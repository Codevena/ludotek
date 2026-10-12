import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { PassThrough, Readable, Writable } from "node:stream";
import type { Device, DeviceFile, FilePlan, FilePlanOperation, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createConnection, requireFileIo, type DeviceConnection, type FileIo } from "@/lib/connection";
import { AdmissionStore, EnrichmentJob, type acquireScopedJob } from "@/lib/job-admission";
import { acquireDeviceFiles, assertDeviceJobsOwned, type DeviceJobs } from "@/lib/device-jobs";
import { decrypt } from "@/lib/encryption";
import { getLocalFilesRoots, resolveLocalPath } from "@/lib/local-paths";
import { parseScanDescriptor } from "@/lib/scanner";
import { descriptorKind, expandDescriptorSelections, fileKey, type PlanDescriptor, type PlanSelection } from "@/lib/file-plan-descriptors";
import { createDirectoryPlan, directoryPlanView, executeDirectoryPlan } from "@/lib/file-plans-directory";
import { protectedUploadStat, readProtectedUploadTo, registeredProtectedUpload, verifyProtectedUpload } from "@/lib/file-plan-upload-source";

const MAX_FILE_BYTES = 16 * 1024 ** 3;
const MAX_TOTAL_BYTES = 128 * 1024 ** 3;
const MAX_DESCRIPTOR_BYTES = 1024 ** 2;
const MAX_DESCRIPTOR_TOTAL = 16 * 1024 ** 2;
const MAX_DESCRIPTOR_SNAPSHOT_BYTES = 16 * 1024 ** 2;
const MAX_DEVICE_STATE_BYTES = 32 * 1024 ** 2;
export interface FilePlanOptions {
  db?: PrismaClient;
  connect?: (device: Device) => Promise<DeviceConnection>;
  acquire?: typeof acquireScopedJob;
  heldJobs?: { deviceIds: number[]; jobs: DeviceJobs };
  /** Trusted server composition only; HTTP callers never supply this option. */
  replaceTargets?: { deviceId: number; path: string }[];
  storageDirectory?: string;
  targetBackupVersionId?: string;
  ioTimeoutMs?: number;
  totalTimeoutMs?: number;
}
export interface FilePlanInput {
  kind: "copy" | "move" | "rename" | "delete" | "mkdir";
  operations: { deviceId: number; filePath: string; gameId?: number; targetDeviceId?: number; newPath?: string }[];
}
export interface FilePlanOperationView {
  id: string; ordinal: number; kind: string; phase: string; error: string | null;
  deviceId: number; filePath: string; targetDeviceId?: number; newPath?: string;
  bytes: number; generated: boolean; rewritesDescriptor: boolean;
  sourceDeviceId: number; sourcePath: string; targetPath?: string;
  sourceFingerprint: { sha256: string; size: number }; outputFingerprint?: { sha256: string; size: number };
  sourceVersionId?: string;
  sourceUploadId?: string;
}
export interface FilePlanView {
  id: string; kind: string; status: string; totalBytes: string; revision: number;
  error: string | null; createdAt: string; appliedAt: string | null; operations: FilePlanOperationView[];
  warningLevel?: "checked_ftp";
  limitations?: string[];
}
export class FilePlanError extends Error {
  constructor(public readonly status: 400 | 404 | 409 | 413 | 422 | 503, public readonly code: string, message: string, public readonly planId?: string) { super(message); this.name = "FilePlanError"; }
}
export type FilePlanTransportPolicy = "strict_native" | "ftp_checked";
type Evidence = "native" | "content";
interface Fingerprint { size: number; sha256: string; modifiedAt: string | null; evidence?: Evidence; identity?: string; uniqueId?: string }
export const CHECKED_FTP_LIMITATIONS = [
  "FTP/FTPS prüft Inhalte und Serverbestätigungen; Veröffentlichung ist nicht atomar gegen gleichzeitige externe Schreibzugriffe.",
  "Rücknahme setzt voraus, dass kein anderer Client gleichzeitig schreibt. Fremde Ersetzungen mit identischen Inhalten lassen sich nicht sicher erkennen.",
  "Serverbestätigungen garantieren keine Beständigkeit bei Stromausfall. Unklare Antworten bleiben zur manuellen Wiederherstellung erhalten.",
  "Freier Zielplatz kann unbekannt sein; Transfers sind dann nur ohne konfigurierte Speicherreserve zulässig.",
];
interface StoredManifest {
  gameId: number | null; scanRoot: string; platformAlias: string; relativePath: string; platform: string | null;
  source: string; kind: string; size: string; modifiedAt: string | null; sha256: string | null; generation: string; seenAt: string;
}
interface Specification {
  version: 1; action: PlanSelection["action"]; generated: boolean;
  source: { deviceId: number; path: string; manifestPath: string; fingerprint: Fingerprint; record: StoredManifest; policy?: FilePlanTransportPolicy | "read_content"; manifestTracked?: boolean; noSourceManifest?: boolean; saveVersionId?: string; backupVersionId?: string; uploadSourceId?: string };
  target?: { deviceId: number; path: string; scanRoot: string; policy?: FilePlanTransportPolicy };
  payload?: string; tempPath?: string; quarantinePath: string; undoPath?: string; staged?: Fingerprint;
  artifacts: { deviceId: number; path: string; fingerprint: Fingerprint }[];
  /** A receipt exists only in the durably committed phase following successful I/O and readback. */
  receipts?: Partial<Record<"stage" | "quarantine" | "publish" | "undoTarget" | "restoreSource", true>>;
}
interface DescriptorSnapshotFile { path: string; fingerprint: Fingerprint }
interface DescriptorSnapshot { version: 1; files: DescriptorSnapshotFile[] }
interface DeviceSnapshot { id: number; configHash: string; roots: string[]; generation: string; evidence?: Evidence; descriptorGraph?: DescriptorSnapshot }
type PlanWithOperations = FilePlan & { operations: FilePlanOperation[] };
interface RuntimeOperation { row: FilePlanOperation; spec: Specification }
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const fail = (code: string, message: string, status: FilePlanError["status"] = 409): never => { throw new FilePlanError(status, code, message); };
const publicError = (error: unknown) => error instanceof FilePlanError ? error.message : "File I/O or journal storage failed; recovery must verify the saved state";
function validPath(filename: unknown): filename is string {
  return typeof filename === "string" && filename.length <= 4096 && filename.startsWith("/") && filename !== "/" && path.posix.normalize(filename) === filename && !/[\x00-\x1f\x7f-\x9f]/.test(filename);
}
function contains(root: string, filename: string) {
  const relative = path.posix.relative(root, filename);
  return relative !== "" && relative !== ".." && !relative.startsWith("../") && !path.posix.isAbsolute(relative);
}
function reserved(filename: string) { return filename.split("/").some((component) => component.startsWith(".ludotek-")); }
export function parseFilePlanScanRoots(scanPaths: string): string[] {
  let values: unknown;
  try { values = JSON.parse(scanPaths); } catch { return fail("INVALID_ROOTS", "Device scan roots are invalid", 422); }
  if (!Array.isArray(values) || !values.length || values.length > 32) return fail("INVALID_ROOTS", "Device needs 1–32 explicit scan roots", 422);
  const roots = values.map((value) => {
    const root = typeof value === "string" ? value : value && typeof value === "object" && "path" in value && "type" in value && ["rom", "steam"].includes(String(value.type)) ? value.path : undefined;
    if (!validPath(root) || reserved(root)) return fail("INVALID_ROOTS", "Device scan root entry is invalid", 422);
    return root;
  });
  return [...new Set(roots)];
}
function parseSaveRoots(saveRoots: string): { path: string; platform?: string }[] {
  let entries: unknown;
  try { entries = JSON.parse(saveRoots); } catch { return fail("INVALID_SAVE_ROOTS", "Save profile roots are invalid", 422); }
  if (!Array.isArray(entries) || !entries.length || entries.length > 32) return fail("INVALID_SAVE_ROOTS", "Device needs 1–32 explicit save roots", 422);
  return entries.map((entry) => {
    const value = typeof entry === "string" ? { path: entry } : entry as { path?: unknown; platform?: unknown } | null;
    if (!value || !validPath(value.path) || reserved(value.path) || (value.platform !== undefined && (typeof value.platform !== "string" || !/^[a-z0-9-]{1,40}$/.test(value.platform)))) return fail("INVALID_SAVE_ROOTS", "Save profile root entry is invalid", 422);
    return { path: value.path, ...(typeof value.platform === "string" ? { platform: value.platform } : {}) };
  });
}
function parseSpec(row: FilePlanOperation): Specification {
  try {
    const result = JSON.parse(row.specification) as Specification;
    if (result.version !== 1 || !validFingerprint(result.source?.fingerprint) || !Array.isArray(result.artifacts)) throw new Error();
    if (result.source.policy && !["strict_native", "read_content", "ftp_checked"].includes(result.source.policy)) throw new Error();
    if (result.target?.policy && !["strict_native", "ftp_checked"].includes(result.target.policy)) throw new Error();
    if (result.source.policy === "strict_native" && !result.source.fingerprint.identity) throw new Error();
    if (result.staged && !validFingerprint(result.staged)) throw new Error();
    if (result.target && result.target.policy !== "ftp_checked" && result.staged && !result.staged.identity) throw new Error();
    if (result.artifacts.some((entry) => !validFingerprint(entry.fingerprint))) throw new Error();
    return result;
  } catch { return fail("INVALID_JOURNAL", "Stored file-plan specification is invalid", 503); }
}
function validFingerprint(value: Fingerprint | undefined): boolean {
  return !!value && Number.isSafeInteger(value.size) && value.size >= 0 && value.size <= MAX_FILE_BYTES && /^[a-f0-9]{64}$/.test(value.sha256) &&
    (value.evidence === "content" || !!value.identity) && (value.evidence === undefined || value.evidence === "native" || value.evidence === "content") &&
    (value.identity === undefined || (typeof value.identity === "string" && value.identity.length > 0 && value.identity.length <= 128 && !/[\x00-\x1f\x7f-\x9f]/.test(value.identity)));
}
function parseSnapshots(plan: FilePlan): DeviceSnapshot[] {
  try {
    if (Buffer.byteLength(plan.deviceState) > MAX_DEVICE_STATE_BYTES) throw new Error();
    const states = JSON.parse(plan.deviceState) as DeviceSnapshot[];
    if (!Array.isArray(states) || !states.length || states.length > 100 || states.some((state) => !state || !Number.isSafeInteger(state.id) || state.id < 1 || !/^[a-f0-9]{64}$/.test(state.configHash) || !Array.isArray(state.roots) || state.roots.length < 1 || state.roots.length > 32 || state.roots.some((root) => !validPath(root)))) throw new Error();
    if (new Set(states.map((state) => state.id)).size !== states.length) throw new Error();
    validateDescriptorSnapshots(states);
    return states;
  } catch { return fail("INVALID_JOURNAL", "Stored file-plan device snapshot is invalid", 503); }
}
function validateDescriptorSnapshots(states: DeviceSnapshot[]) {
  const metadata = states.filter((state) => state.descriptorGraph !== undefined).map((state) => ({ id: state.id, descriptorGraph: state.descriptorGraph }));
  if (Buffer.byteLength(JSON.stringify(metadata)) > MAX_DESCRIPTOR_SNAPSHOT_BYTES) return fail("DESCRIPTOR_SNAPSHOT_LIMIT", "Descriptor graph snapshot exceeds its 16 MiB metadata bound", 413);
  let capturedBytes = 0;
  for (const state of states) {
    const graph = state.descriptorGraph; if (graph === undefined) continue;
    if (!graph || graph.version !== 1 || !Array.isArray(graph.files) || graph.files.length > 100000) return fail("INVALID_DESCRIPTOR_SNAPSHOT", "Descriptor graph snapshot is invalid", 503);
    const seen = new Set<string>();
    for (const entry of graph.files) {
      const value = entry?.fingerprint;
      if (!entry || !validPath(entry.path) || reserved(entry.path) || !descriptorKind(entry.path) || !state.roots.some((root) => contains(root, entry.path)) || seen.has(entry.path) || !value ||
          !Number.isSafeInteger(value.size) || value.size < 0 || value.size > MAX_DESCRIPTOR_BYTES || typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.sha256) ||
          !validFingerprint(value) || (state.evidence !== "content" && !value.identity) ||
          (value.modifiedAt !== null && (typeof value.modifiedAt !== "string" || value.modifiedAt.length > 64 || !Number.isFinite(Date.parse(value.modifiedAt))))) return fail("INVALID_DESCRIPTOR_SNAPSHOT", "Descriptor graph entry is invalid", 503);
      seen.add(entry.path); capturedBytes += value.size;
      if (capturedBytes > MAX_DESCRIPTOR_TOTAL) return fail("DESCRIPTOR_SNAPSHOT_LIMIT", "Captured descriptor bytes exceed the 16 MiB graph bound", 413);
    }
  }
}
function view(plan: PlanWithOperations): FilePlanView {
  if (plan.kind === "mkdir") return directoryPlanView(plan);
  return { id: plan.id, kind: plan.kind, status: plan.status, totalBytes: plan.totalBytes.toString(), revision: plan.revision,
    error: plan.error, createdAt: plan.createdAt.toISOString(), appliedAt: plan.appliedAt?.toISOString() ?? null,
    ...(plan.operations.some((operation) => { const spec = parseSpec(operation); return spec.source.policy === "ftp_checked" || spec.target?.policy === "ftp_checked"; }) ? { warningLevel: "checked_ftp" as const, limitations: CHECKED_FTP_LIMITATIONS } : {}),
    operations: plan.operations.map((operation) => {
      const spec = parseSpec(operation);
      return { id: operation.id, ordinal: operation.ordinal, kind: operation.kind, phase: operation.phase, error: operation.error,
        deviceId: spec.source.deviceId, filePath: spec.source.saveVersionId ? `backup:${spec.source.saveVersionId}` : spec.source.uploadSourceId ? `Upload: ${spec.source.record.relativePath}` : spec.source.path, targetDeviceId: spec.target?.deviceId, newPath: spec.target?.path,
        bytes: spec.payload ? Buffer.byteLength(spec.payload, "base64") : spec.source.fingerprint.size, generated: spec.generated, rewritesDescriptor: !!spec.payload,
        sourceDeviceId: spec.source.deviceId, sourcePath: spec.source.saveVersionId ? `backup:${spec.source.saveVersionId}` : spec.source.uploadSourceId ? `Upload: ${spec.source.record.relativePath}` : spec.source.path, targetPath: spec.target?.path, sourceVersionId: spec.source.saveVersionId, sourceUploadId: spec.source.uploadSourceId,
        sourceFingerprint: { sha256: spec.source.fingerprint.sha256, size: spec.source.fingerprint.size },
        outputFingerprint: spec.target ? { sha256: spec.payload ? digest(Buffer.from(spec.payload, "base64")) : spec.source.fingerprint.sha256,
          size: spec.payload ? Buffer.byteLength(spec.payload, "base64") : spec.source.fingerprint.size } : undefined };
    }) };
}
async function loadPlan(id: string, db: PrismaClient): Promise<PlanWithOperations> {
  if (!/^[a-f0-9-]{36}$/.test(id)) return fail("INVALID_PLAN_ID", "Invalid file-plan ID", 400);
  const plan = await db.filePlan.findUnique({ where: { id }, include: { operations: { orderBy: { ordinal: "asc" } } } });
  if (!plan) return fail("PLAN_NOT_FOUND", "File plan not found", 404);
  return plan;
}
function record(file: DeviceFile): StoredManifest {
  return { gameId: file.gameId, scanRoot: file.scanRoot, platformAlias: file.platformAlias, relativePath: file.relativePath,
    platform: file.platform, source: file.source, kind: file.kind, size: file.size.toString(), modifiedAt: file.modifiedAt,
    sha256: file.sha256, generation: file.generation, seenAt: file.seenAt.toISOString() };
}
class Context {
  readonly db: PrismaClient;
  readonly devices = new Map<number, Device>();
  readonly snapshots = new Map<number, DeviceSnapshot>();
  readonly connections = new Map<number, DeviceConnection>();
  readonly readConnections = new Map<number, DeviceConnection>();
  readonly saveSources = new Map<string, string>();
  readonly uploadSources = new Map<string, string>();
  readonly controller = new AbortController();
  readonly signal: AbortSignal;
  readonly ioTimeoutMs: number;
  private readonly timer: ReturnType<typeof setTimeout>;
  private readonly jobAbort: () => void;
  owner?: string;
  constructor(readonly jobs: DeviceJobs, readonly options: FilePlanOptions, readonly scope: "rom" | "save" | "upload" = "rom") {
    this.db = options.db ?? prisma;
    this.ioTimeoutMs = options.ioTimeoutMs ?? 120000;
    const totalTimeoutMs = options.totalTimeoutMs ?? 900000;
    if (![this.ioTimeoutMs, totalTimeoutMs].every((value) => Number.isSafeInteger(value) && value >= 1 && value <= 3600000)) throw new FilePlanError(400, "INVALID_LIMITS", "Invalid file-plan deadlines");
    this.jobAbort = () => this.controller.abort(jobs.signal.reason);
    jobs.signal.addEventListener("abort", this.jobAbort, { once: true });
    if (jobs.signal.aborted) this.jobAbort();
    this.signal = this.controller.signal;
    this.timer = setTimeout(() => this.controller.abort(new FilePlanError(409, "PLAN_TIMEOUT", "File-plan total deadline exceeded")), totalTimeoutMs);
  }
  async loadDevice(id: number): Promise<DeviceSnapshot> {
    const existing = this.snapshots.get(id); if (existing) return existing;
    const device = await this.db.device.findUnique({ where: { id }, include: { inventory: true, profile: true } });
    if (!device) return fail("DEVICE_MISSING", "File-plan device no longer exists");
    let roots = this.scope === "save" ? parseSaveRoots(device.profile?.saveRoots ?? "[]").map((root) => root.path) : parseFilePlanScanRoots(device.scanPaths);
    if (device.protocol === "local") roots = await Promise.all(roots.map((root) => resolveLocalPath(root)));
    const localRoots = device.protocol === "local" ? await getLocalFilesRoots() : [];
    const configHash = digest(JSON.stringify({ protocol: device.protocol, host: device.host, port: device.port, user: device.user,
      password: device.password, ftps: device.ftps, scanPaths: device.scanPaths, blacklist: device.blacklist,
      updatedAt: device.updatedAt.toISOString(), profile: device.profile, localRoots, scope: this.scope }, (_key, value) => typeof value === "bigint" ? value.toString() : value));
    const snapshot = { id, configHash, roots, generation: device.inventory?.generation ?? "" };
    this.devices.set(id, device); this.snapshots.set(id, snapshot); return snapshot;
  }
  async io(id: number): Promise<FileIo> {
    await this.loadDevice(id);
    if (!this.connections.has(id)) {
      const device = this.devices.get(id)!;
      const connection = this.options.connect ? await this.options.connect(device) : await createConnection({
        protocol: device.protocol as "local" | "ssh" | "ftp", host: device.host, port: device.port, user: device.user,
        password: decrypt(device.password), ftps: device.ftps });
      this.connections.set(id, connection);
    }
    return requireFileIo(this.connections.get(id)!);
  }
  /** FTP has one data transfer per control connection; a same-device copy
   * streams its source over a separate connection under the same held leases. */
  async readIo(id: number): Promise<FileIo> {
    await this.assert(); await this.loadDevice(id);
    if (!this.readConnections.has(id)) {
      const device = this.devices.get(id)!;
      const connection = this.options.connect ? await this.options.connect(device) : await createConnection({
        protocol: device.protocol as "local" | "ssh" | "ftp", host: device.host, port: device.port, user: device.user, password: decrypt(device.password), ftps: device.ftps });
      this.readConnections.set(id, connection);
    }
    return requireFileIo(this.readConnections.get(id)!);
  }
  async safePath(id: number, filename: string, missing = false, internal = false): Promise<string> {
    if (!validPath(filename) || (!internal && reserved(filename))) return fail("INVALID_PATH", "Invalid or protected file-plan path", 400);
    const state = await this.loadDevice(id);
    const safe = this.devices.get(id)!.protocol === "local" ? await resolveLocalPath(filename, { allowMissing: missing, destructive: true }) : filename;
    if (!state.roots.some((root) => contains(root, safe))) return fail("OUTSIDE_SCAN_ROOT", "File-plan path is outside this device's scan roots");
    await (await this.io(id)).checkPath?.(safe, state.roots, missing);
    return safe;
  }
  async assert(configs?: DeviceSnapshot[], recovery = false) {
    await this.jobs.assertActive();
    if (!recovery && this.signal.aborted) throw this.signal.reason;
    if (configs) for (const expected of configs) {
      this.snapshots.delete(expected.id);
      const actual = await this.loadDevice(expected.id);
      actual.evidence = expected.evidence;
      if (actual.configHash !== expected.configHash) return fail("DEVICE_CHANGED", "Device configuration or permitted roots changed since preview");
      if (!recovery && this.scope === "rom") {
        const inventory = await this.db.deviceInventory.findUnique({ where: { deviceId: expected.id } });
        if (!inventory?.complete || actual.generation !== expected.generation) return fail("INVENTORY_CHANGED", "Device inventory changed since the verified preview");
      }
    }
  }
  limits(size: number, recovery = false) { return { maxBytes: size, expectedBytes: size, timeoutMs: this.ioTimeoutMs, signal: recovery ? this.jobs.signal : this.signal }; }
  async close() {
    clearTimeout(this.timer); this.jobs.signal.removeEventListener("abort", this.jobAbort);
    try { for (const connection of [...this.connections.values(), ...this.readConnections.values()]) connection.disconnect(); }
    finally { await this.jobs.close(); }
  }
}
async function context(ids: number[], request: Request, options: FilePlanOptions, scope: "rom" | "save" | "upload" = "rom"): Promise<Context> {
  const db = options.db ?? prisma;
  let jobs: DeviceJobs;
  if (options.heldJobs) {
    if (ids.some((id) => !options.heldJobs!.deviceIds.includes(id))) return fail("LEASE_SCOPE", "Borrowed lease does not cover every plan device");
    const parent = options.heldJobs.jobs;
    jobs = { signal: parent.signal, assertActive: () => parent.assertActive(), assertOwned: parent.assertOwned ? (tx) => parent.assertOwned!(tx) : undefined, close: async () => {} };
  } else {
    const store = new AdmissionStore(db);
    jobs = await acquireDeviceFiles(ids, request, options.acquire ?? (async (resource, req) => new EnrichmentJob(await store.acquire(resource), req.signal)));
  }
  try { return new Context(jobs, options, scope); } catch (error) { await jobs.close(); throw error; }
}
async function verifiedSaveSource(ctx: Context, versionId: string) {
  if (!/^[a-f0-9-]{36}$/.test(versionId)) return fail("INVALID_SAVE_VERSION", "Invalid protected save version", 400);
  const version = await ctx.db.saveVersion.findUnique({ where: { id: versionId } });
  if (!version || !/^[a-f0-9]{64}$/.test(version.storageKey) || version.sha256 !== version.storageKey || version.size < BigInt(0) || version.size > BigInt(512 * 1024 ** 2)) return fail("SAVE_VERSION_UNAVAILABLE", "Protected save version is invalid or unavailable", 422);
  const { verifySaveObject } = await import("@/lib/save-store");
  const verified = await verifySaveObject(version.storageKey, { storageDirectory: ctx.options.storageDirectory });
  if (verified.sha256 !== version.sha256 || BigInt(verified.size) !== version.size) return fail("SAVE_VERSION_CHANGED", "Protected save object does not match its immutable version", 422);
  return { version, verified, fingerprint: { size: Number(verified.size), sha256: verified.sha256, modifiedAt: verified.modifiedAt, identity: verified.identity } };
}
function registerSaveSources(ctx: Context, operations: RuntimeOperation[]) {
  for (const { spec } of operations) {
    if (spec.source.saveVersionId) ctx.saveSources.set(fileKey(spec.source.deviceId, spec.source.path), spec.source.saveVersionId);
    if (spec.source.uploadSourceId) ctx.uploadSources.set(fileKey(spec.source.deviceId, spec.source.path), spec.source.uploadSourceId);
  }
}
async function verifyTargetBackup(ctx: Context, source: Specification["source"]) {
  if (!source.backupVersionId) return fail("SAVE_BACKUP_REQUIRED", "Existing save target requires a verified immutable backup", 422);
  const backup = await verifiedSaveSource(ctx, source.backupVersionId);
  const backupPath = await ctx.safePath(source.deviceId, backup.version.sourcePath);
  if (backup.version.deviceId !== source.deviceId || backupPath !== source.path || backup.fingerprint.sha256 !== source.fingerprint.sha256 || backup.fingerprint.size !== source.fingerprint.size) return fail("SAVE_BACKUP_MISMATCH", "Immutable target backup does not match the exact existing save", 422);
}

export interface SaveRestoreInput { versionId: string; targetDeviceId: number; targetPath: string }
export async function createSaveRestorePlan(input: SaveRestoreInput, request: Request, options: FilePlanOptions = {}): Promise<FilePlanView> {
  if (!input || !Number.isSafeInteger(input.targetDeviceId) || input.targetDeviceId < 1 || !/^[a-f0-9-]{36}$/.test(input.versionId) || !validPath(input.targetPath) || reserved(input.targetPath)) return fail("INVALID_RESTORE_INPUT", "Invalid save restore version/device/path", 400);
  const ctx = await context([input.targetDeviceId], request, options, "save");
  try {
    await ctx.assert(); const state = await ctx.loadDevice(input.targetDeviceId);
    const targetPath = await ctx.safePath(input.targetDeviceId, input.targetPath, true);
    const io = await requireCapabilities(ctx, input.targetDeviceId, path.posix.dirname(targetPath));
    if ((await io.lstat(path.posix.dirname(targetPath))).type !== "directory") return fail("TARGET_PARENT", "Save target parent must already exist", 422);
    const source = await verifiedSaveSource(ctx, input.versionId);
    const profile = await ctx.db.deviceProfile.findUnique({ where: { deviceId: input.targetDeviceId } });
    const candidates = await Promise.all(parseSaveRoots(profile?.saveRoots ?? "[]").map(async (root) => ({ ...root, path: ctx.devices.get(input.targetDeviceId)!.protocol === "local" ? await resolveLocalPath(root.path) : root.path })));
    const selectedRoot = candidates.filter((root) => contains(root.path, targetPath)).sort((a, b) => b.path.length - a.path.length)[0];
    if (!selectedRoot || (selectedRoot.platform && source.version.platform && selectedRoot.platform !== source.version.platform)) return fail("SAVE_PLATFORM_MISMATCH", "Save version is incompatible with the selected platform save root", 422);
    const planId = randomUUID(); const operations: RuntimeOperation[] = [];
    const manifest: StoredManifest = { gameId: null, scanRoot: selectedRoot.path, platformAlias: "", relativePath: source.version.fileKey,
      platform: source.version.platform, source: "save", kind: "file", size: source.version.size.toString(), modifiedAt: source.verified.modifiedAt, sha256: source.version.sha256,
      generation: state.generation, seenAt: new Date().toISOString() };
    const operation = (value: Specification, kind: string): RuntimeOperation => {
      const id = randomUUID(); const ordinal = operations.length;
      return { spec: value, row: { id, planId, ordinal, kind, specification: "", phase: "planned", error: null, updatedAt: new Date() } };
    };
    const existing = await exists(ctx, input.targetDeviceId, targetPath);
    if (existing) {
      if (existing.type !== "file") return fail("UNSAFE_SAVE_TARGET", "Existing save target must be a regular file", 422);
      if (!options.targetBackupVersionId) return fail("SAVE_BACKUP_REQUIRED", "Back up the existing save to an immutable version before preparing restore", 422);
      const original = await fingerprint(ctx, input.targetDeviceId, targetPath);
      const spec: Specification = { version: 1, action: "delete", generated: true,
        source: { deviceId: input.targetDeviceId, path: targetPath, manifestPath: targetPath, fingerprint: original, policy: mutationPolicy(ctx, input.targetDeviceId), record: { ...manifest, size: String(original.size), modifiedAt: original.modifiedAt, sha256: original.sha256 }, manifestTracked: false, backupVersionId: options.targetBackupVersionId },
        quarantinePath: path.posix.join(path.posix.dirname(targetPath), `.ludotek-${planId}-${randomUUID()}-backup`), artifacts: [] };
      await verifyTargetBackup(ctx, spec.source); operations.push(operation(spec, "delete"));
    }
    const opId = randomUUID();
    const spec: Specification = { version: 1, action: "copy", generated: false,
      source: { deviceId: input.targetDeviceId, path: source.verified.path, manifestPath: source.verified.path, fingerprint: source.fingerprint, record: manifest, manifestTracked: false, saveVersionId: input.versionId },
      target: { deviceId: input.targetDeviceId, path: targetPath, scanRoot: manifest.scanRoot, policy: mutationPolicy(ctx, input.targetDeviceId) },
      quarantinePath: path.posix.join(path.posix.dirname(targetPath), `.ludotek-${planId}-${opId}-unused-source-backup`),
      tempPath: path.posix.join(path.posix.dirname(targetPath), `.ludotek-${planId}-${opId}-temp`),
      undoPath: path.posix.join(path.posix.dirname(targetPath), `.ludotek-${planId}-${opId}-undo`), artifacts: [] };
    operations.push(operation(spec, "copy")); registerSaveSources(ctx, operations);
    await checkSpace(ctx, operations); await ctx.assert([...ctx.snapshots.values()]);
    const plan = await ctx.db.$transaction(async (tx) => {
      await assertDeviceJobsOwned(ctx.jobs, tx);
      return tx.filePlan.create({ data: { id: planId, kind: "save_restore", deviceState: JSON.stringify([...ctx.snapshots.values()]), totalBytes: source.version.size,
        operations: { create: operations.map(({ row, spec: savedSpec }) => ({ id: row.id, ordinal: row.ordinal, kind: row.kind, specification: JSON.stringify(savedSpec) })) } }, include: { operations: { orderBy: { ordinal: "asc" } } } });
    });
    return view(plan);
  } finally { await ctx.close(); }
}

export interface UploadFilePlanInput { targetDeviceId: number; sources: { sourceId: string; targetPath: string }[] }
/** Trusted process-route entry. Ordinary HTTP file-plan input cannot name upload sources. */
export async function createUploadFilePlan(input: UploadFilePlanInput, request: Request, options: FilePlanOptions = {}): Promise<FilePlanView> {
  if (!input || !Number.isSafeInteger(input.targetDeviceId) || input.targetDeviceId < 1 || !Array.isArray(input.sources) || input.sources.length < 1 || input.sources.length > 100 || input.sources.some((source) => !source || !/^[a-f0-9-]{36}$/.test(source.sourceId) || !validPath(source.targetPath) || reserved(source.targetPath))) return fail("INVALID_UPLOAD_PLAN", "Upload plan requires 1–100 positive source IDs and valid target paths", 400);
  if (new Set(input.sources.map((source) => source.sourceId)).size !== input.sources.length) return fail("DUPLICATE_SOURCE", "Upload source appears more than once", 400);
  try { for (const source of input.sources) await registeredProtectedUpload(options.db ?? prisma, source.sourceId); }
  catch { return fail("UNCONFIRMED_UPLOAD_SOURCE", "Positive upload source is missing, invalid or released", 422); }
  const ctx = await context([input.targetDeviceId], request, options, "upload");
  try {
    await ctx.assert(); const state = await ctx.loadDevice(input.targetDeviceId);
    const targets = new Map<string, string>(); const targetAliases = new Map<string, string>(); const sourceIds = new Set<string>();
    // No source body is read before all actual targets prove their required capabilities.
    for (const source of input.sources) {
      if (sourceIds.has(source.sourceId)) return fail("DUPLICATE_SOURCE", "Upload source appears more than once", 400); sourceIds.add(source.sourceId);
      const target = await ctx.safePath(input.targetDeviceId, source.targetPath, true);
      if (targets.has(target)) return fail("TARGET_COLLISION", "Upload plan has duplicate target paths");
      targets.set(target, source.sourceId);
      targetAliases.set(source.targetPath, source.sourceId);
      const io = await requireCapabilities(ctx, input.targetDeviceId, path.posix.dirname(target));
      if ((await io.lstat(path.posix.dirname(target))).type !== "directory") return fail("TARGET_PARENT", "Upload target parents must already exist", 422);
      if (await exists(ctx, input.targetDeviceId, target)) return fail("TARGET_COLLISION", "Upload target already exists; no overwrite is permitted");
    }
    const verified = new Map<string, Awaited<ReturnType<typeof verifyProtectedUpload>>>();
    const paths = new Map<string, string>(); const selections: PlanSelection[] = [];
    for (const [target, id] of targets) {
      await ctx.assert(); const source = await verifyProtectedUpload(ctx.db, id, { signal: ctx.signal, timeoutMs: ctx.ioTimeoutMs });
      if (paths.has(source.path)) return fail("DUPLICATE_SOURCE", "Upload source paths are not unique", 400);
      if (path.posix.extname(source.row.filename).toLowerCase() !== path.posix.extname(source.path).toLowerCase()) return fail("SOURCE_FORMAT", "Upload source label does not match its closed physical format", 422);
      if (path.posix.extname(target).toLowerCase() !== path.posix.extname(source.row.filename).toLowerCase()) return fail("SOURCE_FORMAT", "Upload copying cannot convert a file format by changing its extension", 422);
      paths.set(source.path, id); paths.set(source.row.path, id); verified.set(id, source);
      selections.push({ sourceDeviceId: input.targetDeviceId, sourcePath: source.path, action: "copy", targetDeviceId: input.targetDeviceId, targetPath: target, generated: false });
    }
    const descriptors = new Map<string, PlanDescriptor>(); let descriptorBytes = 0;
    for (const source of verified.values()) {
      const kind = descriptorKind(source.path); if (!kind) continue;
      if (source.fingerprint.size > MAX_DESCRIPTOR_BYTES || (descriptorBytes += source.fingerprint.size) > MAX_DESCRIPTOR_TOTAL) return fail("DESCRIPTOR_LIMIT", "Closed upload descriptor graph exceeds its metadata bound", 413);
      const chunks: Buffer[] = [];
      await readProtectedUploadTo(ctx.db, source.row.id, new Writable({ write(chunk: Buffer, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } }), { signal: ctx.signal, timeoutMs: ctx.ioTimeoutMs, maxBytes: source.fingerprint.size, expectedBytes: source.fingerprint.size });
      let contents: string;
      try { contents = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(Buffer.concat(chunks)); } catch { return fail("DESCRIPTOR_ENCODING", "Upload descriptor encoding is unsupported", 422); }
      const parsed = parseScanDescriptor(contents, kind); if (!parsed) return fail("UNSUPPORTED_DESCRIPTOR", "Upload descriptor references cannot be parsed safely", 422);
      const descriptorTarget = selections.find((selection) => selection.sourcePath === source.path)!.targetPath!;
      const references = parsed.map((token) => {
        if (token.reference.includes("\\") || /^[a-z][a-z\d+.-]*:/i.test(token.reference)) return fail("UNSUPPORTED_DESCRIPTOR", "Upload descriptor reference syntax is unsupported", 422);
        const sourcePath = path.posix.resolve(path.posix.dirname(source.path), token.reference);
        const targetPath = path.posix.resolve(path.posix.dirname(descriptorTarget), token.reference);
        // Generated absolute playlists may refer to exact declared targets; no basename guessing.
        const id = paths.get(sourcePath) ?? targets.get(targetPath) ?? targetAliases.get(targetPath);
        if (!id) return fail("UNRESOLVED_DESCRIPTOR", "Upload descriptor dependency is absent from the positively closed transfer set", 422);
        return { filename: verified.get(id)!.path, token };
      });
      descriptors.set(fileKey(input.targetDeviceId, source.path), { deviceId: input.targetDeviceId, filename: source.path, contents, references });
    }
    let expanded: PlanSelection[];
    try { expanded = expandDescriptorSelections(selections, descriptors, { closedMappings: true }); } catch { return fail("DESCRIPTOR_CONFLICT", "Upload descriptor targets cannot be rewritten safely", 422); }
    const planId = randomUUID(); const operations: RuntimeOperation[] = []; let totalBytes = 0;
    for (const [ordinal, selection] of expanded.entries()) {
      const source = verified.get(paths.get(selection.sourcePath)!)!; const operationId = randomUUID();
      const targetPath = selection.targetPath!; const scanRoot = state.roots.filter((root) => contains(root, targetPath)).sort((a, b) => b.length - a.length)[0];
      const relative = path.posix.relative(scanRoot, targetPath); const platformAlias = relative.includes("/") ? relative.split("/")[0] : "";
      const metadata: StoredManifest = { gameId: null, scanRoot, platformAlias, relativePath: source.row.filename, platform: source.row.platform, source: "rom", kind: "file",
        size: String(source.fingerprint.size), modifiedAt: source.fingerprint.modifiedAt, sha256: source.fingerprint.sha256, generation: state.generation || `upload:${planId}`, seenAt: new Date().toISOString() };
      const spec: Specification = { version: 1, action: "copy", generated: false,
        source: { deviceId: input.targetDeviceId, path: source.path, manifestPath: source.path, fingerprint: source.fingerprint, record: metadata, uploadSourceId: source.row.id, noSourceManifest: true },
        target: { deviceId: input.targetDeviceId, path: targetPath, scanRoot, policy: mutationPolicy(ctx, input.targetDeviceId) }, payload: selection.rewritten?.toString("base64"),
        quarantinePath: path.posix.join(path.posix.dirname(targetPath), `.ludotek-${planId}-${operationId}-unused-source-backup`),
        tempPath: path.posix.join(path.posix.dirname(targetPath), `.ludotek-${planId}-${operationId}-temp`), undoPath: path.posix.join(path.posix.dirname(targetPath), `.ludotek-${planId}-${operationId}-undo`), artifacts: [] };
      totalBytes += selection.rewritten?.length ?? source.fingerprint.size;
      if (totalBytes > MAX_TOTAL_BYTES) return fail("BYTE_LIMIT", "Upload plan exceeds its total byte bound", 413);
      operations.push({ spec, row: { id: operationId, planId, ordinal, kind: "copy", specification: "", phase: "planned", error: null, updatedAt: new Date() } });
    }
    registerSaveSources(ctx, operations); await checkSpace(ctx, operations); await ctx.assert([...ctx.snapshots.values()]);
    const plan = await ctx.db.$transaction(async (tx) => {
      await assertDeviceJobsOwned(ctx.jobs, tx);
      return tx.filePlan.create({ data: { id: planId, kind: "upload", deviceState: JSON.stringify([...ctx.snapshots.values()]), totalBytes: BigInt(totalBytes),
        operations: { create: operations.map(({ row, spec }) => ({ id: row.id, ordinal: row.ordinal, kind: row.kind, specification: JSON.stringify(spec) })) } }, include: { operations: { orderBy: { ordinal: "asc" } } } });
    });
    return view(plan);
  } finally { await ctx.close(); }
}
export function filePlanMutationPolicy(io: FileIo, protocol: string): FilePlanTransportPolicy {
  return protocol === "ftp" && io.checked?.policy === "ftp_checked" && io.checked.durability === "server_ack" ? "ftp_checked" : "strict_native";
}
export async function assertFilePlanMutationCapabilities(io: FileIo, parent: string, protocol: string): Promise<FilePlanTransportPolicy> {
  const caps = await io.capabilities(parent);
  const policy = filePlanMutationPolicy(io, protocol);
  if (policy === "ftp_checked") {
    if (caps.readStream.state !== "supported") return fail("UNSUPPORTED_CAPABILITY", "Checked FTP requires bounded readback", 422);
    return policy;
  }
  for (const key of ["readStream", "exclusiveTemp", "publishNoReplace", "renameNoReplace", "fileFlush", "directoryFlush"] as const) if (caps[key].state !== "supported") return fail("UNSUPPORTED_CAPABILITY", `Device cannot safely execute this plan: ${key}: ${caps[key].reason}`, 422);
  if (!io.flushFile) return fail("UNSUPPORTED_CAPABILITY", "Device cannot flush existing file data before quarantine", 422);
  return policy;
}
export async function assertFilePlanSpace(io: FileIo, parent: string, bytes: bigint, reserve: bigint, protocol: string) {
  if (bytes < BigInt(0) || reserve < BigInt(0)) return fail("INVALID_SPACE", "Invalid target space requirement", 422);
  const space = await io.freeBytes(parent);
  if (space.state !== "known") {
    if (filePlanMutationPolicy(io, protocol) === "ftp_checked" && reserve === BigInt(0)) return space;
    return fail("SPACE_UNKNOWN", "Target space is unknown; a nonzero reserve cannot be proven", 422);
  }
  if (space.bytes < bytes + reserve) return fail("INSUFFICIENT_SPACE", "Target device has insufficient verified free space including reserve", 422);
  return space;
}
async function requireCapabilities(ctx: Context, id: number, parent: string) {
  const io = await ctx.io(id);
  const policy = await assertFilePlanMutationCapabilities(io, parent, ctx.devices.get(id)!.protocol);
  ctx.snapshots.get(id)!.evidence = policy === "ftp_checked" ? "content" : "native";
  return io;
}
async function requireReadCapabilities(ctx: Context, id: number, parent: string) {
  const io = await ctx.io(id);
  // Mutation capability probes can fsync a directory. Read-only copies prove
  // their bounded read by hashing all selected bytes before any target effect.
  if (typeof io.readTo !== "function" || typeof io.lstat !== "function") return fail("UNSUPPORTED_CAPABILITY", "Copy source requires bounded streaming reads", 422);
  await io.checkPath?.(parent, ctx.snapshots.get(id)!.roots);
  if (ctx.devices.get(id)!.protocol === "local") ctx.snapshots.get(id)!.evidence = "native";
  else ctx.snapshots.get(id)!.evidence ??= "content";
  return io;
}
function mutationPolicy(ctx: Context, id: number): FilePlanTransportPolicy {
  return filePlanMutationPolicy(requireFileIo(ctx.connections.get(id)!), ctx.devices.get(id)!.protocol);
}
function sameMetadata(left: Awaited<ReturnType<FileIo["lstat"]>>, right: Awaited<ReturnType<FileIo["lstat"]>>) {
  return left.identity === right.identity && left.uniqueId === right.uniqueId && left.size === right.size && left.modifiedAt === right.modifiedAt && right.type === "file";
}
function matchesFingerprint(actual: Fingerprint, expected: Fingerprint) {
  return (expected.identity === undefined || actual.identity === expected.identity) && (expected.uniqueId === undefined || actual.uniqueId === expected.uniqueId) &&
    actual.size === expected.size && actual.sha256 === expected.sha256 && actual.modifiedAt === expected.modifiedAt;
}
async function fingerprint(ctx: Context, id: number, filename: string, expected?: Fingerprint, recovery = false): Promise<Fingerprint> {
  const uploadId = ctx.uploadSources.get(fileKey(id, filename));
  if (uploadId) {
    await ctx.assert(undefined, recovery);
    const source = await verifyProtectedUpload(ctx.db, uploadId, { signal: recovery ? ctx.jobs.signal : ctx.signal, timeoutMs: ctx.ioTimeoutMs });
    const actual = source.fingerprint;
    if (source.path !== filename || (expected && (actual.identity !== expected.identity || actual.sha256 !== expected.sha256 || actual.size !== expected.size || actual.modifiedAt !== expected.modifiedAt))) return fail("UPLOAD_SOURCE_CHANGED", "Upload source changed since its bound preview");
    return actual;
  }
  const versionId = ctx.saveSources.get(fileKey(id, filename));
  if (versionId) {
    await ctx.assert(undefined, recovery);
    const source = await verifiedSaveSource(ctx, versionId);
    await ctx.assert(undefined, recovery);
    const actual = source.fingerprint;
    if (source.verified.path !== filename || (expected && (actual.identity !== expected.identity || actual.sha256 !== expected.sha256 || actual.size !== expected.size || actual.modifiedAt !== expected.modifiedAt))) return fail("SAVE_SOURCE_CHANGED", "Protected save identity changed since this bound restore preview");
    return actual;
  }
  const io = await ctx.io(id);
  await ctx.safePath(id, filename, false, true);
  const before = await io.lstat(filename);
  const nativeRequired = ctx.devices.get(id)!.protocol === "local" || (expected ? expected.evidence !== "content" : ctx.snapshots.get(id)!.evidence !== "content");
  if (before.type !== "file" || (nativeRequired && !before.identity) || !Number.isSafeInteger(before.size) || before.size < 0 || before.size > MAX_FILE_BYTES) return fail("UNSAFE_ENTRY", "Plan requires a bounded regular file with the saved evidence strength");
  const hash = createHash("sha256");
  await io.readTo(filename, new Writable({ write(chunk: Buffer, _encoding, callback) { hash.update(chunk); callback(); } }), ctx.limits(before.size, recovery));
  const after = await io.lstat(filename);
  if (!sameMetadata(before, after)) return fail("FILE_CHANGED", "File identity or metadata changed while hashing");
  const result: Fingerprint = { size: before.size, sha256: hash.digest("hex"), modifiedAt: before.modifiedAt ?? null, evidence: before.identity ? "native" : "content", ...(before.identity ? { identity: before.identity } : {}), ...(before.uniqueId ? { uniqueId: before.uniqueId } : {}) };
  if (expected && !matchesFingerprint(result, expected)) return fail("OWNERSHIP_CONFLICT", "File content or identity changed; this plan does not own the current entry");
  return result;
}
async function exists(ctx: Context, id: number, filename: string) {
  const uploadId = ctx.uploadSources.get(fileKey(id, filename));
  if (uploadId) return protectedUploadStat(ctx.db, uploadId);
  const versionId = ctx.saveSources.get(fileKey(id, filename));
  if (versionId) {
    const source = await verifiedSaveSource(ctx, versionId);
    if (source.verified.path !== filename) return fail("SAVE_SOURCE_CHANGED", "Protected save store location changed since preview");
    return { type: "file" as const, isDirectory: false, size: source.fingerprint.size, modifiedAt: source.fingerprint.modifiedAt ?? undefined, identity: source.fingerprint.identity };
  }
  await ctx.safePath(id, filename, true, true);
  try { return await (await ctx.io(id)).lstat(filename); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT" || (error as { code?: number }).code === 2) return null; throw error; }
}
async function boundedDescriptor(ctx: Context, id: number, filename: string, remainingBytes: number): Promise<{ contents: string; fingerprint: Fingerprint }> {
  const io = await ctx.io(id); const info = await io.lstat(filename);
  if (info.type !== "file" || (ctx.snapshots.get(id)!.evidence !== "content" && !info.identity) || !Number.isSafeInteger(info.size) || info.size < 0 || info.size > MAX_DESCRIPTOR_BYTES || info.size > remainingBytes) return fail("DESCRIPTOR_LIMIT", "Descriptor must be a regular file within the bounded graph budget", 413);
  const chunks: Buffer[] = [];
  await io.readTo(filename, new Writable({ write(chunk: Buffer, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } }), ctx.limits(info.size));
  const raw = Buffer.concat(chunks); const after = await io.lstat(filename);
  if (raw.length !== info.size || !sameMetadata(info, after)) return fail("DESCRIPTOR_CHANGED", "Descriptor identity or metadata changed during capture");
  const captured: Fingerprint = { size: raw.length, sha256: digest(raw), evidence: info.identity ? "native" : "content", identity: info.identity, uniqueId: info.uniqueId, modifiedAt: info.modifiedAt ?? null };
  try { return { contents: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(raw), fingerprint: captured }; } catch { return fail("DESCRIPTOR_ENCODING", "Descriptor encoding is unsupported", 422); }
}
/** The original graph belongs only to preview/initial Apply, never effect-based Undo/Reconcile. */
async function verifyDescriptorGraphs(ctx: Context, states: DeviceSnapshot[], requiredDeviceIds: Iterable<number>) {
  validateDescriptorSnapshots(states);
  for (const id of new Set(requiredDeviceIds)) if (!states.find((state) => state.id === id)?.descriptorGraph) return fail("DESCRIPTOR_SNAPSHOT_REQUIRED", "This legacy preview has no captured descriptor graph; create a fresh preview");
  for (const state of states) {
    const graph = state.descriptorGraph; if (!graph) continue;
    await ctx.assert();
    const entries = await ctx.db.deviceFile.findMany({ where: { deviceId: state.id, kind: "file" }, select: { path: true }, take: 100001 });
    if (entries.length > 100000) return fail("INVENTORY_LIMIT", "Descriptor inventory exceeds its bounded entry count", 413);
    const current = new Set<string>();
    for (const entry of entries) if (descriptorKind(entry.path) && !reserved(entry.path)) current.add(await ctx.safePath(state.id, entry.path));
    if (current.size !== graph.files.length || graph.files.some((entry) => !current.has(entry.path))) return fail("DESCRIPTOR_GRAPH_CHANGED", "Confirmed descriptor graph membership changed since capture; create a fresh preview");
    for (const entry of graph.files) {
      await ctx.assert(); await ctx.safePath(state.id, entry.path);
      await fingerprint(ctx, state.id, entry.path, entry.fingerprint);
    }
  }
}
async function checkSpace(ctx: Context, operations: RuntimeOperation[]) {
  const required = new Map<number, number>();
  for (const { spec } of operations) if (spec.target) required.set(spec.target.deviceId, (required.get(spec.target.deviceId) ?? 0) + (spec.payload ? Buffer.byteLength(spec.payload, "base64") : spec.source.fingerprint.size));
  for (const [id, bytes] of required) for (const parent of new Set(operations.filter((operation) => operation.spec.target?.deviceId === id).map((operation) => path.posix.dirname(operation.spec.target!.path)))) {
    const profile = await ctx.db.deviceProfile.findUnique({ where: { deviceId: id } });
    await assertFilePlanSpace(await ctx.io(id), parent, BigInt(bytes), profile?.reserveBytes ?? BigInt(0), ctx.devices.get(id)!.protocol);
  }
}

export async function createFilePlan(input: FilePlanInput, request: Request, options: FilePlanOptions = {}): Promise<FilePlanView> {
  if (input?.kind === "mkdir") return createDirectoryPlan(input, request, options);
  if (!input || !["copy", "move", "rename", "delete"].includes(input.kind) || !Array.isArray(input.operations) || input.operations.length < 1 || input.operations.length > 100) return fail("INVALID_INPUT", "Plan requires 1–100 valid operations", 400);
  const ids: number[] = [];
  const db = options.db ?? prisma;
  for (const operation of input.operations) {
    if (!operation || typeof operation !== "object") return fail("INVALID_INPUT", "Invalid file-plan operation", 400);
    if (!Number.isSafeInteger(operation.deviceId) || operation.deviceId < 1 || (operation.gameId !== undefined && (!Number.isSafeInteger(operation.gameId) || operation.gameId < 1))) return fail("INVALID_INPUT", "Invalid file-plan device/game ID", 400);
    const target = operation.targetDeviceId ?? operation.deviceId;
    if (!Number.isSafeInteger(target) || target < 1 || (input.kind === "rename" && target !== operation.deviceId)) return fail("INVALID_INPUT", "Rename is on the same device; use move for another device", 400);
    if (!validPath(operation.filePath) || reserved(operation.filePath)) return fail("INVALID_PATH", "Invalid or protected confirmed source path", 400);
    // Causal A-05 guard: reject wrong bindings before opening any device connection.
    const binding = await db.deviceFile.findUnique({ where: { deviceId_path: { deviceId: operation.deviceId, path: operation.filePath } } });
    if (!binding || binding.kind !== "file" || (operation.gameId !== undefined && operation.gameId !== binding.gameId)) return fail("UNCONFIRMED_SOURCE", "Exact file/device/game association is not confirmed");
    ids.push(operation.deviceId); if (input.kind !== "delete") ids.push(target);
  }
  const ctx = await context(ids, request, options);
  try {
    const replacementKeys = new Set<string>();
    if (options.replaceTargets && (input.kind !== "copy" || options.replaceTargets.length > 100)) return fail("INVALID_REPLACEMENT", "Replacement composition requires a bounded copy plan", 400);
    for (const target of options.replaceTargets ?? []) {
      if (!ids.includes(target.deviceId)) return fail("INVALID_REPLACEMENT", "Replacement target is not covered by this plan", 400);
      replacementKeys.add(fileKey(target.deviceId, await ctx.safePath(target.deviceId, target.path, true)));
    }
    const files = new Map<string, DeviceFile>();
    for (const id of new Set(ids)) {
      await ctx.assert(); await ctx.loadDevice(id);
      const inventory = await ctx.db.deviceInventory.findUnique({ where: { deviceId: id } });
      if (!inventory?.complete) return fail("INVENTORY_INCOMPLETE", "A complete confirmed device inventory is required before file plans", 422);
      const manifestEntries = await ctx.db.deviceFile.findMany({ where: { deviceId: id }, take: 100001 });
      if (manifestEntries.length > 100000) return fail("INVENTORY_LIMIT", "Device inventory exceeds the bounded 100000-entry manifest limit", 413);
      for (const file of manifestEntries) {
        if (file.generation !== inventory.generation) return fail("INVENTORY_STALE", "Device inventory generation is inconsistent", 422);
        if (!reserved(file.path) && file.kind === "file") files.set(fileKey(id, await ctx.safePath(id, file.path)), file);
      }
    }
    const seeds: PlanSelection[] = []; const seenSources = new Set<string>();
    for (const operation of input.operations) {
      const sourcePath = await ctx.safePath(operation.deviceId, operation.filePath);
      const source = files.get(fileKey(operation.deviceId, sourcePath));
      if (!source || source.kind !== "file" || (operation.gameId !== undefined && source.gameId !== operation.gameId)) return fail("UNCONFIRMED_SOURCE", "Exact file/device/game association is not confirmed");
      const key = fileKey(operation.deviceId, sourcePath);
      if (seenSources.has(key)) return fail("DUPLICATE_SOURCE", "Source occurs more than once in the plan", 400);
      seenSources.add(key);
      const targetDeviceId = input.kind === "delete" ? undefined : operation.targetDeviceId ?? operation.deviceId;
      const targetPath = targetDeviceId ? await ctx.safePath(targetDeviceId, operation.newPath ?? "", true) : undefined;
      if (targetDeviceId === operation.deviceId && targetPath === sourcePath) return fail("SAME_PATH", "Source and target must differ", 400);
      seeds.push({ sourceDeviceId: operation.deviceId, sourcePath, action: input.kind === "rename" ? "move" : input.kind, targetDeviceId, targetPath, generated: false });
    }
    const mutatingIds = new Set(seeds.flatMap((seed) => [...(seed.action !== "copy" ? [seed.sourceDeviceId] : []), ...(seed.targetDeviceId ? [seed.targetDeviceId] : [])]));
    for (const id of new Set(ids)) for (const root of ctx.snapshots.get(id)!.roots) {
      if (mutatingIds.has(id)) await requireCapabilities(ctx, id, root);
      else await requireReadCapabilities(ctx, id, root);
    }
    const descriptors = new Map<string, PlanDescriptor>(); const capturedDescriptors = new Map<string, DescriptorSnapshotFile>(); let descriptorBytes = 0;
    const sourceIds = new Set(seeds.map((seed) => seed.sourceDeviceId));
    const capturedDeviceIds = replacementKeys.size ? new Set(ids) : sourceIds;
    for (const id of capturedDeviceIds) ctx.snapshots.get(id)!.descriptorGraph = { version: 1, files: [] };
    for (const [key, file] of files) {
      const kind = descriptorKind(file.path);
      if (!kind || !capturedDeviceIds.has(file.deviceId) || file.kind !== "file") continue;
      const filenameCanonical = await ctx.safePath(file.deviceId, file.path);
      const captured = await boundedDescriptor(ctx, file.deviceId, filenameCanonical, MAX_DESCRIPTOR_TOTAL - descriptorBytes);
      descriptorBytes += captured.fingerprint.size;
      const contents = captured.contents;
      const entry = { path: filenameCanonical, fingerprint: captured.fingerprint };
      capturedDescriptors.set(key, entry); ctx.snapshots.get(file.deviceId)!.descriptorGraph!.files.push(entry);
      const references = parseScanDescriptor(contents, kind);
      if (!references) return fail("UNSUPPORTED_DESCRIPTOR", "Descriptor references cannot be parsed safely", 422);
      const resolved = [];
      for (const token of references) {
        if (token.reference.includes("\\") || /^[a-z][a-z\d+.-]*:/i.test(token.reference)) return fail("UNSUPPORTED_DESCRIPTOR", "Descriptor reference syntax is unsupported", 422);
        const filename = await ctx.safePath(file.deviceId, path.posix.resolve(path.posix.dirname(filenameCanonical), token.reference));
        if (files.get(fileKey(file.deviceId, filename))?.kind !== "file") return fail("UNRESOLVED_DESCRIPTOR", "Descriptor reference has no confirmed regular-file dependency", 422);
        resolved.push({ filename, token });
      }
      descriptors.set(key, { deviceId: file.deviceId, filename: filenameCanonical, contents, references: resolved });
    }
    let selections: PlanSelection[];
    try { selections = expandDescriptorSelections(seeds, descriptors); } catch { return fail("DESCRIPTOR_CONFLICT", "Descriptor dependencies cannot be transformed safely", 422); }
    const replacements: PlanSelection[] = [];
    const selectedTargets = new Set(selections.filter((selection) => selection.targetDeviceId && selection.targetPath).map((selection) => fileKey(selection.targetDeviceId!, selection.targetPath!)));
    for (const key of replacementKeys) {
      if (!selectedTargets.has(key)) return fail("INVALID_REPLACEMENT", "Replacement does not match a selected final target", 400);
      const old = files.get(key);
      if (!old || old.kind !== "file" || descriptorKind(old.path) || [...descriptors.values()].some((descriptor) => descriptor.references.some((reference) => fileKey(descriptor.deviceId, reference.filename) === key))) return fail("REPLACEMENT_DESCRIPTOR", "Existing descriptor sets require an explicitly supported whole-set replacement", 422);
      const filename = await ctx.safePath(old.deviceId, old.path);
      if (selections.some((selection) => selection.sourceDeviceId === old.deviceId && selection.sourcePath === filename)) return fail("REPLACEMENT_SOURCE", "A replacement cannot also be a copy source", 400);
      replacements.push({ sourceDeviceId: old.deviceId, sourcePath: filename, action: "delete", generated: true });
    }
    selections = [...replacements, ...selections];
    if (selections.length > 100) return fail("OPERATION_LIMIT", "Expanded replacement plan exceeds 100 operations", 413);
    const planId = randomUUID(); const operations: RuntimeOperation[] = []; const targets = new Set<string>(); let totalBytes = 0;
    for (const [ordinal, selection] of selections.entries()) {
      const source = files.get(fileKey(selection.sourceDeviceId, selection.sourcePath));
      if (!source || source.kind !== "file") return fail("UNCONFIRMED_DEPENDENCY", "Expanded dependency is not a confirmed regular file");
      await ctx.safePath(selection.sourceDeviceId, selection.sourcePath);
      const io = await (selection.action === "copy" ? requireReadCapabilities : requireCapabilities)(ctx, selection.sourceDeviceId, path.posix.dirname(selection.sourcePath));
      const metadata = await io.lstat(selection.sourcePath);
      if (metadata.type !== "file" || metadata.size !== Number(source.size) || (source.modifiedAt !== null && metadata.modifiedAt !== source.modifiedAt) || (ctx.snapshots.get(selection.sourceDeviceId)!.evidence !== "content" && !metadata.identity)) return fail("INVENTORY_CHANGED", "Physical file changed since the confirmed inventory; scan again");
      const operationId = randomUUID(); let target: Specification["target"];
      if (selection.targetDeviceId && selection.targetPath) {
        const targetPath = await ctx.safePath(selection.targetDeviceId, selection.targetPath, true); const targetKey = fileKey(selection.targetDeviceId, targetPath);
        if (targets.has(targetKey)) return fail("TARGET_COLLISION", "Expanded plan has a target collision"); targets.add(targetKey);
        const targetIo = await requireCapabilities(ctx, selection.targetDeviceId, path.posix.dirname(targetPath));
        if ((await targetIo.lstat(path.posix.dirname(targetPath))).type !== "directory") return fail("TARGET_PARENT", "Target parent must be an existing directory", 422);
        if (await exists(ctx, selection.targetDeviceId, targetPath)) if (!(selection.action === "rewrite" && selection.targetDeviceId === selection.sourceDeviceId && targetPath === selection.sourcePath) && !replacementKeys.has(targetKey)) return fail("TARGET_COLLISION", "Target already exists; the plan never overwrites a foreign entry");
        target = { deviceId: selection.targetDeviceId, path: targetPath, scanRoot: ctx.snapshots.get(selection.targetDeviceId)!.roots.find((root) => contains(root, targetPath))!, policy: mutationPolicy(ctx, selection.targetDeviceId) };
      }
      const spec: Specification = { version: 1, action: selection.action, generated: selection.generated,
        source: { deviceId: source.deviceId, path: selection.sourcePath, manifestPath: source.path,
          fingerprint: { size: metadata.size, sha256: "", modifiedAt: metadata.modifiedAt ?? null, evidence: metadata.identity ? "native" : "content", identity: metadata.identity, uniqueId: metadata.uniqueId },
          policy: selection.action === "copy" ? "read_content" : mutationPolicy(ctx, selection.sourceDeviceId), record: record(source) }, target,
        payload: selection.rewritten?.toString("base64"), quarantinePath: path.posix.join(path.posix.dirname(selection.sourcePath), `.ludotek-${planId}-${operationId}-backup`),
        tempPath: target ? path.posix.join(path.posix.dirname(target.path), `.ludotek-${planId}-${operationId}-temp`) : undefined,
        undoPath: target ? path.posix.join(path.posix.dirname(target.path), `.ludotek-${planId}-${operationId}-undo`) : undefined, artifacts: [] };
      totalBytes += target ? selection.rewritten?.length ?? metadata.size : metadata.size;
      if (!Number.isSafeInteger(totalBytes) || totalBytes > MAX_TOTAL_BYTES || metadata.size > MAX_FILE_BYTES) return fail("BYTE_LIMIT", "File plan exceeds its verified byte bound", 413);
      operations.push({ row: { id: operationId, planId, ordinal, kind: selection.action, specification: "", phase: "planned", error: null, updatedAt: new Date() }, spec });
    }
    await checkSpace(ctx, operations);
    for (const operation of operations) {
      await ctx.assert();
      const captured = capturedDescriptors.get(fileKey(operation.spec.source.deviceId, operation.spec.source.path));
      if (captured) { operation.spec.source.fingerprint = captured.fingerprint; continue; }
      const fresh = await fingerprint(ctx, operation.spec.source.deviceId, operation.spec.source.path);
      if (fresh.identity !== operation.spec.source.fingerprint.identity || fresh.uniqueId !== operation.spec.source.fingerprint.uniqueId || fresh.modifiedAt !== operation.spec.source.fingerprint.modifiedAt || fresh.size !== operation.spec.source.fingerprint.size) return fail("FILE_CHANGED", "File changed during preview preparation");
      operation.spec.source.fingerprint = fresh;
    }
    const snapshots = [...ctx.snapshots.values()];
    await verifyDescriptorGraphs(ctx, snapshots, capturedDeviceIds);
    const saved = await ctx.db.$transaction(async (tx) => {
      await assertDeviceJobsOwned(ctx.jobs, tx);
      return tx.filePlan.create({ data: { id: planId, kind: input.kind, deviceState: JSON.stringify(snapshots), totalBytes: BigInt(totalBytes),
        operations: { create: operations.map(({ row, spec }) => ({ id: row.id, ordinal: row.ordinal, kind: row.kind, specification: JSON.stringify(spec) })) } }, include: { operations: { orderBy: { ordinal: "asc" } } } });
    });
    return view(saved);
  } finally { await ctx.close(); }
}
export async function getFilePlan(id: string, options: FilePlanOptions = {}): Promise<FilePlanView> { return view(await loadPlan(id, options.db ?? prisma)); }
/** Read-only release decision. The caller fences the actual released flag update under its held file jobs. */
export async function getUploadSourceReleaseProof(id: string, options: FilePlanOptions = {}): Promise<{ sourceIds: string[]; releasable: boolean; blockingPlanIds: string[] }> {
  const db = options.db ?? prisma; const plan = await loadPlan(id, db);
  if (plan.kind !== "upload" || !["applied", "undone"].includes(plan.status)) return fail("UPLOAD_NOT_TERMINAL", "Upload cache cannot be released before verified terminal application");
  const sourceIds = [...new Set(plan.operations.map((row) => parseSpec(row).source.uploadSourceId).filter((value): value is string => !!value))];
  const related = await db.filePlanOperation.findMany({ where: { OR: sourceIds.map((sourceId) => ({ specification: { contains: sourceId } })) }, include: { plan: { select: { id: true, status: true } } }, take: 100001 });
  if (related.length > 100000) return fail("RELEASE_PROOF_LIMIT", "Too many dependent plans to prove safe upload cache release", 503);
  const blocking = new Set<string>();
  for (const operation of related) {
    const sourceId = parseSpec(operation).source.uploadSourceId;
    if (sourceId && sourceIds.includes(sourceId) && !["applied", "undone"].includes(operation.plan.status)) blocking.add(operation.plan.id);
  }
  return { sourceIds, releasable: blocking.size === 0, blockingPlanIds: [...blocking] };
}
/** Trusted immutable post-apply expectations; consumers must still hash current bytes before advancing baselines. */
export async function getFilePlanFingerprints(id: string, options: FilePlanOptions = {}): Promise<{ deviceId: number; path: string; sha256: string; size: string }[]> {
  const plan = await loadPlan(id, options.db ?? prisma);
  if (plan.kind === "mkdir") return [];
  if (plan.status !== "applied") return fail("NOT_APPLIED", "Fingerprint expectations require an applied plan");
  const result = new Map<string, { deviceId: number; path: string; sha256: string; size: string }>();
  for (const row of plan.operations) {
    const spec = parseSpec(row);
    if (spec.action === "copy" && !spec.source.saveVersionId && !spec.source.uploadSourceId) result.set(fileKey(spec.source.deviceId, spec.source.path), { deviceId: spec.source.deviceId, path: spec.source.path, sha256: spec.source.fingerprint.sha256, size: String(spec.source.fingerprint.size) });
    if (spec.target) {
      if (!spec.staged) return fail("INVALID_JOURNAL", "Applied output has no verified staged fingerprint", 503);
      result.set(fileKey(spec.target.deviceId, spec.target.path), { deviceId: spec.target.deviceId, path: spec.target.path, sha256: spec.staged.sha256, size: String(spec.staged.size) });
    }
  }
  return [...result.values()];
}

async function claim(ctx: Context, plan: PlanWithOperations, status: string, allowed: string[]) {
  const owner = randomUUID();
  const result = await ctx.db.$transaction(async (tx) => {
    await assertDeviceJobsOwned(ctx.jobs, tx);
    return tx.filePlan.updateMany({ where: { id: plan.id, revision: plan.revision, status: { in: allowed } }, data: { owner, status, error: null, revision: { increment: 1 } } });
  });
  if (result.count !== 1) return fail("PLAN_BUSY", "Plan state changed or another owner is active"); ctx.owner = owner;
}
async function journal(ctx: Context, plan: FilePlan, operation: RuntimeOperation, phase: string, recovery = false) {
  await ctx.assert(parseSnapshots(plan), recovery);
  await ctx.db.$transaction(async (tx) => {
    await assertDeviceJobsOwned(ctx.jobs, tx);
    const owned = await tx.filePlan.updateMany({ where: { id: plan.id, owner: ctx.owner, status: { in: ["applying", "undoing", "reconciling"] } }, data: { revision: { increment: 1 } } });
    if (owned.count !== 1) return fail("OWNER_LOST", "Journal owner is no longer authoritative");
    await tx.filePlanOperation.update({ where: { id: operation.row.id }, data: { phase, specification: JSON.stringify(operation.spec), error: null } });
  }); operation.row.phase = phase;
}
async function preflight(ctx: Context, plan: FilePlan, operations: RuntimeOperation[]) {
  const snapshots = parseSnapshots(plan);
  await ctx.assert(snapshots);
  if (ctx.scope === "rom") await verifyDescriptorGraphs(ctx, snapshots, operations.map((operation) => operation.spec.source.deviceId));
  for (const operation of operations) {
    const { spec } = operation;
    if (!spec.source.saveVersionId && !spec.source.uploadSourceId) {
      await ctx.safePath(spec.source.deviceId, spec.source.path);
      await (spec.action === "copy" ? requireReadCapabilities : requireCapabilities)(ctx, spec.source.deviceId, path.posix.dirname(spec.source.path));
      if (spec.action !== "copy" && (spec.source.policy ?? "strict_native") !== mutationPolicy(ctx, spec.source.deviceId)) return fail("TRANSPORT_POLICY_CHANGED", "Mutation transport strength changed since preview");
    }
    await fingerprint(ctx, spec.source.deviceId, spec.source.path, spec.source.fingerprint);
    if (spec.source.manifestTracked !== false && !spec.source.noSourceManifest) {
      const association = await ctx.db.deviceFile.findUnique({ where: { deviceId_path: { deviceId: spec.source.deviceId, path: spec.source.manifestPath } } });
      if (!association || association.kind !== "file" || association.gameId !== spec.source.record.gameId) return fail("SOURCE_ASSOCIATION_CHANGED", "Confirmed source/game binding changed since preview");
    }
    if (spec.source.backupVersionId) await verifyTargetBackup(ctx, spec.source);
    if (spec.target) {
      await ctx.safePath(spec.target.deviceId, spec.target.path, true);
      await requireCapabilities(ctx, spec.target.deviceId, path.posix.dirname(spec.target.path));
      if ((spec.target.policy ?? "strict_native") !== mutationPolicy(ctx, spec.target.deviceId)) return fail("TRANSPORT_POLICY_CHANGED", "Target transport strength changed since preview");
      if (await exists(ctx, spec.target.deviceId, spec.target.path)) {
        const replacement = operations.find((operation) => operation.spec.action === "delete" && operation.spec.source.deviceId === spec.target!.deviceId && operation.spec.source.path === spec.target!.path);
        if (!replacement && (spec.action !== "rewrite" || spec.target.deviceId !== spec.source.deviceId || spec.target.path !== spec.source.path)) return fail("TARGET_COLLISION", "Target collision appeared since preview");
      }
      if (await exists(ctx, spec.target.deviceId, spec.tempPath!)) return fail("RECOVERY_NEEDED", "A prior or foreign temporary entry needs explicit recovery");
    }
    if (await exists(ctx, spec.source.deviceId, spec.quarantinePath)) return fail("RECOVERY_NEEDED", "A prior or foreign backup entry needs explicit recovery");
  }
  await checkSpace(ctx, operations);
}
async function stage(ctx: Context, plan: FilePlan, operation: RuntimeOperation) {
  const { spec } = operation; if (!spec.target) return;
  await journal(ctx, plan, operation, "stage_intent");
  const targetIo = await ctx.io(spec.target.deviceId);
  const writeTemp = spec.target.policy === "ftp_checked" ? targetIo.checked!.writeTempFrom.bind(targetIo.checked) : targetIo.writeExclusiveTempFrom.bind(targetIo);
  const expectedSize = spec.payload ? Buffer.byteLength(spec.payload, "base64") : spec.source.fingerprint.size;
  if (spec.payload) await writeTemp(spec.tempPath!, Readable.from(Buffer.from(spec.payload, "base64")), ctx.limits(expectedSize));
  else {
    const bridge = new PassThrough(); const controller = new AbortController();
    const limits = { ...ctx.limits(expectedSize), signal: AbortSignal.any([ctx.signal, controller.signal]) };
    const sourceIo = !spec.source.uploadSourceId && !spec.source.saveVersionId ? await (spec.target.policy === "ftp_checked" && spec.target.deviceId === spec.source.deviceId ? ctx.readIo(spec.source.deviceId) : ctx.io(spec.source.deviceId)) : undefined;
    await sourceIo?.checkPath?.(spec.source.path, ctx.snapshots.get(spec.source.deviceId)!.roots);
    const write = writeTemp(spec.tempPath!, bridge, limits).catch((error) => { controller.abort(error); bridge.destroy(); throw error; });
    const read = (spec.source.uploadSourceId ? readProtectedUploadTo(ctx.db, spec.source.uploadSourceId, bridge, limits) : spec.source.saveVersionId ? (async () => {
      const source = await verifiedSaveSource(ctx, spec.source.saveVersionId!);
      const { readSaveObjectTo } = await import("@/lib/save-store");
      return readSaveObjectTo(source.version.storageKey, bridge, limits, { storageDirectory: ctx.options.storageDirectory });
    })() : sourceIo!.readTo(spec.source.path, bridge, limits)).catch((error) => { controller.abort(error); bridge.destroy(); throw error; });
    for (const result of await Promise.allSettled([write, read])) if (result.status === "rejected") throw result.reason;
  }
  const verified = await fingerprint(ctx, spec.target.deviceId, spec.tempPath!);
  if (verified.size !== expectedSize || verified.sha256 !== (spec.payload ? digest(Buffer.from(spec.payload, "base64")) : spec.source.fingerprint.sha256)) return fail("STAGED_HASH_MISMATCH", "Temporary file does not match the verified planned bytes");
  spec.staged = verified;
  if (spec.target.policy === "ftp_checked") (spec.receipts ??= {}).stage = true;
  await journal(ctx, plan, operation, "staged");
}
async function quarantine(ctx: Context, plan: FilePlan, operation: RuntimeOperation) {
  const { spec } = operation; if (spec.action === "copy") return;
  await fingerprint(ctx, spec.source.deviceId, spec.source.path, spec.source.fingerprint);
  if (spec.source.backupVersionId) await verifyTargetBackup(ctx, spec.source);
  await journal(ctx, plan, operation, "quarantine_intent"); const io = await ctx.io(spec.source.deviceId);
  if (spec.source.policy === "ftp_checked") {
    await io.checked!.acknowledgeFile(spec.source.path);
    await io.checked!.rename(spec.source.path, spec.quarantinePath);
  } else {
    await io.flushFile!(spec.source.path);
    await io.renameNoReplace(spec.source.path, spec.quarantinePath);
  }
  await fingerprint(ctx, spec.source.deviceId, spec.quarantinePath, spec.source.fingerprint);
  if (await exists(ctx, spec.source.deviceId, spec.source.path)) return fail("PARTIAL_QUARANTINE", "Quarantine retained the source entry; reconcile before continuing");
  if (spec.source.policy === "ftp_checked") (spec.receipts ??= {}).quarantine = true;
  await journal(ctx, plan, operation, "quarantined");
}
async function publish(ctx: Context, plan: FilePlan, operation: RuntimeOperation) {
  const { spec } = operation; if (!spec.target || !spec.staged) return;
  await fingerprint(ctx, spec.target.deviceId, spec.tempPath!, spec.staged);
  await journal(ctx, plan, operation, "publish_intent");
  const io = await ctx.io(spec.target.deviceId);
  if (spec.target.policy === "ftp_checked") await io.checked!.publish(spec.tempPath!, spec.target.path);
  else await io.publishFileNoReplace(spec.tempPath!, spec.target.path);
  await fingerprint(ctx, spec.target.deviceId, spec.target.path, spec.staged);
  if (await exists(ctx, spec.target.deviceId, spec.tempPath!)) return fail("PARTIAL_PUBLICATION", "Publication retained a temporary entry; reconcile before continuing");
  if (spec.target.policy === "ftp_checked") (spec.receipts ??= {}).publish = true;
  await journal(ctx, plan, operation, "published");
}
async function validateDescriptors(ctx: Context, operations: RuntimeOperation[], recovery = false) {
  for (const { spec } of operations) {
    if (!spec.target || !spec.payload) continue;
    const references = parseScanDescriptor(Buffer.from(spec.payload, "base64").toString("utf8"), descriptorKind(spec.source.path)!);
    if (!references) return fail("DESCRIPTOR_CHANGED", "Descriptor references are not safely resolvable");
    for (const reference of references) {
      const filename = await ctx.safePath(spec.target.deviceId, path.posix.resolve(path.posix.dirname(spec.target.path), reference.reference));
      if ((await exists(ctx, spec.target.deviceId, filename))?.type !== "file") return fail("BROKEN_REFERENCE", "Descriptor target dependency is missing after publication");
    }
    await ctx.assert(undefined, recovery);
  }
}
function manifestData(value: StoredManifest): Omit<Prisma.DeviceFileUncheckedCreateInput, "deviceId" | "path"> { return { ...value, size: BigInt(value.size), seenAt: new Date(value.seenAt) }; }
async function updateManifest(tx: Prisma.TransactionClient, operations: RuntimeOperation[], undo: boolean, snapshots: DeviceSnapshot[]) {
  const affectedLinks = new Map<string, { gameId: number; deviceId: number }>();
  for (const { spec } of operations) if (spec.source.manifestTracked !== false && spec.source.record.gameId !== null) {
    const gameId = spec.source.record.gameId;
    affectedLinks.set(`${gameId}:${spec.source.deviceId}`, { gameId, deviceId: spec.source.deviceId });
    if (spec.target) affectedLinks.set(`${gameId}:${spec.target.deviceId}`, { gameId, deviceId: spec.target.deviceId });
  }
  for (const { spec } of operations) if (spec.source.noSourceManifest && spec.target) {
    const target = await tx.deviceFile.findUnique({ where: { deviceId_path: { deviceId: spec.target.deviceId, path: spec.target.path } } });
    if (target?.gameId) affectedLinks.set(`${target.gameId}:${spec.target.deviceId}`, { gameId: target.gameId, deviceId: spec.target.deviceId });
  }
  if (undo) for (const { spec } of operations) if (spec.source.manifestTracked !== false && spec.target && spec.staged && !(spec.target.deviceId === spec.source.deviceId && spec.target.path === spec.source.manifestPath)) {
    await tx.deviceFile.deleteMany({ where: { deviceId: spec.target.deviceId, path: spec.target.path, sha256: spec.staged?.sha256 } });
  }
  for (const { spec } of operations) {
    if (spec.source.manifestTracked === false) continue;
    const original = spec.source;
    if (undo) {
      if (spec.source.noSourceManifest || spec.action === "copy") continue;
      const restored = manifestData(original.record);
      if (restored.gameId && !await tx.game.findUnique({ where: { id: restored.gameId } })) restored.gameId = null;
      await tx.deviceFile.upsert({ where: { deviceId_path: { deviceId: original.deviceId, path: original.manifestPath } }, create: { deviceId: original.deviceId, path: original.manifestPath, ...restored }, update: restored });
    } else {
      if (spec.action !== "copy" && !(spec.target?.deviceId === original.deviceId && spec.target.path === original.manifestPath)) await tx.deviceFile.deleteMany({ where: { deviceId: original.deviceId, path: original.manifestPath } });
      if (spec.target && spec.staged) {
        const relative = path.posix.relative(spec.target.scanRoot, spec.target.path); const platformAlias = relative.includes("/") ? relative.split("/")[0] : "";
        const data = { ...manifestData(original.record), scanRoot: spec.target.scanRoot, platformAlias,
          relativePath: platformAlias ? path.posix.relative(path.posix.join(spec.target.scanRoot, platformAlias), spec.target.path) : relative,
          generation: snapshots.find((snapshot) => snapshot.id === spec.target!.deviceId)!.generation,
          size: BigInt(spec.staged.size), modifiedAt: spec.staged.modifiedAt, sha256: spec.staged.sha256, seenAt: new Date() };
        await tx.deviceFile.upsert({ where: { deviceId_path: { deviceId: spec.target.deviceId, path: spec.target.path } }, create: { ...data, deviceId: spec.target.deviceId, path: spec.target.path }, update: data });
      }
    }
  }
  for (const { gameId, deviceId } of affectedLinks.values()) {
    if (!await tx.game.findUnique({ where: { id: gameId } })) continue;
    const confirmed = await tx.deviceFile.findMany({ where: { gameId, deviceId, kind: "file", source: { in: ["rom", "steam"] } }, orderBy: { path: "asc" } });
    if (!confirmed.length) await tx.gameDevice.deleteMany({ where: { gameId, deviceId } });
    else {
      const representative = confirmed.find((file) => path.posix.extname(file.path).toLowerCase() === ".m3u") ?? confirmed.find((file) => descriptorKind(file.path)) ?? confirmed[0];
      await tx.gameDevice.upsert({ where: { gameId_deviceId: { gameId, deviceId } }, create: { gameId, deviceId, originalFile: representative.relativePath }, update: { originalFile: representative.relativePath } });
    }
  }
}
async function finish(ctx: Context, plan: FilePlan, operations: RuntimeOperation[], status: string, undo: boolean) {
  await ctx.assert(parseSnapshots(plan), undo);
  await ctx.db.$transaction(async (tx) => {
    await assertDeviceJobsOwned(ctx.jobs, tx);
    const owned = await tx.filePlan.updateMany({ where: { id: plan.id, owner: ctx.owner }, data: { status, owner: null, error: null, revision: { increment: 1 }, ...(status === "applied" ? { appliedAt: new Date() } : {}) } });
    if (owned.count !== 1) return fail("OWNER_LOST", "Journal owner was lost before completion");
    await updateManifest(tx, operations, undo, parseSnapshots(plan));
    for (const operation of operations) {
      if (status === "ready") operation.spec.staged = undefined;
      if (status === "ready") operation.spec.receipts = undefined;
      await tx.filePlanOperation.update({ where: { id: operation.row.id }, data: { phase: status === "ready" ? "planned" : status === "applied" ? "complete" : "restored", specification: JSON.stringify(operation.spec), error: null } });
    }
  });
}
async function verifyRecovery(ctx: Context, operations: RuntimeOperation[]) {
  for (const { spec } of operations) {
    const source = spec.action === "copy" ? null : await exists(ctx, spec.source.deviceId, spec.source.path); const backup = await exists(ctx, spec.source.deviceId, spec.quarantinePath);
    // A copy never owns or restores its source. Only its verified output is undone.
    if (spec.action === "copy") {
      if (backup) return fail("RECOVERY_CONFLICT", "A copy has an unexpected source quarantine; preserve it for inspection");
    } else if (source) {
      const ownOutput = operations.find((operation) => operation.spec.target?.deviceId === spec.source.deviceId && operation.spec.target.path === spec.source.path && operation.spec.staged &&
        (operation.spec.target.policy === "ftp_checked" ? operation.spec.receipts?.publish && !operation.spec.receipts.undoTarget : operation.spec.staged.identity === source.identity));
      if (spec.source.policy === "ftp_checked" && spec.receipts?.quarantine && !spec.receipts.restoreSource && !ownOutput) return fail("RECOVERY_CONFLICT", "Source reappeared after confirmed FTP quarantine without a recorded restore");
      await fingerprint(ctx, spec.source.deviceId, spec.source.path, ownOutput?.spec.staged ?? spec.source.fingerprint, true);
    } else if (!backup) return fail("RECOVERY_CONFLICT", "Neither the original source nor its verified backup exists");
    if (backup) {
      if (spec.source.policy === "ftp_checked" && (!spec.receipts?.quarantine || spec.receipts.restoreSource)) return fail("RECOVERY_CONFLICT", "FTP quarantine ownership has no recorded completed acknowledgement; preserve it for manual review");
      await fingerprint(ctx, spec.source.deviceId, spec.quarantinePath, spec.source.fingerprint, true);
    }
    if (spec.target) {
      const target = await exists(ctx, spec.target.deviceId, spec.target.path);
      if (spec.target.policy === "ftp_checked" && !target && spec.receipts?.publish && !spec.receipts.undoTarget) return fail("RECOVERY_CONFLICT", "Confirmed FTP publication disappeared without a recorded Undo");
      const replacement = operations.find((operation) => operation.spec.action === "delete" && operation.spec.source.deviceId === spec.target!.deviceId && operation.spec.source.path === spec.target!.path && target &&
        (operation.spec.source.policy === "ftp_checked" ? !operation.spec.receipts?.quarantine || operation.spec.receipts.restoreSource : target.identity === operation.spec.source.fingerprint.identity));
      const originalRewrite = spec.action === "rewrite" && (spec.source.policy === "ftp_checked" ? !spec.receipts?.quarantine || spec.receipts.restoreSource : target?.identity === spec.source.fingerprint.identity);
      if (target && !originalRewrite && !replacement) {
        if (!spec.staged) return fail("RECOVERY_CONFLICT", "Target ownership was never durably recorded");
        if (spec.target.policy === "ftp_checked" && (!spec.receipts?.publish || spec.receipts.undoTarget)) return fail("RECOVERY_CONFLICT", "FTP publication has no recorded completed acknowledgement; preserve the public file for manual review");
        await fingerprint(ctx, spec.target.deviceId, spec.target.path, spec.staged, true);
      }
      if (await exists(ctx, spec.target.deviceId, spec.tempPath!)) {
        if (!spec.staged) return fail("RECOVERY_CONFLICT", "Temporary ownership was not durably recorded; preserve it for inspection");
        if (spec.target.policy === "ftp_checked" && (!spec.receipts?.stage || spec.receipts.publish)) return fail("RECOVERY_CONFLICT", "FTP staging completion is unrecorded or inconsistent; preserve it for review");
        await fingerprint(ctx, spec.target.deviceId, spec.tempPath!, spec.staged, true);
      }
      const undo = await exists(ctx, spec.target.deviceId, spec.undoPath!);
      if (spec.target.policy === "ftp_checked" && spec.receipts?.undoTarget && !undo) return fail("RECOVERY_CONFLICT", "Recorded FTP Undo quarantine disappeared; preserve the remaining files for review");
      if (undo) {
        if (!spec.staged) return fail("RECOVERY_CONFLICT", "Undo backup ownership is unknown");
        if (spec.target.policy === "ftp_checked" && !spec.receipts?.undoTarget) return fail("RECOVERY_CONFLICT", "FTP undo effect has no recorded completed acknowledgement");
        await fingerprint(ctx, spec.target.deviceId, spec.undoPath!, spec.staged, true);
      }
    }
  }
}
async function retainEntry(ctx: Context, plan: FilePlan, operation: RuntimeOperation, id: number, filename: string, expected: Fingerprint, phase: string) {
  const target = path.posix.join(path.posix.dirname(filename), `.ludotek-${plan.id}-${operation.row.id}-${randomUUID()}-retained`);
  operation.spec.artifacts.push({ deviceId: id, path: target, fingerprint: expected });
  await journal(ctx, plan, operation, phase, true); await fingerprint(ctx, id, filename, expected, true);
  const io = await ctx.io(id);
  if (mutationPolicy(ctx, id) === "ftp_checked") await io.checked!.rename(filename, target);
  else await io.renameNoReplace(filename, target);
  await fingerprint(ctx, id, target, expected, true);
  if (await exists(ctx, id, filename)) return fail("RECOVERY_CONFLICT", "Recovery retained a second namespace entry and needs another explicit check");
  await journal(ctx, plan, operation, `${phase}_done`, true);
}
async function rollback(ctx: Context, plan: FilePlan, operations: RuntimeOperation[], status: "ready" | "undone") {
  await ctx.assert(parseSnapshots(plan), true); await verifyRecovery(ctx, operations);
  for (const operation of [...operations].reverse()) {
    const { spec } = operation; if (!spec.target || !spec.staged) continue;
    const target = await exists(ctx, spec.target.deviceId, spec.target.path);
    if (target && (spec.target.policy === "ftp_checked" ? spec.receipts?.publish && !spec.receipts.undoTarget : target.identity === spec.staged.identity)) {
      await journal(ctx, plan, operation, "undo_target_intent", true); await fingerprint(ctx, spec.target.deviceId, spec.target.path, spec.staged, true);
      if (await exists(ctx, spec.target.deviceId, spec.undoPath!)) await retainEntry(ctx, plan, operation, spec.target.deviceId, spec.undoPath!, spec.staged, "retain_previous_undo");
      const io = await ctx.io(spec.target.deviceId);
      if (spec.target.policy === "ftp_checked") await io.checked!.rename(spec.target.path, spec.undoPath!);
      else await io.renameNoReplace(spec.target.path, spec.undoPath!);
      await fingerprint(ctx, spec.target.deviceId, spec.undoPath!, spec.staged, true);
      if (await exists(ctx, spec.target.deviceId, spec.target.path)) return fail("RECOVERY_CONFLICT", "Undo could not remove the verified target namespace entry");
      if (spec.target.policy === "ftp_checked") (spec.receipts ??= {}).undoTarget = true;
      await journal(ctx, plan, operation, "undo_target_done", true);
    }
    if (await exists(ctx, spec.target.deviceId, spec.tempPath!)) await retainEntry(ctx, plan, operation, spec.target.deviceId, spec.tempPath!, spec.staged, "retain_temp");
  }
  for (const operation of operations) {
    const { spec } = operation; if (spec.action === "copy") continue;
    const source = await exists(ctx, spec.source.deviceId, spec.source.path); const backup = await exists(ctx, spec.source.deviceId, spec.quarantinePath);
    if (backup && !source) {
      await journal(ctx, plan, operation, "restore_source_intent", true); await fingerprint(ctx, spec.source.deviceId, spec.quarantinePath, spec.source.fingerprint, true);
      const io = await ctx.io(spec.source.deviceId);
      if (spec.source.policy === "ftp_checked") await io.checked!.rename(spec.quarantinePath, spec.source.path);
      else await io.renameNoReplace(spec.quarantinePath, spec.source.path);
      await fingerprint(ctx, spec.source.deviceId, spec.source.path, spec.source.fingerprint, true);
      if (spec.source.policy === "ftp_checked") (spec.receipts ??= {}).restoreSource = true;
      await journal(ctx, plan, operation, "source_restored", true);
    } else if (backup && source) await retainEntry(ctx, plan, operation, spec.source.deviceId, spec.quarantinePath, spec.source.fingerprint, "retain_duplicate_backup");
  }
  // Reset paths and retain undo artifacts atomically with the final status.
  if (status === "ready") for (const operation of operations) {
    const { spec } = operation;
    if (spec.target && spec.staged && await exists(ctx, spec.target.deviceId, spec.undoPath!)) spec.artifacts.push({ deviceId: spec.target.deviceId, path: spec.undoPath!, fingerprint: spec.staged });
    const suffix = randomUUID();
    spec.quarantinePath = path.posix.join(path.posix.dirname(spec.source.path), `.ludotek-${plan.id}-${operation.row.id}-${suffix}-backup`);
    if (spec.target) {
      spec.tempPath = path.posix.join(path.posix.dirname(spec.target.path), `.ludotek-${plan.id}-${operation.row.id}-${suffix}-temp`);
      spec.undoPath = path.posix.join(path.posix.dirname(spec.target.path), `.ludotek-${plan.id}-${operation.row.id}-${suffix}-undo`);
    }
  }
  await finish(ctx, plan, operations, status, true);
}
async function markRecovery(ctx: Context, plan: FilePlan, error: unknown) {
  await ctx.db.$transaction(async (tx) => {
    await assertDeviceJobsOwned(ctx.jobs, tx);
    await tx.filePlan.updateMany({ where: { id: plan.id, owner: ctx.owner }, data: { status: "recovery_needed", owner: null, error: publicError(error), revision: { increment: 1 } } });
  });
}
export async function applyFilePlan(id: string, request: Request, options: FilePlanOptions = {}): Promise<FilePlanView> {
  const plan = await loadPlan(id, options.db ?? prisma);
  if (plan.kind === "mkdir") return executeDirectoryPlan(id, request, options, "apply");
  const operations = plan.operations.map((row) => ({ row, spec: parseSpec(row) }));
  const ctx = await context(parseSnapshots(plan).map((state) => state.id), request, options, plan.kind === "save_restore" ? "save" : plan.kind === "upload" ? "upload" : "rom"); let started = false;
  registerSaveSources(ctx, operations);
  try {
    for (const state of parseSnapshots(plan)) await ctx.loadDevice(state.id);
    if (plan.status === "applied") {
      await ctx.assert(parseSnapshots(plan)); await verifyRecovery(ctx, operations);
      for (const { spec } of operations) if (spec.target) {
        if (!spec.staged || !await exists(ctx, spec.target.deviceId, spec.target.path)) return fail("APPLIED_STATE_CHANGED", "Applied plan output no longer exists");
        await fingerprint(ctx, spec.target.deviceId, spec.target.path, spec.staged);
      }
      for (const { spec } of operations) if (spec.action !== "copy") {
        const source = await exists(ctx, spec.source.deviceId, spec.source.path);
        if (source && source.identity === spec.source.fingerprint.identity) return fail("APPLIED_STATE_CHANGED", "An applied source quarantine has been externally reversed");
      }
      return view(plan);
    }
    if (plan.status !== "ready") return fail("RECOVERY_NEEDED", "Plan must be ready; resolve its saved recovery state first");
    await preflight(ctx, plan, operations); await claim(ctx, plan, "applying", ["ready"]); started = true;
    for (const operation of operations) await stage(ctx, plan, operation);
    for (const { spec } of operations) await fingerprint(ctx, spec.source.deviceId, spec.source.path, spec.source.fingerprint);
    for (const operation of operations) await quarantine(ctx, plan, operation);
    for (const operation of operations) await publish(ctx, plan, operation);
    await validateDescriptors(ctx, operations); await finish(ctx, plan, operations, "applied", false);
    return await getFilePlan(id, options);
  } catch (error) {
    if (started) {
      // Recovery uses committed receipts, never in-memory evidence whose DB commit failed.
      const durable = await loadPlan(plan.id, ctx.db);
      for (const operation of operations) { const row = durable.operations.find((entry) => entry.id === operation.row.id)!; operation.row = row; operation.spec = parseSpec(row); }
      try { await rollback(ctx, plan, operations, "ready"); }
      catch (recoveryError) { try { await markRecovery(ctx, plan, recoveryError); } catch { /* Keep the last durable phase on store failure. */ } }
    }
    if (error instanceof FilePlanError) throw error; throw new FilePlanError(503, "PLAN_IO_FAILED", publicError(error), id);
  } finally { await ctx.close(); }
}
async function recover(id: string, request: Request, options: FilePlanOptions, undo: boolean): Promise<FilePlanView> {
  const plan = await loadPlan(id, options.db ?? prisma);
  if (plan.kind === "mkdir") return executeDirectoryPlan(id, request, options, undo ? "undo" : "reconcile");
  const operations = plan.operations.map((row) => ({ row, spec: parseSpec(row) }));
  const ctx = await context(parseSnapshots(plan).map((state) => state.id), request, options, plan.kind === "save_restore" ? "save" : plan.kind === "upload" ? "upload" : "rom"); let claimed = false;
  registerSaveSources(ctx, operations);
  try {
    if (undo && plan.status === "undone") return view(plan);
    if (undo && plan.status !== "applied") return fail("NOT_APPLIED", "Only a successfully applied plan can be undone");
    for (const state of parseSnapshots(plan)) await ctx.loadDevice(state.id);
    for (const { spec } of operations) {
      if (spec.action !== "copy") {
        await requireCapabilities(ctx, spec.source.deviceId, path.posix.dirname(spec.source.path));
        if ((spec.source.policy ?? "strict_native") !== mutationPolicy(ctx, spec.source.deviceId)) return fail("TRANSPORT_POLICY_CHANGED", "Source mutation strength changed since preview");
      }
      if (spec.target) {
        await requireCapabilities(ctx, spec.target.deviceId, path.posix.dirname(spec.target.path));
        if ((spec.target.policy ?? "strict_native") !== mutationPolicy(ctx, spec.target.deviceId)) return fail("TRANSPORT_POLICY_CHANGED", "Target mutation strength changed since preview");
      }
    }
    await ctx.assert(parseSnapshots(plan), true); await verifyRecovery(ctx, operations);
    if (!undo && plan.status === "applied") return view(plan);
    await claim(ctx, plan, undo ? "undoing" : "reconciling", undo ? ["applied"] : ["ready", "applying", "undoing", "reconciling", "recovery_needed", "applied"]); claimed = true;
    await rollback(ctx, plan, operations, undo || !!plan.appliedAt ? "undone" : "ready"); return await getFilePlan(id, options);
  } catch (error) {
    if (claimed) try { await markRecovery(ctx, plan, error); } catch { /* Keep the last durable phase on store failure. */ }
    if (error instanceof FilePlanError) throw error; throw new FilePlanError(503, "RECOVERY_FAILED", publicError(error), id);
  } finally { await ctx.close(); }
}
export async function undoFilePlan(id: string, request: Request, options: FilePlanOptions = {}): Promise<FilePlanView> { return recover(id, request, options, true); }
export async function reconcileFilePlan(id: string, request: Request, options: FilePlanOptions = {}): Promise<FilePlanView> { return recover(id, request, options, false); }
