import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { Writable } from "node:stream";
import type { Device, FilePlan, FilePlanOperation, PrismaClient } from "@prisma/client";
import { createConnection, requireFileIo, type DeviceConnection, type FileEntryStat } from "@/lib/connection";
import { acquireDeviceFiles, assertDeviceJobsOwned, type DeviceJobs } from "@/lib/device-jobs";
import { AdmissionStore, EnrichmentJob } from "@/lib/job-admission";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { getLocalFilesRoots, resolveLocalPath } from "@/lib/local-paths";
import { FilePlanError, parseFilePlanScanRoots, filePlanMutationPolicy, assertFilePlanSpace, CHECKED_FTP_LIMITATIONS, type FilePlanTransportPolicy, type FilePlanInput, type FilePlanOptions, type FilePlanView } from "@/lib/file-plans";

type Plan = FilePlan & { operations: FilePlanOperation[] };
interface DirectorySpec { version: 2; deviceId: number; path: string; scanRoot: string; parent: string; policy?: FilePlanTransportPolicy; parentIdentity?: string; parentUniqueId?: string; createdIdentity?: string; createdUniqueId?: string; receipt?: string; createdAck?: boolean; removedAck?: boolean }
interface Snapshot { id: number; configHash: string; roots: string[]; generation: string }
const error = (message: string, code = "DIRECTORY_CONFLICT", status: FilePlanError["status"] = 409): never => { throw new FilePlanError(status, code, message); };
function spec(row: FilePlanOperation): DirectorySpec {
  try {
    const value = JSON.parse(row.specification) as DirectorySpec;
    if (value.version !== 2 || !Number.isSafeInteger(value.deviceId) || !value.path ||
      (value.policy === "ftp_checked" ? !value.receipt || !/^[a-f0-9-]{36}$/.test(value.receipt) : !value.parentIdentity) ||
      (value.policy !== undefined && !["strict_native", "ftp_checked"].includes(value.policy))) throw new Error();
    return value;
  } catch { return error("Directory journal specification is invalid", "INVALID_JOURNAL", 503); }
}
function contains(root: string, filename: string) { const relative = path.posix.relative(root, filename); return !!relative && relative !== ".." && !relative.startsWith("../") && !path.posix.isAbsolute(relative); }
function valid(filename: unknown): filename is string { return typeof filename === "string" && filename.length <= 4096 && filename.startsWith("/") && filename !== "/" && path.posix.normalize(filename) === filename && !/[\x00-\x1f\x7f-\x9f]/.test(filename) && !filename.split("/").some((part) => part.startsWith(".ludotek-")); }
export function directoryPlanView(plan: Plan): FilePlanView {
  return { id: plan.id, kind: "mkdir", status: plan.status, totalBytes: "0", revision: plan.revision, error: plan.error,
    createdAt: plan.createdAt.toISOString(), appliedAt: plan.appliedAt?.toISOString() ?? null,
    ...(plan.operations.some((row) => spec(row).policy === "ftp_checked") ? { warningLevel: "checked_ftp" as const, limitations: CHECKED_FTP_LIMITATIONS } : {}),
    operations: plan.operations.map((row) => { const value = spec(row); return { id: row.id, ordinal: row.ordinal, kind: "mkdir", phase: row.phase, error: row.error,
      deviceId: value.deviceId, filePath: value.path, newPath: value.path, sourceDeviceId: value.deviceId, sourcePath: value.path,
      targetDeviceId: value.deviceId, targetPath: value.path, bytes: 0, generated: false, rewritesDescriptor: false, sourceFingerprint: { sha256: "", size: 0 } }; }) };
}
async function load(id: string, db: PrismaClient): Promise<Plan> {
  if (!/^[a-f0-9-]{36}$/.test(id)) return error("Invalid file-plan ID", "INVALID_PLAN_ID", 400);
  const plan = await db.filePlan.findUnique({ where: { id }, include: { operations: { orderBy: { ordinal: "asc" } } } });
  if (!plan || plan.kind !== "mkdir") return error("Directory plan not found", "PLAN_NOT_FOUND", 404); return plan;
}
async function snapshot(db: PrismaClient, id: number): Promise<{ state: Snapshot; device: Device }> {
  const device = await db.device.findUnique({ where: { id }, include: { profile: true, inventory: true } });
  if (!device) return error("Directory plan device no longer exists");
  let roots = parseFilePlanScanRoots(device.scanPaths);
  if (device.protocol === "local") roots = await Promise.all(roots.map((root) => resolveLocalPath(root)));
  const localRoots = device.protocol === "local" ? await getLocalFilesRoots() : [];
  const configHash = createHash("sha256").update(JSON.stringify({ protocol: device.protocol, host: device.host, port: device.port, user: device.user,
    password: device.password, ftps: device.ftps, scanPaths: device.scanPaths, blacklist: device.blacklist, updatedAt: device.updatedAt.toISOString(), profile: device.profile, localRoots },
  (_key, value) => typeof value === "bigint" ? value.toString() : value)).digest("hex");
  return { state: { id, configHash, roots, generation: device.inventory?.generation ?? "" }, device };
}
async function withRuntime<T>(ids: number[], request: Request, options: FilePlanOptions, work: (runtime: Runtime) => Promise<T>): Promise<T> {
  const db = options.db ?? prisma;
  let jobs: DeviceJobs;
  if (options.heldJobs) {
    if (ids.some((id) => !options.heldJobs!.deviceIds.includes(id))) return error("Borrowed lease does not cover every directory-plan device", "LEASE_SCOPE");
    const parent = options.heldJobs.jobs; jobs = { signal: parent.signal, assertActive: () => parent.assertActive(), assertOwned: parent.assertOwned ? (tx) => parent.assertOwned!(tx) : undefined, close: async () => {} };
  } else { const store = new AdmissionStore(db); jobs = await acquireDeviceFiles(ids, request, options.acquire ?? (async (resource, req) => new EnrichmentJob(await store.acquire(resource), req.signal))); }
  let runtime: Runtime | undefined;
  try { runtime = new Runtime(db, jobs, options); return await work(runtime); }
  finally { try { for (const connection of runtime?.connections.values() ?? []) connection.disconnect(); } finally { await jobs.close(); } }
}
class Runtime {
  readonly connections = new Map<number, DeviceConnection>();
  owner?: string;
  private readonly deadline: number;
  constructor(readonly db: PrismaClient, readonly jobs: DeviceJobs, readonly options: FilePlanOptions) {
    const duration = options.totalTimeoutMs ?? 900000;
    if (!Number.isSafeInteger(duration) || duration < 1 || duration > 3600000) throw new FilePlanError(400, "INVALID_LIMITS", "Invalid directory-plan total deadline");
    this.deadline = Date.now() + duration;
  }
  async io(id: number) {
    if (!this.connections.has(id)) {
      const { device } = await snapshot(this.db, id);
      this.connections.set(id, this.options.connect ? await this.options.connect(device) : await createConnection({
        protocol: device.protocol as "local" | "ssh" | "ftp", host: device.host, port: device.port, user: device.user, password: decrypt(device.password), ftps: device.ftps }));
    }
    return requireFileIo(this.connections.get(id)!);
  }
  async assert(states: Snapshot[]) {
    await this.jobs.assertActive();
    if (Date.now() >= this.deadline) return error("Directory-plan total deadline exceeded", "PLAN_TIMEOUT");
    for (const state of states) if ((await snapshot(this.db, state.id)).state.configHash !== state.configHash) return error("Directory-plan device configuration or permitted roots changed");
  }
  async capabilities(id: number, parent: string, receiptBytes?: number) {
    const io = await this.io(id); const caps = await io.capabilities(parent);
    const { device } = await snapshot(this.db, id);
    if (filePlanMutationPolicy(io, device.protocol) === "ftp_checked") {
      if (receiptBytes !== undefined) {
        const profile = await this.db.deviceProfile.findUnique({ where: { deviceId: id } });
        await assertFilePlanSpace(io, parent, BigInt(receiptBytes), profile?.reserveBytes ?? BigInt(0), device.protocol);
      }
      return io;
    }
    if (caps.directoryCreate?.state !== "supported" || caps.directoryRemoveEmpty?.state !== "supported" || caps.directoryFlush.state !== "supported" || !io.createDirectoryNoReplace || !io.removeEmptyDirectory) return error("Device has no evidenced durable no-replace directory capability", "UNSUPPORTED_CAPABILITY", 422);
    return io;
  }
  async guard(value: Pick<DirectorySpec, "deviceId" | "path" | "parent">) {
    const { state } = await snapshot(this.db, value.deviceId); const io = await this.io(value.deviceId);
    await io.checkPath?.(value.parent, state.roots);
    await io.checkPath?.(value.path, state.roots, true);
  }
  async owned(value: DirectorySpec, current: FileEntryStat) {
    if (current.type !== "directory") return false;
    if (value.policy !== "ftp_checked") return !!value.createdIdentity && current.identity === value.createdIdentity;
    if (!value.createdAck || value.removedAck || (value.createdUniqueId !== undefined && current.uniqueId !== value.createdUniqueId)) return false;
    const marker = path.posix.join(value.path, `.ludotek-directory-receipt-${value.receipt}`);
    const chunks: Buffer[] = [];
    try {
      await (await this.io(value.deviceId)).readTo(marker, new Writable({ write(chunk: Buffer, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } }),
        { maxBytes: value.receipt!.length, expectedBytes: value.receipt!.length, timeoutMs: this.options.ioTimeoutMs ?? 120000, signal: this.jobs.signal });
      return Buffer.concat(chunks).toString("utf8") === value.receipt;
    } catch { return false; }
  }
  async empty(value: DirectorySpec) {
    const entries = await this.connections.get(value.deviceId)!.listDir(value.path, { requireComplete: true });
    return value.policy === "ftp_checked" ? entries.length === 1 && entries[0].name === `.ludotek-directory-receipt-${value.receipt}` : entries.length === 0;
  }
  async remove(value: DirectorySpec) {
    const io = await this.io(value.deviceId);
    await this.guard(value);
    if (value.policy === "ftp_checked") await io.checked!.removeEmptyDirectory(value.path, value.receipt!);
    else await io.removeEmptyDirectory!(value.path, value.createdIdentity!);
  }
  async exists(id: number, filename: string) {
    try { return await (await this.io(id)).lstat(filename); } catch (failure) { if ((failure as NodeJS.ErrnoException).code === "ENOENT" || (failure as { code?: number }).code === 2) return null; throw failure; }
  }
  async journal(plan: Plan, row: FilePlanOperation, value: DirectorySpec, phase: string) {
    await this.assert(JSON.parse(plan.deviceState));
    await this.db.$transaction(async (tx) => {
      await assertDeviceJobsOwned(this.jobs, tx);
      const owned = await tx.filePlan.updateMany({ where: { id: plan.id, owner: this.owner }, data: { revision: { increment: 1 } } });
      if (owned.count !== 1) return error("Directory journal owner was lost", "OWNER_LOST");
      await tx.filePlanOperation.update({ where: { id: row.id }, data: { phase, specification: JSON.stringify(value) } });
    }); row.phase = phase;
  }
  async claim(plan: Plan, status: string, allowed: string[]) {
    this.owner = randomUUID();
    const owned = await this.db.$transaction(async (tx) => {
      await assertDeviceJobsOwned(this.jobs, tx);
      return tx.filePlan.updateMany({ where: { id: plan.id, revision: plan.revision, status: { in: allowed } }, data: { owner: this.owner, status, error: null, revision: { increment: 1 } } });
    });
    if (owned.count !== 1) return error("Directory-plan state changed or another owner is active", "PLAN_BUSY");
  }
  async recovery(plan: Plan, failure: unknown) {
    try { await this.db.$transaction(async (tx) => {
      await assertDeviceJobsOwned(this.jobs, tx);
      await tx.filePlan.updateMany({ where: { id: plan.id, owner: this.owner }, data: { owner: null, status: "recovery_needed", revision: { increment: 1 }, error: failure instanceof FilePlanError ? failure.message : "Directory I/O or journal storage failed; recovery is required" } });
    }); } catch { /* Keep prior durable phase when storage is unavailable. */ }
  }
  async compensate(plan: Plan, rows: { row: FilePlanOperation; value: DirectorySpec }[], failure: unknown, attemptedId?: string) {
    await this.assert(JSON.parse(plan.deviceState));
    const owned: { row: FilePlanOperation; value: DirectorySpec }[] = [];
    for (const entry of rows) {
      const current = await this.exists(entry.value.deviceId, entry.value.path);
      if (!current) continue;
      if (entry.value.policy === "ftp_checked" ? !entry.value.createdAck : !entry.value.createdIdentity) {
        // EEXIST proves that this particular mkdir created nothing; preserve that foreign entry.
        if (entry.row.id === attemptedId && (failure as NodeJS.ErrnoException).code === "EEXIST") continue;
        return error("Directory creation ownership was not recorded; explicit recovery is required", "OWNERSHIP_CONFLICT");
      }
      if (!await this.owned(entry.value, current) || !await this.empty(entry.value)) return error("Created directory changed or is no longer empty; preserve it for recovery", "OWNERSHIP_CONFLICT");
      owned.push(entry);
    }
    for (const { row, value } of owned.reverse()) {
      await this.journal(plan, row, value, "compensate_empty_directory_intent");
      await this.remove(value);
      value.createdIdentity = undefined;
      value.createdAck = undefined; value.removedAck = undefined; value.createdUniqueId = undefined;
      await this.journal(plan, row, value, "directory_compensated");
    }
    await this.db.$transaction(async (tx) => {
      await assertDeviceJobsOwned(this.jobs, tx);
      const updated = await tx.filePlan.updateMany({ where: { id: plan.id, owner: this.owner }, data: { owner: null, status: "ready", revision: { increment: 1 }, error: "Directory apply failed; verified empty creations were compensated" } });
      if (updated.count !== 1) return error("Directory journal owner was lost", "OWNER_LOST");
      for (const { row, value } of rows) await tx.filePlanOperation.update({ where: { id: row.id }, data: { phase: "planned", specification: JSON.stringify(value) } });
    });
  }
}
export async function createDirectoryPlan(input: FilePlanInput, request: Request, options: FilePlanOptions): Promise<FilePlanView> {
  if (!Array.isArray(input.operations) || !input.operations.length || input.operations.length > 100 || input.operations.some((operation) => !operation || !Number.isSafeInteger(operation.deviceId) || operation.deviceId < 1 || operation.gameId !== undefined || operation.targetDeviceId !== undefined)) return error("Directory plan requires 1–100 bounded same-device operations", "INVALID_INPUT", 400);
  return withRuntime(input.operations.map((operation) => operation.deviceId), request, options, async (runtime) => {
    const states = new Map<number, Snapshot>(); const rows: { id: string; ordinal: number; value: DirectorySpec }[] = []; const paths = new Set<string>();
    for (const [ordinal, operation] of input.operations.entries()) {
      await runtime.jobs.assertActive();
      const { state, device } = await snapshot(runtime.db, operation.deviceId); states.set(operation.deviceId, state);
      const requested = operation.newPath ?? operation.filePath;
      if (!valid(requested)) return error("Invalid or protected directory path", "INVALID_PATH", 400);
      const filename = device.protocol === "local" ? await resolveLocalPath(requested, { allowMissing: true, destructive: true }) : requested;
      const scanRoot = state.roots.find((root) => contains(root, filename));
      if (!scanRoot) return error("Directory target is outside this device's scan roots", "OUTSIDE_SCAN_ROOT");
      const key = `${operation.deviceId}:${filename}`; if (paths.has(key)) return error("Directory target occurs more than once", "INVALID_INPUT", 400); paths.add(key);
      const parent = path.posix.dirname(filename); const io = await runtime.capabilities(operation.deviceId, parent, 36); const parentInfo = await io.lstat(parent);
      await runtime.guard({ deviceId: operation.deviceId, path: filename, parent });
      const policy = filePlanMutationPolicy(io, device.protocol);
      if (parentInfo.type !== "directory" || (policy === "strict_native" && !parentInfo.identity)) return error("Directory parent identity is unavailable", "UNSAFE_PARENT");
      if (await runtime.exists(operation.deviceId, filename)) return error("Directory target already exists", "TARGET_COLLISION");
      rows.push({ id: randomUUID(), ordinal, value: { version: 2, deviceId: operation.deviceId, path: filename, scanRoot, parent, policy, parentIdentity: parentInfo.identity, parentUniqueId: parentInfo.uniqueId, ...(policy === "ftp_checked" ? { receipt: randomUUID() } : {}) } });
    }
    const plan = await runtime.db.$transaction(async (tx) => {
      await assertDeviceJobsOwned(runtime.jobs, tx);
      return tx.filePlan.create({ data: { kind: "mkdir", deviceState: JSON.stringify([...states.values()]), totalBytes: BigInt(0),
        operations: { create: rows.map((row) => ({ id: row.id, ordinal: row.ordinal, kind: "mkdir", specification: JSON.stringify(row.value) })) } }, include: { operations: { orderBy: { ordinal: "asc" } } } });
    });
    return directoryPlanView(plan);
  });
}
export async function executeDirectoryPlan(id: string, request: Request, options: FilePlanOptions, mode: "apply" | "undo" | "reconcile"): Promise<FilePlanView> {
  const db = options.db ?? prisma; const plan = await load(id, db); const rows = plan.operations.map((row) => ({ row, value: spec(row) }));
  return withRuntime(rows.map(({ value }) => value.deviceId), request, options, async (runtime) => {
    const states: Snapshot[] = JSON.parse(plan.deviceState); await runtime.assert(states);
    for (const { value } of rows) {
      const io = await runtime.capabilities(value.deviceId, value.parent, mode === "apply" ? value.receipt?.length ?? 36 : undefined);
      const { device } = await snapshot(runtime.db, value.deviceId);
      if ((value.policy ?? "strict_native") !== filePlanMutationPolicy(io, device.protocol)) return error("Directory transport strength changed since preview", "OWNERSHIP_CONFLICT");
      await runtime.guard(value);
      const parent = await io.lstat(value.parent);
      if (parent.type !== "directory" || (value.policy === "ftp_checked" ? value.parentUniqueId !== undefined && parent.uniqueId !== value.parentUniqueId : parent.identity !== value.parentIdentity)) return error("Directory parent identity changed", "OWNERSHIP_CONFLICT");
    }
    if ((mode === "apply" && plan.status === "applied") || (mode === "reconcile" && plan.status === "applied")) {
      for (const { value } of rows) { const current = await runtime.exists(value.deviceId, value.path); if (!current || !await runtime.owned(value, current)) return error("Applied directory ownership changed", "OWNERSHIP_CONFLICT"); }
      return directoryPlanView(plan);
    }
    if (mode === "undo" && plan.status === "undone") return directoryPlanView(plan);
    if (mode === "apply" && plan.status !== "ready") return error("Directory plan requires explicit recovery before applying", "RECOVERY_NEEDED");
    if (mode === "undo" && plan.status !== "applied") return error("Only an applied directory plan can be undone", "NOT_APPLIED");
    for (const { value } of rows) {
      const entry = await runtime.exists(value.deviceId, value.path);
      if (mode === "apply") { if (entry) return error("Directory target collision appeared since preview", "TARGET_COLLISION"); }
      else if (entry) {
        if (!await runtime.owned(value, entry)) return error("Directory ownership is unknown or changed; preserve it", "OWNERSHIP_CONFLICT");
        if (!await runtime.empty(value)) return error("Undo requires the owned directory to remain empty", "DIRECTORY_NOT_EMPTY");
      } else if (value.policy === "ftp_checked" && value.createdAck && !value.removedAck) {
        return error("FTP directory removal has no recorded acknowledgement; explicit review is required", "OWNERSHIP_CONFLICT");
      }
    }
    await runtime.claim(plan, mode === "apply" ? "applying" : mode === "undo" ? "undoing" : "reconciling", mode === "apply" ? ["ready"] : mode === "undo" ? ["applied"] : ["ready", "applying", "undoing", "reconciling", "recovery_needed"]);
    let attemptedId: string | undefined;
    try {
      for (const { row, value } of mode === "apply" ? rows : [...rows].reverse()) {
        if (mode === "apply") {
          await runtime.journal(plan, row, value, "create_directory_intent");
          attemptedId = row.id;
          let created;
          try { const io = await runtime.io(value.deviceId); created = value.policy === "ftp_checked" ? await io.checked!.createDirectory(value.path, value.receipt!) : await io.createDirectoryNoReplace!(value.path); }
          catch (failure) {
            const identity = (failure as { createdIdentity?: string }).createdIdentity;
            if (identity) { value.createdIdentity = identity; await runtime.journal(plan, row, value, "directory_created_needs_flush"); }
            throw failure;
          }
          if ((value.policy !== "ftp_checked" && !created.identity) || created.type !== "directory") return error("Created directory identity is unavailable", "OWNERSHIP_CONFLICT");
          value.createdIdentity = created.identity; value.createdUniqueId = created.uniqueId;
          if (value.policy === "ftp_checked") { value.createdAck = true; value.removedAck = false; }
          await runtime.journal(plan, row, value, "directory_created");
        } else {
          await runtime.journal(plan, row, value, "remove_empty_directory_intent");
          if (await runtime.exists(value.deviceId, value.path)) await runtime.remove(value);
          else if (value.policy === "ftp_checked") await (await runtime.io(value.deviceId)).checked!.acknowledgeDirectory(value.parent);
          else await (await runtime.io(value.deviceId)).flushDirectory(value.parent);
          if (value.policy === "ftp_checked") value.removedAck = true;
          await runtime.journal(plan, row, value, "directory_removed");
        }
      }
      const status = mode === "apply" ? "applied" : mode === "undo" || !!plan.appliedAt ? "undone" : "ready";
      await runtime.assert(states);
      const currentDirectories = new Map<string, FileEntryStat>();
      if (status === "applied") for (const { value } of rows) {
        const info = await (await runtime.io(value.deviceId)).lstat(value.path);
        if (!await runtime.owned(value, info)) return error("Created directory identity changed before completion", "OWNERSHIP_CONFLICT");
        currentDirectories.set(value.path, info);
      }
      await runtime.db.$transaction(async (tx) => {
        await assertDeviceJobsOwned(runtime.jobs, tx);
        const owned = await tx.filePlan.updateMany({ where: { id, owner: runtime.owner }, data: { status, owner: null, error: null, revision: { increment: 1 }, ...(status === "applied" ? { appliedAt: new Date() } : {}) } });
        if (owned.count !== 1) return error("Directory journal owner was lost before completion", "OWNER_LOST");
        for (const { row, value } of rows) {
          if (status === "applied") {
            const info = currentDirectories.get(value.path)!;
            const generation = states.find((state) => state.id === value.deviceId)!.generation;
            const data = { scanRoot: value.scanRoot, platformAlias: "", relativePath: path.posix.relative(value.scanRoot, value.path), source: "rom", kind: "directory", size: BigInt(0), modifiedAt: info.modifiedAt, generation, seenAt: new Date() };
            await tx.deviceFile.upsert({ where: { deviceId_path: { deviceId: value.deviceId, path: value.path } }, create: { deviceId: value.deviceId, path: value.path, ...data }, update: data });
          } else await tx.deviceFile.deleteMany({ where: { deviceId: value.deviceId, path: value.path, kind: "directory" } });
          await tx.filePlanOperation.update({ where: { id: row.id }, data: { phase: status === "ready" ? "planned" : status === "applied" ? "complete" : "restored", specification: JSON.stringify(value) } });
        }
      });
      return directoryPlanView(await load(id, db));
    } catch (failure) {
      let compensated = false;
      if (mode === "apply") try {
        const durable = await load(id, db);
        await runtime.compensate(plan, durable.operations.map((row) => ({ row, value: spec(row) })), failure, attemptedId); compensated = true;
      } catch { /* Recovery retains all entries whose safe ownership/emptiness is not provable. */ }
      if (!compensated) await runtime.recovery(plan, failure);
      if (failure instanceof FilePlanError) throw failure; throw new FilePlanError(503, "DIRECTORY_IO_FAILED", "Directory I/O or journal storage failed; recover the saved plan", id);
    }
  });
}
