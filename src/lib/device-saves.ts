import path from "node:path";
import type { Device, PrismaClient, SaveVersion } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createConnection, requireFileIo, type DeviceConnection, type FileIo } from "@/lib/connection";
import { decrypt } from "@/lib/encryption";
import { acquireDeviceFiles, assertDeviceJobsOwned, type DeviceJobs } from "@/lib/device-jobs";
import { DeviceProfileError, deviceProfileAcquire, getDeviceProfile, profileContains, validDeviceNumber, type ProfileRoot } from "@/lib/device-profiles";
import { resolveLocalPath } from "@/lib/local-paths";
import { readProfileFingerprint } from "@/lib/device-profile-sync";
import { createSaveObject, MAX_SAVE_BYTES, verifySaveObject, type SaveStoreOptions } from "@/lib/save-store";
import { createSaveRestorePlan, type FilePlanOptions, type FilePlanView } from "@/lib/file-plans";

export type DeviceSavesOptions = FilePlanOptions & SaveStoreOptions & { createRestore?: typeof createSaveRestorePlan };
export interface SaveFile { path: string; fileKey: string; platform: string | null; size: string; modifiedAt: string | null }
export interface SaveVersionView { id: string; deviceId: number | null; gameId: number | null; deviceName: string; gameTitle: string | null; platform: string | null; fileKey: string; sourcePath: string; sha256: string; size: string; createdAt: string }
export function saveVersionView(version: SaveVersion): SaveVersionView { return { id: version.id, deviceId: version.deviceId, gameId: version.gameId, deviceName: version.deviceName, gameTitle: version.gameTitle, platform: version.platform, fileKey: version.fileKey, sourcePath: version.sourcePath, sha256: version.sha256, size: version.size.toString(), createdAt: version.createdAt.toISOString() }; }
export function validSaveVersionId(id: string): boolean { return /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id); }
export function validSavePath(filename: unknown): filename is string { return typeof filename === "string" && filename.length <= 4096 && filename.startsWith("/") && filename !== "/" && path.posix.normalize(filename) === filename && !/[\\\x00-\x1f\x7f-\x9f]/.test(filename) && !filename.split("/").some((part) => part.startsWith(".ludotek-")); }

export class SaveContext {
  readonly db: PrismaClient;
  readonly connections = new Map<number, DeviceConnection>();
  readonly devices = new Map<number, Device>();
  constructor(readonly jobs: DeviceJobs, readonly deviceIds: number[], readonly options: DeviceSavesOptions) { this.db = options.db ?? prisma; }
  async device(id: number): Promise<Device> {
    if (!this.deviceIds.includes(id)) throw new DeviceProfileError("Das Gerät liegt außerhalb dieses Save-Auftrags.", 409);
    await this.jobs.assertActive();
    if (!this.devices.has(id)) { const device = await this.db.device.findUnique({ where: { id } }); if (!device) throw new DeviceProfileError("Gerät nicht gefunden.", 404); this.devices.set(id, device); }
    return this.devices.get(id)!;
  }
  async roots(id: number): Promise<ProfileRoot[]> {
    await this.device(id);
    const configured = await getDeviceProfile(id, { db: this.db });
    if (!configured.saved || !configured.profile.saveRoots.length) throw new DeviceProfileError("Zuerst explizite Save-Wurzeln im Geräteprofil speichern.", 422);
    return configured.profile.saveRoots;
  }
  async safePath(id: number, filename: string): Promise<{ path: string; root: ProfileRoot; fileKey: string }> {
    if (!validSavePath(filename)) throw new DeviceProfileError("Ungültiger Save-Pfad.");
    const roots = (await this.roots(id)).filter((root) => filename !== root.path && profileContains(root.path, filename)).sort((left, right) => right.path.length - left.path.length);
    if (!roots.length || (roots.length > 1 && roots[0].path.length === roots[1].path.length)) throw new DeviceProfileError("Der Save-Pfad gehört nicht eindeutig zu einer deklarierten Save-Wurzel.", 422);
    const device = await this.device(id);
    const canonical = device.protocol === "local" ? await resolveLocalPath(filename, { allowMissing: true }) : filename;
    if (!profileContains(roots[0].path, canonical) || canonical === roots[0].path || canonical !== filename) throw new DeviceProfileError("Der Save-Pfad verlässt die deklarierte Wurzel oder folgt einer Symlink-Umleitung.", 422);
    const parts = path.posix.relative(roots[0].path, filename).split("/");
    if (parts.length > 16) throw new DeviceProfileError("Der Save-Pfad überschreitet die begrenzte Verzeichnistiefe.", 422);
    if (device.protocol !== "local") {
      const io = await this.io(id); let parent = roots[0].path;
      for (let index = 0; index < parts.length; index++) {
        await this.jobs.assertActive();
        if ((await io.lstat(parent)).type !== "directory") throw new DeviceProfileError("Die Save-Wurzel oder ein Elternpfad ist kein bestätigtes reguläres Verzeichnis.", 422);
        parent = path.posix.join(parent, parts[index]);
      }
    }
    return { path: canonical, root: roots[0], fileKey: `${roots[0].platform ?? "*"}|${path.posix.relative(roots[0].path, canonical)}` };
  }
  async io(id: number): Promise<FileIo> {
    if (!this.connections.has(id)) {
      const device = await this.device(id);
      if (!["ssh", "ftp", "local"].includes(device.protocol)) throw new DeviceProfileError("Nicht unterstütztes Geräteprotokoll.", 422);
      await this.jobs.assertActive();
      const connection = this.options.connect ? await this.options.connect(device) : await createConnection({ ...device, password: decrypt(device.password), protocol: device.protocol as "ssh" | "ftp" | "local" });
      this.connections.set(id, connection);
    }
    return requireFileIo(this.connections.get(id)!);
  }
  async close() {
    const failures: unknown[] = [];
    for (const connection of this.connections.values()) { try { connection.disconnect(); } catch (error) { failures.push(error); } }
    try { await this.jobs.close(); } catch (error) { failures.push(error); }
    if (failures.length) throw failures[0];
  }
}
export async function acquireSaveContext(ids: number[], request: Request, options: DeviceSavesOptions = {}): Promise<SaveContext> {
  if (!ids.length || ids.some((id) => !validDeviceNumber(id))) throw new DeviceProfileError("Ungültige Save-Geräteauswahl.");
  return new SaveContext(await acquireDeviceFiles(ids, request, deviceProfileAcquire(options)), ids, options);
}

export async function readSaveInventory(context: SaveContext, deviceId: number): Promise<{ files: SaveFile[]; complete: boolean; reason?: string }> {
  const roots = await context.roots(deviceId); const io = await context.io(deviceId); const connection = context.connections.get(deviceId)!;
  const files = new Map<string, SaveFile>(); const visited = new Set<string>(); let complete = true; let entriesRead = 0;
  const walk = async (directory: string, depth: number) => {
    await context.jobs.assertActive();
    if (visited.has(directory)) return; visited.add(directory);
    if (depth > 8 || entriesRead >= 10000 || files.size >= 2000) { complete = false; return; }
    let entries;
    try { entries = await connection.listDir(directory, { requireComplete: true }); } catch { await context.jobs.assertActive(); complete = false; return; }
    for (const entry of entries) {
      await context.jobs.assertActive(); entriesRead++;
      if (entriesRead > 10000 || files.size >= 2000) { complete = false; break; }
      if (entry.name.startsWith(".ludotek-")) continue;
      if (!entry.name || [".", ".."].includes(entry.name) || /[/\\\x00-\x1f\x7f]/.test(entry.name)) { complete = false; continue; }
      const filename = path.posix.join(directory, entry.name);
      try {
        const safe = await context.safePath(deviceId, filename); const metadata = await io.lstat(safe.path);
        if (metadata.type === "directory") await walk(safe.path, depth + 1);
        else if (metadata.type === "file" && Number.isSafeInteger(metadata.size) && metadata.size >= 0 && metadata.size <= MAX_SAVE_BYTES) files.set(safe.path, { path: safe.path, fileKey: safe.fileKey, platform: safe.root.platform ?? null, size: String(metadata.size), modifiedAt: metadata.modifiedAt ?? null });
        else complete = false;
      } catch { await context.jobs.assertActive(); complete = false; }
    }
  };
  for (const root of roots) {
    const device = await context.device(deviceId);
    if (device.protocol === "local" && await resolveLocalPath(root.path) !== root.path) throw new DeviceProfileError("Save-Wurzeln müssen kanonische erlaubte LOCAL-Pfade sein.", 422);
    await walk(root.path, 0);
  }
  return { files: [...files.values()].sort((left, right) => left.path.localeCompare(right.path)), complete, ...(!complete ? { reason: "Der Save-Bestand ist unvollständig; unlesbare, unsichere oder zu große Dateien wurden nicht bestätigt." } : {}) };
}

export async function backupSaveInContext(context: SaveContext, deviceId: number, filename: string, gameId?: number, onProgress?: (bytes: number, total: number) => void): Promise<SaveVersionView> {
  const safe = await context.safePath(deviceId, filename); const device = await context.device(deviceId);
  if (gameId !== undefined && !validDeviceNumber(gameId)) throw new DeviceProfileError("Ungültige Spielauswahl.");
  const game = gameId === undefined ? null : await context.db.game.findUnique({ where: { id: gameId }, select: { id: true, title: true, platform: true } });
  if (gameId !== undefined && !game) throw new DeviceProfileError("Das ausgewählte Spiel existiert nicht mehr.", 404);
  if (game && safe.root.platform && game.platform !== safe.root.platform) throw new DeviceProfileError("Spiel und Save-Wurzel gehören zu unterschiedlichen Plattformen.", 422);
  const io = await context.io(deviceId); const before = await io.lstat(safe.path);
  if (before.type !== "file" || !Number.isSafeInteger(before.size) || before.size < 0 || before.size > MAX_SAVE_BYTES) throw new DeviceProfileError("Nur bestätigte reguläre Saves bis512 MiB können gesichert werden.", 422);
  const object = await createSaveObject(async (sink, signal) => {
    await io.readTo(safe.path, sink, { signal, maxBytes: before.size, expectedBytes: before.size, timeoutMs: 120000, onProgress: (bytes) => onProgress?.(bytes, before.size) });
  }, { ...context.options, expectedBytes: before.size, signal: context.jobs.signal });
  const after = await io.lstat(safe.path);
  if (after.type !== "file" || after.size !== before.size || after.modifiedAt !== before.modifiedAt || (before.identity && after.identity !== before.identity)) throw new DeviceProfileError("Der Save wurde während der Sicherung verändert; es wurde keine gültige Version eingetragen.", 409);
  const current = await readProfileFingerprint(io, safe.path, context.jobs);
  if (current.sha256 !== object.sha256 || current.size !== object.size) throw new DeviceProfileError("Der Save-Inhalt wurde während der Sicherung verändert; die Version wurde nicht freigegeben.", 409);
  await context.jobs.assertActive();
  const stored = await context.db.$transaction(async (tx) => {
    await assertDeviceJobsOwned(context.jobs, tx); context.jobs.signal.throwIfAborted();
    return tx.saveVersion.create({ data: { deviceId, gameId: game?.id ?? null, deviceName: device.name, gameTitle: game?.title ?? null, platform: safe.root.platform ?? game?.platform ?? null,
      fileKey: safe.fileKey, sourcePath: safe.path, sha256: object.sha256, size: BigInt(object.size), storageKey: object.storageKey } });
  });
  return saveVersionView(stored);
}
export async function backupDeviceSave(input: { deviceId: number; filePath: string; gameId?: number }, request: Request, options: DeviceSavesOptions = {}) {
  if (!validSavePath(input.filePath)) throw new DeviceProfileError("Ungültiger Save-Pfad.");
  const context = await acquireSaveContext([input.deviceId], request, options);
  try { return await backupSaveInContext(context, input.deviceId, input.filePath, input.gameId); }
  finally { await context.close(); }
}
export async function getSaveVersions(input: { deviceId?: number; gameId?: number; fileKey?: string; offset?: number; take?: number }, options: DeviceSavesOptions = {}) {
  const offset = input.offset ?? 0; const take = input.take ?? 20;
  if ((input.deviceId !== undefined && !validDeviceNumber(input.deviceId)) || (input.gameId !== undefined && !validDeviceNumber(input.gameId)) || !Number.isSafeInteger(offset) || offset < 0 || offset > 100000 || !Number.isSafeInteger(take) || take < 1 || take > 200 || (input.fileKey !== undefined && (typeof input.fileKey !== "string" || input.fileKey.length > 8192 || /[\x00-\x1f\x7f]/.test(input.fileKey)))) throw new DeviceProfileError("Ungültige Versionsseite.");
  const db = options.db ?? prisma; const where = { ...(input.deviceId ? { deviceId: input.deviceId } : {}), ...(input.gameId ? { gameId: input.gameId } : {}), ...(input.fileKey !== undefined ? { fileKey: input.fileKey } : {}) };
  const [versions, total] = await Promise.all([db.saveVersion.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: offset, take }), db.saveVersion.count({ where })]);
  return { versions: versions.map(saveVersionView), total, nextOffset: offset + take < total ? offset + take : null };
}
export async function prepareSaveRestore(input: { versionId: string; targetDeviceId: number; targetPath: string }, request: Request, options: DeviceSavesOptions = {}): Promise<{ plan: FilePlanView; targetBackupVersionId: string | null }> {
  if (!validSaveVersionId(input.versionId) || !validSavePath(input.targetPath)) throw new DeviceProfileError("Ungültige Restore-Auswahl.");
  const context = await acquireSaveContext([input.targetDeviceId], request, options);
  try {
    const version = await context.db.saveVersion.findUnique({ where: { id: input.versionId } });
    if (!version) throw new DeviceProfileError("Save-Version nicht gefunden.", 404);
    const verified = await verifySaveObject(version.storageKey, options);
    if (verified.sha256 !== version.sha256 || verified.size !== version.size.toString()) throw new DeviceProfileError("Die gewählte Save-Version ist nicht mehr verifiziert.", 409);
    const target = await context.safePath(input.targetDeviceId, input.targetPath); const io = await context.io(input.targetDeviceId);
    if (target.root.platform && version.platform && target.root.platform !== version.platform) throw new DeviceProfileError("Restore-Version und Zielwurzel gehören zu unterschiedlichen Plattformen.", 422);
    let exists = true;
    try { await io.lstat(target.path); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") exists = false; else throw error; }
    const game = version.gameId ? await context.db.game.findUnique({ where: { id: version.gameId }, select: { id: true } }) : null;
    const backup = exists ? await backupSaveInContext(context, input.targetDeviceId, target.path, game?.id) : null;
    const plan = await (options.createRestore ?? createSaveRestorePlan)({ versionId: version.id, targetDeviceId: input.targetDeviceId, targetPath: target.path }, request,
      { ...options, heldJobs: { deviceIds: [input.targetDeviceId], jobs: context.jobs }, targetBackupVersionId: backup?.id });
    return { plan, targetBackupVersionId: backup?.id ?? null };
  } finally { await context.close(); }
}

/** UI cancellation aborts the producer and holds the lease until I/O drains. */
export async function streamSaveBackup(input: { deviceId: number; filePath: string; gameId?: number }, request: Request, options: DeviceSavesOptions = {}): Promise<Response> {
  const owned = await acquireSaveContext([input.deviceId], request, options);
  const cancellation = new AbortController();
  const signal = AbortSignal.any([owned.jobs.signal, cancellation.signal]);
  const context = new SaveContext({ ...owned.jobs, signal, async assertActive() { signal.throwIfAborted(); await owned.jobs.assertActive(); signal.throwIfAborted(); } }, owned.deviceIds, options);
  let completion: Promise<void>; let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (data: Record<string, unknown>) => { if (!cancelled) { try { controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)); } catch { cancellation.abort(); } } };
      completion = (async () => {
        try {
          let lastSent = 0;
          send({ type: "start" });
          const version = await backupSaveInContext(context, input.deviceId, input.filePath, input.gameId, (bytes, total) => {
            if (bytes === total || bytes - lastSent >= 1024 * 1024) { lastSent = bytes; send({ type: "progress", bytes, total }); }
          });
          send({ type: "done", version });
        }
        catch (error) { send({ type: "error", stopped: true, error: error instanceof DeviceProfileError ? error.message : "Save-Sicherung wurde nicht erfolgreich abgeschlossen." }); }
        finally { try { await context.close(); } catch { send({ type: "error", stopped: true, error: "Save-Auftrag konnte nicht sicher freigegeben werden." }); } if (!cancelled) controller.close(); }
      })();
    },
    async cancel() { cancelled = true; cancellation.abort(); await completion; },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" } });
}
