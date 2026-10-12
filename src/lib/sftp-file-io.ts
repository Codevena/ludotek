import type { SFTPWrapper, Stats } from "ssh2";
import path from "node:path";
import { Writable, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { FileIoError, IoScope, byteMeter, capability, statType, validLimits, type FileIo, type FileIoCapabilities, type FileEntryStat, type IoLimits, type IoResult, type FreeBytesResult } from "@/lib/file-io";

function unsupported(): never { throw new FileIoError("Safe SFTP mutation is not supported by the evidenced device capabilities", { code: "UNSUPPORTED_CAPABILITY" }); }
export interface SftpNativeStat { identity: string; size: number; mode: number; mtime: number }
export interface SftpNativeMetadata {
  stat(filename: string, signal?: AbortSignal): Promise<SftpNativeStat>;
  realpath(filename: string, signal?: AbortSignal): Promise<string>;
}
function safePath(filename: string): string {
  if (!path.posix.isAbsolute(filename) || /[\x00-\x1f\x7f-\x9f]/.test(filename) || Buffer.byteLength(filename) > 4096) throw new FileIoError("Invalid absolute SFTP path", { code: "INVALID_PATH" });
  return path.posix.normalize(filename);
}
function quote(value: string): string { return `'${safePath(value).replace(/'/g, `'"'"'`)}'`; }
/** GNU stat and realpath are bounded, read-only commands in the existing SSH session. */
export function createSftpNativeMetadata(exec: (command: string, signal?: AbortSignal) => Promise<string>): SftpNativeMetadata {
  const execute = async (command: string, signal?: AbortSignal) => {
    try { return await exec(command, signal); }
    catch (error) {
      if (signal?.aborted) throw error;
      throw new FileIoError("Native SSH metadata commands are unavailable", { code: "NATIVE_METADATA_UNAVAILABLE", cause: error });
    }
  };
  return {
    async stat(filename, signal) {
      const output = await execute(`stat -c '%d:%i:%s:%f:%Y' -- ${quote(filename)}`, signal);
      const match = output.length <= 512 && /^(\d+):(\d+):(\d+):([0-9a-fA-F]+):(-?\d+)\n?$/.exec(output);
      if (!match || BigInt(match[2]) < BigInt(1)) throw new FileIoError("Native SSH stat did not return exact device/inode metadata", { code: "INVALID_NATIVE_STAT" });
      const size = Number(match[3]), mode = Number.parseInt(match[4], 16), mtime = Number(match[5]);
      if (!Number.isSafeInteger(size) || size < 0 || !Number.isSafeInteger(mode) || mode < 0 || mode > 0xffff || !Number.isSafeInteger(mtime)) throw new FileIoError("Native SSH stat integers are not exact", { code: "INVALID_NATIVE_STAT" });
      return { identity: `${match[1]}:${match[2]}`, size, mode, mtime };
    },
    async realpath(filename, signal) {
      const output = await execute(`realpath -e -- ${quote(filename)}`, signal);
      return safePath(output.endsWith("\n") ? output.slice(0, -1) : output);
    },
  };
}
function request<T>(operation: (callback: (error: Error | undefined, value: T) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => operation((error, value) => error ? reject(error) : resolve(value)));
}
function done(operation: (callback: (error?: Error | null) => void) => void): Promise<void> {
  return new Promise((resolve, reject) => operation((error) => error ? reject(error) : resolve()));
}
function contains(root: string, filename: string) { return filename === root || filename.startsWith(root === "/" ? "/" : `${root}/`); }
function same(original: FileEntryStat, actual: FileEntryStat): boolean {
  return !!original.identity && original.identity === actual.identity && original.type === actual.type && original.size === actual.size && original.modifiedAt === actual.modifiedAt;
}

/** OpenSSH extensions plus native SSH metadata; no inferred or invented identity. */
export class SftpFileIo implements FileIo {
  private closed = false;
  private roots?: readonly string[];
  private nativeUnavailable = false;
  private observed = new WeakSet<SFTPWrapper>();
  constructor(private readonly getSftp: () => Promise<SFTPWrapper>, private readonly abortConnection: () => void = () => {}, private readonly nativeMetadata?: SftpNativeMetadata) {}
  private stop = () => { if (!this.closed) { this.closed = true; this.abortConnection(); } };
  private async channel(scope: IoScope): Promise<SFTPWrapper> {
    if (this.closed) throw new FileIoError("SFTP connection was closed", { code: "CONNECTION_CLOSED" });
    scope.check();
    const sftp = await scope.wait(this.getSftp(), (late) => late.end());
    if (!this.observed.has(sftp)) {
      this.observed.add(sftp);
      sftp.once?.("close", () => { this.closed = true; });
      sftp.once?.("end", () => { this.closed = true; });
    }
    if (this.closed) throw new FileIoError("SFTP connection was closed", { code: "CONNECTION_CLOSED" });
    return sftp;
  }
  private async metadata<T>(operation: (sftp: SFTPWrapper, scope: IoScope) => Promise<T>): Promise<T> {
    const scope = new IoScope({ maxBytes: 0, timeoutMs: 10_000 }, this.stop);
    try { return await operation(await this.channel(scope), scope); } finally { scope.dispose(); }
  }
  private async namespace(sftp: SFTPWrapper, scope: IoScope, filename: string): Promise<string> {
    const resolved = safePath(await scope.wait(request<string>((callback) => sftp.realpath(safePath(filename), callback))));
    if (this.nativeMetadata && !this.nativeUnavailable) {
      try {
        const native = await scope.wait(this.nativeMetadata.realpath(filename, scope.signal));
        if (resolved !== native) throw new FileIoError("Native SSH and SFTP namespaces disagree", { code: "NAMESPACE_CONFLICT" });
      } catch (error) {
        if ((error as { code?: string }).code !== "NATIVE_METADATA_UNAVAILABLE") throw error;
        this.nativeUnavailable = true;
      }
    }
    return resolved;
  }
  async checkPath(filename: string, roots: readonly string[], allowMissing = false): Promise<void> {
    const normalized = safePath(filename), configured = roots.map(safePath).filter((root) => contains(root, normalized));
    if (!configured.length) throw new FileIoError("SFTP path is outside the configured roots", { code: "PATH_OUTSIDE_ROOT" });
    await this.metadata(async (sftp, scope) => {
      const resolvedRoots: string[] = [];
      for (const root of configured) resolvedRoots.push(await this.namespace(sftp, scope, root));
      let resolved: string;
      if (allowMissing) {
        const parent = await this.namespace(sftp, scope, path.posix.dirname(normalized));
        resolved = path.posix.join(parent, path.posix.basename(normalized));
        let present = true;
        try { await scope.wait(request<Stats>((callback) => sftp.lstat(normalized, callback))); }
        catch (error) {
          if ((error as { code?: number | string }).code !== 2 && (error as { code?: string }).code !== "ENOENT") throw error;
          present = false;
        }
        // OpenSSH v3 REALPATH can succeed for an absent final entry. Compare
        // the actual existing parent namespaces; native realpath -e cannot
        // resolve an absent target and must not disable native capabilities.
        if (present) resolved = await this.namespace(sftp, scope, normalized);
      } else resolved = await this.namespace(sftp, scope, normalized);
      if (!resolvedRoots.some((root) => contains(root, resolved))) throw new FileIoError("Resolved SFTP path escapes the configured roots", { code: "PATH_OUTSIDE_ROOT" });
    });
    this.roots = [...roots];
  }
  private async guard(filename: string, allowMissing = false) {
    safePath(filename);
    if (this.roots) await this.checkPath(filename, this.roots, allowMissing);
  }
  private async entry(sftp: SFTPWrapper, scope: IoScope, filename: string): Promise<FileEntryStat> {
    const stats = await scope.wait(request<Stats>((callback) => sftp.lstat(safePath(filename), callback)));
    if (!Number.isSafeInteger(stats.size) || stats.size < 0 || !Number.isSafeInteger(stats.mode) || !Number.isSafeInteger(stats.mtime)) throw new FileIoError("SFTP metadata integers are not exact", { code: "INVALID_STAT" });
    let identity: string | undefined;
    if (this.nativeMetadata && !this.nativeUnavailable) {
      await this.namespace(sftp, scope, path.posix.dirname(filename));
      if (!this.nativeUnavailable) {
        try {
          const native = await scope.wait(this.nativeMetadata.stat(filename, scope.signal));
          const after = await scope.wait(request<Stats>((callback) => sftp.lstat(filename, callback)));
          if (native.size !== stats.size || native.mode !== stats.mode || native.mtime !== stats.mtime || after.size !== stats.size || after.mode !== stats.mode || after.mtime !== stats.mtime) throw new FileIoError("Native SSH and SFTP metadata disagree or changed", { code: "IDENTITY_CONFLICT" });
          identity = native.identity;
        } catch (error) {
          if ((error as { code?: string }).code !== "NATIVE_METADATA_UNAVAILABLE") throw error;
          this.nativeUnavailable = true;
        }
      }
    }
    return { size: stats.size, modifiedAt: new Date(stats.mtime * 1000).toISOString(), isDirectory: stats.isDirectory(), type: statType(stats), identity };
  }
  private hasExtension(sftp: SFTPWrapper, name: string, version = "1") {
    // Installed ssh2 exposes the actual parsed VERSION negotiation here.
    return (sftp as SFTPWrapper & { _extensions?: Record<string, string> })._extensions?.[name] === version;
  }
  async capabilities(parent: string): Promise<FileIoCapabilities> {
    let hardlink = capability("unknown", "Native SSH metadata has not been provided"), fsync = hardlink, directory = hardlink;
    let space: FreeBytesResult = { state: "unknown", reason: "Actual statvfs has not succeeded" };
    if (this.nativeMetadata) {
      await this.guard(parent);
      await this.metadata(async (sftp, scope) => {
        await this.namespace(sftp, scope, parent);
        const parentStat = await this.entry(sftp, scope, parent);
        if (parentStat.type !== "directory") throw new FileIoError("SFTP mutation parent is not a directory");
        if (!parentStat.identity) {
          hardlink = fsync = directory = capability("unsupported", "Native SSH metadata/namespace commands are unavailable; ownership cannot be proven");
          return;
        }
        hardlink = capability(this.hasExtension(sftp, "hardlink@openssh.com") ? "supported" : "unsupported", "Actual SFTP VERSION hardlink@openssh.com version 1 negotiation");
        fsync = capability(this.hasExtension(sftp, "fsync@openssh.com") ? "supported" : "unsupported", "Actual SFTP VERSION fsync@openssh.com version 1 negotiation");
        directory = capability("unsupported", "An actual READ directory OPEN/FSTAT/fsync must succeed");
        if (fsync.state === "supported") {
          try { await this.flushHandle(sftp, scope, parent, "directory"); directory = capability("supported", "READ directory OPEN, FSTAT and fsync succeeded without writing content"); }
          catch (error) { scope.check(); directory = capability("unsupported", `Directory fsync failed: ${(error as Error).message}`); }
        }
      });
      space = await this.freeBytes(parent);
    }
    return {
      readStream: capability("supported", "SFTP bounded read stream"),
      exclusiveTemp: capability("supported", "SFTP v3 CREAT | EXCL on one retained handle; mutation still requires native metadata and flush"),
      publishNoReplace: hardlink, renameNoReplace: hardlink, fileFlush: fsync, directoryFlush: directory,
      freeBytes: capability(space.state === "known" ? "supported" : "unknown", space.state === "known" ? "Actual available-block statvfs count" : space.reason),
      directoryCreate: directory, directoryRemoveEmpty: directory,
    };
  }
  async lstat(filename: string): Promise<FileEntryStat> {
    // Inspect the final symlink entry instead of following it; mutation guards resolve it.
    safePath(filename);
    try { return await this.metadata((sftp, scope) => this.entry(sftp, scope, filename)); }
    catch (error) {
      if ((error as { code?: unknown }).code === 2) throw new FileIoError("SFTP directory entry does not exist", { code: "ENOENT", cause: error });
      throw error;
    }
  }
  async readTo(filename: string, destination: Writable, limits: IoLimits): Promise<IoResult> {
    const scope = new IoScope(limits, this.stop);
    try {
      const sftp = await this.channel(scope);
      await scope.wait(this.guard(filename));
      if (this.nativeMetadata && (await this.entry(sftp, scope, filename)).type !== "file") throw new FileIoError("SFTP read requires a regular file, not a symlink/directory");
      const meter = byteMeter(limits);
      await scope.run(() => pipeline(sftp.createReadStream(filename), meter.stream, destination, { signal: scope.signal }));
      return meter.result();
    } finally { scope.dispose(); }
  }
  private async requireMutation(parent: string) {
    if (!this.nativeMetadata) unsupported();
    const caps = await this.capabilities(parent);
    if ([caps.publishNoReplace, caps.fileFlush, caps.directoryFlush].some((item) => item.state !== "supported")) unsupported();
  }
  private async flushHandle(sftp: SFTPWrapper, scope: IoScope, filename: string, type: "file" | "directory") {
    if (!this.hasExtension(sftp, "fsync@openssh.com")) unsupported();
    await this.namespace(sftp, scope, type === "directory" ? filename : path.posix.dirname(filename));
    const entry = await this.entry(sftp, scope, filename);
    if (entry.type !== type || !entry.identity) throw new FileIoError(`SFTP flush requires an evidenced regular ${type}`);
    const handle = await scope.run(() => request<Buffer>((callback) => sftp.open(filename, "r", callback)));
    try {
      const stats = await scope.run(() => request<Stats>((callback) => sftp.fstat(handle, callback)));
      if (statType(stats) !== type || stats.size !== entry.size || new Date(stats.mtime * 1000).toISOString() !== entry.modifiedAt) throw new FileIoError("SFTP flush handle changed", { code: "IDENTITY_CONFLICT" });
      await scope.run(() => done((callback) => sftp.ext_openssh_fsync(handle, callback)));
      if (!same(entry, await this.entry(sftp, scope, filename))) throw new FileIoError("SFTP flush entry identity changed", { code: "IDENTITY_CONFLICT" });
    } finally { if (!this.closed && !scope.signal.aborted) await done((callback) => sftp.close(handle, callback)); }
  }
  async writeExclusiveTempFrom(filename: string, source: Readable, limits: IoLimits): Promise<IoResult> {
    validLimits(limits);
    if (!this.nativeMetadata) unsupported();
    const scope = new IoScope(limits, this.stop);
    let sftp: SFTPWrapper | undefined, handle: Buffer | undefined, created = false, destination: Writable | undefined;
    const pending = new Set<Promise<void>>();
    try {
      await scope.wait(this.guard(filename, true));
      await scope.wait(this.requireMutation(path.posix.dirname(filename)));
      sftp = await this.channel(scope);
      await scope.run(async () => {
        handle = await request<Buffer>((callback) => sftp!.open(filename, "wx", { mode: 0o600 }, callback));
        created = true;
      });
      scope.check();
      let position = 0;
      destination = new Writable({
        write(data: Buffer, _encoding, callback) {
          const written = done((finish) => sftp!.write(handle!, data, 0, data.length, position, finish)); position += data.length;
          pending.add(written); written.then(() => { pending.delete(written); callback(); }, (error) => { pending.delete(written); callback(error); });
        },
      });
      const meter = byteMeter(limits);
      await scope.run(() => pipeline(source, meter.stream, destination!, { signal: scope.signal }));
      await scope.run(() => done((callback) => sftp!.ext_openssh_fsync(handle!, callback)));
      await scope.run(() => done((callback) => sftp!.close(handle!, callback))); handle = undefined;
      await scope.run(() => this.flushDirectory(path.posix.dirname(filename)));
      return meter.result();
    } catch (error) {
      const actual = scope.signal.aborted ? scope.signal.reason : error;
      if (created) throw new FileIoError((actual as Error).message, { code: (actual as { code?: string }).code, tempCreated: true, cause: actual });
      throw actual;
    } finally {
      destination?.destroy(); await Promise.allSettled([...pending]);
      // ssh2 queues callbacks forever when CLOSE is submitted after channel teardown.
      // The disconnected server owns handle cleanup; drain outstanding writes above.
      try { if (handle && sftp && !this.closed) await done((callback) => sftp!.close(handle!, callback)).catch(() => {}); } finally { scope.dispose(); }
    }
  }
  async publishFileNoReplace(temp: string, target: string): Promise<void> { return this.renameNoReplace(temp, target); }
  async renameNoReplace(source: string, target: string): Promise<void> {
    if (!this.nativeMetadata) unsupported();
    await this.guard(source); await this.guard(target, true);
    const original = await this.lstat(source);
    if (original.type !== "file" || !original.identity) throw new FileIoError("SFTP no-replace publication requires a regular file with native identity");
    for (const parent of new Set([path.posix.dirname(source), path.posix.dirname(target)])) await this.requireMutation(parent);
    await this.metadata(async (sftp, scope) => {
      try { await scope.run(() => done((callback) => sftp.ext_openssh_hardlink(source, target, callback))); }
      catch (error) {
        // A received SFTP STATUS is authoritative rejection. A lost response can
        // mean the target already exists and must remain a recovery conflict.
        if (typeof (error as { code?: unknown }).code === "number") throw error;
        throw new FileIoError("SFTP hardlink acknowledgement was lost; preserve possible target and original source", { code: "PUBLICATION_UNCERTAIN", published: true, sourceRetained: true, cause: error });
      }
      let sourceRetained = true;
      try {
        const check = async () => {
          if (!same(original, await this.entry(sftp, scope, source)) || !same(original, await this.entry(sftp, scope, target))) throw new FileIoError("Source/target native identity changed; preserve both for recovery", { code: "IDENTITY_CONFLICT" });
        };
        await check(); await this.flushDirectory(path.posix.dirname(target)); await check();
        await scope.run(() => done((callback) => sftp.unlink(source, callback))); sourceRetained = false;
        await this.flushDirectory(path.posix.dirname(source));
      } catch (error) { throw new FileIoError("SFTP publication created a target but unlink/flush needs journal recovery", { code: (error as { code?: string }).code, published: true, sourceRetained, cause: error }); }
    });
  }
  async flushDirectory(dirname: string): Promise<void> {
    if (!this.nativeMetadata) unsupported();
    await this.guard(dirname); return this.metadata((sftp, scope) => this.flushHandle(sftp, scope, dirname, "directory"));
  }
  async flushFile(filename: string): Promise<void> {
    if (!this.nativeMetadata) unsupported();
    await this.guard(filename); return this.metadata((sftp, scope) => this.flushHandle(sftp, scope, filename, "file"));
  }
  async createDirectoryNoReplace(filename: string): Promise<FileEntryStat> {
    if (!this.nativeMetadata) unsupported();
    await this.guard(filename, true); await this.requireMutation(path.posix.dirname(filename));
    return this.metadata(async (sftp, scope) => {
      await scope.run(() => done((callback) => sftp.mkdir(filename, { mode: 0o700 }, callback)));
      let identity: string | undefined;
      try {
        const created = await this.entry(sftp, scope, filename); identity = created.identity;
        if (created.type !== "directory" || !identity) throw new FileIoError("Created SFTP directory lacks native identity");
        await this.flushDirectory(filename); await this.flushDirectory(path.posix.dirname(filename));
        const current = await this.entry(sftp, scope, filename);
        if (current.type !== "directory" || current.identity !== identity) throw new FileIoError("Created SFTP directory changed", { code: "IDENTITY_CONFLICT" });
        return current;
      } catch (error) { throw new FileIoError("SFTP directory creation needs recovery", { code: "DIRECTORY_CREATE_PARTIAL", published: true, createdIdentity: identity, cause: error }); }
    });
  }
  async removeEmptyDirectory(filename: string, expectedIdentity: string): Promise<void> {
    if (!this.nativeMetadata) unsupported();
    await this.guard(filename); await this.requireMutation(path.posix.dirname(filename)); const entry = await this.lstat(filename);
    if (entry.type !== "directory" || !entry.identity || entry.identity !== expectedIdentity) throw new FileIoError("Directory ownership changed; preserve it", { code: "IDENTITY_CONFLICT" });
    await this.metadata(async (sftp, scope) => { await scope.run(() => done((callback) => sftp.rmdir(filename, callback))); await this.flushDirectory(path.posix.dirname(filename)); });
  }
  async freeBytes(filename: string): Promise<FreeBytesResult> {
    const scope = new IoScope({ maxBytes: 0, timeoutMs: 10_000 }, this.stop);
    try {
      const sftp = await this.channel(scope);
      const info = await scope.wait(new Promise<{ f_bavail: unknown; f_frsize: unknown }>((resolve, reject) => sftp.ext_openssh_statvfs(filename, (error, stats) => error ? reject(error) : resolve(stats))));
      const integer = (value: unknown) => typeof value === "bigint" ? value : typeof value === "number" && Number.isSafeInteger(value) ? BigInt(value) : undefined;
      const available = integer(info.f_bavail), size = integer(info.f_frsize);
      if (available === undefined || available < BigInt(0) || size === undefined || size < BigInt(1)) throw new Error("Invalid statvfs");
      return { state: "known", bytes: available * size };
    } catch { return { state: "unknown", reason: "SFTP statvfs unavailable or inexact" }; }
    finally { scope.dispose(); }
  }
}
