import { constants } from "node:fs";
import * as fs from "node:fs/promises";
import path from "node:path";
import { Readable, Transform, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getLocalFilesRoots, resolveLocalPath } from "@/lib/local-paths";

export interface IoLimits {
  signal?: AbortSignal;
  maxBytes: number;
  timeoutMs: number;
  expectedBytes?: number;
  onProgress?: (bytes: number) => void;
}
export interface IoResult { bytes: number }
export interface FileEntryStat {
  /** Transport-evidenced identity; absent when ownership cannot be proven. */
  readonly identity?: string;
  /** FTP MLSD fact: observed server value, not a durable cross-session identity. */
  readonly uniqueId?: string;
  size: number;
  modifiedAt?: string;
  isDirectory: boolean;
  type: "file" | "directory" | "symlink" | "other";
}
export interface FileIoCapability {
  state: "supported" | "unsupported" | "unknown";
  reason: string;
}
export interface FileIoCapabilities {
  readStream: FileIoCapability;
  exclusiveTemp: FileIoCapability;
  publishNoReplace: FileIoCapability;
  renameNoReplace: FileIoCapability;
  fileFlush: FileIoCapability;
  directoryFlush: FileIoCapability;
  freeBytes: FileIoCapability;
  directoryCreate?: FileIoCapability;
  directoryRemoveEmpty?: FileIoCapability;
}
export type FreeBytesResult = { state: "known"; bytes: bigint } | { state: "unknown"; reason: string };
export interface CheckedFtpMutations {
  readonly policy: "ftp_checked";
  readonly durability: "server_ack";
  writeTempFrom(filename: string, source: Readable, limits: IoLimits): Promise<IoResult>;
  publish(temp: string, target: string): Promise<void>;
  rename(source: string, target: string): Promise<void>;
  acknowledgeFile(filename: string): Promise<void>;
  acknowledgeDirectory(dirname: string): Promise<void>;
  createDirectory(filename: string, receipt: string): Promise<FileEntryStat>;
  removeEmptyDirectory(filename: string, receipt: string): Promise<void>;
}

export interface FileIo {
  /** Explicit weaker private-LAN policy; never promotes FTP to atomic/native fsync. */
  readonly checked?: CheckedFtpMutations;
  /** Read-only path validation against the plan's authoritative configured roots. */
  checkPath?(filename: string, roots: readonly string[], allowMissing?: boolean): Promise<void>;
  capabilities(parentPath: string): Promise<FileIoCapabilities>;
  lstat(filename: string): Promise<FileEntryStat>;
  readTo(filename: string, destination: Writable, limits: IoLimits): Promise<IoResult>;
  writeExclusiveTempFrom(filename: string, source: Readable, limits: IoLimits): Promise<IoResult>;
  /** Regular files only. Link is atomic and no-clobber; unlink is a separate journal step. */
  publishFileNoReplace(temp: string, target: string): Promise<void>;
  /** Regular files only; callers must handle the possible two-link intermediate state. */
  renameNoReplace(source: string, target: string): Promise<void>;
  flushDirectory(dirname: string): Promise<void>;
  flushFile?(filename: string): Promise<void>;
  createDirectoryNoReplace?(filename: string): Promise<FileEntryStat>;
  removeEmptyDirectory?(filename: string, expectedIdentity: string): Promise<void>;
  freeBytes(filename: string): Promise<FreeBytesResult>;
}

/** Failure metadata describes effects that cannot be rolled back by this transport. */
export class FileIoError extends Error {
  readonly code: string;
  readonly published: boolean;
  readonly sourceRetained: boolean;
  readonly tempCreated: boolean;
  readonly createdIdentity?: string;
  constructor(message: string, options: { code?: string; published?: boolean; sourceRetained?: boolean; tempCreated?: boolean; createdIdentity?: string; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = "FileIoError";
    this.code = options.code ?? "FILE_IO_ERROR";
    this.published = options.published ?? false;
    this.sourceRetained = options.sourceRetained ?? false;
    this.tempCreated = options.tempCreated ?? false;
    this.createdIdentity = options.createdIdentity;
  }
}

export function capability(state: FileIoCapability["state"], reason: string): FileIoCapability { return { state, reason }; }
function unsupported(operation: string): never {
  throw new FileIoError(`Safe ${operation} is not supported by the evidenced device capabilities`, { code: "UNSUPPORTED_CAPABILITY" });
}
export function validLimits(limits: IoLimits) {
  if (!Number.isSafeInteger(limits.maxBytes) || limits.maxBytes < 0 || !Number.isSafeInteger(limits.timeoutMs) || limits.timeoutMs < 1 || limits.timeoutMs > 3_600_000
    || (limits.expectedBytes !== undefined && (!Number.isSafeInteger(limits.expectedBytes) || limits.expectedBytes < 0 || limits.expectedBytes > limits.maxBytes))) {
    throw new FileIoError("Invalid bounded stream byte/deadline limits", { code: "INVALID_LIMITS" });
  }
}

/** Abort requests cleanup immediately, but completion waits for pipeline/driver drain. */
export class IoScope {
  readonly controller = new AbortController();
  readonly signal = this.controller.signal;
  private readonly timer: ReturnType<typeof setTimeout>;
  private readonly abortExternal: () => void;
  private readonly abortRemote: () => void;
  constructor(private readonly limits: IoLimits, onAbort: () => void = () => {}) {
    validLimits(limits);
    this.abortRemote = onAbort;
    this.signal.addEventListener("abort", this.abortRemote, { once: true });
    this.abortExternal = () => this.controller.abort(new FileIoError("File I/O aborted", { code: "ABORT_ERR" }));
    limits.signal?.addEventListener("abort", this.abortExternal, { once: true });
    this.timer = setTimeout(() => this.controller.abort(new FileIoError(`File I/O timed out after ${limits.timeoutMs}ms`, { code: "IO_TIMEOUT" })), limits.timeoutMs);
    if (limits.signal?.aborted) this.abortExternal();
  }
  check() { if (this.signal.aborted) throw this.signal.reason; }
  async run<T>(operation: () => Promise<T>): Promise<T> {
    this.check();
    try {
      const result = await operation();
      this.check();
      return result;
    } catch (error) {
      if (this.signal.aborted) throw this.signal.reason;
      throw error;
    }
  }
  /** Only acquisition/read-only metadata: late channels are closed without starting I/O. */
  async wait<T>(pending: Promise<T>, late?: (value: T) => void): Promise<T> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const abort = () => { settled = true; reject(this.signal.reason); };
      this.signal.addEventListener("abort", abort, { once: true });
      pending.then((value) => {
        this.signal.removeEventListener("abort", abort);
        if (settled || this.signal.aborted) { late?.(value); return; }
        settled = true;
        resolve(value);
      }, (error) => {
        this.signal.removeEventListener("abort", abort);
        if (!settled) { settled = true; reject(error); }
      });
      if (this.signal.aborted) abort();
    });
  }
  dispose() {
    clearTimeout(this.timer);
    this.limits.signal?.removeEventListener("abort", this.abortExternal);
    this.signal.removeEventListener("abort", this.abortRemote);
  }
}

export function byteMeter(limits: IoLimits): { stream: Transform; result: () => IoResult } {
  let bytes = 0;
  const stream = new Transform({
    transform(chunk: Buffer | string, encoding, callback) {
      const size = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, encoding);
      if (size > limits.maxBytes - bytes) return callback(new FileIoError("File stream exceeds its byte limit", { code: "BYTE_LIMIT" }));
      bytes += size;
      try { limits.onProgress?.(bytes); } catch (error) { return callback(error as Error); }
      callback(null, chunk);
    },
    flush(callback) {
      if (limits.expectedBytes !== undefined && bytes !== limits.expectedBytes) {
        return callback(new FileIoError("File stream size does not match expected bytes", { code: "SIZE_MISMATCH" }));
      }
      callback();
    },
  });
  return { stream, result: () => ({ bytes }) };
}

async function localEntryPath(filename: string, destructive = false): Promise<string> {
  const safe = await resolveLocalPath(filename, { destructive });
  const roots = await getLocalFilesRoots();
  if (roots.includes(safe)) return safe;
  // Preserve the final entry instead of following an in-root final symlink.
  return path.join(await resolveLocalPath(path.dirname(path.resolve(filename))), path.basename(filename));
}

/** lstat inspects an allowed entry, including a link whose target is outside.
 * Only its parent is resolved; read/write operations still guard the target.
 */
async function localMetadataPath(filename: string): Promise<string> {
  if (!path.isAbsolute(filename) || /[\x00-\x1f\x7f-\x9f]/.test(filename)) throw new FileIoError("Invalid local metadata path");
  const normalized = path.resolve(filename);
  const roots = await getLocalFilesRoots();
  const configured: string[] = process.env.LOCAL_FILES_ROOTS ? JSON.parse(process.env.LOCAL_FILES_ROOTS) : [process.env.LOCAL_FILES_ROOT!];
  if (roots.includes(normalized) || configured.some((root) => path.resolve(root) === normalized)) return resolveLocalPath(normalized);
  const parent = await resolveLocalPath(path.dirname(normalized));
  return path.join(parent, path.basename(normalized));
}
export function statType(stats: { isSymbolicLink(): boolean; isDirectory(): boolean; isFile(): boolean }): FileEntryStat["type"] {
  return stats.isSymbolicLink() ? "symlink" : stats.isDirectory() ? "directory" : stats.isFile() ? "file" : "other";
}

export class LocalFileIo implements FileIo {
  async capabilities(parentPath: string): Promise<FileIoCapabilities> {
    await resolveLocalPath(parentPath);
    let directoryFlush: FileIoCapability;
    try {
      await this.flushDirectory(parentPath);
      directoryFlush = capability("supported", "Actual directory handle fsync succeeded on this filesystem");
    } catch {
      directoryFlush = capability("unsupported", "Directory fsync failed on this filesystem; durable publication is unavailable");
    }
    const space = await this.freeBytes(parentPath);
    return {
      readStream: capability("supported", "Node FileHandle streams with byte limits and pipeline drain"),
      exclusiveTemp: capability("supported", "O_CREAT | O_EXCL prevents existing files and symlinks from being replaced"),
      publishNoReplace: capability("supported", "POSIX hard link creates one regular-file target without replacement; same filesystem required"),
      renameNoReplace: capability("supported", "Regular-file hard link followed by unlink; journal must recover the intermediate two-link state"),
      fileFlush: capability("supported", "FileHandle.sync is required after the complete write"),
      directoryFlush,
      freeBytes: capability(space.state === "known" ? "supported" : "unknown", space.state === "known" ? "Actual statfs available-block count" : space.reason),
      directoryCreate: capability("supported", "Nonrecursive mkdir rejects every existing entry; new directory and parent must fsync"),
      directoryRemoveEmpty: capability("supported", "Ownership-checked rmdir rejects a nonempty directory; no recursive deletion"),
    };
  }
  async lstat(filename: string): Promise<FileEntryStat> {
    const stats = await fs.lstat(await localMetadataPath(filename), { bigint: true });
    const size = Number(stats.size);
    if (!Number.isSafeInteger(size) || size < 0) throw new FileIoError("File size cannot be represented exactly", { code: "INVALID_SIZE" });
    return { size, modifiedAt: stats.mtime.toISOString(), isDirectory: stats.isDirectory(), type: statType(stats), identity: `${stats.dev}:${stats.ino}` };
  }
  async readTo(filename: string, destination: Writable, limits: IoLimits): Promise<IoResult> {
    const scope = new IoScope(limits);
    let handle: fs.FileHandle | undefined;
    try {
      const safe = await localEntryPath(filename);
      if ((await this.lstat(filename)).type !== "file") throw new FileIoError("Streaming requires a regular file, not a symlink/directory");
      scope.check();
      handle = await fs.open(safe, constants.O_RDONLY | constants.O_NOFOLLOW);
      scope.check();
      if (!(await handle.stat()).isFile()) throw new FileIoError("Streaming requires a regular file");
      const meter = byteMeter(limits);
      await scope.run(() => pipeline(handle!.createReadStream({ autoClose: false }), meter.stream, destination, { signal: scope.signal }));
      return meter.result();
    } finally {
      try { await handle?.close(); } finally { scope.dispose(); }
    }
  }
  async writeExclusiveTempFrom(filename: string, source: Readable, limits: IoLimits): Promise<IoResult> {
    const scope = new IoScope(limits);
    let handle: fs.FileHandle | undefined;
    let destination: Writable | undefined;
    let tempCreated = false;
    try {
      const safe = await resolveLocalPath(filename, { allowMissing: true, destructive: true });
      if ((await this.capabilities(path.dirname(safe))).directoryFlush.state !== "supported") unsupported("durable temporary write");
      scope.check();
      handle = await fs.open(safe, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      tempCreated = true;
      scope.check();
      const meter = byteMeter(limits);
      destination = handle.createWriteStream({ autoClose: false });
      await scope.run(() => pipeline(source, meter.stream, destination!, { signal: scope.signal }));
      await scope.run(() => handle!.sync());
      // A FileHandle stream retains its handle even after finish. Release it
      // before close(), which otherwise waits forever for that retained stream.
      const closed = new Promise<void>((resolve) => destination!.once("close", resolve));
      destination.destroy();
      await closed;
      await handle.close();
      handle = undefined;
      await scope.run(() => this.flushDirectory(path.dirname(safe)));
      return meter.result();
    } catch (error) {
      // Only the journal knows ownership/fingerprint and may remove this temp.
      if (tempCreated) {
        const existing = error as Error & { code?: string };
        throw new FileIoError(existing.message, { code: existing.code, tempCreated: true, cause: error });
      }
      throw error;
    } finally {
      destination?.destroy();
      try { await handle?.close(); } finally { scope.dispose(); }
    }
  }
  async publishFileNoReplace(temp: string, target: string): Promise<void> {
    await this.renameNoReplace(temp, target);
  }
  async renameNoReplace(source: string, target: string): Promise<void> {
    const safeSource = await localEntryPath(source, true);
    const safeTarget = await resolveLocalPath(target, { allowMissing: true, destructive: true });
    const original = await fs.lstat(safeSource, { bigint: true });
    if (!original.isFile()) throw new FileIoError("No-replace publication supports regular files only, not directories or symlinks");
    for (const parent of new Set([path.dirname(safeSource), path.dirname(safeTarget)])) {
      if ((await this.capabilities(parent)).directoryFlush.state !== "supported") unsupported("durable no-replace publication");
    }
    await fs.link(safeSource, safeTarget);
    let sourceRetained = true;
    try {
      const checkIdentity = async () => {
        const [currentSource, currentTarget] = await Promise.all([fs.lstat(safeSource, { bigint: true }), fs.lstat(safeTarget, { bigint: true })]);
        for (const current of [currentSource, currentTarget]) {
          if (!current.isFile() || current.dev !== original.dev || current.ino !== original.ino || current.size !== original.size || current.mtimeNs !== original.mtimeNs) {
            throw new FileIoError("Source/target identity changed during publication; preserve both entries for recovery", { code: "IDENTITY_CONFLICT" });
          }
        }
      };
      await checkIdentity();
      // Persist the target first. Never unlink the source when that flush fails.
      await this.flushDirectory(path.dirname(safeTarget));
      await checkIdentity();
      await fs.unlink(safeSource);
      sourceRetained = false;
      await this.flushDirectory(path.dirname(safeSource));
    } catch (error) {
      throw new FileIoError("Publication created the target but did not complete all unlink/flush steps; reconcile the journal", {
        code: (error as NodeJS.ErrnoException).code, published: true, sourceRetained, cause: error,
      });
    }
  }
  async flushDirectory(dirname: string): Promise<void> {
    const safe = await resolveLocalPath(dirname);
    const handle = await fs.open(safe, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try { await handle.sync(); } finally { await handle.close(); }
  }
  async flushFile(filename: string): Promise<void> {
    const safe = await localEntryPath(filename);
    if ((await this.lstat(filename)).type !== "file") throw new FileIoError("File flush requires a regular file, not a symlink");
    const handle = await fs.open(safe, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      if (!(await handle.stat()).isFile()) throw new FileIoError("File flush requires a regular file");
      await handle.sync();
    } finally { await handle.close(); }
  }
  async freeBytes(filename: string): Promise<FreeBytesResult> {
    const safe = await resolveLocalPath(filename);
    try {
      const info = await fs.statfs(safe, { bigint: true });
      if (info.bavail < BigInt(0) || info.bsize < BigInt(1)) throw new Error("Invalid filesystem space response");
      return { state: "known", bytes: info.bavail * info.bsize };
    } catch {
      return { state: "unknown", reason: "The filesystem did not provide a valid available-space count" };
    }
  }
  async createDirectoryNoReplace(filename: string): Promise<FileEntryStat> {
    const safe = await resolveLocalPath(filename, { allowMissing: true, destructive: true });
    await this.flushDirectory(path.dirname(safe));
    await fs.mkdir(safe, { mode: 0o700, recursive: false });
    let identity: string | undefined;
    try {
      const created = await this.lstat(safe);
      if (created.type !== "directory" || !created.identity) throw new FileIoError("Created directory identity is unavailable");
      identity = created.identity;
      await this.flushDirectory(safe);
      await this.flushDirectory(path.dirname(safe));
      const current = await this.lstat(safe);
      if (current.type !== "directory" || current.identity !== identity) throw new FileIoError("Created directory changed before publication completed");
      return current;
    } catch (error) {
      throw new FileIoError("Directory creation needs journal recovery after flush/identity failure", { code: "DIRECTORY_CREATE_PARTIAL", published: true, createdIdentity: identity, cause: error });
    }
  }
  async removeEmptyDirectory(filename: string, expectedIdentity: string): Promise<void> {
    const safe = await resolveLocalPath(filename, { destructive: true });
    const actual = await this.lstat(safe);
    if (actual.type !== "directory" || !actual.identity || actual.identity !== expectedIdentity) throw new FileIoError("Directory ownership changed; preserve this entry", { code: "IDENTITY_CONFLICT" });
    await fs.rmdir(safe);
    await this.flushDirectory(path.dirname(safe));
  }
}


export { SftpFileIo } from "@/lib/sftp-file-io";
export { FtpFileIo } from "@/lib/ftp-file-io";
