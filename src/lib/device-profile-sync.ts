import path from "node:path";
import { createHash } from "node:crypto";
import { Writable } from "node:stream";
import type { Device, DeviceFile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createConnection, requireFileIo, type DeviceConnection, type FileIo } from "@/lib/connection";
import { decrypt } from "@/lib/encryption";
import { acquireDeviceFiles, assertDeviceJobsOwned, type DeviceJobs } from "@/lib/device-jobs";
import { createFilePlan, applyFilePlan, getFilePlan, type FilePlanOptions } from "@/lib/file-plans";
import { DeviceProfileError, deviceProfileAcquire, getDeviceProfile, profileContains, profileFingerprint, validDeviceNumber, type DeviceProfileData } from "@/lib/device-profiles";

export interface SyncFingerprint { sha256: string; size: string }
export interface SyncBaseline { master: SyncFingerprint; device: SyncFingerprint }
export type SyncDirection = "push" | "pull" | "two-way";
export type SyncResolution = "master" | "device" | "skip";
export interface SyncDecision { action: "equal" | "copy-master" | "copy-device" | "conflict" | "skip"; reason: string }
const same = (left: SyncFingerprint | null, right: SyncFingerprint | null) => Boolean(left && right && left.sha256 === right.sha256 && left.size === right.size);
export function chooseSyncAction(master: SyncFingerprint | null, device: SyncFingerprint | null, baseline: SyncBaseline | null, direction: SyncDirection, resolution?: SyncResolution): SyncDecision {
  if (resolution === "skip") return { action: "skip", reason: "Ausdrücklich übersprungen." };
  if (resolution === "master") return master ? { action: direction === "pull" ? "skip" : "copy-master", reason: "Master ausdrücklich ausgewählt." } : { action: "conflict", reason: "Die ausgewählte Masterdatei fehlt." };
  if (resolution === "device") return device ? { action: direction === "push" ? "skip" : "copy-device", reason: "Gerät ausdrücklich ausgewählt." } : { action: "conflict", reason: "Die ausgewählte Gerätedatei fehlt." };
  if (!master && !device) return { action: "skip", reason: "Auf keiner Seite vorhanden; keine automatische Löschung." };
  if (baseline) {
    if (!master || !device) return { action: "conflict", reason: "Eine Seite fehlt seit der letzten Baseline; keine automatische Löschung oder Wiederherstellung." };
    const masterChanged = !same(master, baseline.master);
    const deviceChanged = !same(device, baseline.device);
    if (!masterChanged && !deviceChanged) return { action: "equal", reason: "Beide Seiten entsprechen ihrer letzten verifizierten Baseline." };
    if (masterChanged && deviceChanged) return { action: "conflict", reason: "Beide Seiten wurden seit der Baseline geändert." };
    if (masterChanged && direction !== "pull") return { action: "copy-master", reason: "Nur der Master wurde seit der Baseline geändert." };
    if (deviceChanged && direction !== "push") return { action: "copy-device", reason: "Nur das Gerät wurde seit der Baseline geändert." };
    return { action: "conflict", reason: "Die Gegenseite wurde geändert; die gewählte Richtung darf sie nicht still überschreiben." };
  }
  if (same(master, device)) return { action: "equal", reason: "Inhalte sind gleich." };
  if (master && !device && direction !== "pull") return { action: "copy-master", reason: "Neue Datei auf dem Master." };
  if (!master && device && direction !== "push") return { action: "copy-device", reason: "Neue Datei auf dem Gerät." };
  return { action: "conflict", reason: "Unterschiedliche Inhalte ohne gemeinsame Baseline; Seite ausdrücklich auswählen." };
}
export interface DeviceSyncInput { masterDeviceId: number; deviceId: number; direction: SyncDirection; resolutions?: Record<string, SyncResolution>; platform?: string; afterKey?: string }
interface SyncRow extends SyncDecision { fileKey: string; masterPath: string; devicePath: string; master: SyncFingerprint | null; device: SyncFingerprint | null }
interface SyncCheck { fileKey: string; masterPath: string; devicePath: string; expected: SyncBaseline; planId?: string }
interface SyncSummary {
  version: 1; masterProfile: string; deviceProfile: string; rows: SyncRow[]; checks: SyncCheck[];
  total: number; nextKey: string | null; afterKey: string; platform?: string; bytes: string;
}
export interface DeviceSyncView { id: string; masterDeviceId: number; deviceId: number; direction: string; status: string; plans: string[]; conflicts: { fileKey: string; reason: string }[]; summary: SyncSummary; createdAt: string }
export type DeviceSyncOptions = FilePlanOptions & { journal?: { create: typeof createFilePlan; apply: typeof applyFilePlan; get: typeof getFilePlan } };
const logicalKey = (file: Pick<DeviceFile, "platform" | "relativePath">) => `${file.platform}|${file.relativePath}`;
function parseInput(input: unknown): DeviceSyncInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new DeviceProfileError("Ungültiger Synchronisierungsauftrag.");
  const data = input as Record<string, unknown>;
  if (Object.keys(data).some((key) => !["masterDeviceId", "deviceId", "direction", "resolutions", "platform", "afterKey"].includes(key)) || !validDeviceNumber(data.masterDeviceId) || !validDeviceNumber(data.deviceId) || data.masterDeviceId === data.deviceId || !["push", "pull", "two-way"].includes(String(data.direction))) throw new DeviceProfileError("Zwei verschiedene Geräte und eine gültige Richtung auswählen.");
  if (data.platform !== undefined && (typeof data.platform !== "string" || !/^[a-z0-9-]{1,40}$/.test(data.platform))) throw new DeviceProfileError("Ungültige Plattformauswahl.");
  if (data.afterKey !== undefined && (typeof data.afterKey !== "string" || data.afterKey.length > 8192 || /[\x00-\x1f\x7f]/.test(data.afterKey))) throw new DeviceProfileError("Ungültige Dateifortsetzung.");
  if (data.resolutions !== undefined && (!data.resolutions || typeof data.resolutions !== "object" || Array.isArray(data.resolutions) || Object.keys(data.resolutions).length > 100 || Object.entries(data.resolutions).some(([key, value]) => key.length > 8192 || !["master", "device", "skip"].includes(String(value))))) throw new DeviceProfileError("Ungültige Konfliktauflösung.");
  return data as unknown as DeviceSyncInput;
}
function profileFile(profile: DeviceProfileData, file: DeviceFile): boolean {
  return file.kind === "file" && file.source === "rom" && file.platform !== null && profile.romRoots.some((root) => (!root.platform || root.platform === file.platform) && profileContains(root.path, file.path));
}
function destination(profile: DeviceProfileData, file: DeviceFile): string {
  if (!file.platform || !file.relativePath || file.relativePath.startsWith("/") || path.posix.normalize(file.relativePath) !== file.relativePath || file.relativePath.split("/").includes("..")) throw new DeviceProfileError("Die Manifestdatei besitzt keinen sicheren Plattformpfad.", 422);
  const specific = profile.romRoots.filter((root) => root.platform === file.platform);
  const roots = specific.length ? specific : profile.romRoots.filter((root) => !root.platform);
  if (roots.length !== 1) throw new DeviceProfileError("Für jede synchronisierte Plattform genau eine Zielwurzel konfigurieren.", 422);
  return path.posix.join(roots[0].path, ...(roots[0].platform ? [] : [file.platform]), file.relativePath);
}
async function connection(device: Device): Promise<DeviceConnection> { return createConnection({ ...device, password: decrypt(device.password), protocol: device.protocol as "ssh" | "ftp" | "local" }); }
export async function readProfileFingerprint(io: FileIo, filename: string, jobs: DeviceJobs, expected?: DeviceFile): Promise<SyncFingerprint> {
  await jobs.assertActive();
  const before = await io.lstat(filename);
  if (before.type !== "file" || !Number.isSafeInteger(before.size) || before.size < 0 || before.size > 16 * 1024 ** 3 || (expected && (BigInt(before.size) !== expected.size || (before.modifiedAt ?? null) !== expected.modifiedAt))) throw new DeviceProfileError("Eine Datei ist nicht mehr durch das aktuelle Manifest bestätigt. Bitte zuerst neu scannen.", 409);
  const hash = createHash("sha256");
  const sink = new Writable({ write(chunk, _encoding, callback) { hash.update(chunk); callback(); } });
  await io.readTo(filename, sink, { signal: jobs.signal, maxBytes: before.size, expectedBytes: before.size, timeoutMs: 120000 });
  const after = await io.lstat(filename);
  if (after.type !== "file" || after.size !== before.size || after.modifiedAt !== before.modifiedAt || (before.identity && after.identity !== before.identity)) throw new DeviceProfileError("Die Datei wurde während der Inhaltsprüfung geändert.", 409);
  await jobs.assertActive();
  return { sha256: hash.digest("hex"), size: String(before.size) };
}
function view(stored: { id: string; masterDeviceId: number; deviceId: number; direction: string; status: string; plans: string; conflicts: string; summary: string; createdAt: Date }): DeviceSyncView {
  const summary = JSON.parse(stored.summary) as SyncSummary;
  if (summary.version !== 1 || !Array.isArray(summary.rows) || !Array.isArray(summary.checks) || summary.rows.length > 100 || summary.checks.length > 100) throw new DeviceProfileError("Gespeicherter Synchronisierungsplan ist ungültig.", 503);
  return { ...stored, plans: JSON.parse(stored.plans), conflicts: JSON.parse(stored.conflicts), summary, createdAt: stored.createdAt.toISOString() };
}
export async function getDeviceSyncPlan(id: string, options: DeviceSyncOptions = {}): Promise<DeviceSyncView> {
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new DeviceProfileError("Ungültige Plan-ID.");
  const stored = await (options.db ?? prisma).deviceSyncPlan.findUnique({ where: { id } });
  if (!stored) throw new DeviceProfileError("Synchronisierungsplan nicht gefunden.", 404);
  return view(stored);
}

export async function createDeviceSyncPlan(input: unknown, request: Request, options: DeviceSyncOptions = {}): Promise<DeviceSyncView> {
  const data = parseInput(input);
  const db = options.db ?? prisma;
  const ids = [data.masterDeviceId, data.deviceId];
  const jobs = await acquireDeviceFiles(ids, request, deviceProfileAcquire(options));
  const connections = new Map<number, DeviceConnection>();
  const getIo = async (id: number) => {
    if (!connections.has(id)) {
      await jobs.assertActive();
      const device = await db.device.findUnique({ where: { id } });
      if (!device) throw new DeviceProfileError("Gerät nicht gefunden.", 404);
      connections.set(id, await (options.connect ?? connection)(device));
    }
    return requireFileIo(connections.get(id)!);
  };
  try {
    const [masterProfileData, deviceProfileData, inventories, files, baselines] = await Promise.all([
      getDeviceProfile(ids[0], { db }), getDeviceProfile(ids[1], { db }),
      db.deviceInventory.findMany({ where: { deviceId: { in: ids } } }),
      db.deviceFile.findMany({ where: { deviceId: { in: ids }, ...(data.platform ? { platform: data.platform } : {}) }, orderBy: [{ deviceId: "asc" }, { path: "asc" }], take: 100001 }),
      db.deviceSyncBaseline.findMany({ where: { masterDeviceId: ids[0], deviceId: ids[1] }, take: 100001 }),
    ]);
    if (inventories.length !== 2 || inventories.some((inventory) => !inventory.complete) || files.length > 100000 || baselines.length > 100000) throw new DeviceProfileError("Beide Geräte brauchen ein vollständiges, begrenztes Manifest. Bitte zuerst scannen.", 422);
    if (!masterProfileData.saved || !deviceProfileData.saved) throw new DeviceProfileError("Für beide Geräte zuerst ein Profil speichern.", 422);
    const profiles = [masterProfileData.profile, deviceProfileData.profile];
    const maps = ids.map((id, index) => {
      const map = new Map<string, DeviceFile[]>();
      for (const file of files.filter((file) => file.deviceId === id && profileFile(profiles[index], file))) {
        if (inventories.find((inventory) => inventory.deviceId === id)!.generation !== file.generation) throw new DeviceProfileError("Eine Manifestgeneration ist veraltet. Bitte zuerst neu scannen.", 422);
        const key = logicalKey(file); map.set(key, [...map.get(key) ?? [], file]);
      }
      return map;
    });
    const allKeys = [...new Set([...maps[0].keys(), ...maps[1].keys()])].sort();
    const pageKeys = allKeys.filter((key) => key > (data.afterKey ?? "")).slice(0, 100);
    if (Object.keys(data.resolutions ?? {}).some((key) => !pageKeys.includes(key))) throw new DeviceProfileError("Konfliktauflösungen müssen zur aktuellen Dateiseite gehören.");
    const rows: SyncRow[] = [];
    const checks: SyncCheck[] = [];
    const copies: { sourceId: number; targetId: number; source: DeviceFile; targetPath: string; replace: boolean; fileKey: string }[] = [];
    for (const key of pageKeys) {
      await jobs.assertActive();
      const pair = maps.map((map) => map.get(key) ?? []);
      if (pair.some((items) => items.length > 1)) {
        rows.push({ fileKey: key, masterPath: pair[0].map((file) => file.path).join("\n"), devicePath: pair[1].map((file) => file.path).join("\n"), master: null, device: null, action: "conflict", reason: "Mehrere physische Dateien besitzen denselben Plattform-/Relativpfad. Profilwurzeln eindeutig konfigurieren." });
        continue;
      }
      const master = pair[0][0]; const device = pair[1][0];
      const masterPath = master?.path ?? destination(profiles[0], device);
      const devicePath = device?.path ?? destination(profiles[1], master);
      const masterFingerprint = master ? await readProfileFingerprint(await getIo(ids[0]), masterPath, jobs, master) : null;
      const deviceFingerprint = device ? await readProfileFingerprint(await getIo(ids[1]), devicePath, jobs, device) : null;
      const baseline = baselines.find((baseline) => baseline.fileKey === key && baseline.masterPath === masterPath && baseline.devicePath === devicePath);
      const decision = chooseSyncAction(masterFingerprint, deviceFingerprint, baseline ? JSON.parse(baseline.fingerprint) as SyncBaseline : null, data.direction, data.resolutions?.[key]);
      const row = { fileKey: key, masterPath, devicePath, master: masterFingerprint, device: deviceFingerprint, ...decision };
      rows.push(row);
      if (decision.action === "equal" && masterFingerprint && deviceFingerprint) checks.push({ fileKey: key, masterPath, devicePath, expected: { master: masterFingerprint, device: deviceFingerprint } });
      if (decision.action === "copy-master" || decision.action === "copy-device") {
        const sourceIndex = decision.action === "copy-master" ? 0 : 1;
        const targetIndex = 1 - sourceIndex;
        const source = pair[sourceIndex][0];
        const targetPath = targetIndex === 0 ? masterPath : devicePath;
        if (profiles[targetIndex].formats.length && !profiles[targetIndex].formats.includes(path.posix.extname(targetPath).toLowerCase())) {
          row.action = "conflict"; row.reason = "Das Dateiformat ist im Zielprofil nicht freigegeben."; continue;
        }
        copies.push({ sourceId: ids[sourceIndex], targetId: ids[targetIndex], source, targetPath, replace: Boolean(pair[targetIndex][0]), fileKey: key });
      }
    }
    const plans: string[] = [];
    let bytes = BigInt(0);
    if (!rows.some((row) => row.action === "conflict")) {
      for (const targetId of ids) {
        const selected = copies.filter((copy) => copy.targetId === targetId);
        if (!selected.length) continue;
        const targetProfile = profiles[ids.indexOf(targetId)];
        const required = selected.reduce((total, copy) => total + copy.source.size, BigInt(0));
        for (const parent of new Set(selected.map((copy) => path.posix.dirname(copy.targetPath)))) {
          const free = await (await getIo(targetId)).freeBytes(parent);
          if (free.state !== "known" || free.bytes < required + BigInt(targetProfile.reserveBytes)) throw new DeviceProfileError("Zielplatz unbekannt oder zu klein einschließlich der Speicherreserve.", 422);
        }
        const journalOptions = { ...options, heldJobs: { deviceIds: ids, jobs }, replaceTargets: selected.filter((copy) => copy.replace).map((copy) => ({ deviceId: targetId, path: copy.targetPath })) };
        const plan = await (options.journal?.create ?? createFilePlan)({ kind: "copy", operations: selected.map((copy) => ({ deviceId: copy.sourceId, filePath: copy.source.path, ...(copy.source.gameId ? { gameId: copy.source.gameId } : {}), targetDeviceId: copy.targetId, newPath: copy.targetPath })) }, request, journalOptions);
        plans.push(plan.id); bytes += BigInt(plan.totalBytes);
        for (const operation of plan.operations) {
          if (operation.kind !== "copy" || !operation.outputFingerprint || !operation.targetPath || !operation.targetDeviceId) continue;
          const original = files.find((file) => file.deviceId === operation.sourceDeviceId && file.path === operation.sourcePath);
          if (!original || !profileFile(profiles[ids.indexOf(operation.sourceDeviceId)], original)) throw new DeviceProfileError("Eine Descriptorabhängigkeit ist nicht durch das Geräteprofil bestätigt.", 422);
          if (targetProfile.formats.length && !targetProfile.formats.includes(path.posix.extname(operation.targetPath).toLowerCase())) throw new DeviceProfileError("Eine Descriptorabhängigkeit hat ein nicht freigegebenes Zielformat.", 422);
          const source = { sha256: operation.sourceFingerprint.sha256, size: String(operation.sourceFingerprint.size) };
          const target = { sha256: operation.outputFingerprint.sha256, size: String(operation.outputFingerprint.size) };
          const sourceIsMaster = operation.sourceDeviceId === ids[0];
          const captured = rows.find((row) => row.fileKey === logicalKey(original));
          const capturedSource = captured && (sourceIsMaster ? captured.master : captured.device);
          if (capturedSource && !same(capturedSource, source)) throw new DeviceProfileError("Eine Quelldatei hat sich während der Vorschau geändert. Neue Vorschau erforderlich.", 409);
          const check = { fileKey: logicalKey(original), masterPath: sourceIsMaster ? operation.sourcePath : operation.targetPath, devicePath: sourceIsMaster ? operation.targetPath : operation.sourcePath, expected: sourceIsMaster ? { master: source, device: target } : { master: target, device: source }, planId: plan.id };
          const previous = checks.find((item) => item.fileKey === check.fileKey);
          if (previous && (previous.masterPath !== check.masterPath || previous.devicePath !== check.devicePath || !same(previous.expected.master, check.expected.master) || !same(previous.expected.device, check.expected.device))) throw new DeviceProfileError("Descriptorabhängigkeiten verlangen widersprüchliche Richtungen. Zusammenhängende Dateien gemeinsam auflösen.", 409);
          if (!previous) checks.push(check);
        }
        if (checks.length > 100) throw new DeviceProfileError("Descriptorabhängigkeiten überschreiten die 100-Dateien-Grenze. Kleinere Dateiseite wählen.", 422);
        for (const parent of new Set(plan.operations.flatMap((operation) => operation.targetPath ? [path.posix.dirname(operation.targetPath)] : []))) {
          const free = await (await getIo(targetId)).freeBytes(parent);
          if (free.state !== "known" || free.bytes < BigInt(plan.totalBytes) + BigInt(targetProfile.reserveBytes)) throw new DeviceProfileError("Der vollständige Descriptorplan überschreitet den Zielplatz einschließlich Reserve.", 422);
        }
      }
    }
    await jobs.assertActive();
    const summary: SyncSummary = { version: 1, masterProfile: profileFingerprint(profiles[0]), deviceProfile: profileFingerprint(profiles[1]), rows, checks,
      total: allKeys.length, nextKey: pageKeys.length && allKeys.some((key) => key > pageKeys[pageKeys.length - 1]) ? pageKeys[pageKeys.length - 1] : null,
      afterKey: data.afterKey ?? "", ...(data.platform ? { platform: data.platform } : {}), bytes: bytes.toString() };
    const conflicts = rows.filter((row) => row.action === "conflict").map((row) => ({ fileKey: row.fileKey, reason: row.reason }));
    return view(await db.$transaction(async (tx) => {
      await assertDeviceJobsOwned(jobs, tx); jobs.signal.throwIfAborted();
      return tx.deviceSyncPlan.create({ data: { masterDeviceId: ids[0], deviceId: ids[1], direction: data.direction, status: conflicts.length ? "conflict" : "ready", plans: JSON.stringify(plans), conflicts: JSON.stringify(conflicts), summary: JSON.stringify(summary) } });
    }));
  } finally { for (const connection of connections.values()) connection.disconnect(); await jobs.close(); }
}

export async function applyDeviceSyncPlan(id: string, request: Request, options: DeviceSyncOptions = {}): Promise<DeviceSyncView> {
  const db = options.db ?? prisma;
  const plan = await getDeviceSyncPlan(id, { db });
  const ids = [plan.masterDeviceId, plan.deviceId];
  const jobs = await acquireDeviceFiles(ids, request, deviceProfileAcquire(options));
  const connections = new Map<number, DeviceConnection>();
  try {
    const current = await getDeviceSyncPlan(id, { db });
    if (current.status === "applied") return current;
    if (!["ready", "applying", "recovery"].includes(current.status) || current.conflicts.some((conflict) => conflict.fileKey)) throw new DeviceProfileError("Dieser Plan ist nicht konfliktfrei anwendbar. Neue Vorschau erstellen.", 409);
    const profiles = await Promise.all(ids.map((deviceId) => getDeviceProfile(deviceId, { db })));
    if (profileFingerprint(profiles[0].profile) !== current.summary.masterProfile || profileFingerprint(profiles[1].profile) !== current.summary.deviceProfile) throw new DeviceProfileError("Ein Geräteprofil hat sich seit der Vorschau geändert.", 409);
    const claimed = await db.$transaction(async (tx) => {
      await assertDeviceJobsOwned(jobs, tx); jobs.signal.throwIfAborted();
      return tx.deviceSyncPlan.updateMany({ where: { id, status: current.status }, data: { status: "applying" } });
    });
    if (claimed.count !== 1) throw new DeviceProfileError("Der Synchronisierungsplan wird bereits ausgeführt.", 409);
    const getIo = async (deviceId: number) => {
      if (!connections.has(deviceId)) {
        const device = await db.device.findUnique({ where: { id: deviceId } });
        if (!device) throw new DeviceProfileError("Gerät nicht gefunden.", 404);
        connections.set(deviceId, await (options.connect ?? connection)(device));
      }
      return requireFileIo(connections.get(deviceId)!);
    };
    try {
      const journalOptions = { ...options, heldJobs: { deviceIds: ids, jobs } };
      // Check reserves again before starting any common journal mutation.
      for (const childId of current.plans) {
        const child = await (options.journal?.get ?? getFilePlan)(childId, journalOptions);
        if (!["ready", "applied"].includes(child.status)) throw new DeviceProfileError("Zuerst den gemeinsamen Dateiplan ausdrücklich abgleichen oder wiederherstellen.", 409);
        if (child.status === "applied") continue;
        for (const targetId of ids) {
          const operations = child.operations.filter((operation) => operation.targetDeviceId === targetId && operation.targetPath);
          if (!operations.length) continue;
          for (const parent of new Set(operations.map((operation) => path.posix.dirname(operation.targetPath!)))) {
            const free = await (await getIo(targetId)).freeBytes(parent);
            if (free.state !== "known" || free.bytes < BigInt(child.totalBytes) + BigInt(profiles[ids.indexOf(targetId)].profile.reserveBytes)) throw new DeviceProfileError("Zielplatz reicht vor Anwendung einschließlich Reserve nicht mehr aus.", 409);
          }
        }
      }
      for (const childId of current.plans) {
        await jobs.assertActive();
        const result = await (options.journal?.apply ?? applyFilePlan)(childId, request, journalOptions);
        if (result.status !== "applied") throw new DeviceProfileError("Ein Dateiplan benötigt Recovery; keine Baseline wurde fortgeschrieben.", 409);
      }
      for (const check of current.summary.checks) {
        const actualMaster = await readProfileFingerprint(await getIo(ids[0]), check.masterPath, jobs);
        const actualDevice = await readProfileFingerprint(await getIo(ids[1]), check.devicePath, jobs);
        if (!same(actualMaster, check.expected.master) || !same(actualDevice, check.expected.device)) throw new DeviceProfileError("Eine Datei wurde nach der verifizierten Anwendung geändert. Baseline bleibt unverändert.", 409);
      }
      await jobs.assertActive();
      await db.$transaction(async (tx) => {
        await assertDeviceJobsOwned(jobs, tx); jobs.signal.throwIfAborted();
        for (const check of current.summary.checks) await tx.deviceSyncBaseline.upsert({ where: { masterDeviceId_deviceId_fileKey: { masterDeviceId: ids[0], deviceId: ids[1], fileKey: check.fileKey } },
          create: { masterDeviceId: ids[0], deviceId: ids[1], fileKey: check.fileKey, masterPath: check.masterPath, devicePath: check.devicePath, fingerprint: JSON.stringify(check.expected) },
          update: { masterPath: check.masterPath, devicePath: check.devicePath, fingerprint: JSON.stringify(check.expected) } });
        const changed = await tx.deviceSyncPlan.updateMany({ where: { id, status: "applying" }, data: { status: "applied", conflicts: "[]" } });
        if (changed.count !== 1) throw new DeviceProfileError("Die Planverantwortung ging vor Abschluss verloren.", 409);
      });
      return await getDeviceSyncPlan(id, { db });
    } catch (error) {
      await db.$transaction(async (tx) => {
        await assertDeviceJobsOwned(jobs, tx);
        await tx.deviceSyncPlan.updateMany({ where: { id, status: "applying" }, data: { status: "recovery", conflicts: JSON.stringify([{ fileKey: "", reason: "Dateiplanstatus und aktuelle Inhalte prüfen; Baseline wurde nicht geändert." }]) } });
      });
      throw error;
    }
  } finally { for (const connection of connections.values()) connection.disconnect(); await jobs.close(); }
}
