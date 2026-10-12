import { constants } from "node:fs";
import { open, realpath, lstat, statfs, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { Device, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertDeviceJobsOwned, type DeviceJobs } from "@/lib/device-jobs";
import { assertUploadFilename, assertUploadPlatform, UploadInputError } from "@/lib/disc-inputs";
import { getDeviceProfile, deviceProfileAcquire, validDeviceNumber } from "@/lib/device-profiles";
import { acquireDeviceFiles } from "@/lib/device-jobs";
import { createConnection, requireFileIo, type DeviceConnection } from "@/lib/connection";
import { decrypt } from "@/lib/encryption";
import { createUploadFilePlan, applyFilePlan, getFilePlanFingerprints, getUploadSourceReleaseProof, type FilePlanOptions, type FilePlanView } from "@/lib/file-plans";
import { PLATFORM_CONFIG } from "@/lib/platforms";
import { readProfileFingerprint } from "@/lib/device-profile-sync";
import { convert } from "@/lib/converter";
import { loadUploadSession, validateUploadBody } from "@/lib/disc-inputs";
import { AdmissionError, acquireEnrichment, type EnrichmentJob } from "@/lib/job-admission";
import { searchIgdb } from "@/lib/igdb";
import { searchSteamGridDb } from "@/lib/steamgriddb";
import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Open } from "unzipper";
import { RequestBodyError } from "@/lib/request-body";

const MAX_BYTES = 16 * 1024 ** 3;
export const UPLOAD_BASE = "/tmp/ludotek-uploads";
export const UPLOAD_DISK_RESERVE = BigInt(256 * 1024 * 1024);
const MAX_MULTIPART_BYTES = 1024 ** 3;
const MAX_EXPANDED_BYTES = 32 * 1024 ** 3;
export type UploadPipelineOptions = FilePlanOptions & { converter?: typeof convert; createPlan?: typeof createUploadFilePlan; applyPlan?: typeof applyFilePlan; enrichAcquire?: typeof acquireEnrichment };
/** Used only by the authenticated pipeline after its actual session/conversion
 * selection. An HTTP caller never supplies an authoritative cache pathname.
 */
export async function registerUploadSources(
  sessionId: string, sessionDirectory: string, platform: string,
  files: Array<{ name: string; localPath: string }>, jobs: DeviceJobs, db: PrismaClient = prisma,
) {
  assertUploadFilename(sessionId); assertUploadPlatform(platform);
  if (files.length < 1 || files.length > 100) throw new UploadInputError("Upload plan requires 1–100 actual files");
  const base = await realpath("/tmp/ludotek-uploads");
  const directory = await realpath(path.join(base, sessionId));
  if (directory !== sessionDirectory || path.dirname(directory) !== base) throw new UploadInputError("Invalid upload session boundary");
  const rows: Prisma.UploadFileSourceCreateInput[] = [];
  const seen = new Set<string>();
  let selectedBytes = BigInt(0);
  // Reject the complete group's aggregate size before reading any source body.
  for (const file of files) {
    await jobs.assertActive(); assertUploadFilename(file.name);
    const relative = path.relative(directory, file.localPath);
    if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative) || seen.has(file.localPath) || path.basename(file.localPath) !== file.name) throw new UploadInputError("Invalid selected upload source");
    seen.add(file.localPath);
    const metadata = await lstat(file.localPath, { bigint: true });
    if (await realpath(file.localPath) !== file.localPath || !metadata.isFile() || metadata.isSymbolicLink()) throw new UploadInputError("Upload source must be a canonical regular file");
    selectedBytes += metadata.size;
    if (metadata.size > BigInt(MAX_BYTES) || selectedBytes > BigInt(MAX_EXPANDED_BYTES)) throw new UploadInputError("Selected upload sources exceed the file/group byte limit", 413);
  }
  for (const file of files) {
    await jobs.assertActive();
    const handle = await open(file.localPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const before = await handle.stat({ bigint: true });
      const size = Number(before.size);
      if (!before.isFile() || !Number.isSafeInteger(size) || size < 0 || size > MAX_BYTES) throw new UploadInputError("Upload file exceeds the stream limit");
      const hash = createHash("sha256");
      const chunk = Buffer.alloc(64 * 1024);
      const deadline = Date.now() + 120000;
      let bytes = 0;
      for (;;) {
        jobs.signal.throwIfAborted();
        if (Date.now() >= deadline) throw new UploadInputError("Upload source hashing deadline exceeded", 408);
        const result = await handle.read(chunk, 0, chunk.length, bytes);
        if (!result.bytesRead) break;
        bytes += result.bytesRead;
        if (bytes > size) throw new UploadInputError("Upload source changed during preparation", 409);
        hash.update(chunk.subarray(0, result.bytesRead));
      }
      const after = await handle.stat({ bigint: true });
      const entry = await lstat(file.localPath, { bigint: true });
      if (bytes !== size || after.size !== before.size || after.mtimeNs !== before.mtimeNs || after.ctimeNs !== before.ctimeNs || entry.dev !== before.dev || entry.ino !== before.ino || !entry.isFile()) throw new UploadInputError("Upload source changed during preparation", 409);
      rows.push({ sessionId, path: file.localPath, filename: file.name, platform, size: BigInt(size), sha256: hash.digest("hex"), identity: `${before.dev}:${before.ino}`, modifiedAt: before.mtime.toISOString() });
    } finally { await handle.close(); }
  }
  return db.$transaction(async (tx) => {
    await assertDeviceJobsOwned(jobs, tx); jobs.signal.throwIfAborted();
    const registered = [];
    for (const row of rows) registered.push(await tx.uploadFileSource.create({ data: row }));
    return registered;
  });
}

export async function getUploadDestination(deviceId: number, platform: string, db: PrismaClient = prisma) {
  assertUploadPlatform(platform);
  const { profile } = await getDeviceProfile(deviceId, { db });
  const specific = profile.romRoots.filter((root) => root.platform === platform);
  const roots = specific.length ? specific : profile.romRoots.filter((root) => !root.platform);
  if (roots.length !== 1) throw new UploadInputError("Configure one target ROM root for the selected platform", 422);
  return roots[0].platform ? roots[0].path : path.posix.join(roots[0].path, platform);
}

export async function uploadFreeBytes(directory: string): Promise<bigint> {
  const space = await statfs(directory, { bigint: true });
  if (space.bavail < BigInt(0) || space.bsize <= BigInt(0)) throw new UploadInputError("Authoritative upload disk space is unavailable", 503);
  const available = space.bavail * space.bsize;
  if (available <= UPLOAD_DISK_RESERVE) throw new UploadInputError("Upload cache has insufficient free disk space", 413);
  return available - UPLOAD_DISK_RESERVE;
}
export async function canonicalUploadSession(sessionId: string): Promise<string> {
  assertUploadFilename(sessionId);
  const base = await realpath(UPLOAD_BASE); const expected = path.join(base, sessionId);
  const directory = await realpath(expected); const metadata = await lstat(expected);
  if (directory !== expected || path.dirname(directory) !== base || !metadata.isDirectory() || metadata.isSymbolicLink()) throw new UploadInputError("Invalid upload session boundary");
  return directory;
}

async function writeUploadStream(filename: string, source: Readable, expected: number, jobs: DeviceJobs): Promise<void> {
  if (!Number.isSafeInteger(expected) || expected < 0 || expected > MAX_BYTES) throw new UploadInputError("Upload file exceeds the permitted byte bound", 413);
  if (await uploadFreeBytes(path.dirname(filename)) < BigInt(expected)) throw new UploadInputError("Upload cache has insufficient authoritative free space", 413);
  const handle = await open(filename, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  let bytes = 0; const controller = new AbortController(); const signal = AbortSignal.any([jobs.signal, controller.signal]);
  const timer = setTimeout(() => controller.abort(new UploadInputError("Upload file stream deadline exceeded", 408)), 120000);
  const sink = new Writable({ write(chunk: Buffer, _encoding, callback) {
    void (async () => { signal.throwIfAborted(); if (chunk.length > expected - bytes) throw new UploadInputError("Upload stream exceeds declared/allowed bytes", 413); let offset = 0; while (offset < chunk.length) { const written = await handle.write(chunk, offset, chunk.length - offset, bytes + offset); if (!written.bytesWritten) throw new UploadInputError("Upload cache write failed", 503); offset += written.bytesWritten; } bytes += chunk.length; })().then(() => callback(), (error) => callback(error));
  } });
  try { await pipeline(source, sink, { signal }); if (bytes !== expected) throw new UploadInputError("Upload stream ended before its declared size", 400); await handle.sync(); await jobs.assertActive(); }
  finally { clearTimeout(timer); source.destroy(); sink.destroy(); await handle.close(); }
}

/** Central-directory count is checked before unzipper allocates entry metadata. */
async function validateZipCount(filename: string) {
  const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const metadata = await handle.stat(); const length = Math.min(metadata.size, 65557); const tail = Buffer.alloc(length);
    if ((await handle.read(tail, 0, length, metadata.size - length)).bytesRead !== length) throw new UploadInputError("Invalid ZIP footer");
    let offset = -1;
    for (let position = length - 22; position >= 0; position--) if (tail.readUInt32LE(position) === 0x06054b50 && position + 22 + tail.readUInt16LE(position + 20) === length) { offset = position; break; }
    if (offset < 0) throw new UploadInputError("ZIP has no complete central directory");
    let count = BigInt(tail.readUInt16LE(offset + 10));
    if (count === BigInt(65535)) {
      const absolute = metadata.size - length + offset; const locator = Buffer.alloc(20);
      if (absolute < 20 || (await handle.read(locator, 0, 20, absolute - 20)).bytesRead !== 20 || locator.readUInt32LE(0) !== 0x07064b50) throw new UploadInputError("Invalid ZIP64 directory");
      const position = locator.readBigUInt64LE(8); if (position > BigInt(metadata.size - 56)) throw new UploadInputError("Invalid ZIP64 offset");
      const record = Buffer.alloc(56); if ((await handle.read(record, 0, 56, Number(position))).bytesRead !== 56 || record.readUInt32LE(0) !== 0x06064b50) throw new UploadInputError("Invalid ZIP64 record");
      count = record.readBigUInt64LE(32);
    }
    if (count > BigInt(100)) throw new UploadInputError("ZIP exceeds the 100-entry limit", 413);
  } finally { await handle.close(); }
}
function zipRelativePath(filename: string): string {
  if (!filename || filename.length > 4096 || path.posix.isAbsolute(filename) || path.win32.isAbsolute(filename) || /[\x00-\x1f\x7f-\x9f]/.test(filename)) throw new UploadInputError("Invalid ZIP entry path");
  const parts = filename.split(/[/\\]/);
  if (parts.some((part) => !part || part === "." || part === ".." || part.startsWith(".ludotek-") || Buffer.byteLength(part) > 255)) throw new UploadInputError("Unsafe ZIP entry path");
  return parts.join("/");
}

/** Framework Blob parsing remains bounded; all subsequent copies/extraction stream. */
export async function receiveUpload(request: Request, options: FilePlanOptions = {}) {
  const db = options.db ?? prisma; const jobs = await acquireDeviceFiles([], request, deviceProfileAcquire(options));
  let sessionId: string | undefined; let sessionDirectory: string | undefined;
  try {
    if (!request.headers.get("Content-Type")?.startsWith("multipart/form-data;")) throw new UploadInputError("A multipart file upload is required");
    const declared = request.headers.get("Content-Length");
    if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_MULTIPART_BYTES)) throw new UploadInputError("Multipart upload exceeds 1 GiB; use smaller batches or existing device files", 413);
    if (!request.body) throw new UploadInputError("No files provided");
    const controller = new AbortController(); const signal = AbortSignal.any([jobs.signal, controller.signal]); let wireBytes = 0;
    const timer = setTimeout(() => controller.abort(new RequestBodyError("Multipart upload deadline exceeded", 408)), 120000);
    const meter = new TransformStream<Uint8Array, Uint8Array>({ transform(chunk, output) { wireBytes += chunk.byteLength; if (wireBytes > MAX_MULTIPART_BYTES) throw new UploadInputError("Actual multipart wire bytes exceed 1 GiB", 413); output.enqueue(chunk); } });
    let form: FormData;
    try { form = await new Request(request.url, { method: "POST", headers: request.headers, body: request.body.pipeThrough(meter, { signal }), signal, duplex: "half" } as never).formData(); }
    catch (error) { if (signal.aborted) throw signal.reason; throw error; }
    finally { clearTimeout(timer); }
    const files = form.getAll("files");
    if (!files.length || files.length > 100 || files.some((file) => !(file instanceof File))) throw new UploadInputError("Provide 1–100 actual files");
    let uploadBytes = 0;
    for (const file of files as File[]) { assertUploadFilename(file.name); if (file.name.startsWith(".ludotek-") || Buffer.byteLength(file.name) > 255 || !Number.isSafeInteger(file.size) || file.size < 0 || (uploadBytes += file.size) > MAX_MULTIPART_BYTES) throw new UploadInputError("Upload filename/byte limit exceeded", 413); }
    const existing = await lstat(UPLOAD_BASE).catch((error) => { if (error.code === "ENOENT") return null; throw error; });
    if (existing && (!existing.isDirectory() || existing.isSymbolicLink())) throw new UploadInputError("Upload cache boundary is unavailable", 503);
    await mkdir(UPLOAD_BASE, { recursive: true, mode: 0o700 }); const base = await realpath(UPLOAD_BASE);
    if (await uploadFreeBytes(base) < BigInt(uploadBytes)) throw new UploadInputError("Upload cache has insufficient free disk space", 413);
    sessionId = randomUUID(); const created = path.join(base, sessionId); await mkdir(created, { mode: 0o700 }); sessionDirectory = await realpath(created);
    const identity = await lstat(sessionDirectory, { bigint: true });
    await writeFile(path.join(sessionDirectory, ".ludotek-session.json"), JSON.stringify({ version: 1, id: sessionId, identity: `${identity.dev}:${identity.ino}` }), { flag: "wx", mode: 0o600 });
    const saved: { name: string; size: number; path: string }[] = []; let expanded = 0;
    for (const file of files as File[]) {
      await jobs.assertActive(); const filename = path.join(sessionDirectory, file.name);
      await writeUploadStream(filename, Readable.fromWeb(file.stream() as never), file.size, jobs);
      if (!file.name.toLowerCase().endsWith(".zip")) { expanded += file.size; saved.push({ name: file.name, size: file.size, path: filename }); continue; }
      await validateZipCount(filename); const archive = await Open.file(filename);
      const entries = archive.files.filter((entry) => entry.type === "File");
      if (entries.length + saved.length > 100) throw new UploadInputError("Expanded upload exceeds 100 files", 413);
      let declaredExpanded = 0;
      for (const entry of entries) {
        zipRelativePath(entry.path); const unixType = (entry.externalFileAttributes >>> 16) & 0xf000;
        if (unixType && unixType !== 0x8000 || (entry.flags & 1) || !Number.isSafeInteger(entry.uncompressedSize) || entry.uncompressedSize < 0 || entry.uncompressedSize > MAX_BYTES || (declaredExpanded += entry.uncompressedSize) + expanded > MAX_EXPANDED_BYTES) throw new UploadInputError("ZIP has unsupported entries or exceeds extraction limits", 413);
      }
      if (await uploadFreeBytes(sessionDirectory) < BigInt(declaredExpanded)) throw new UploadInputError("ZIP extraction exceeds authoritative free disk space", 413);
      for (const entry of entries) {
        await jobs.assertActive(); const relative = zipRelativePath(entry.path); const output = path.join(sessionDirectory, relative);
        await mkdir(path.dirname(output), { recursive: true, mode: 0o700 }); await writeUploadStream(output, entry.stream(), entry.uncompressedSize, jobs);
        expanded += entry.uncompressedSize; saved.push({ name: path.basename(relative), size: entry.uncompressedSize, path: output });
      }
      // Only this request's private archive copy is removed; extracted sources remain.
      await rm(filename);
    }
    if (!saved.length) throw new UploadInputError("No files provided");
    return { sessionId, files: saved };
  } catch (error) {
    if (sessionId && sessionDirectory) { try { await removeOwnedUploadSession(sessionId, jobs, db); } catch { /* Preserve uncertain or leased source bytes. */ } }
    throw error;
  } finally { await jobs.close(); }
}
export async function removeOwnedUploadSession(sessionId: string, jobs: DeviceJobs, db: PrismaClient = prisma): Promise<boolean> {
  await jobs.assertActive();
  const directory = await canonicalUploadSession(sessionId);
  let marker: { id?: string; identity?: string; version?: number };
  try { marker = JSON.parse(await readFile(path.join(directory, ".ludotek-session.json"), "utf8")); } catch { return false; }
  const metadata = await lstat(directory, { bigint: true });
  if (marker.version !== 1 || marker.id !== sessionId || marker.identity !== `${metadata.dev}:${metadata.ino}` || metadata.isSymbolicLink()) return false;
  if (await db.uploadFileSource.count({ where: { sessionId, released: false } })) return false;
  await jobs.assertActive();
  await rm(directory, { recursive: true });
  return true;
}

async function connectDevice(device: Device): Promise<DeviceConnection> {
  return createConnection({ ...device, password: decrypt(device.password), protocol: device.protocol as "ssh" | "ftp" | "local" });
}
export async function preflightUploadTarget(deviceId: number, platform: string, jobs: DeviceJobs, options: UploadPipelineOptions = {}) {
  await jobs.assertActive(); const db = options.db ?? prisma;
  const device = await db.device.findUnique({ where: { id: deviceId } });
  if (!device) throw new UploadInputError("Target device not found", 404);
  const directory = await getUploadDestination(deviceId, platform, db);
  const profile = (await getDeviceProfile(deviceId, { db })).profile;
  const connection = await (options.connect ?? connectDevice)(device);
  try {
    const io = requireFileIo(connection); const caps = await io.capabilities(directory);
    for (const name of ["readStream", "exclusiveTemp", "publishNoReplace", "renameNoReplace", "fileFlush", "directoryFlush", "freeBytes"] as const) if (caps[name].state !== "supported") throw new UploadInputError(`Target cannot safely upload: ${name} is ${caps[name].state}`, 422);
    if ((await io.lstat(directory)).type !== "directory") throw new UploadInputError("Target platform directory must already exist; create it through a verified file plan", 422);
    const space = await io.freeBytes(directory);
    if (space.state !== "known" || space.bytes < BigInt(profile.reserveBytes)) throw new UploadInputError("Target free space is unavailable or below its reserve", 422);
    await jobs.assertActive();
    return { device, directory, profile, connection, io };
  } catch (error) { connection.disconnect(); throw error; }
}

export async function bindUploadedCatalog(plan: FilePlanView, input: { title: string; platform: string; representative: string; deviceId: number }, jobs: DeviceJobs, db: PrismaClient = prisma) {
  if (plan.status !== "applied" || !plan.operations.length) throw new UploadInputError("No verified upload plan was applied", 409);
  const definition = PLATFORM_CONFIG.find((entry) => entry.id === input.platform)!;
  return db.$transaction(async (tx) => {
    await assertDeviceJobsOwned(jobs, tx); jobs.signal.throwIfAborted();
    const stored = await tx.filePlan.findUnique({ where: { id: plan.id }, select: { status: true } });
    if (stored?.status !== "applied") throw new UploadInputError("Upload plan status changed before catalog binding", 409);
    const paths = plan.operations.map((operation) => operation.targetPath).filter((value): value is string => Boolean(value));
    if (paths.length !== plan.operations.length || plan.operations.some((operation) => operation.targetDeviceId !== input.deviceId)) throw new UploadInputError("Upload manifest target binding is invalid", 409);
    const records = await tx.deviceFile.findMany({ where: { deviceId: input.deviceId, path: { in: paths } } });
    if (records.length !== paths.length || records.some((record) => record.kind !== "file" || record.platform !== input.platform)) throw new UploadInputError("Upload manifest was not committed completely", 409);
    const game = await tx.game.upsert({ where: { originalFile_platform: { originalFile: input.representative, platform: input.platform } }, update: { title: input.title },
      create: { title: input.title, originalFile: input.representative, platform: input.platform, platformLabel: definition.label, source: "rom" } });
    await tx.gameDevice.upsert({ where: { gameId_deviceId: { gameId: game.id, deviceId: input.deviceId } }, update: { originalFile: input.representative }, create: { gameId: game.id, deviceId: input.deviceId, originalFile: input.representative } });
    await tx.deviceFile.updateMany({ where: { deviceId: input.deviceId, path: { in: paths } }, data: { gameId: game.id } });
    const count = await tx.game.count({ where: { platform: input.platform } });
    await tx.platform.upsert({ where: { id: input.platform }, update: { gameCount: count }, create: { id: input.platform, label: definition.label, icon: definition.icon, color: definition.color, sortOrder: definition.sortOrder, gameCount: count } });
    return game;
  });
}

/** Protected cache paths are server selections; HTTP input never chooses them. */
export async function processUploadThroughJournal(input: ReturnType<typeof validateUploadBody>, request: Request, options: UploadPipelineOptions = {}): Promise<Response> {
  const db = options.db ?? prisma;
  const selected = input.deviceId ?? (await db.settings.findUnique({ where: { id: 1 }, select: { activeDeviceId: true } }))?.activeDeviceId;
  if (!validDeviceNumber(selected)) throw new UploadInputError("No target device specified. Select a device or set an active device.");
  const jobs = await acquireDeviceFiles([selected], request, deviceProfileAcquire(options));
  const cancellation = new AbortController(); const signal = AbortSignal.any([jobs.signal, cancellation.signal]);
  const scoped: DeviceJobs = { ...jobs, signal, async assertActive() { signal.throwIfAborted(); await jobs.assertActive(); signal.throwIfAborted(); } };
  let target: Awaited<ReturnType<typeof preflightUploadTarget>> | undefined;
  let session: Awaited<ReturnType<typeof loadUploadSession>>;
  try {
    await canonicalUploadSession(input.sessionId);
    target = await preflightUploadTarget(selected, input.platform, scoped, options);
    session = await loadUploadSession(input.sessionId, input.platform, { signal });
    const selectedGames = session.games.filter((game) => input.gameIds.includes(game.id));
    if (!selectedGames.length || selectedGames.length !== new Set(input.gameIds).size || selectedGames.length > 100) throw new UploadInputError("No matching games found for provided gameIds");
  } catch (error) { target?.connection.disconnect(); await jobs.close(); throw error; }
  const activeTarget = target;
  const games = session.games.filter((game) => input.gameIds.includes(game.id));
  const allInputs = new Set([...session.descriptorInputs.values()].flat());
  const preparation = new Map(games.map((game) => {
    const extensions = game.conversion === "chd" ? [".cue", ".gdi", ".iso"] : game.conversion === "rvz" ? [".iso"] : [];
    const conversions = game.files.filter((file) => !allInputs.has(file.path) && extensions.includes(path.extname(file.name).toLowerCase()));
    const extension = game.conversion === "chd" ? ".chd" : ".rvz";
    const consumed = new Set(conversions.flatMap((file) => [file.path, ...session.descriptorInputs.get(file.path) ?? []]));
    const names = [...conversions.map((file) => path.parse(file.name).name + extension), ...game.files.filter((file) => !consumed.has(file.path)).map((file) => file.name)];
    if (game.type === "multi-disc") names.push(`${game.title}.m3u`);
    return [game.id, { conversions, extension, names }];
  }));
  const owners = new Map<string, string>(); const collisions = new Set<string>();
  for (const game of games) for (const name of preparation.get(game.id)!.names) {
    const previous = owners.get(name); if (previous) { collisions.add(previous); collisions.add(game.id); } owners.set(name, game.id);
  }
  let rawSettings: Awaited<ReturnType<typeof db.settings.findUnique>>;
  try { rawSettings = await db.settings.findUnique({ where: { id: 1 } }); }
  catch (error) { try { activeTarget.connection.disconnect(); } finally { await jobs.close(); } throw error; }
  let completion: Promise<void>; let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (data: Record<string, unknown>) => { if (!cancelled) { try { controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)); } catch { cancellation.abort(new AdmissionError(409, "Upload stream closed")); } } };
      completion = (async () => {
        let succeeded = 0; let failed = 0;
        try {
          send({ type: "start", totalGames: games.length });
          for (const game of games) {
            if (signal.aborted) break; let planId: string | undefined;
            try {
              await scoped.assertActive(); const prepared = preparation.get(game.id)!;
              if (!prepared.names.length) throw new UploadInputError("No files to transfer");
              for (const name of prepared.names) assertUploadFilename(name);
              if (collisions.has(game.id)) throw new UploadInputError("Colliding transfer filenames", 409);
              if (activeTarget.profile.formats.length && prepared.names.some((name) => !activeTarget.profile.formats.includes(path.extname(name).toLowerCase()))) throw new UploadInputError("A planned file format is not allowed by the target profile", 422);
              for (const name of prepared.names) { try { await activeTarget.io.lstat(path.posix.join(activeTarget.directory, name)); throw new UploadInputError("Target file already exists; upload never overwrites", 409); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; } }
              const targetSpace = await activeTarget.io.freeBytes(activeTarget.directory);
              if (targetSpace.state !== "known" || targetSpace.bytes < BigInt(game.totalSize) + BigInt(activeTarget.profile.reserveBytes)) throw new UploadInputError("Target free space is insufficient including reserve", 422);
              send({ type: "game-start", gameId: game.id, title: game.title, step: "convert" });
              const outputs: { name: string; localPath: string; disc?: number }[] = []; const consumed = new Set<string>();
              const generated = path.join(session.sessionDir, `.ludotek-generated-${randomUUID()}`);
              if (prepared.conversions.length || game.type === "multi-disc") await mkdir(generated, { mode: 0o700 });
              for (const file of prepared.conversions) {
                await scoped.assertActive(); const name = path.parse(file.name).name + prepared.extension; const outputPath = path.join(generated, name);
                const available = await uploadFreeBytes(session.sessionDir);
                if (available < BigInt(game.totalSize)) throw new UploadInputError("Conversion cache has insufficient authoritative disk space", 413);
                send({ type: "convert-progress", gameId: game.id, file: file.name, percent: 0 });
                await (options.converter ?? convert)({ inputPath: file.path, outputPath, format: game.conversion as "chd" | "rvz", chdType: input.platform === "ps2" && path.extname(file.name).toLowerCase() === ".iso" ? "dvd" : "cd", signal, maxOutputBytes: Number(available > BigInt(MAX_BYTES) ? BigInt(MAX_BYTES) : available), onProgress: (percent) => send({ type: "convert-progress", gameId: game.id, file: file.name, percent: Math.round(percent) }) });
                consumed.add(file.path); for (const reference of session.descriptorInputs.get(file.path) ?? []) consumed.add(reference);
                outputs.push({ name, localPath: outputPath, disc: file.disc }); send({ type: "convert-done", gameId: game.id, file: file.name });
              }
              outputs.push(...game.files.filter((file) => !consumed.has(file.path)).map((file) => ({ name: file.name, localPath: file.path, disc: file.disc })));
              if (!outputs.length) throw new UploadInputError("No files to transfer");
              if (game.type === "multi-disc") {
                const playlist = path.join(generated, `${game.title}.m3u`);
                const discs = outputs.filter((file) => file.disc !== undefined || [".chd", ".rvz", ".iso", ".cue", ".gdi", ".pbp", ".cso"].includes(path.extname(file.name).toLowerCase()));
                if (!discs.length) throw new UploadInputError("No verified disc files for playlist");
                await writeFile(playlist, discs.map((file) => `${path.relative(generated, file.localPath).split(path.sep).join("/")}\n`).join(""), { flag: "wx", mode: 0o600 });
                outputs.push({ name: `${game.title}.m3u`, localPath: playlist });
              }
              await scoped.assertActive(); send({ type: "game-step", gameId: game.id, step: "transfer" });
              const sources = await registerUploadSources(input.sessionId, session.sessionDir, input.platform, outputs, scoped, db);
              const journalOptions = { ...options, heldJobs: { deviceIds: [selected], jobs: scoped } };
              const plan = await (options.createPlan ?? createUploadFilePlan)({ targetDeviceId: selected, sources: sources.map((source) => ({ sourceId: source.id, targetPath: path.posix.join(activeTarget.directory, source.filename) })) }, request, journalOptions);
              planId = plan.id; send({ type: "game-plan", gameId: game.id, planId });
              const availableTarget = await activeTarget.io.freeBytes(activeTarget.directory);
              if (availableTarget.state !== "known" || availableTarget.bytes < BigInt(plan.totalBytes) + BigInt(activeTarget.profile.reserveBytes)) throw new UploadInputError("Actual upload plan exceeds target space including reserve", 422);
              send({ type: "transfer-progress", gameId: game.id, planId, percent: 0, completedFiles: 0, totalFiles: plan.operations.length });
              const applied = await (options.applyPlan ?? applyFilePlan)(plan.id, request, journalOptions);
              if (applied.status !== "applied") throw new UploadInputError("Upload file plan needs recovery", 409);
              send({ type: "transfer-progress", gameId: game.id, planId, percent: 100, completedFiles: applied.operations.length, totalFiles: applied.operations.length });
              for (const expected of await getFilePlanFingerprints(plan.id, { db })) {
                const actual = await readProfileFingerprint(activeTarget.io, expected.path, scoped);
                if (actual.sha256 !== expected.sha256 || actual.size !== expected.size) throw new UploadInputError("Target changed before catalog binding", 409);
              }
              await scoped.assertActive(); send({ type: "game-step", gameId: game.id, step: "scan" });
              const representative = game.type === "multi-disc" ? `${game.title}.m3u` : outputs.find((file) => [".chd", ".rvz", ".cue", ".gdi", ".m3u"].includes(path.extname(file.name).toLowerCase()))?.name ?? outputs[0].name;
              const catalog = await bindUploadedCatalog(applied, { title: game.title, platform: input.platform, representative, deviceId: selected }, scoped, db);
              const proof = await getUploadSourceReleaseProof(plan.id, { db });
              if (proof.releasable) await db.$transaction(async (tx) => { await assertDeviceJobsOwned(scoped, tx); signal.throwIfAborted(); await tx.uploadFileSource.updateMany({ where: { id: { in: proof.sourceIds } }, data: { released: true } }); });
              let coverUrl: string | null = null;
              if (!signal.aborted && rawSettings?.igdbClientId && rawSettings.igdbClientSecret) {
                send({ type: "game-step", gameId: game.id, step: "enrich" }); let enrichment: EnrichmentJob | undefined;
                try {
                  const metadataRequest = new Request(request.url, { signal });
                  const acquire = options.enrichAcquire ?? (options.db ? async (request: Request) => deviceProfileAcquire(options)!("enrichment", request) : acquireEnrichment);
                  enrichment = await acquire(metadataRequest); const active = enrichment;
                  await active.run(async () => {
                    await active.assertActive(); const data = await searchIgdb(game.title, input.platform, rawSettings.igdbClientId, decrypt(rawSettings.igdbClientSecret));
                    if (!data) return; coverUrl = data.coverUrl;
                    if (!coverUrl && rawSettings.steamgriddbKey) coverUrl = await searchSteamGridDb(game.title, decrypt(rawSettings.steamgriddbKey));
                    await active.assertActive(); await scoped.assertActive();
                    await db.$transaction(async (tx) => { await assertDeviceJobsOwned(scoped, tx); signal.throwIfAborted(); await tx.game.update({ where: { id: catalog.id }, data: { igdbId: data.igdbId, coverUrl, igdbScore: data.igdbScore, metacriticScore: data.metacriticScore, genres: JSON.stringify(data.genres), developer: data.developer, publisher: data.publisher, releaseDate: data.releaseDate, summary: data.summary, screenshotUrls: JSON.stringify(data.screenshotUrls), videoIds: JSON.stringify(data.videoIds), artworkUrls: JSON.stringify(data.artworkUrls), franchise: data.franchise, themes: JSON.stringify(data.themes) } }); });
                  });
                } catch (error) { send({ type: error instanceof AdmissionError ? "enrich-skipped" : "enrich-error", gameId: game.id, reason: error instanceof AdmissionError ? error.reason : "Optional enrichment failed", ...(error instanceof AdmissionError ? { status: error.status } : {}) }); }
                finally { try { await enrichment?.close(); } catch { send({ type: "enrich-error", gameId: game.id, reason: "Admission store unavailable", status: 503 }); } }
              }
              if (signal.aborted) break;
              send({ type: "game-done", gameId: game.id, dbId: catalog.id, title: game.title, coverUrl, planId, transferredFiles: applied.operations.length }); succeeded++;
            } catch (error) {
              if (signal.aborted) break;
              const failure = error as { planId?: string; status?: number; name?: string; message?: string };
              send({ type: "game-error", gameId: game.id, title: game.title, error: error instanceof UploadInputError || failure.name === "FilePlanError" ? failure.message : "Upload failed; inspect the saved file plan", ...(planId || failure.planId ? { planId: planId ?? failure.planId } : {}), ...(failure.status ? { status: failure.status } : {}) }); failed++;
            }
          }
          if (!signal.aborted && failed === 0 && succeeded === games.length && games.length === session.games.length) { try { await removeOwnedUploadSession(input.sessionId, scoped, db); } catch { /* Retain sources on uncertain cleanup state. */ } }
          send({ type: "done", processed: succeeded + failed, succeeded, failed, stopped: signal.aborted });
        } finally { try { activeTarget.connection.disconnect(); } finally { await jobs.close(); } if (!cancelled) controller.close(); }
      })().catch(() => { if (!cancelled) { try { controller.close(); } catch { /* Already closed. */ } } });
    }, async cancel() { cancelled = true; cancellation.abort(new AdmissionError(409, "Upload cancelled")); await completion; },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" } });
}
