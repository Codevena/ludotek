import { createHash } from "node:crypto";
import { PassThrough } from "node:stream";
import { type PrismaClient, type DeviceFile, type IntegrityJob } from "@prisma/client";
import { createConnection, type DeviceConnection, type FileEntryStat } from "@/lib/connection";
import { decrypt } from "@/lib/encryption";
import { parseDat, type DatRom } from "@/lib/dat";
import { classifyDump, hashReadable, type FileFingerprint } from "@/lib/integrity";
import { AdmissionStore, AdmissionError, EnrichmentJob, admissionResponse } from "@/lib/job-admission";
import { acquireDeviceFiles, assertDeviceJobsOwned, type DeviceJobs } from "@/lib/device-jobs";
import { prisma } from "@/lib/prisma";

export const INTEGRITY_DAT_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 100_000;
const MAX_FILE_BYTES = 64 * 1024 * 1024 * 1024;
const MAX_JOB_BYTES = BigInt(2 * 1024 ** 4);
const FILE_TIMEOUT = 30 * 60_000;
const PAGE_SIZE = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class IntegrityInputError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
export interface IntegrityStartInput {
  datSourceId?: string;
  fileIds?: number[];
  expected?: { deviceFileId: number; romIndex: number }[];
}
export interface IntegritySourceView { id: string; name: string; format: string; romCount: number; createdAt: Date }
export interface IntegrityJobView {
  id: string; deviceId: number; datSourceId: string | null; sourceName: string | null;
  status: string; progress: number; total: number; checked: number; cancelRequested: boolean;
  error: string | null; createdAt: Date; completedAt: Date | null;
}
export interface IntegrityResultView {
  id: number; deviceFileId: number | null; path: string; fingerprint: Partial<FileFingerprint>;
  status: string; originalStatus: string; stale: boolean; duplicateCount: number;
  matches: DatRom[]; matchCount: number; expectedRom: DatRom | null; datSourceId: string | null; sourceName: string | null;
}
export interface IntegritySnapshot {
  job: IntegrityJobView; results: IntegrityResultView[]; nextCursor: number | null;
}

function positiveId(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) > 0 && (value as number) <= 2147483647; }
function uuid(value: unknown): value is string { return typeof value === "string" && UUID.test(value); }
function friendlyName(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 120 || /[\x00-\x1f\x7f]/.test(value)) throw new IntegrityInputError("Invalid DAT name (1–120 characters)");
  return value.trim();
}
export function parseIntegrityStart(input: unknown): IntegrityStartInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new IntegrityInputError("Invalid integrity request");
  const body = input as Record<string, unknown>;
  if (Object.keys(body).some((key) => !["datSourceId", "fileIds", "expected"].includes(key))) throw new IntegrityInputError("Unknown integrity request field");
  if (body.datSourceId !== undefined && !uuid(body.datSourceId)) throw new IntegrityInputError("Invalid DAT source");
  if (body.fileIds !== undefined && (!Array.isArray(body.fileIds) || !body.fileIds.length || body.fileIds.length > 1000 || !body.fileIds.every(positiveId) || new Set(body.fileIds).size !== body.fileIds.length)) throw new IntegrityInputError("Invalid selected files (maximum 1000)");
  if (body.expected !== undefined) {
    if (!uuid(body.datSourceId) || !Array.isArray(body.expected) || body.expected.length > 1000) throw new IntegrityInputError("Expected revisions require a selected DAT source");
    const seen = new Set<number>();
    for (const value of body.expected) {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new IntegrityInputError("Invalid expected revision");
      const pair = value as Record<string, unknown>;
      if (Object.keys(pair).some((key) => !["deviceFileId", "romIndex"].includes(key)) || !positiveId(pair.deviceFileId) || !Number.isSafeInteger(pair.romIndex) || (pair.romIndex as number) < 0 || seen.has(pair.deviceFileId)) throw new IntegrityInputError("Invalid or duplicate expected revision");
      seen.add(pair.deviceFileId);
    }
  }
  return { datSourceId: body.datSourceId as string | undefined, fileIds: body.fileIds as number[] | undefined, expected: body.expected as IntegrityStartInput["expected"] };
}

/** Content-Length is only an early rejection; the actual bytes are always bounded. */
export async function readIntegrityBody(request: Request, maxBytes: number): Promise<Buffer> {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) throw new IntegrityInputError("Request body exceeds its byte limit", 413);
  if (!request.body) throw new IntegrityInputError("Request body required");
  const reader = request.body.getReader();
  let rejectDeadline!: (error: IntegrityInputError) => void;
  const deadline = new Promise<never>((_, reject) => { rejectDeadline = reject; });
  const stop = () => { rejectDeadline(new IntegrityInputError("Request body timed out or was cancelled", 408)); void reader.cancel().catch(() => {}); };
  const timer = setTimeout(stop, 10_000);
  request.signal.addEventListener("abort", stop, { once: true });
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    if (request.signal.aborted) throw new IntegrityInputError("Request cancelled", 408);
    while (true) {
      const chunk = await Promise.race([reader.read(), deadline]);
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) { void reader.cancel().catch(() => {}); throw new IntegrityInputError("Request body exceeds its byte limit", 413); }
      chunks.push(chunk.value);
    }
    return Buffer.concat(chunks);
  } catch (error) {
    if (error instanceof IntegrityInputError) throw error;
    throw new IntegrityInputError("Invalid request body");
  } finally {
    clearTimeout(timer); request.signal.removeEventListener("abort", stop); reader.releaseLock();
  }
}

function storedRoms(value: string): DatRom[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.length > 20_000) throw new Error("Invalid stored DAT source");
  return parsed as DatRom[];
}
function sameMetadata(stat: FileEntryStat, file: DeviceFile): boolean {
  return stat.type === "file" && BigInt(stat.size) === file.size && (stat.modifiedAt ?? null) === file.modifiedAt;
}
function sameStat(before: FileEntryStat, after: FileEntryStat): boolean {
  return before.type === "file" && after.type === "file" && before.size === after.size && before.modifiedAt === after.modifiedAt && (!before.identity || !after.identity || before.identity === after.identity);
}

type ActiveJob = { controller: AbortController; promise: Promise<void> };
type ServiceOptions = { connect?: typeof createConnection; clock?: () => number; decrypt?: typeof decrypt; beforeResultWrite?: () => Promise<void>; beforeCompleteWrite?: () => Promise<void> };

export class DeviceIntegrityService {
  private readonly active = new Map<string, ActiveJob>();
  private readonly connect: typeof createConnection;
  private readonly clock: () => number;
  private readonly decrypt: typeof decrypt;
  private readonly admission: AdmissionStore;
  private readonly beforeResultWrite?: () => Promise<void>;
  private readonly beforeCompleteWrite?: () => Promise<void>;
  constructor(private readonly db: PrismaClient, options: ServiceOptions = {}) {
    this.connect = options.connect ?? createConnection;
    this.clock = options.clock ?? Date.now;
    this.decrypt = options.decrypt ?? decrypt;
    this.admission = new AdmissionStore(db, this.clock);
    this.beforeResultWrite = options.beforeResultWrite;
    this.beforeCompleteWrite = options.beforeCompleteWrite;
  }
  async importDat(bytes: Buffer, name?: string): Promise<IntegritySourceView> {
    if (bytes.length > INTEGRITY_DAT_BYTES) throw new IntegrityInputError("DAT exceeds 5 MiB", 413);
    const suppliedName = name === undefined ? undefined : friendlyName(name);
    let parsed: ReturnType<typeof parseDat>;
    try { parsed = parseDat(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
    catch { throw new IntegrityInputError("Invalid DAT document"); }
    let resolvedName = suppliedName ?? "Imported DAT";
    if (!suppliedName && parsed.name) { try { resolvedName = friendlyName(parsed.name); } catch { /* Keep the safe fallback. */ } }
    const contentHash = createHash("sha256").update(bytes).digest("hex");
    const row = await this.db.datSource.upsert({ where: { contentHash }, update: {}, create: { name: resolvedName, format: parsed.format, roms: JSON.stringify(parsed.roms), contentHash } });
    return { id: row.id, name: row.name, format: row.format, romCount: parsed.roms.length, createdAt: row.createdAt };
  }
  async sources(afterId = "") {
    if (afterId && !uuid(afterId)) throw new IntegrityInputError("Invalid source cursor");
    const rows = await this.db.$queryRaw<{ id: string; name: string; format: string; romCount: number; createdAt: number }[]>`
      SELECT id, name, format, json_array_length(roms) AS romCount, createdAt FROM DatSource WHERE id > ${afterId} ORDER BY id LIMIT 201`;
    const sources = rows.slice(0, PAGE_SIZE).map((row) => ({ ...row, romCount: Number(row.romCount), createdAt: new Date(Number(row.createdAt)) }));
    return { sources, nextCursor: rows.length > PAGE_SIZE ? sources.at(-1)!.id : null };
  }
  async sourceRoms(sourceId: string, afterIndex = -1, query = "") {
    if (!uuid(sourceId) || !Number.isSafeInteger(afterIndex) || afterIndex < -1 || query.length > 100) throw new IntegrityInputError("Invalid DAT selection or cursor");
    const source = await this.db.datSource.findUnique({ where: { id: sourceId } });
    if (!source) throw new IntegrityInputError("DAT source not found", 404);
    const roms = storedRoms(source.roms);
    const matches = roms.map((rom, index) => ({ ...rom, index })).filter((rom) => rom.index > afterIndex && (!query || `${rom.gameName} ${rom.name}`.toLowerCase().includes(query.toLowerCase()))).slice(0, PAGE_SIZE + 1);
    return { source: { id: source.id, name: source.name, format: source.format, romCount: roms.length }, roms: matches.slice(0, PAGE_SIZE), nextCursor: matches.length > PAGE_SIZE ? matches[PAGE_SIZE - 1].index : null };
  }
  async overview(deviceId: number, afterFileId = 0, query = "", beforeJobId?: string) {
    if (!positiveId(deviceId) || !Number.isSafeInteger(afterFileId) || afterFileId < 0 || afterFileId > 2147483647 || query.length > 100) throw new IntegrityInputError("Invalid device or file cursor");
    const device = await this.db.device.findUnique({ where: { id: deviceId }, select: { id: true } });
    if (!device) throw new IntegrityInputError("Device not found", 404);
    if (beforeJobId && !uuid(beforeJobId)) throw new IntegrityInputError("Invalid history cursor");
    const previous = beforeJobId ? await this.db.integrityJob.findUnique({ where: { id: beforeJobId }, select: { deviceId: true, createdAt: true, id: true } }) : null;
    if (beforeJobId && (!previous || previous.deviceId !== deviceId)) throw new IntegrityInputError("History cursor does not belong to this device");
    const [files, job, inventory, history, totalFiles] = await Promise.all([
      this.db.deviceFile.findMany({ where: { deviceId, source: "rom", kind: "file", id: { gt: afterFileId }, ...(query ? { path: { contains: query } } : {}) }, orderBy: { id: "asc" }, take: PAGE_SIZE + 1,
        select: { id: true, path: true, size: true, platform: true } }),
      this.db.integrityJob.findFirst({ where: { deviceId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
      this.db.deviceInventory.findUnique({ where: { deviceId }, select: { complete: true } }),
      this.db.integrityJob.findMany({ where: { deviceId, ...(previous ? { OR: [{ createdAt: { lt: previous.createdAt } }, { createdAt: previous.createdAt, id: { lt: previous.id } }] } : {}) }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: PAGE_SIZE + 1 }),
      this.db.deviceFile.count({ where: { deviceId, source: "rom", kind: "file" } }),
    ]);
    const historyPage = history.slice(0, PAGE_SIZE);
    const sourceNames = await this.db.datSource.findMany({ where: { id: { in: [...new Set(historyPage.flatMap((entry) => entry.datSourceId ? [entry.datSourceId] : []))] } }, select: { id: true, name: true } });
    const names = new Map(sourceNames.map((source) => [source.id, source.name]));
    return { files: files.slice(0, PAGE_SIZE).map((file) => ({ ...file, size: file.size.toString() })), nextFilesCursor: files.length > PAGE_SIZE ? files[PAGE_SIZE - 1].id : null,
      totalFiles, inventoryComplete: inventory?.complete ?? false, job: job ? (await this.snapshot(job.id)).job : null,
      jobs: historyPage.map((entry) => this.jobView(entry, entry.datSourceId ? names.get(entry.datSourceId) ?? null : null, entry.status)), nextJobsCursor: history.length > PAGE_SIZE ? historyPage.at(-1)!.id : null };
  }
  async start(deviceId: number, body: IntegrityStartInput): Promise<IntegrityJobView> {
    if (!positiveId(deviceId)) throw new IntegrityInputError("Invalid device ID");
    const input = parseIntegrityStart(body);
    // Namespace and device ownership both precede credentials and connections.
    const scoped = await acquireDeviceFiles([deviceId], new Request("http://ludotek.internal/integrity"),
      async (resource, request) => new EnrichmentJob(await this.admission.acquire(resource), request.signal));
    let accepted = false;
    try {
      await scoped.assertActive();
      const owner = scoped.resourceOwners?.get(`files:${deviceId}`);
      const globalOwner = scoped.resourceOwners?.get("device-files");
      if (!owner || !globalOwner) throw new AdmissionError(503, "Integrity ownership proof unavailable");
      const exists = await this.db.device.findUnique({ where: { id: deviceId }, select: { id: true } });
      if (!exists) throw new IntegrityInputError("Device not found", 404);
      const source = input.datSourceId ? await this.db.datSource.findUnique({ where: { id: input.datSourceId } }) : null;
      if (input.datSourceId && !source) throw new IntegrityInputError("DAT source not found", 404);
      const roms = source ? storedRoms(source.roms) : [];
      const files = await this.db.deviceFile.findMany({ where: { deviceId, source: "rom", kind: "file", ...(input.fileIds ? { id: { in: input.fileIds } } : {}) }, orderBy: { id: "asc" }, take: MAX_FILES + 1 });
      if (!files.length || files.length > MAX_FILES || (input.fileIds && files.length !== input.fileIds.length)) throw new IntegrityInputError("Select confirmed ROM files belonging to this device");
      const expected = new Map<number, DatRom>();
      for (const pair of input.expected ?? []) {
        if (!files.some((file) => file.id === pair.deviceFileId) || pair.romIndex >= roms.length) throw new IntegrityInputError("Expected revision does not belong to selected files and DAT source");
        expected.set(pair.deviceFileId, roms[pair.romIndex]);
      }
      let totalBytes = BigInt(0);
      for (const file of files) { totalBytes += file.size; if (file.size < BigInt(0) || file.size > BigInt(MAX_FILE_BYTES) || totalBytes > MAX_JOB_BYTES) throw new IntegrityInputError("Integrity limits: 64 GiB per file, 2 TiB per job"); }
      await scoped.assertActive();
      const row = await this.db.$transaction(async (tx) => {
        await assertDeviceJobsOwned(scoped, tx);
        // A newly acquired owner proves previous running jobs no longer own this resource.
        await tx.integrityJob.updateMany({ where: { deviceId, status: "running" }, data: { status: "interrupted", error: "The device lease no longer belongs to this job", completedAt: new Date(this.clock()) } });
        return tx.integrityJob.create({ data: { deviceId, datSourceId: source?.id, status: "running", total: files.length, owner, globalOwner } });
      });
      const active: ActiveJob = { controller: new AbortController(), promise: Promise.resolve() };
      this.active.set(row.id, active);
      active.promise = this.run(row, files, roms, expected, scoped, active.controller);
      // Cancellation and status are durable. This map is only an in-process drain handle.
      void active.promise.catch(() => {});
      accepted = true;
      return this.jobView(row, source?.name ?? null, row.status);
    } finally { if (!accepted) await scoped.close(); }
  }
  async wait(jobId: string): Promise<void> { await this.active.get(jobId)?.promise; }
  private jobView(job: IntegrityJob, sourceName: string | null, status: string): IntegrityJobView {
    return { id: job.id, deviceId: job.deviceId, datSourceId: job.datSourceId, sourceName, status, progress: job.progress, total: job.total,
      checked: job.checked, cancelRequested: job.cancelRequested, error: status === "interrupted" ? "The device lease no longer belongs to this job" : job.error, createdAt: job.createdAt, completedAt: job.completedAt };
  }
  private async run(row: IntegrityJob, files: DeviceFile[], roms: DatRom[], expected: Map<number, DatRom>, scoped: DeviceJobs, controller: AbortController) {
    const signal = AbortSignal.any([scoped.signal, controller.signal]);
    let connection: DeviceConnection | undefined;
    let checked = 0;
    let staleCount = 0;
    let polling: Promise<void> | undefined;
    const poll = (): Promise<void> => {
      if (signal.aborted) return Promise.resolve();
      if (!polling) {
        polling = (async () => {
          try {
            const current = await this.db.integrityJob.findUnique({ where: { id: row.id }, select: { cancelRequested: true } });
            if (!current || current.cancelRequested) controller.abort(new Error("Integrity job cancelled"));
          } catch { controller.abort(new Error("Integrity store unavailable")); }
        })().finally(() => { polling = undefined; });
      }
      return polling;
    };
    const timer = setInterval(() => { void poll(); }, 500);
    timer.unref?.();
    const assertActive = async () => { signal.throwIfAborted(); await scoped.assertActive(); await poll(); signal.throwIfAborted(); };
    try {
      await assertActive();
      const device = await this.db.device.findUnique({ where: { id: row.deviceId } });
      if (!device) throw new IntegrityInputError("Device was removed", 409);
      await assertActive();
      connection = await this.connect({ protocol: device.protocol as "local" | "ssh" | "ftp", host: device.host, port: device.port, user: device.user, password: this.decrypt(device.password), ftps: device.ftps });
      await assertActive();
      const io = connection.fileIo;
      if (!io) throw new IntegrityInputError("This connection cannot provide bounded streaming reads", 409);
      for (const file of files) {
        await assertActive();
        const before = await io.lstat(file.path);
        await assertActive();
        let fingerprint: Partial<FileFingerprint> = {};
        let stale = !sameMetadata(before, file);
        if (!stale) {
          const bytes = new PassThrough();
          const hashing = hashReadable(bytes, { maxBytes: Number(file.size), signal, timeoutMs: FILE_TIMEOUT });
          const reading = io.readTo(file.path, bytes, { maxBytes: Number(file.size), expectedBytes: Number(file.size), timeoutMs: FILE_TIMEOUT, signal });
          void reading.catch((error) => { bytes.destroy(error instanceof Error ? error : new Error("Stream failed")); controller.abort(error); });
          void hashing.catch((error) => { controller.abort(error); });
          // Both promises are observed immediately and drained even on rejection.
          const outcomes = await Promise.allSettled([hashing, reading]);
          const failed = outcomes.find((result) => result.status === "rejected");
          if (failed?.status === "rejected") throw failed.reason;
          fingerprint = (outcomes[0] as PromiseFulfilledResult<FileFingerprint>).value;
          await assertActive();
          const after = await io.lstat(file.path);
          await assertActive();
          stale = !sameStat(before, after) || !sameMetadata(after, file);
        }
        const classification = fingerprint.sha256 && !stale ? classifyDump(fingerprint as FileFingerprint, roms, expected.get(file.id)) : { status: "stale", matches: [] as DatRom[] };
        await assertActive();
        await this.beforeResultWrite?.();
        await this.db.$transaction(async (tx) => {
          // The common fence checks both captured owners in this writer TX.
          await assertDeviceJobsOwned(scoped, tx);
          const currentJob = await tx.integrityJob.findUnique({ where: { id: row.id }, select: { owner: true, globalOwner: true, status: true, cancelRequested: true } });
          if (currentJob?.owner !== row.owner || currentJob.globalOwner !== row.globalOwner || currentJob.status !== "running") throw new AdmissionError(409, "Integrity device lease lost");
          if (currentJob.cancelRequested) throw new IntegrityInputError("Integrity job cancelled", 409);
          const current = await tx.deviceFile.updateMany({ where: { id: file.id, deviceId: row.deviceId, path: file.path, size: file.size, modifiedAt: file.modifiedAt, generation: file.generation, kind: "file" }, data: { sha256: stale ? null : fingerprint.sha256 } });
          const linked = await tx.deviceFile.findUnique({ where: { id: file.id }, select: { id: true } });
          if (current.count !== 1) stale = true;
          await tx.integrityResult.create({ data: { jobId: row.id, deviceFileId: linked?.id, deviceId: row.deviceId, path: file.path, fingerprint: JSON.stringify(fingerprint),
            observedModifiedAt: before.modifiedAt, datSourceId: row.datSourceId, expectedRom: expected.has(file.id) ? JSON.stringify(expected.get(file.id)) : null,
            status: stale ? "stale" : classification.status, matches: JSON.stringify(classification.matches.slice(0, 100)), matchCount: classification.matches.length } });
          checked++;
          if (stale) staleCount++;
          await tx.integrityJob.update({ where: { id: row.id }, data: { checked, progress: Math.floor(checked * 100 / files.length) } });
        });
      }
      await assertActive();
      await this.beforeCompleteWrite?.();
      await this.db.$transaction(async (tx) => {
        await assertDeviceJobsOwned(scoped, tx);
        const terminal = await tx.integrityJob.updateMany({ where: { id: row.id, owner: row.owner, globalOwner: row.globalOwner, status: "running", cancelRequested: false },
          data: { status: staleCount ? "completed_with_stale" : "completed", completedAt: new Date(this.clock()), error: staleCount ? `${staleCount} files changed; rescan before checking them again` : null } });
        if (terminal.count !== 1) throw new IntegrityInputError("Integrity completion was cancelled or superseded", 409);
      });
    } catch (error) {
      if (error instanceof AdmissionError && error.status === 409) controller.abort(error);
      try {
        await this.db.$transaction(async (tx) => {
          await assertDeviceJobsOwned(scoped, tx);
          const current = await tx.integrityJob.findUnique({ where: { id: row.id }, select: { cancelRequested: true } });
          await tx.integrityJob.updateMany({ where: { id: row.id, owner: row.owner, globalOwner: row.globalOwner, status: "running" },
            data: { status: current?.cancelRequested ? "cancelled" : scoped.signal.aborted || error instanceof AdmissionError && error.status === 409 ? "interrupted" : "failed", completedAt: new Date(this.clock()), error: current?.cancelRequested ? "Integrity job cancelled" : "Integrity check stopped before completion" } });
        });
      } catch { /* A later read derives interrupted status from the lost authoritative lease. */ }
    } finally {
      clearInterval(timer);
      await polling;
      connection?.disconnect();
      try { await scoped.close(); }
      catch { /* No worker-state write is permitted after either lease was released. */ }
      finally { this.active.delete(row.id); }
    }
  }
  async snapshot(jobId: string, afterId = 0): Promise<IntegritySnapshot> {
    if (!uuid(jobId) || !Number.isSafeInteger(afterId) || afterId < 0 || afterId > 2147483647) throw new IntegrityInputError("Invalid job or result cursor");
    return this.db.$transaction(async (tx) => {
      const job = await tx.integrityJob.findUnique({ where: { id: jobId } });
      if (!job) throw new IntegrityInputError("Integrity job not found", 404);
      const [lease, namespace, clock, source, rows] = await Promise.all([
        tx.jobLease.findUnique({ where: { resource: `files:${job.deviceId}` } }),
        tx.jobLease.findUnique({ where: { resource: "device-files" } }),
        tx.admissionClock.findUnique({ where: { id: 1 } }),
        job.datSourceId ? tx.datSource.findUnique({ where: { id: job.datSourceId }, select: { name: true } }) : null,
        tx.integrityResult.findMany({ where: { jobId, id: { gt: afterId } }, orderBy: { id: "asc" }, take: PAGE_SIZE + 1,
          include: { file: { select: { path: true, size: true, modifiedAt: true, sha256: true } } } }),
      ]);
      const now = BigInt(Math.max(this.clock(), Number(clock?.value ?? BigInt(0))));
      const status = job.status === "running" && (!lease || !job.owner || lease.owner !== job.owner || lease.expiresAt <= now ||
        !namespace || !job.globalOwner || namespace.owner !== job.globalOwner || namespace.expiresAt <= now) ? "interrupted" : job.status;
      const page = rows.slice(0, PAGE_SIZE);
      const hashes = page.map((row) => JSON.parse(row.fingerprint)?.sha256).filter((hash): hash is string => typeof hash === "string" && /^[a-f0-9]{64}$/.test(hash));
      const duplicateRows = hashes.length ? await tx.$queryRaw<{ sha: string; size: number; count: number }[]>`
        SELECT json_extract(fingerprint, '$.sha256') AS sha, json_extract(fingerprint, '$.size') AS size, COUNT(*) AS count
        FROM IntegrityResult WHERE jobId = ${jobId} AND status IN ('verified', 'unknown', 'mismatch')
          AND json_extract(fingerprint, '$.sha256') IN (SELECT value FROM json_each(${JSON.stringify(hashes)}))
        GROUP BY sha, size HAVING COUNT(*) > 1` : [];
      const duplicates = new Map(duplicateRows.map((group) => [`${group.sha}:${group.size}`, Number(group.count)]));
      const results = page.map((row): IntegrityResultView => {
        const fingerprint = JSON.parse(row.fingerprint) as Partial<FileFingerprint>;
        const stale = row.status === "stale" || !row.file || !fingerprint.sha256 || row.file.sha256 !== fingerprint.sha256 || row.file.path !== row.path ||
          row.file.size.toString() !== String(fingerprint.size) || row.file.modifiedAt !== row.observedModifiedAt;
        return { id: row.id, deviceFileId: row.deviceFileId, path: row.path, fingerprint, stale, status: stale ? "stale" : row.status, originalStatus: row.status,
          duplicateCount: duplicates.get(`${fingerprint.sha256}:${fingerprint.size}`) ?? 1, matches: JSON.parse(row.matches), matchCount: row.matchCount,
          expectedRom: row.expectedRom ? JSON.parse(row.expectedRom) : null, datSourceId: row.datSourceId, sourceName: source?.name ?? null };
      });
      return { job: this.jobView(job, source?.name ?? null, status), results, nextCursor: rows.length > PAGE_SIZE ? results.at(-1)!.id : null };
    });
  }
  async cancel(jobId: string): Promise<IntegritySnapshot> {
    if (!uuid(jobId)) throw new IntegrityInputError("Invalid job ID");
    const job = await this.db.integrityJob.findUnique({ where: { id: jobId } });
    if (!job) throw new IntegrityInputError("Integrity job not found", 404);
    if (job.status === "running") {
      await this.db.integrityJob.updateMany({ where: { id: jobId, status: "running" }, data: { cancelRequested: true } });
      const active = this.active.get(jobId);
      active?.controller.abort(new Error("Integrity job cancelled"));
      await active?.promise;
    }
    return this.snapshot(jobId);
  }
}

export const integrityService = new DeviceIntegrityService(prisma);
export function integrityErrorResponse(error: unknown): Response {
  if (error instanceof AdmissionError) return admissionResponse(error);
  if (error instanceof IntegrityInputError) return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  return Response.json({ error: "Integrity store unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
