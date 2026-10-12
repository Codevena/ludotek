import { mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Device, PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDatabase } from "../helpers/temp-database";
import { backupDeviceSave, getSaveVersions, prepareSaveRestore, acquireSaveContext, readSaveInventory, streamSaveBackup, type DeviceSavesOptions } from "@/lib/device-saves";
import { saveDeviceProfile } from "@/lib/device-profiles";
import { applyFilePlan, createSaveRestorePlan, undoFilePlan } from "@/lib/file-plans";
import { createConnection } from "@/lib/connection";
import { applySaveSyncPlan, createSaveSyncPlan } from "@/lib/save-sync";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
let sandbox: string; let roots: string[]; let devices: Device[]; let options: DeviceSavesOptions;
const request = () => new Request("http://fixture.invalid", { method: "POST" });
beforeAll(async () => { fixture = await createTestDatabase(); });
afterAll(async () => { await fixture.cleanup(); });
beforeEach(async () => {
  sandbox = await mkdtemp(path.join(tmpdir(), "ludotek-device-saves-")); roots = []; devices = [];
  for (const name of ["master", "device"]) {
    await mkdir(path.join(sandbox, name)); const root = await realpath(path.join(sandbox, name)); roots.push(root);
    await mkdir(path.join(root, "roms")); await mkdir(path.join(root, "saves"));
  }
  vi.stubEnv("LOCAL_FILES_ROOT", undefined); vi.stubEnv("LOCAL_FILES_ROOTS", JSON.stringify(roots)); vi.stubEnv("DATABASE_URL", fixture.url);
  options = { db: fixture.client, storageDirectory: path.join(sandbox, "store"), connect: (device) => createConnection({ ...device, protocol: "local" }), ioTimeoutMs: 1000, totalTimeoutMs: 10000 };
  for (const root of roots) {
    const device = await fixture.client.device.create({ data: { name: "Own save device", protocol: "local", host: "localhost", user: "", password: "", scanPaths: JSON.stringify([{ path: path.join(root, "roms"), type: "rom" }]) } }); devices.push(device);
    await saveDeviceProfile(device.id, { template: "custom", romRoots: [{ path: path.join(root, "roms") }], saveRoots: [{ platform: "snes", path: path.join(root, "saves") }], formats: [], reserveBytes: "0" }, request(), options);
  }
});
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); await rm(sandbox, { recursive: true }); });
async function save(index: number, contents: string, name = "Toy.srm") { const filename = path.join(roots[index], "saves", name); await writeFile(filename, contents); return filename; }

describe("immutable saves with persisted version history and common-journal restore", () => {
  it("backs up exact bytes, deduplicates objects and paginates retained metadata", async () => {
    const filename = await save(0, "own first save");
    const first = await backupDeviceSave({ deviceId: devices[0].id, filePath: filename }, request(), options);
    const second = await backupDeviceSave({ deviceId: devices[0].id, filePath: filename }, request(), options);
    expect(first.sha256).toBe(second.sha256); expect(first.id).not.toBe(second.id);
    expect(await readdir(options.storageDirectory!)).toEqual([first.sha256]);
    const history = await getSaveVersions({ deviceId: devices[0].id, take: 1 }, options);
    expect(history.total).toBe(2); expect(history.nextOffset).toBe(1); expect(history.versions).toHaveLength(1);
    expect(history.versions[0]).not.toHaveProperty("storageKey");
    expect(await readFile(filename, "utf8")).toBe("own first save");
  });
  it("restores through quarantine/copy and Undo after both original Game and Device are gone", async () => {
    const game = await fixture.client.game.create({ data: { title: "Own save game", platform: "snes", platformLabel: "SNES", originalFile: `own-save-${devices[0].id}.sfc` } });
    const source = await save(0, "own historical save"); const target = await save(1, "own current target");
    const version = await backupDeviceSave({ deviceId: devices[0].id, filePath: source, gameId: game.id }, request(), options);
    await fixture.client.game.delete({ where: { id: game.id } }); await fixture.client.device.delete({ where: { id: devices[0].id } });
    await writeFile(source, "source is no longer authoritative");
    const prepared = await prepareSaveRestore({ versionId: version.id, targetDeviceId: devices[1].id, targetPath: target }, request(), options);
    expect(prepared.targetBackupVersionId).toBeTypeOf("string");
    expect(await readFile(target, "utf8")).toBe("own current target");
    expect(JSON.stringify(prepared.plan)).not.toContain(options.storageDirectory);
    await applyFilePlan(prepared.plan.id, request(), options);
    expect(await readFile(target, "utf8")).toBe("own historical save");
    await undoFilePlan(prepared.plan.id, request(), options);
    expect(await readFile(target, "utf8")).toBe("own current target");
    expect(await fixture.client.saveVersion.findUnique({ where: { id: version.id } })).toMatchObject({ gameTitle: "Own save game", deviceId: devices[0].id });
  });
  it("preserves published backup bytes but performs zero target writes when version SQL persistence fails", async () => {
    const source = await save(0, "own stored version"); const target = await save(1, "own protected target");
    const version = await backupDeviceSave({ deviceId: devices[0].id, filePath: source }, request(), options);
    const failing = fixture.client.$extends({ query: { saveVersion: { create() { throw new Error("own fixture SQL failure"); } } } });
    const createRestore = vi.fn(createSaveRestorePlan);
    await expect(prepareSaveRestore({ versionId: version.id, targetDeviceId: devices[1].id, targetPath: target }, request(), { ...options, db: failing as unknown as PrismaClient, createRestore })).rejects.toThrow();
    expect(createRestore).not.toHaveBeenCalled(); expect(await readFile(target, "utf8")).toBe("own protected target");
    expect(await readdir(options.storageDirectory!)).toHaveLength(2);
    expect(await fixture.client.saveVersion.count({ where: { deviceId: devices[1].id } })).toBe(0);
  });
  it("cannot follow symlinks, leave declared save roots or restore through a forged version identity", async () => {
    const outside = path.join(roots[0], "roms/other.sfc"); await writeFile(outside, "other bytes");
    await symlink(outside, path.join(roots[0], "saves/alias.srm"));
    await expect(backupDeviceSave({ deviceId: devices[0].id, filePath: path.join(roots[0], "saves/alias.srm") }, request(), options)).rejects.toThrow();
    await expect(backupDeviceSave({ deviceId: devices[0].id, filePath: outside }, request(), options)).rejects.toThrow();
    await expect(prepareSaveRestore({ versionId: "../outside", targetDeviceId: devices[0].id, targetPath: outside }, request(), options)).rejects.toThrow();
    expect(await readFile(outside, "utf8")).toBe("other bytes");
  });
  it("reads eligible save inventory and excludes the reserved journal namespace without hiding unsafe user links", async () => {
    const filename = await save(0, "own save"); await save(0, "journal bytes", ".ludotek-reserved-backup");
    const context = await acquireSaveContext([devices[0].id], request(), options);
    try {
      const inventory = await readSaveInventory(context, devices[0].id); expect(inventory.complete).toBe(true); expect(inventory.files.map((file) => file.path)).toEqual([filename]);
    } finally { await context.close(); }
    await symlink(filename, path.join(roots[0], "saves/user-link.srm"));
    const again = await acquireSaveContext([devices[0].id], request(), options);
    try { expect((await readSaveInventory(again, devices[0].id)).complete).toBe(false); } finally { await again.close(); }
    expect((await stat(filename)).size).toBe(8);
  });
  it("syncs original save bytes, persists a baseline and requires explicit resolution when both sides change", async () => {
    await save(0, "master initial");
    const input = { masterDeviceId: devices[0].id, deviceId: devices[1].id, direction: "two-way" };
    const first = await createSaveSyncPlan(input, request(), options);
    expect(first.status).toBe("ready"); expect(await applySaveSyncPlan(first.id, request(), options)).toMatchObject({ status: "applied" });
    expect(await readFile(path.join(roots[1], "saves/Toy.srm"), "utf8")).toBe("master initial");
    expect(await fixture.client.saveSyncBaseline.count({ where: { masterDeviceId: devices[0].id, deviceId: devices[1].id } })).toBe(1);
    await save(0, "master changed"); await save(1, "device changed");
    const conflict = await createSaveSyncPlan(input, request(), options); expect(conflict.status).toBe("conflict"); expect(conflict.plans).toEqual([]);
    await expect(applySaveSyncPlan(conflict.id, request(), options)).rejects.toMatchObject({ status: 409 });
    const resolved = await createSaveSyncPlan({ ...input, resolutions: { "snes|Toy.srm": "device" } }, request(), options);
    await applySaveSyncPlan(resolved.id, request(), options);
    expect(await readFile(path.join(roots[0], "saves/Toy.srm"), "utf8")).toBe("device changed");
    const backups = await fixture.client.saveVersion.findMany({ where: { deviceId: devices[0].id, sourcePath: path.join(roots[0], "saves/Toy.srm") } });
    const preserved = await Promise.all(backups.map((backup) => readFile(path.join(options.storageDirectory!, backup.storageKey), "utf8")));
    expect(preserved).toContain("master changed");
  });
  it("never overwrites a target or advances baseline when the native source changes after Save-Sync preview", async () => {
    await save(0, "master preview"); const target = await save(1, "device current");
    const preview = await createSaveSyncPlan({ masterDeviceId: devices[0].id, deviceId: devices[1].id, direction: "push", resolutions: { "snes|Toy.srm": "master" } }, request(), options);
    await save(0, "master later edit");
    await expect(applySaveSyncPlan(preview.id, request(), options)).rejects.toMatchObject({ status: 409 });
    expect(await readFile(target, "utf8")).toBe("device current");
    expect(await fixture.client.saveSyncBaseline.count({ where: { masterDeviceId: devices[0].id, deviceId: devices[1].id } })).toBe(0);
  });
  it("a corrupt version cannot legitimize restoring over a native save", async () => {
    const source = await save(0, "own valid version"); const target = await save(1, "own current save");
    const version = await backupDeviceSave({ deviceId: devices[0].id, filePath: source }, request(), options);
    await writeFile(path.join(options.storageDirectory!, version.sha256), "corrupted object");
    const createRestore = vi.fn(createSaveRestorePlan);
    await expect(prepareSaveRestore({ versionId: version.id, targetDeviceId: devices[1].id, targetPath: target }, request(), { ...options, createRestore })).rejects.toThrow();
    expect(createRestore).not.toHaveBeenCalled(); expect(await readFile(target, "utf8")).toBe("own current save");
  });
  it("backup cancellation holds the actual device lease until its reader has drained", async () => {
    const filename = await save(0, "own save"); let finish!: () => void; let signal: AbortSignal | undefined;
    const connect: NonNullable<DeviceSavesOptions["connect"]> = async (device) => {
      const connection = await createConnection({ ...device, protocol: "local" }); const io = connection.fileIo!;
      const wrapped = new Proxy(io, { get(target, property) {
        if (property === "readTo") return async (_path: string, _sink: unknown, limits: { signal?: AbortSignal }) => {
          signal = limits.signal; await new Promise<void>((resolve) => { finish = resolve; }); return { bytes: 0 };
        };
        const value = Reflect.get(target, property); return typeof value === "function" ? value.bind(target) : value;
      } });
      return new Proxy(connection, { get(target, property) { return property === "fileIo" ? wrapped : Reflect.get(target, property); } });
    };
    const response = await streamSaveBackup({ deviceId: devices[0].id, filePath: filename }, request(), { ...options, connect });
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    const cancelling = response.body!.cancel(); await Promise.resolve(); expect(signal?.aborted).toBe(true);
    expect(await fixture.client.jobLease.findUnique({ where: { resource: `files:${devices[0].id}` } })).not.toBeNull();
    finish(); await cancelling;
    expect(await fixture.client.jobLease.findUnique({ where: { resource: `files:${devices[0].id}` } })).toBeNull();
    expect(await fixture.client.saveVersion.count({ where: { deviceId: devices[0].id } })).toBe(0);
    expect(await readFile(filename, "utf8")).toBe("own save");
  });
  it("does not persist a stale snapshot when source bytes change with unchanged reported size and coarse mtime", async () => {
    const filename = await save(0, "own save");
    const connect: NonNullable<DeviceSavesOptions["connect"]> = async (device) => {
      const connection = await createConnection({ ...device, protocol: "local" }); const io = connection.fileIo!;
      const old = await io.lstat(filename); let metadataReads = 0; let dataReads = 0;
      const wrapped = new Proxy(io, { get(target, property) {
        if (property === "lstat") return async (path: string) => { metadataReads++; return metadataReads === 2 ? old : target.lstat(path); };
        if (property === "readTo") return async (...args: Parameters<typeof io.readTo>) => { const result = await target.readTo(...args); if (++dataReads === 1) await writeFile(filename, "new save"); return result; };
        const value = Reflect.get(target, property); return typeof value === "function" ? value.bind(target) : value;
      } });
      return new Proxy(connection, { get(target, property) { return property === "fileIo" ? wrapped : Reflect.get(target, property); } });
    };
    await expect(backupDeviceSave({ deviceId: devices[0].id, filePath: filename }, request(), { ...options, connect })).rejects.toMatchObject({ status: 409 });
    expect(await fixture.client.saveVersion.count({ where: { deviceId: devices[0].id } })).toBe(0);
    expect(await readFile(filename, "utf8")).toBe("new save");
  });
});
