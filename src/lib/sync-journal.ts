import { randomUUID } from "node:crypto";
import type { PrismaClient, SyncQueue } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AdmissionStore, EnrichmentJob } from "@/lib/job-admission";
import { acquireDeviceFiles, assertDeviceJobsOwned, type DeviceJobs } from "@/lib/device-jobs";
import { applyFilePlan, createFilePlan, getFilePlan, FilePlanError, type FilePlanOptions, type FilePlanView } from "@/lib/file-plans";

const PAGE_SIZE = 100;
const ACTIVE = ["pending", "failed", "in_progress", "review_required", "metadata_failed"];
const MUTABLE = ["pending", "failed", "review_required", "metadata_failed"];
const id = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0 && (value as number) <= 2147483647;
const fail = (message: string, status: FilePlanError["status"] = 409): never => { throw new FilePlanError(status, "SYNC_REVIEW", message); };
export function parseSyncIds(body: unknown): number[] {
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => key !== "ids")) return fail("Explicit queue IDs are required", 400);
  const ids = (body as { ids?: unknown }).ids;
  if (!Array.isArray(ids) || !ids.length || ids.length > PAGE_SIZE || !ids.every(id) || new Set(ids).size !== ids.length) return fail("Select 1–100 unique queue IDs", 400);
  return ids;
}
interface StageInput { type: "rename" | "delete"; deviceId: number; gameId: number; filePath: string; newPath?: string }
function parseStage(body: unknown): StageInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail("Invalid queue request", 400);
  const input = body as StageInput;
  if (Object.keys(input).some((key) => !["type", "deviceId", "gameId", "filePath", "newPath"].includes(key)) ||
      !["rename", "delete"].includes(input.type) || !id(input.deviceId) || !id(input.gameId) || typeof input.filePath !== "string" ||
      (input.type === "rename" && typeof input.newPath !== "string")) return fail("Valid type, game/device IDs and physical paths are required", 400);
  return input;
}
function safeItem(row: SyncQueue) {
  return { id: row.id, type: row.type, deviceId: row.deviceId, gameId: row.gameId, filePath: row.filePath, newPath: row.newPath,
    status: row.status, error: row.error, planId: row.planId, createdAt: row.createdAt };
}
export interface SyncApplyResult {
  applied: number; failed: number; ignored: number; orphansRemoved: number;
  results: { id: number; status: string; error?: string; planId?: string; plan?: FilePlanView }[];
}
export type SyncJournalOptions = FilePlanOptions & { beforeQueueCommit?: () => Promise<void> };

/** Queue rows are UI references to immutable plans, never filesystem instructions. */
export class SyncJournalService {
  private readonly store: AdmissionStore;
  private readonly options: FilePlanOptions;
  private readonly beforeQueueCommit?: () => Promise<void>;
  constructor(private readonly db: PrismaClient, options: SyncJournalOptions = {}) { this.store = new AdmissionStore(db); this.options = { ...options, db }; this.beforeQueueCommit = options.beforeQueueCommit; }
  private async withJobs<T>(deviceIds: number[], request: Request, work: (jobs: DeviceJobs) => Promise<T>) {
    const jobs = await acquireDeviceFiles(deviceIds, request, this.options.acquire ?? (async (resource, req) => new EnrichmentJob(await this.store.acquire(resource), req.signal)));
    try { await jobs.assertActive(); return await work(jobs); }
    finally { await jobs.close(); }
  }
  private async binding(gameId: number, deviceId: number, filePath: string) {
    const [physical, link] = await Promise.all([
      this.db.deviceFile.findUnique({ where: { deviceId_path: { deviceId, path: filePath } } }),
      this.db.gameDevice.findUnique({ where: { gameId_deviceId: { gameId, deviceId } } }),
    ]);
    if (!link || !physical || physical.gameId !== gameId || physical.kind !== "file") return fail("File association is unconfirmed or belongs to another game; rescan the device");
    return physical;
  }
  async stage(body: unknown, request: Request) {
    const input = parseStage(body);
    await this.binding(input.gameId, input.deviceId, input.filePath);
    return this.withJobs([input.deviceId], request, async (jobs) => {
      await this.binding(input.gameId, input.deviceId, input.filePath);
      const existing = await this.db.syncQueue.findFirst({ where: { deviceId: input.deviceId, filePath: input.filePath, status: { in: ACTIVE } } });
      if (existing) return fail("This file already has a queued plan; inspect or remove that preview first");
      const plan = await createFilePlan({ kind: input.type, operations: [{ deviceId: input.deviceId, gameId: input.gameId, filePath: input.filePath, newPath: input.newPath }] }, request,
        { ...this.options, heldJobs: { deviceIds: [input.deviceId], jobs } });
      const primary = plan.operations.find((operation) => !operation.generated && operation.kind === (input.type === "rename" ? "move" : "delete"));
      if (!primary) return fail("Saved plan has no matching operation");
      await jobs.assertActive();
      const item = await this.db.$transaction(async (tx) => {
        await assertDeviceJobsOwned(jobs, tx);
        const physical = await tx.deviceFile.findUnique({ where: { deviceId_path: { deviceId: input.deviceId, path: input.filePath } } });
        const link = await tx.gameDevice.findUnique({ where: { gameId_deviceId: { gameId: input.gameId, deviceId: input.deviceId } } });
        if (!physical || physical.gameId !== input.gameId || physical.kind !== "file" || !link) return fail("File association changed before queue commit");
        return tx.syncQueue.create({ data: { type: input.type, deviceId: input.deviceId, gameId: input.gameId, filePath: input.filePath,
          newPath: input.type === "rename" ? primary.targetPath : null, planId: plan.id, status: "pending" } });
      });
      return { item: safeItem(item), plan };
    });
  }
  private async planFor(row: SyncQueue): Promise<FilePlanView> {
    if (!row.planId) return fail("Legacy queue entry has no verified plan; rescan and stage a new preview");
    const record = await this.db.filePlan.findUnique({ where: { id: row.planId }, include: { operations: true } });
    if (!record || record.kind !== row.type) return fail("Queue entry does not belong to its saved plan");
    let primary: { generated?: boolean; action?: string; source?: { deviceId?: number; manifestPath?: string; record?: { gameId?: number } }; target?: { deviceId?: number; path?: string } } | undefined;
    try { primary = record.operations.map((operation) => JSON.parse(operation.specification)).find((spec) => !spec.generated && spec.action === (row.type === "rename" ? "move" : "delete")); }
    catch { return fail("Saved plan is unreadable; inspect recovery history"); }
    if (!primary || primary.source?.deviceId !== row.deviceId || primary.source.manifestPath !== row.filePath || primary.source.record?.gameId !== row.gameId ||
        (row.type === "rename" && (primary.target?.deviceId !== row.deviceId || primary.target.path !== row.newPath))) return fail("Queue game/device/file identity does not match the immutable plan");
    if (record.status !== "applied") await this.binding(row.gameId, row.deviceId, row.filePath);
    return getFilePlan(record.id, this.options);
  }
  async list(afterId = 0) {
    if (!Number.isInteger(afterId) || afterId < 0 || afterId > 2147483647) return fail("Invalid queue cursor", 400);
    const [rows, count] = await Promise.all([
      this.db.syncQueue.findMany({ where: { status: { in: ACTIVE }, id: { gt: afterId } }, include: { device: { select: { id: true, name: true } }, game: { select: { id: true, title: true, platform: true } } }, orderBy: { id: "asc" }, take: PAGE_SIZE + 1 }),
      this.db.syncQueue.count({ where: { status: { in: ACTIVE } } }),
    ]);
    const items = await Promise.all(rows.slice(0, PAGE_SIZE).map(async (row) => {
      let plan: FilePlanView | null = null;
      let status = row.status;
      let error = row.error;
      try {
        plan = await this.planFor(row);
        if (plan.status === "applied") status = "metadata_pending";
      } catch (failure) { status = "review_required"; error = failure instanceof FilePlanError ? failure.message : "Stored plan unavailable; review history before restaging"; }
      return { ...safeItem(row), status, storedStatus: row.status, error, device: row.device, game: row.game, plan,
        canApply: row.status !== "in_progress" && !!plan && ["ready", "applied"].includes(plan.status), canRemove: row.status !== "in_progress" || !!plan && ["applied", "undone", "compensated"].includes(plan.status) };
    }));
    return { items, count, nextCursor: rows.length > PAGE_SIZE ? items.at(-1)!.id : null };
  }
  async apply(ids: number[], request: Request): Promise<SyncApplyResult> {
    parseSyncIds({ ids });
    const rows = await this.db.syncQueue.findMany({ where: { id: { in: ids } }, orderBy: { id: "asc" } });
    const result: SyncApplyResult = { applied: 0, failed: 0, ignored: 0, orphansRemoved: 0, results: [] };
    const selected = rows.filter((row) => MUTABLE.includes(row.status));
    for (const rowId of ids) {
      const row = rows.find((value) => value.id === rowId);
      if (!row || !MUTABLE.includes(row.status)) { result.ignored++; result.results.push({ id: rowId, status: "ignored", error: row ? "This queue entry is claimed or already finished" : "Queue entry no longer exists" }); }
    }
    if (!selected.length) return result;
    const deviceIds = [...new Set(selected.map((row) => row.deviceId))];
    return this.withJobs(deviceIds, request, async (jobs) => {
      const owner = randomUUID();
      for (const original of selected) {
        let plan: FilePlanView | undefined;
        let claimed = false;
        try {
          await jobs.assertActive();
          const row = await this.db.syncQueue.findUnique({ where: { id: original.id } });
          if (!row || !MUTABLE.includes(row.status)) { result.ignored++; result.results.push({ id: original.id, status: "ignored" }); continue; }
          plan = await this.planFor(row);
          if (!["ready", "applied"].includes(plan.status)) return fail("Saved plan needs explicit recovery before applying this queue entry");
          await this.db.$transaction(async (tx) => {
            await assertDeviceJobsOwned(jobs, tx);
            const claim = await tx.syncQueue.updateMany({ where: { id: row.id, planId: row.planId, gameId: row.gameId, deviceId: row.deviceId, filePath: row.filePath, status: { in: MUTABLE } }, data: { status: "in_progress", claimOwner: owner, error: null } });
            if (claim.count !== 1) return fail("Queue claim changed before application");
          });
          claimed = true;
          plan = await applyFilePlan(plan.id, request, { ...this.options, heldJobs: { deviceIds, jobs } });
          if (plan.status !== "applied") return fail("Journal has not confirmed all filesystem and manifest steps");
          await this.beforeQueueCommit?.();
          await this.db.$transaction(async (tx) => {
            await assertDeviceJobsOwned(jobs, tx);
            const completed = await tx.syncQueue.updateMany({ where: { id: row.id, status: "in_progress", claimOwner: owner, planId: plan!.id }, data: { status: "applied", claimOwner: null, error: null } });
            if (completed.count !== 1) return fail("Queue metadata could not confirm the completed journal");
          });
          result.applied++; result.results.push({ id: row.id, status: "applied", planId: plan.id, plan });
        } catch (failure) {
          if (original.planId) { try { plan = await getFilePlan(original.planId, this.options); } catch { /* Keep a usable recovery link. */ } }
          const status = plan?.status === "applied" ? "metadata_failed" : claimed ? "failed" : "review_required";
          const error = failure instanceof FilePlanError ? failure.message : "Sync metadata or file operation failed; inspect the saved journal before retrying";
          try {
            await this.db.$transaction(async (tx) => {
              await assertDeviceJobsOwned(jobs, tx);
              await tx.syncQueue.updateMany({ where: { id: original.id, ...(claimed ? { status: "in_progress", claimOwner: owner } : { status: { in: MUTABLE } }) }, data: { status, error, claimOwner: null } });
            });
          } catch { /* Durable journal remains authoritative even if annotation storage fails. */ }
          result.failed++; result.results.push({ id: original.id, status, error, planId: original.planId ?? undefined, plan });
        }
      }
      return result;
    });
  }
  async clear(ids: number[] | undefined, request: Request) {
    if (ids) parseSyncIds({ ids });
    const rows = await this.db.syncQueue.findMany({ where: ids ? { id: { in: ids } } : { status: { in: MUTABLE } }, take: PAGE_SIZE + 1 });
    if (rows.length > PAGE_SIZE) return fail("Remove at most 100 displayed queue entries at a time", 413);
    if (!rows.length) return { cleared: 0 };
    const deviceIds = [...new Set(rows.map((row) => row.deviceId))];
    for (const row of rows) if (row.status === "in_progress") {
      const plan = await this.planFor(row);
      if (!["applied", "undone", "compensated"].includes(plan.status)) return fail("Claimed queue work cannot be removed; inspect its journal and wait for the running owner");
    }
    return this.withJobs(deviceIds, request, async (jobs) => this.db.$transaction(async (tx) => {
      await assertDeviceJobsOwned(jobs, tx);
      const current = await tx.syncQueue.findMany({ where: { id: { in: rows.map((row) => row.id) } } });
      for (const row of current) if (row.status === "in_progress") {
        const plan = row.planId ? await tx.filePlan.findUnique({ where: { id: row.planId }, select: { owner: true, status: true } }) : null;
        if (!plan || plan.owner || !["applied", "undone", "compensated"].includes(plan.status)) return fail("Claimed queue work cannot be removed");
      }
      const removed = await tx.syncQueue.deleteMany({ where: { id: { in: current.map((row) => row.id) } } });
      return { cleared: removed.count };
    }));
  }
}
export const syncJournal = new SyncJournalService(prisma);
