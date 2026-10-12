import { constants } from "node:fs";
import * as fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { Transform, Writable } from "node:stream";
import { finished, pipeline } from "node:stream/promises";
import type { IoLimits } from "@/lib/file-io";

export const MAX_SAVE_BYTES = 512 * 1024 * 1024;
export interface SaveStoreOptions { storageDirectory?: string }
export class SaveStoreError extends Error { constructor(message = "Der verifizierte Save-Speicher ist nicht verfügbar.") { super(message); this.name = "SaveStoreError"; } }
export interface VerifiedSaveObject { sha256: string; size: string; path: string; identity: string; modifiedAt: string }
async function resolveStoreDirectory(options: SaveStoreOptions, createDirectory: boolean): Promise<string> {
  const requested = options.storageDirectory ?? path.join(process.cwd(), "data", "save-backups");
  if (!path.isAbsolute(requested) || requested === path.parse(requested).root || /[\x00-\x1f\x7f]/.test(requested)) throw new SaveStoreError();
  if (!options.storageDirectory) {
    const application = await fs.realpath(process.cwd());
    if (application !== path.resolve(process.cwd())) throw new SaveStoreError();
    for (const directory of [path.join(application, "data"), requested]) {
      const existing = await fs.lstat(directory).catch((error) => { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; });
      if (existing && (existing.isSymbolicLink() || !existing.isDirectory())) throw new SaveStoreError("Der interne Save-Speicher darf keine Symlink-Umleitung enthalten.");
    }
  }
  const existing = await fs.lstat(requested).catch((error) => { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; });
  if (existing && (existing.isSymbolicLink() || !existing.isDirectory())) throw new SaveStoreError();
  if (createDirectory) await fs.mkdir(requested, { recursive: true, mode: 0o700 });
  const metadata = await fs.lstat(requested);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new SaveStoreError();
  const canonical = await fs.realpath(requested);
  if (!options.storageDirectory && canonical !== path.resolve(requested)) throw new SaveStoreError("Der interne Save-Speicher darf keine Symlink-Umleitung enthalten.");
  return canonical;
}
export async function saveStoreDirectory(options: SaveStoreOptions = {}): Promise<string> { return resolveStoreDirectory(options, false); }
function validKey(key: string) { if (!/^[a-f0-9]{64}$/.test(key)) throw new SaveStoreError("Ungültiger interner Save-Schlüssel."); }
async function flushDirectory(directory: string) { const handle = await fs.open(directory, constants.O_RDONLY | constants.O_NOFOLLOW); try { await handle.sync(); } finally { await handle.close(); } }
async function safeDirectory(directory: string, identity: string) {
  const metadata = await fs.lstat(directory, { bigint: true });
  if (!metadata.isDirectory() || metadata.isSymbolicLink() || `${metadata.dev}:${metadata.ino}` !== identity) throw new SaveStoreError("Der Save-Speicher wurde während des Vorgangs verändert.");
}
function boundedSignal(external: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const cancel = () => controller.abort(external?.reason ?? new SaveStoreError("Save-Vorgang abgebrochen."));
  external?.addEventListener("abort", cancel, { once: true }); if (external?.aborted) cancel();
  const timer = setTimeout(() => controller.abort(new SaveStoreError("Zeitlimit des Save-Speichers erreicht.")), timeoutMs);
  return { signal: controller.signal, close() { clearTimeout(timer); external?.removeEventListener("abort", cancel); } };
}

/** The sole storage key is a content digest; callers never pass a backup path. */
export async function verifySaveObject(storageKey: string, options: SaveStoreOptions = {}): Promise<VerifiedSaveObject> {
  validKey(storageKey);
  const directory = await saveStoreDirectory(options);
  const filename = path.join(directory, storageKey);
  const handle = await fs.open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  const scope = boundedSignal(undefined, 120000);
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.size < BigInt(0) || before.size > BigInt(MAX_SAVE_BYTES)) throw new SaveStoreError();
    const hash = createHash("sha256");
    const buffer = Buffer.alloc(64 * 1024);
    let bytes = 0;
    for (;;) {
      scope.signal.throwIfAborted();
      const result = await handle.read(buffer, 0, buffer.length, bytes);
      if (!result.bytesRead) break;
      bytes += result.bytesRead;
      if (bytes > MAX_SAVE_BYTES) throw new SaveStoreError();
      hash.update(buffer.subarray(0, result.bytesRead));
    }
    const after = await handle.stat({ bigint: true }); const entry = await fs.lstat(filename, { bigint: true });
    if (hash.digest("hex") !== storageKey || BigInt(bytes) !== before.size || after.size !== before.size || after.mtimeNs !== before.mtimeNs || after.ctimeNs !== before.ctimeNs || entry.isSymbolicLink() || entry.dev !== before.dev || entry.ino !== before.ino) throw new SaveStoreError("Das Save-Objekt stimmt nicht mit seinem verifizierten Inhalt überein.");
    return { sha256: storageKey, size: String(bytes), path: filename, identity: `${before.dev}:${before.ino}`, modifiedAt: before.mtime.toISOString() };
  } finally { scope.close(); await handle.close(); }
}

export async function createSaveObject(produce: (sink: Writable, signal: AbortSignal) => Promise<void>, options: SaveStoreOptions & { expectedBytes: number; signal?: AbortSignal; timeoutMs?: number }): Promise<{ sha256: string; storageKey: string; size: string }> {
  if (!Number.isSafeInteger(options.expectedBytes) || options.expectedBytes < 0 || options.expectedBytes > MAX_SAVE_BYTES || !Number.isSafeInteger(options.timeoutMs ?? 120000) || (options.timeoutMs ?? 120000) < 1 || (options.timeoutMs ?? 120000) > 120000) throw new SaveStoreError("Save-Größe oder Zeitlimit überschreitet die erlaubte Grenze.");
  const directory = await resolveStoreDirectory(options, true);
  const directoryMetadata = await fs.lstat(directory, { bigint: true }); const directoryIdentity = `${directoryMetadata.dev}:${directoryMetadata.ino}`;
  const temp = path.join(directory, `.ludotek-save-${randomUUID()}.tmp`);
  let handle: fs.FileHandle | undefined = await fs.open(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  const identity = await handle.stat({ bigint: true });
  const scope = boundedSignal(options.signal, options.timeoutMs ?? 120000);
  const hash = createHash("sha256"); let bytes = 0;
  const sink = new Writable({ write(chunk: Buffer, _encoding, callback) {
    void (async () => {
      scope.signal.throwIfAborted();
      if (chunk.length > options.expectedBytes - bytes) throw new SaveStoreError("Save-Daten überschreiten die bestätigte Größe.");
      let offset = 0;
      while (offset < chunk.length) { const result = await handle!.write(chunk, offset, chunk.length - offset, bytes + offset); if (!result.bytesWritten) throw new SaveStoreError(); offset += result.bytesWritten; }
      bytes += chunk.length; hash.update(chunk);
    })().then(() => callback(), (error) => callback(error));
  } });
  const abort = () => sink.destroy(scope.signal.reason instanceof Error ? scope.signal.reason : new SaveStoreError());
  scope.signal.addEventListener("abort", abort, { once: true });
  try {
    scope.signal.throwIfAborted();
    const finish = finished(sink, { cleanup: true });
    const transfer = Promise.resolve().then(() => produce(sink, scope.signal)).catch((error) => { sink.destroy(error instanceof Error ? error : new SaveStoreError()); throw error; });
    const results = await Promise.allSettled([transfer, finish]);
    for (const result of results) if (result.status === "rejected") throw result.reason;
    scope.signal.throwIfAborted();
    if (bytes !== options.expectedBytes) throw new SaveStoreError("Save-Daten entsprechen nicht der bestätigten Größe.");
    await handle.sync(); await handle.close(); handle = undefined;
    await safeDirectory(directory, directoryIdentity);
    const storageKey = hash.digest("hex");
    try { await fs.link(temp, path.join(directory, storageKey)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    await flushDirectory(directory);
    const verified = await verifySaveObject(storageKey, options);
    if (verified.size !== String(bytes)) throw new SaveStoreError();
    return { sha256: storageKey, storageKey, size: String(bytes) };
  } finally {
    scope.signal.removeEventListener("abort", abort); scope.close(); sink.destroy();
    await handle?.close();
    const current = await fs.lstat(temp, { bigint: true }).catch(() => null);
    if (current && current.dev === identity.dev && current.ino === identity.ino && !current.isSymbolicLink()) { await fs.unlink(temp); await flushDirectory(directory); }
  }
}

export async function readSaveObjectTo(storageKey: string, destination: Writable, limits: IoLimits, options: SaveStoreOptions = {}): Promise<{ bytes: number }> {
  const verified = await verifySaveObject(storageKey, options);
  const size = Number(verified.size);
  if (!Number.isSafeInteger(limits.maxBytes) || limits.maxBytes < size || (limits.expectedBytes !== undefined && limits.expectedBytes !== size) || !Number.isSafeInteger(limits.timeoutMs) || limits.timeoutMs < 1 || limits.timeoutMs > 120000) throw new SaveStoreError("Ungültige Grenzen für das Save-Objekt.");
  const scope = boundedSignal(limits.signal, limits.timeoutMs);
  const handle = await fs.open(verified.path, constants.O_RDONLY | constants.O_NOFOLLOW);
  const hash = createHash("sha256"); let bytes = 0;
  let source: ReturnType<fs.FileHandle["createReadStream"]> | undefined;
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || `${before.dev}:${before.ino}` !== verified.identity || before.size !== BigInt(size)) throw new SaveStoreError();
    source = handle.createReadStream({ autoClose: false });
    const meter = new Transform({ transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length; if (bytes > size) return callback(new SaveStoreError()); hash.update(chunk);
      try { limits.onProgress?.(bytes); callback(null, chunk); } catch (error) { callback(error instanceof Error ? error : new SaveStoreError()); }
    } });
    await pipeline(source, meter, destination, { signal: scope.signal });
    const after = await handle.stat({ bigint: true });
    if (bytes !== size || hash.digest("hex") !== storageKey || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs) throw new SaveStoreError("Das Save-Objekt wurde während des Lesens verändert.");
    return { bytes };
  } finally {
    if (source && !source.closed) { const closed = new Promise<void>((resolve) => source!.once("close", resolve)); source.destroy(); await closed; }
    await handle.close(); scope.close();
  }
}
