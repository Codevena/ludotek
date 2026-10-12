import path from "node:path";
import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Client as FtpClient } from "basic-ftp";
import { FileIoError, IoScope, byteMeter, capability, validLimits } from "@/lib/file-io";
import type { CheckedFtpMutations, FileIo, FileIoCapabilities, FileEntryStat, IoLimits, IoResult, FreeBytesResult } from "@/lib/file-io";

function unsupported(operation: string): never {
  throw new FileIoError(`Safe ${operation} is not supported by the evidenced device capabilities`, { code: "UNSUPPORTED_CAPABILITY" });
}

function checkedPath(filename: string): string {
  if (typeof filename !== "string" || filename.length > 4096 || !filename.startsWith("/") || path.posix.normalize(filename) !== filename
    || /[\x00-\x1f\x7f-\x9f\\]/.test(filename)) {
    throw new FileIoError("FTP requires an absolute normalized path without control characters or traversal", { code: "INVALID_PATH" });
  }
  return filename;
}
function receiptMarker(filename: string, receipt: string) {
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(receipt)) throw new FileIoError("Invalid bounded FTP directory receipt", { code: "INVALID_RECEIPT" });
  return path.posix.join(checkedPath(filename), `.ludotek-directory-receipt-${receipt}`);
}
function sameEntry(before: FileEntryStat, after: FileEntryStat) {
  return before.type === after.type && before.size === after.size && before.modifiedAt === after.modifiedAt && before.uniqueId === after.uniqueId;
}
function replyCode(error: unknown): number | undefined {
  const code = (error as { code?: unknown } | undefined)?.code;
  return typeof code === "number" && code >= 400 && code <= 599 ? code : undefined;
}

export class FtpFileIo implements FileIo {
  private busy = false;
  private closed = false;
  /** Approved private-LAN policy: checks plus server ACK, without atomic RNTO or disk durability. */
  readonly checked: CheckedFtpMutations = Object.freeze({
    policy: "ftp_checked",
    durability: "server_ack",
    writeTempFrom: (filename: string, source: Readable, limits: IoLimits) => this.writeCheckedTemp(filename, source, limits),
    publish: (temp: string, target: string) => this.renameChecked(temp, target),
    rename: (source: string, target: string) => this.renameChecked(source, target),
    acknowledgeFile: (filename: string) => this.acknowledge(filename, "file"),
    acknowledgeDirectory: (dirname: string) => this.acknowledge(dirname, "directory"),
    createDirectory: (filename: string, receipt: string) => this.createCheckedDirectory(filename, receipt),
    removeEmptyDirectory: (filename: string, receipt: string) => this.removeCheckedDirectory(filename, receipt),
  });
  constructor(private readonly client: FtpClient) {}
  private stop = () => {
    if (!this.closed) { this.closed = true; this.client.close(); }
  };
  async runCommand<T>(operation: () => Promise<T>): Promise<T> {
    if (this.closed) throw new FileIoError("FTP connection was closed", { code: "CONNECTION_CLOSED" });
    if (this.busy) throw new FileIoError("This FTP client already has an active operation", { code: "FTP_BUSY" });
    this.busy = true;
    try { return await operation(); } finally { this.busy = false; }
  }
  async capabilities(parentPath: string): Promise<FileIoCapabilities> {
    void parentPath;
    return {
      readStream: capability("supported", "basic-ftp downloadTo(Writable), one command at a time, with a total stream deadline"),
      exclusiveTemp: capability("unsupported", "FTP STOR overwrites and basic-ftp has no exclusive-create primitive"),
      publishNoReplace: capability("unsupported", "FTP RNTO has no atomic no-replace guarantee; use the explicit checked policy"),
      renameNoReplace: capability("unsupported", "FTP RNTO is not an atomic no-replacement rename; checked policy assumes no concurrent external writer"),
      fileFlush: capability("unsupported", "FTP has no evidenced durable file flush command"),
      directoryFlush: capability("unsupported", "FTP has no evidenced durable directory flush command"),
      freeBytes: capability("unknown", "FTP supplies no portable available-space query"),
      directoryCreate: capability("unsupported", "Strict ownership/durability is unavailable; checked creation uses a persisted receipt"),
      directoryRemoveEmpty: capability("unsupported", "Strict native directory ownership is unavailable; checked empty-only removal uses its receipt"),
    };
  }
  async lstat(filename: string): Promise<FileEntryStat> {
    return this.runCommand(async () => {
      const scope = new IoScope({ maxBytes: 0, timeoutMs: 10_000 }, this.stop);
      try {
        return await this.statEntry(checkedPath(filename), scope);
      } finally { scope.dispose(); }
    });
  }
  private async statEntry(filename: string, scope: IoScope): Promise<FileEntryStat> {
    const items = await scope.wait(this.client.list(path.posix.dirname(filename)));
    const entry = items.find((item) => item.name === path.posix.basename(filename));
    if (!entry) throw new FileIoError("FTP directory entry does not exist", { code: "ENOENT" });
    if (!Number.isSafeInteger(entry.size) || entry.size < 0) throw new FileIoError("FTP size cannot be represented exactly", { code: "INVALID_SIZE" });
    return {
      size: entry.size, modifiedAt: entry.modifiedAt?.toISOString(), isDirectory: entry.isDirectory,
      type: entry.isSymbolicLink ? "symlink" : entry.isDirectory ? "directory" : entry.isFile ? "file" : "other",
      ...(entry.uniqueID === undefined ? {} : { uniqueId: entry.uniqueID }),
    };
  }
  private async absent(filename: string, scope: IoScope) {
    try { await this.statEntry(filename, scope); }
    catch (error) { if ((error as { code?: string }).code === "ENOENT") return; throw error; }
    throw new FileIoError("FTP target already exists; preserve it", { code: "EEXIST" });
  }
  async checkPath(filename: string, roots: readonly string[], allowMissing = false): Promise<void> {
    checkedPath(filename);
    const root = roots.map(checkedPath).filter((candidate) => filename === candidate || filename.startsWith(candidate === "/" ? "/" : candidate + "/"))
      .sort((a, b) => b.length - a.length)[0];
    if (!root) throw new FileIoError("FTP path is outside the configured logical roots", { code: "PATH_OUTSIDE_ROOT" });
    await this.runCommand(async () => {
      const scope = new IoScope({ maxBytes: 0, timeoutMs: 10_000 }, this.stop);
      try {
        // FTP has no realpath/no-follow proof. Reject links only when the server advertises them.
        const components = filename.slice(root === "/" ? 1 : root.length + 1).split("/").filter(Boolean);
        const ancestors = root === "/" ? [] : [root];
        let current = root;
        for (const component of components) { current = path.posix.join(current, component); ancestors.push(current); }
        for (const candidate of ancestors) {
          let entry: FileEntryStat;
          try { entry = await this.statEntry(candidate, scope); }
          catch (error) {
            if (allowMissing && candidate === filename && (error as { code?: string }).code === "ENOENT") return;
            throw error;
          }
          if (entry.type === "symlink" || (candidate !== filename && entry.type !== "directory")) {
            throw new FileIoError("FTP path advertises a symlink or non-directory ancestor", { code: "INVALID_PATH" });
          }
        }
      } finally { scope.dispose(); }
    });
  }
  /** Raw command ACK is evidence of server acceptance, never stable-storage flush. */
  private async mutate(command: string, scope: IoScope): Promise<void> {
    scope.check();
    try { await scope.run(async () => { await this.client.send(command); }); }
    catch (error) {
      if (replyCode(error) !== undefined) throw error;
      this.stop();
      throw new FileIoError("FTP mutation reply was lost; preserve its unknown effect for journal recovery", { code: "EFFECT_UNKNOWN", cause: error });
    }
  }
  private async upload(filename: string, source: Readable, limits: IoLimits, scope: IoScope): Promise<IoResult> {
    const meter = byteMeter(limits);
    const onError = this.stop;
    meter.stream.once("error", onError);
    source.once("error", onError);
    let transfer: Promise<unknown> | undefined;
    let drain: Promise<void> | undefined;
    try {
      scope.check();
      // uploadFrom attaches its error listeners synchronously before the source is piped.
      transfer = this.client.uploadFrom(meter.stream, filename).catch((error) => {
        meter.stream.destroy(error);
        source.destroy(error);
        this.stop();
        throw error;
      });
      drain = pipeline(source, meter.stream, { signal: scope.signal });
      await scope.run(async () => {
        const [uploaded, piped] = await Promise.allSettled([transfer!, drain!]);
        if (piped.status === "rejected") throw piped.reason;
        if (uploaded.status === "rejected") throw uploaded.reason;
      });
      return meter.result();
    } catch (error) {
      const failure = error instanceof Error ? error : new Error("FTP upload failed");
      source.destroy(failure);
      meter.stream.destroy(failure);
      this.stop();
      await Promise.allSettled([transfer, drain]);
      const known = error instanceof FileIoError || replyCode(error) !== undefined;
      throw new FileIoError(known ? failure.message : "FTP upload reply was lost; preserve the possible partial or complete file", {
        code: error instanceof FileIoError ? error.code : replyCode(error) === undefined ? "EFFECT_UNKNOWN" : `FTP_${replyCode(error)}`,
        tempCreated: true, cause: error,
      });
    } finally {
      source.removeListener("error", onError);
      meter.stream.removeListener("error", onError);
    }
  }
  private async writeCheckedTemp(filename: string, source: Readable, limits: IoLimits): Promise<IoResult> {
    validLimits(limits);
    checkedPath(filename);
    if (!/^\.ludotek-[A-Za-z0-9_-]{16,}$/.test(path.posix.basename(filename))) {
      throw new FileIoError("Checked FTP staging requires a generated private .ludotek- namespace", { code: "INVALID_PATH" });
    }
    return this.runCommand(async () => {
      const scope = new IoScope(limits, this.stop);
      try {
        // Nonrecursive raw MKD must succeed: never ensureDir, adopt, or remove a prior reservation.
        await this.mutate(`MKD ${filename}.reservation`, scope);
        await this.absent(filename, scope);
        return await this.upload(filename, source, limits, scope);
      } finally { scope.dispose(); }
    });
  }
  private async renameChecked(source: string, target: string): Promise<void> {
    checkedPath(source); checkedPath(target);
    await this.runCommand(async () => {
      const scope = new IoScope({ maxBytes: 0, timeoutMs: 10_000 }, this.stop);
      try {
        const original = await this.statEntry(source, scope);
        if (original.type !== "file") throw new FileIoError("Checked FTP rename requires a regular file", { code: "INVALID_TYPE" });
        await this.absent(target, scope);
        if (!sameEntry(original, await this.statEntry(source, scope))) throw new FileIoError("FTP source metadata changed before rename", { code: "PRECONDITION_CHANGED" });
        await this.mutate(`RNFR ${source}`, scope);
        // RNTO can overwrite a target introduced now. This is the expressly approved
        // non-atomic policy and assumes no concurrent external writer; the journal hashes.
        await this.mutate(`RNTO ${target}`, scope);
      } finally { scope.dispose(); }
    });
  }
  private async acknowledge(filename: string, expected: "file" | "directory") {
    const entry = await this.lstat(checkedPath(filename));
    if (entry.type !== expected) throw new FileIoError("FTP acknowledged entry has the wrong type", { code: "INVALID_TYPE" });
  }
  private async createCheckedDirectory(filename: string, receipt: string): Promise<FileEntryStat> {
    const marker = receiptMarker(filename, receipt);
    if (filename === "/") throw new FileIoError("Cannot create FTP root", { code: "INVALID_PATH" });
    return this.runCommand(async () => {
      const limits = { maxBytes: receipt.length, expectedBytes: receipt.length, timeoutMs: 10_000 };
      const scope = new IoScope(limits, this.stop);
      try {
        await this.mutate(`MKD ${filename}`, scope);
        await this.absent(marker, scope);
        await this.upload(marker, Readable.from([receipt]), limits, scope);
        const created = await this.statEntry(filename, scope);
        if (created.type !== "directory") throw new FileIoError("New FTP directory changed type", { code: "IDENTITY_CONFLICT" });
        return created;
      } finally { scope.dispose(); }
    });
  }
  private async removeCheckedDirectory(filename: string, receipt: string): Promise<void> {
    const marker = receiptMarker(filename, receipt);
    await this.runCommand(async () => {
      const scope = new IoScope({ maxBytes: receipt.length, timeoutMs: 10_000 }, this.stop);
      try {
        const directory = await this.statEntry(filename, scope);
        if (directory.type !== "directory") throw new FileIoError("FTP receipt directory changed type", { code: "IDENTITY_CONFLICT" });
        const entries = await scope.wait(this.client.list(filename));
        if (entries.length !== 1 || entries[0].name !== path.posix.basename(marker)) {
          throw new FileIoError("FTP directory has user or foreign entries; preserve it", { code: "ENOTEMPTY" });
        }
        if (!entries[0].isFile || entries[0].size !== receipt.length) throw new FileIoError("FTP directory receipt changed", { code: "IDENTITY_CONFLICT" });
        const chunks: Buffer[] = [];
        const destination = new Writable({ write(chunk, _encoding, callback) {
          const bytes = chunks.reduce((total, item) => total + item.length, 0);
          if (chunk.length > receipt.length - bytes) { callback(new FileIoError("FTP receipt exceeds its bound", { code: "IDENTITY_CONFLICT" })); return; }
          chunks.push(Buffer.from(chunk)); callback();
        } });
        await scope.run(() => this.client.downloadTo(destination, marker));
        if (Buffer.concat(chunks).toString("utf8") !== receipt) throw new FileIoError("FTP directory receipt content changed", { code: "IDENTITY_CONFLICT" });
        // RMD is nonrecursive and refuses files created after the listing. A failed/lost
        // delete/rmdir leaves uncertain state for the journal, never recursive cleanup.
        await this.mutate(`DELE ${marker}`, scope);
        await this.mutate(`RMD ${filename}`, scope);
      } finally { scope.dispose(); }
    });
  }
  async readTo(filename: string, destination: Writable, limits: IoLimits): Promise<IoResult> {
    return this.runCommand(async () => {
      const scope = new IoScope(limits, this.stop);
      const meter = byteMeter(limits);
      const drain = pipeline(meter.stream, destination, { signal: scope.signal });
      const onError = this.stop;
      meter.stream.once("error", onError);
      destination.once("error", onError);
      let transfer: Promise<unknown> | undefined;
      try {
        scope.check();
        transfer = this.client.downloadTo(meter.stream, filename).catch((error) => {
          meter.stream.destroy(error);
          destination.destroy(error);
          this.stop();
          throw error;
        });
        await scope.run(async () => {
          const [download, piped] = await Promise.allSettled([transfer!, drain]);
          if (download.status === "rejected") throw download.reason;
          if (piped.status === "rejected") throw piped.reason;
        });
        return meter.result();
      } catch (error) {
        meter.stream.destroy(error instanceof Error ? error : new Error("FTP read failed"));
        destination.destroy(error instanceof Error ? error : new Error("FTP read failed"));
        this.stop();
        await Promise.allSettled([transfer, drain]);
        throw error;
      } finally {
        scope.dispose();
        meter.stream.removeListener("error", onError);
        destination.removeListener("error", onError);
      }
    });
  }
  async writeExclusiveTempFrom(_filename: string, _source: Readable, limits: IoLimits): Promise<IoResult> {
    validLimits(limits);
    return unsupported("exclusive FTP temporary write");
  }
  async publishFileNoReplace(temp: string, target: string): Promise<void> { void temp; void target; unsupported("FTP no-replace publication"); }
  async renameNoReplace(source: string, target: string): Promise<void> { void source; void target; unsupported("FTP no-replace rename"); }
  async flushDirectory(dirname: string): Promise<void> { void dirname; unsupported("FTP directory flush"); }
  async freeBytes(filename: string): Promise<FreeBytesResult> { void filename; return { state: "unknown", reason: "FTP has no evidenced available-space query" }; }
}
