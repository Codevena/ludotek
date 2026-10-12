import path from "node:path";
import { prisma } from "@/lib/prisma";
import { assertDeviceJobsOwned } from "@/lib/device-jobs";
import { DeviceProfileError, getDeviceProfile, profileFingerprint, validDeviceNumber } from "@/lib/device-profiles";
import { acquireSaveContext, backupSaveInContext, readSaveInventory, validSaveVersionId, type DeviceSavesOptions, type SaveFile } from "@/lib/device-saves";
import { chooseSyncAction, readProfileFingerprint, type SyncBaseline, type SyncDirection, type SyncFingerprint, type SyncResolution } from "@/lib/device-profile-sync";
import { applyFilePlan, createSaveRestorePlan, getFilePlan } from "@/lib/file-plans";

interface SaveSyncInput { masterDeviceId: number; deviceId: number; direction: SyncDirection; resolutions?: Record<string, SyncResolution>; afterKey?: string }
interface SaveSyncRow { fileKey: string; masterPath: string; devicePath: string; master: SyncFingerprint | null; device: SyncFingerprint | null; action: string; reason: string }
interface SaveSyncCheck { fileKey: string; masterPath: string; devicePath: string; before: { master: SyncFingerprint | null; device: SyncFingerprint | null }; expected: SyncBaseline }
interface Summary { version: 1; rows: SaveSyncRow[]; checks: SaveSyncCheck[]; masterProfile: string; deviceProfile: string; total: number; nextKey: string | null; afterKey: string; progress: number }
export interface SaveSyncView { id: string; masterDeviceId: number; deviceId: number; direction: string; status: string; plans: string[]; conflicts: { fileKey: string; reason: string }[]; summary: Summary; createdAt: string }
const same = (left: SyncFingerprint | null, right: SyncFingerprint | null) => Boolean(left && right && left.sha256 === right.sha256 && left.size === right.size);
function parse(input: unknown): SaveSyncInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new DeviceProfileError("Ungültiger Save-Sync-Auftrag.");
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => !["masterDeviceId", "deviceId", "direction", "resolutions", "afterKey"].includes(key)) || !validDeviceNumber(value.masterDeviceId) || !validDeviceNumber(value.deviceId) || value.masterDeviceId === value.deviceId || !["push", "pull", "two-way"].includes(String(value.direction))) throw new DeviceProfileError("Zwei verschiedene Save-Geräte und eine gültige Richtung auswählen.");
  if (value.afterKey !== undefined && (typeof value.afterKey !== "string" || value.afterKey.length > 8192 || /[\x00-\x1f\x7f]/.test(value.afterKey))) throw new DeviceProfileError("Ungültige Save-Dateiseite.");
  if (value.resolutions !== undefined && (!value.resolutions || typeof value.resolutions !== "object" || Array.isArray(value.resolutions) || Object.keys(value.resolutions).length > 20 || Object.entries(value.resolutions).some(([key, resolution]) => key.length > 8192 || !["master", "device", "skip"].includes(String(resolution))))) throw new DeviceProfileError("Ungültige Save-Konfliktauflösung.");
  return value as unknown as SaveSyncInput;
}
function view(stored: { id: string; masterDeviceId: number; deviceId: number; direction: string; status: string; plans: string; conflicts: string; summary: string; createdAt: Date }): SaveSyncView {
  const summary = JSON.parse(stored.summary) as Summary;
  if (summary.version !== 1 || !Array.isArray(summary.rows) || summary.rows.length > 20 || !Array.isArray(summary.checks) || summary.checks.length > 20) throw new DeviceProfileError("Gespeicherter Save-Sync-Plan ist ungültig.", 503);
  return { ...stored, plans: JSON.parse(stored.plans), conflicts: JSON.parse(stored.conflicts), summary, createdAt: stored.createdAt.toISOString() };
}
export async function getSaveSyncPlan(id: string, options: DeviceSavesOptions = {}): Promise<SaveSyncView> {
  if (!validSaveVersionId(id)) throw new DeviceProfileError("Ungültige Save-Sync-Plan-ID.");
  const stored = await (options.db ?? prisma).saveSyncPlan.findUnique({ where: { id } });
  if (!stored) throw new DeviceProfileError("Save-Sync-Plan nicht gefunden.", 404);
  return view(stored);
}
export async function createSaveSyncPlan(input: unknown, request: Request, options: DeviceSavesOptions = {}): Promise<SaveSyncView> {
  const value = parse(input); const ids = [value.masterDeviceId, value.deviceId];
  const context = await acquireSaveContext(ids, request, options); const db = context.db;
  try {
    const profiles = await Promise.all(ids.map((id) => getDeviceProfile(id, { db })));
    const inventories = await Promise.all(ids.map((id) => readSaveInventory(context, id)));
    if (inventories.some((inventory) => !inventory.complete)) throw new DeviceProfileError("Save-Sync verlangt zwei vollständige sichere Save-Inventare.", 422);
    const maps = inventories.map((inventory) => {
      const map = new Map<string, SaveFile[]>();
      for (const file of inventory.files) map.set(file.fileKey, [...map.get(file.fileKey) ?? [], file]);
      return map;
    });
    const keys = [...new Set([...maps[0].keys(), ...maps[1].keys()])].sort(); const page = keys.filter((key) => key > (value.afterKey ?? "")).slice(0, 20);
    if (Object.keys(value.resolutions ?? {}).some((key) => !page.includes(key))) throw new DeviceProfileError("Save-Konflikte gehören nicht zur ausgewählten Dateiseite.");
    const baselines = await db.saveSyncBaseline.findMany({ where: { masterDeviceId: ids[0], deviceId: ids[1], fileKey: { in: page } } });
    const rows: SaveSyncRow[] = []; const checks: SaveSyncCheck[] = [];
    const copies: { source: number; target: number; filePath: string; targetPath: string; fileKey: string; expected: SyncFingerprint }[] = [];
    const targetPath = (index: number, file: SaveFile) => {
      const separator = file.fileKey.indexOf("|"); const platform = file.fileKey.slice(0, separator); const relative = file.fileKey.slice(separator + 1);
      const roots = profiles[index].profile.saveRoots.filter((root) => (root.platform ?? "*") === platform);
      if (roots.length !== 1) throw new DeviceProfileError("Save-Plattformwurzeln auf beiden Geräten eindeutig gleich zuordnen.", 422);
      return path.posix.join(roots[0].path, relative);
    };
    for (const key of page) {
      const pair = maps.map((map) => map.get(key) ?? []);
      if (pair.some((files) => files.length > 1)) { rows.push({ fileKey: key, masterPath: pair[0].map((file) => file.path).join("\n"), devicePath: pair[1].map((file) => file.path).join("\n"), master: null, device: null, action: "conflict", reason: "Mehrere Save-Pfade besitzen denselben relativen Schlüssel; Wurzeln eindeutig konfigurieren." }); continue; }
      const masterPath = pair[0][0]?.path ?? targetPath(0, pair[1][0]); const devicePath = pair[1][0]?.path ?? targetPath(1, pair[0][0]);
      const master = pair[0][0] ? await readProfileFingerprint(await context.io(ids[0]), masterPath, context.jobs) : null;
      const device = pair[1][0] ? await readProfileFingerprint(await context.io(ids[1]), devicePath, context.jobs) : null;
      const baseline = baselines.find((baseline) => baseline.fileKey === key && baseline.masterPath === masterPath && baseline.devicePath === devicePath);
      const decision = chooseSyncAction(master, device, baseline ? JSON.parse(baseline.fingerprint) as SyncBaseline : null, value.direction, value.resolutions?.[key]);
      rows.push({ fileKey: key, masterPath, devicePath, master, device, ...decision });
      if (decision.action === "equal" && master && device) {
        if (!same(master, device)) throw new DeviceProfileError("Die Save-Baseline beweist keine gleichen Originalbytes.", 409);
        checks.push({ fileKey: key, masterPath, devicePath, before: { master, device }, expected: { master, device } });
      }
      if (decision.action === "copy-master" || decision.action === "copy-device") {
        const source = decision.action === "copy-master" ? 0 : 1;
        copies.push({ source: ids[source], target: ids[1 - source], filePath: source === 0 ? masterPath : devicePath, targetPath: source === 0 ? devicePath : masterPath, fileKey: key, expected: (source === 0 ? master : device)! });
        checks.push({ fileKey: key, masterPath, devicePath, before: { master, device }, expected: { master: (source === 0 ? master : device)!, device: (source === 0 ? master : device)! } });
      }
    }
    const conflicts = rows.filter((row) => row.action === "conflict").map((row) => ({ fileKey: row.fileKey, reason: row.reason }));
    const plans: string[] = [];
    if (!conflicts.length) {
      const versions: { copy: typeof copies[number]; versionId: string; backupId?: string }[] = [];
      // Every existing target is verified and durably versioned before any
      // child journal can later authorize its replacement.
      for (const copy of copies) {
        const source = await backupSaveInContext(context, copy.source, copy.filePath);
        if (!same({ sha256: source.sha256, size: source.size }, copy.expected)) throw new DeviceProfileError("Ein Save wurde während der Vorschau verändert.", 409);
        const existing = rows.find((row) => row.fileKey === copy.fileKey)!;
        const old = copy.target === ids[0] ? existing.master : existing.device;
        const backup = old ? await backupSaveInContext(context, copy.target, copy.targetPath) : null;
        if (backup && !same({ sha256: backup.sha256, size: backup.size }, old)) throw new DeviceProfileError("Ein Ziel-Save wurde während seiner Sicherung verändert.", 409);
        versions.push({ copy, versionId: source.id, backupId: backup?.id });
      }
      for (const { copy, versionId, backupId } of versions) {
        const plan = await (options.createRestore ?? createSaveRestorePlan)({ versionId, targetDeviceId: copy.target, targetPath: copy.targetPath }, request, { ...options, heldJobs: { deviceIds: ids, jobs: context.jobs }, targetBackupVersionId: backupId });
        plans.push(plan.id);
      }
    }
    const summary: Summary = { version: 1, rows, checks, masterProfile: profileFingerprint(profiles[0].profile), deviceProfile: profileFingerprint(profiles[1].profile), total: keys.length,
      afterKey: value.afterKey ?? "", nextKey: page.length && keys.some((key) => key > page[page.length - 1]) ? page[page.length - 1] : null, progress: 0 };
    return view(await db.$transaction(async (tx) => {
      await assertDeviceJobsOwned(context.jobs, tx); context.jobs.signal.throwIfAborted();
      return tx.saveSyncPlan.create({ data: { masterDeviceId: ids[0], deviceId: ids[1], direction: value.direction, status: conflicts.length ? "conflict" : "ready", plans: JSON.stringify(plans), conflicts: JSON.stringify(conflicts), summary: JSON.stringify(summary) } });
    }));
  } finally { await context.close(); }
}

export async function applySaveSyncPlan(id: string, request: Request, options: DeviceSavesOptions = {}): Promise<SaveSyncView> {
  const initial = await getSaveSyncPlan(id, options); const ids = [initial.masterDeviceId, initial.deviceId]; const context = await acquireSaveContext(ids, request, options); const db = context.db;
  try {
    const current = await getSaveSyncPlan(id, options);
    if (current.status === "applied") return current;
    if (!["ready", "applying", "recovery"].includes(current.status) || current.conflicts.some((conflict) => conflict.fileKey)) throw new DeviceProfileError("Save-Konflikte zuerst durch eine neue ausdrückliche Vorschau auflösen.", 409);
    const profiles = await Promise.all(ids.map((deviceId) => getDeviceProfile(deviceId, { db })));
    if (profileFingerprint(profiles[0].profile) !== current.summary.masterProfile || profileFingerprint(profiles[1].profile) !== current.summary.deviceProfile) throw new DeviceProfileError("Save-Wurzeln oder Geräteprofile haben sich seit der Vorschau geändert.", 409);
    const journalOptions = { ...options, heldJobs: { deviceIds: ids, jobs: context.jobs } };
    const children = await Promise.all(current.plans.map((childId) => getFilePlan(childId, journalOptions)));
    if (children.some((child) => !["ready", "applied"].includes(child.status))) throw new DeviceProfileError("Gemeinsamen Save-Dateiplan zuerst ausdrücklich wiederherstellen oder abgleichen.", 409);
    // Original device sources remain authoritative until their immutable
    // snapshot is applied. A game saving after preview blocks new writes.
    for (const check of current.summary.checks) for (const index of [0, 1]) {
      const expected = index === 0 ? check.before.master : check.before.device;
      if (!expected) continue;
      const filename = index === 0 ? check.masterPath : check.devicePath;
      await context.safePath(ids[index], filename);
      const actual = await readProfileFingerprint(await context.io(ids[index]), filename, context.jobs);
      const alreadyPublished = children.some((child) => child.status === "applied" && child.operations.some((operation) => operation.targetDeviceId === ids[index] && operation.targetPath === filename));
      if (!same(actual, alreadyPublished ? index === 0 ? check.expected.master : check.expected.device : expected)) throw new DeviceProfileError("Ein Save wurde nach der Vorschau geändert; keine neue Überschreibung wurde gestartet.", 409);
    }
    await db.$transaction(async (tx) => { await assertDeviceJobsOwned(context.jobs, tx); context.jobs.signal.throwIfAborted(); const claimed = await tx.saveSyncPlan.updateMany({ where: { id, status: current.status }, data: { status: "applying" } }); if (claimed.count !== 1) throw new DeviceProfileError("Der Save-Sync-Plan wird bereits ausgeführt.", 409); });
    try {
      let progress = 0;
      for (const child of children) {
        const applied = await applyFilePlan(child.id, request, journalOptions);
        if (applied.status !== "applied") throw new DeviceProfileError("Save-Dateiplan benötigt Recovery; Baseline bleibt unverändert.", 409);
        progress++;
        await db.$transaction(async (tx) => { await assertDeviceJobsOwned(context.jobs, tx); await tx.saveSyncPlan.update({ where: { id }, data: { summary: JSON.stringify({ ...current.summary, progress }) } }); });
      }
      for (const check of current.summary.checks) {
        const master = await readProfileFingerprint(await context.io(ids[0]), check.masterPath, context.jobs); const device = await readProfileFingerprint(await context.io(ids[1]), check.devicePath, context.jobs);
        if (!same(master, check.expected.master) || !same(device, check.expected.device) || !same(master, device)) throw new DeviceProfileError("Ein Save wurde während oder nach dem Sync geändert. Baseline bleibt unverändert.", 409);
      }
      await context.jobs.assertActive();
      await db.$transaction(async (tx) => {
        await assertDeviceJobsOwned(context.jobs, tx); context.jobs.signal.throwIfAborted();
        for (const check of current.summary.checks) await tx.saveSyncBaseline.upsert({ where: { masterDeviceId_deviceId_fileKey: { masterDeviceId: ids[0], deviceId: ids[1], fileKey: check.fileKey } },
          create: { masterDeviceId: ids[0], deviceId: ids[1], fileKey: check.fileKey, masterPath: check.masterPath, devicePath: check.devicePath, fingerprint: JSON.stringify(check.expected) }, update: { masterPath: check.masterPath, devicePath: check.devicePath, fingerprint: JSON.stringify(check.expected) } });
        const completed = await tx.saveSyncPlan.updateMany({ where: { id, status: "applying" }, data: { status: "applied", conflicts: "[]", summary: JSON.stringify({ ...current.summary, progress: children.length }) } }); if (completed.count !== 1) throw new DeviceProfileError("Save-Sync-Status ging vor Abschluss verloren.", 409);
      });
      return await getSaveSyncPlan(id, options);
    } catch (error) {
      await db.$transaction(async (tx) => { await assertDeviceJobsOwned(context.jobs, tx); await tx.saveSyncPlan.updateMany({ where: { id, status: "applying" }, data: { status: "recovery", conflicts: JSON.stringify([{ fileKey: "", reason: "Gespeicherte Save-Dateipläne und aktuelle Inhalte prüfen; Baseline bleibt unverändert." }]) } }); });
      throw error;
    }
  } finally { await context.close(); }
}
