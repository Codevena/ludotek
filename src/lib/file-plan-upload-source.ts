import { constants } from "node:fs";
import * as fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { Transform, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { PrismaClient, UploadFileSource } from "@prisma/client";
import type { FileEntryStat, IoLimits } from "@/lib/file-io";
import { assertUploadFilename, assertUploadPlatform } from "@/lib/disc-inputs";

const BASE = "/tmp/ludotek-uploads";
const MAX_BYTES = 16 * 1024 ** 3;
export class ProtectedUploadError extends Error {
  constructor(message = "Protected upload source is unavailable or changed") { super(message); this.name = "ProtectedUploadError"; }
}
export interface VerifiedUpload {
  row: UploadFileSource; path: string; fingerprint: { size: number; sha256: string; identity: string; modifiedAt: string };
}
async function rowFor(db: PrismaClient, id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new ProtectedUploadError();
  const row = await db.uploadFileSource.findUnique({ where: { id } });
  if (!row || !/^[a-f0-9]{64}$/.test(row.sha256) || !/^\d+:\d+$/.test(row.identity) || row.size < BigInt(0) || row.size > BigInt(MAX_BYTES)) throw new ProtectedUploadError();
  assertUploadFilename(row.sessionId); assertUploadFilename(row.filename); assertUploadPlatform(row.platform);
  if (Buffer.byteLength(row.sessionId) > 255 || Buffer.byteLength(row.filename) > 255) throw new ProtectedUploadError();
  return row;
}
/** Database-only admission proof, before any target/cache filesystem access. */
export async function registeredProtectedUpload(db: PrismaClient, id: string): Promise<UploadFileSource> {
  const row = await rowFor(db, id);
  if (row.released) throw new ProtectedUploadError("Upload source cache was released; it cannot be applied again");
  return row;
}
async function sourcePath(row: UploadFileSource) {
  const baseInfo = await fs.lstat(BASE);
  if (!baseInfo.isDirectory() || baseInfo.isSymbolicLink()) throw new ProtectedUploadError();
  const base = await fs.realpath(BASE); const root = path.join(base, row.sessionId);
  const rootInfo = await fs.lstat(root, { bigint: true });
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink() || await fs.realpath(root) !== root) throw new ProtectedUploadError();
  if (!path.isAbsolute(row.path) || /[\x00-\x1f\x7f]/.test(row.path) || path.normalize(row.path) !== row.path) throw new ProtectedUploadError();
  const parent = await fs.realpath(path.dirname(row.path)); const filename = path.join(parent, path.basename(row.path));
  const relative = path.relative(root, filename);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new ProtectedUploadError();
  let current = root;
  for (const component of relative.split(path.sep).slice(0, -1)) {
    current = path.join(current, component); const info = await fs.lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new ProtectedUploadError();
  }
  return { filename, root, rootIdentity: `${rootInfo.dev}:${rootInfo.ino}` };
}
async function checkRoot(root: string, expected: string) {
  const info = await fs.lstat(root, { bigint: true });
  if (!info.isDirectory() || info.isSymbolicLink() || `${info.dev}:${info.ino}` !== expected) throw new ProtectedUploadError();
}
function scope(limits: IoLimits) {
  if (!Number.isSafeInteger(limits.maxBytes) || limits.maxBytes < 0 || limits.maxBytes > MAX_BYTES || !Number.isSafeInteger(limits.timeoutMs) || limits.timeoutMs < 1 || limits.timeoutMs > 3600000) throw new ProtectedUploadError();
  const controller = new AbortController();
  const cancel = () => controller.abort(limits.signal?.reason ?? new ProtectedUploadError("Upload source read was aborted"));
  limits.signal?.addEventListener("abort", cancel, { once: true }); if (limits.signal?.aborted) cancel();
  const timer = setTimeout(() => controller.abort(new ProtectedUploadError("Upload source deadline exceeded")), limits.timeoutMs);
  return { signal: controller.signal, close() { clearTimeout(timer); limits.signal?.removeEventListener("abort", cancel); } };
}

/** Positive persisted row + exact closed-session namespace; never widens LOCAL device roots. */
export async function readProtectedUploadTo(db: PrismaClient, id: string, destination: Writable, limits: IoLimits): Promise<{ bytes: number }> {
  const row = await rowFor(db, id);
  if (row.released) throw new ProtectedUploadError("Upload source cache was released; it cannot be applied again");
  const location = await sourcePath(row); const bounded = scope(limits);
  let handle: fs.FileHandle | undefined;
  let source: ReturnType<fs.FileHandle["createReadStream"]> | undefined;
  try {
    bounded.signal.throwIfAborted();
    handle = await fs.open(location.filename, constants.O_RDONLY | constants.O_NOFOLLOW);
    bounded.signal.throwIfAborted();
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || `${before.dev}:${before.ino}` !== row.identity || before.size !== row.size || (row.modifiedAt !== null && before.mtime.toISOString() !== row.modifiedAt) || row.size > BigInt(limits.maxBytes) || (limits.expectedBytes !== undefined && row.size !== BigInt(limits.expectedBytes))) throw new ProtectedUploadError();
    let bytes = 0; const hash = createHash("sha256");
    const meter = new Transform({ transform(chunk: Buffer, _encoding, callback) {
      if (chunk.length > Number(row.size) - bytes) return callback(new ProtectedUploadError());
      bytes += chunk.length; hash.update(chunk);
      try { limits.onProgress?.(bytes); callback(null, chunk); } catch (error) { callback(error as Error); }
    } });
    source = handle.createReadStream({ autoClose: false });
    await pipeline(source, meter, destination, { signal: bounded.signal });
    const after = await handle.stat({ bigint: true }); const entry = await fs.lstat(location.filename, { bigint: true });
    await checkRoot(location.root, location.rootIdentity);
    const rechecked = await sourcePath(row);
    if (rechecked.filename !== location.filename || rechecked.rootIdentity !== location.rootIdentity) throw new ProtectedUploadError();
    if (BigInt(bytes) !== row.size || hash.digest("hex") !== row.sha256 || after.size !== before.size || after.mtimeNs !== before.mtimeNs || after.ctimeNs !== before.ctimeNs || entry.isSymbolicLink() || entry.dev !== before.dev || entry.ino !== before.ino) throw new ProtectedUploadError();
    return { bytes };
  } finally {
    if (source && !source.closed) { const closed = new Promise<void>((resolve) => source!.once("close", resolve)); source.destroy(); await closed; }
    try { await handle?.close(); } finally { bounded.close(); }
  }
}
export async function verifyProtectedUpload(db: PrismaClient, id: string, limits: Pick<IoLimits, "signal" | "timeoutMs"> = { timeoutMs: 120000 }): Promise<VerifiedUpload> {
  const row = await rowFor(db, id);
  await readProtectedUploadTo(db, id, new Writable({ write(_chunk, _encoding, callback) { callback(); } }), { ...limits, maxBytes: Number(row.size), expectedBytes: Number(row.size) });
  const location = await sourcePath(row); const metadata = await fs.lstat(location.filename, { bigint: true });
  if (!metadata.isFile() || metadata.isSymbolicLink() || `${metadata.dev}:${metadata.ino}` !== row.identity || metadata.size !== row.size) throw new ProtectedUploadError();
  return { row, path: location.filename, fingerprint: { size: Number(row.size), sha256: row.sha256, identity: row.identity, modifiedAt: metadata.mtime.toISOString() } };
}
/** Released source copies are not needed to undo their already verified output. */
export async function protectedUploadStat(db: PrismaClient, id: string): Promise<FileEntryStat | null> {
  const row = await rowFor(db, id); if (row.released) return null;
  try {
    const location = await sourcePath(row); const info = await fs.lstat(location.filename, { bigint: true });
    return { type: info.isSymbolicLink() ? "symlink" : info.isFile() ? "file" : info.isDirectory() ? "directory" : "other", isDirectory: info.isDirectory(), size: Number(info.size), identity: `${info.dev}:${info.ino}`, modifiedAt: info.mtime.toISOString() };
  } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}
