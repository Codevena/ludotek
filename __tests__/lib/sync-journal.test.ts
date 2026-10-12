import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient, type Device } from "@prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createConnection } from "@/lib/connection";
import { AdmissionStore } from "@/lib/job-admission";
import { undoFilePlan } from "@/lib/file-plans";
import { SyncJournalService } from "@/lib/sync-journal";
import { createTestDatabase } from "../helpers/temp-database";

let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
let sandbox: string;
let device: Device;
let root: string;
let service: SyncJournalService;
const request = () => new Request("http://localhost/api/sync/apply", { method: "POST" });
let connect: ReturnType<typeof vi.fn<(device: Device) => ReturnType<typeof createConnection>>>;
beforeAll(async () => { fixture = await createTestDatabase(); });
afterAll(async () => { await fixture?.cleanup(); });
beforeEach(async () => {
  await fixture.client.syncQueue.deleteMany();
  await fixture.client.filePlanOperation.deleteMany();
  await fixture.client.filePlan.deleteMany();
  await fixture.client.device.deleteMany();
  await fixture.client.game.deleteMany();
  await fixture.client.jobLease.deleteMany();
  sandbox = await mkdtemp(path.join(tmpdir(), "ludotek-sync-journal-"));
  root = path.join(sandbox, "roms"); await mkdir(root);
  vi.stubEnv("LOCAL_FILES_ROOT", root); vi.stubEnv("LOCAL_FILES_ROOTS", ""); vi.stubEnv("DATABASE_URL", fixture.url);
  device = await fixture.client.device.create({ data: { name: "Own sync fixture", protocol: "local", host: "", user: "", password: "", scanPaths: JSON.stringify([{ path: root, type: "rom" }]) } });
  await fixture.client.deviceInventory.create({ data: { deviceId: device.id, generation: "own", complete: true } });
  connect = vi.fn((device: Device) => createConnection({ ...device, protocol: "local" }));
  service = new SyncJournalService(fixture.client, { connect, totalTimeoutMs: 10000, ioTimeoutMs: 1000 });
});
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); await rm(sandbox, { recursive: true, force: true }); });

async function game(name: string) {
  return fixture.client.game.create({ data: { title: name, originalFile: `${name}.nes`, platform: "nes", platformLabel: "NES", devices: { create: { deviceId: device.id, originalFile: `${name}.nes` } } } });
}
async function file(name: string, gameId: number, content = "own ROM") {
  const filename = path.join(root, name); await writeFile(filename, content);
  const info = await stat(filename, { bigint: true });
  await fixture.client.deviceFile.create({ data: { deviceId: device.id, gameId, path: filename, scanRoot: root, platformAlias: "", relativePath: name,
    platform: "nes", source: "rom", kind: "file", size: info.size, modifiedAt: info.mtime.toISOString(), generation: "own" } });
  return filename;
}

describe("sync queue backed by durable file plans", () => {
  it("stages a real immutable preview, applies only its stored plan and preserves undo", async () => {
    const title = await game("One"); const source = await file("One.nes", title.id); const target = path.join(root, "Two.nes");
    const staged = await service.stage({ type: "rename", deviceId: device.id, gameId: title.id, filePath: source, newPath: target }, request());
    expect(staged.plan.status).toBe("ready"); expect(staged.item.planId).toBe(staged.plan.id);
    expect(await readFile(source, "utf8")).toBe("own ROM"); await expect(readFile(target)).rejects.toMatchObject({ code: "ENOENT" });
    const result = await service.apply([staged.item.id], request());
    expect(result).toMatchObject({ applied: 1, failed: 0, results: [{ id: staged.item.id, status: "applied", plan: { status: "applied" } }] });
    expect(await readFile(target, "utf8")).toBe("own ROM");
    expect(await fixture.client.gameDevice.findUnique({ where: { gameId_deviceId: { gameId: title.id, deviceId: device.id } } })).toMatchObject({ originalFile: "Two.nes" });
    await undoFilePlan(staged.plan.id, request(), { db: fixture.client, connect });
    expect(await readFile(source, "utf8")).toBe("own ROM");
    expect(await fixture.client.gameDevice.findUnique({ where: { gameId_deviceId: { gameId: title.id, deviceId: device.id } } })).toMatchObject({ originalFile: "One.nes" });
  });

  it("rejects game B with game A's exact file before a preview or any device I/O", async () => {
    const a = await game("A"); const b = await game("B"); const source = await file("A.nes", a.id);
    await expect(service.stage({ type: "delete", deviceId: device.id, gameId: b.id, filePath: source }, request())).rejects.toMatchObject({ status: 409 });
    expect(connect).not.toHaveBeenCalled(); expect(await fixture.client.filePlan.count()).toBe(0); expect(await fixture.client.syncQueue.count()).toBe(0);
  });

  it("rechecks the stored game binding at apply before opening a connection", async () => {
    const a = await game("A"); const b = await game("B"); const source = await file("A.nes", a.id);
    const staged = await service.stage({ type: "delete", deviceId: device.id, gameId: a.id, filePath: source }, request());
    await fixture.client.syncQueue.update({ where: { id: staged.item.id }, data: { gameId: b.id } });
    connect.mockClear();
    expect(await service.apply([staged.item.id], request())).toMatchObject({ applied: 0, failed: 1, results: [{ status: "review_required" }] });
    expect(connect).not.toHaveBeenCalled(); expect(await readFile(source, "utf8")).toBe("own ROM");
  });

  it("declines legacy queues and never adopts another owner's in-progress rows", async () => {
    const title = await game("One"); const source = await file("One.nes", title.id);
    const legacy = await fixture.client.syncQueue.create({ data: { type: "rename", deviceId: device.id, gameId: title.id, filePath: source, newPath: path.join(root, "Legacy.nes"), status: "pending" } });
    const other = await fixture.client.syncQueue.create({ data: { type: "delete", deviceId: device.id, gameId: title.id, filePath: source, status: "in_progress", claimOwner: "other-owner", createdAt: new Date(0) } });
    const result = await service.apply([legacy.id, other.id], request());
    expect(result).toMatchObject({ applied: 0, failed: 1, ignored: 1 });
    expect(connect).not.toHaveBeenCalled(); expect(await fixture.client.syncQueue.findUnique({ where: { id: other.id } })).toMatchObject({ status: "in_progress", claimOwner: "other-owner" });
  });

  it("retains a multidisc GameDevice link when only one confirmed file is removed", async () => {
    const title = await game("Set"); const first = await file("Set (Disc 1).nes", title.id); const second = await file("Set (Disc 2).nes", title.id);
    const staged = await service.stage({ type: "delete", deviceId: device.id, gameId: title.id, filePath: first }, request());
    expect(await service.apply([staged.item.id], request())).toMatchObject({ applied: 1 });
    expect(await readFile(second, "utf8")).toBe("own ROM");
    expect(await fixture.client.gameDevice.count({ where: { gameId: title.id, deviceId: device.id } })).toBe(1);
    expect(await fixture.client.deviceFile.count({ where: { gameId: title.id, deviceId: device.id } })).toBe(1);
  });

  it("holds the actual shared device lease for queue removal and never erases claimed work", async () => {
    const title = await game("One"); const source = await file("One.nes", title.id);
    const staged = await service.stage({ type: "delete", deviceId: device.id, gameId: title.id, filePath: source }, request());
    const lease = await new AdmissionStore(fixture.client).acquire(`files:${device.id}`);
    try { await expect(service.clear([staged.item.id], request())).rejects.toMatchObject({ status: 409 }); }
    finally { await lease.release(); }
    await fixture.client.syncQueue.update({ where: { id: staged.item.id }, data: { status: "in_progress", claimOwner: "other-owner" } });
    await expect(service.clear([staged.item.id], request())).rejects.toMatchObject({ status: 409 });
    expect(await fixture.client.syncQueue.count()).toBe(1); expect(await fixture.client.filePlan.count()).toBe(1);
  });

  it("does not interpret an identical foreign target as a successful rename of a missing source", async () => {
    const title = await game("One"); const source = await file("One.nes", title.id); const target = path.join(root, "Two.nes");
    const staged = await service.stage({ type: "rename", deviceId: device.id, gameId: title.id, filePath: source, newPath: target }, request());
    await rm(source); await writeFile(target, "own ROM");
    const result = await service.apply([staged.item.id], request());
    expect(result).toMatchObject({ applied: 0, failed: 1 });
    expect(await fixture.client.syncQueue.findUnique({ where: { id: staged.item.id } })).toMatchObject({ status: "failed" });
    expect(await readFile(target, "utf8")).toBe("own ROM");
    expect(await fixture.client.deviceFile.findUnique({ where: { deviceId_path: { deviceId: device.id, path: source } } })).not.toBeNull();
  });

  it("surfaces failed queue metadata after real file success and safely confirms the existing journal on retry", async () => {
    const title = await game("One"); const source = await file("One.nes", title.id); const target = path.join(root, "Two.nes");
    const writes: string[] = [];
    connect.mockImplementation(async (device) => {
      const connection = await createConnection({ ...device, protocol: "local" });
      const write = connection.fileIo!.writeExclusiveTempFrom.bind(connection.fileIo);
      vi.spyOn(connection.fileIo!, "writeExclusiveTempFrom").mockImplementation((filename, stream, limits) => { writes.push(filename); return write(filename, stream, limits); });
      return connection;
    });
    let failOnce = true;
    service = new SyncJournalService(fixture.client, { connect, beforeQueueCommit: async () => {
      if (failOnce) { failOnce = false; vi.spyOn(fixture.client, "$transaction").mockRejectedValueOnce(new Error("Own simulated queue commit failure")); }
    } });
    const staged = await service.stage({ type: "rename", deviceId: device.id, gameId: title.id, filePath: source, newPath: target }, request());
    expect(await service.apply([staged.item.id], request())).toMatchObject({ applied: 0, failed: 1, results: [{ status: "metadata_failed", plan: { status: "applied" } }] });
    expect(await readFile(target, "utf8")).toBe("own ROM");
    expect(await fixture.client.syncQueue.findUnique({ where: { id: staged.item.id } })).toMatchObject({ status: "metadata_failed" });
    const writesBefore = writes.length;
    expect(await service.apply([staged.item.id], request())).toMatchObject({ applied: 1, failed: 0 });
    expect(writes.length).toBe(writesBefore);
    expect(await fixture.client.filePlan.findUnique({ where: { id: staged.plan.id } })).toMatchObject({ status: "applied" });
  });

  it("removes only queue metadata while retaining the unchanged file and its durable plan history", async () => {
    const title = await game("One"); const source = await file("One.nes", title.id);
    const staged = await service.stage({ type: "delete", deviceId: device.id, gameId: title.id, filePath: source }, request());
    expect(await service.clear([staged.item.id], request())).toEqual({ cleared: 1 });
    expect(await fixture.client.syncQueue.count()).toBe(0); expect(await fixture.client.filePlan.findUnique({ where: { id: staged.plan.id } })).not.toBeNull();
    expect(await readFile(source, "utf8")).toBe("own ROM");
  });

  it("fences queue completion after namespace takeover without erasing the new owner or losing journal recovery", async () => {
    const title = await game("One"); const source = await file("One.nes", title.id); const target = path.join(root, "Two.nes");
    const foreignOwner = "12345678-1234-4234-8234-123456789abc";
    service = new SyncJournalService(fixture.client, { connect, beforeQueueCommit: async () => {
      await fixture.client.jobLease.update({ where: { resource: "device-files" }, data: { owner: foreignOwner, expiresAt: BigInt(Date.now() + 90000) } });
    } });
    const staged = await service.stage({ type: "rename", deviceId: device.id, gameId: title.id, filePath: source, newPath: target }, request());
    expect(await service.apply([staged.item.id], request())).toMatchObject({ applied: 0, failed: 1, results: [{ status: "metadata_failed", plan: { status: "applied" } }] });
    expect(await fixture.client.syncQueue.findUnique({ where: { id: staged.item.id } })).toMatchObject({ status: "in_progress" });
    expect(await fixture.client.jobLease.findUnique({ where: { resource: "device-files" } })).toMatchObject({ owner: foreignOwner });
    expect(await readFile(target, "utf8")).toBe("own ROM");
    expect(await fixture.client.filePlan.findUnique({ where: { id: staged.plan.id } })).toMatchObject({ status: "applied" });
    // Own fixture removes the synthetic owner, representing a closed old run.
    await fixture.client.jobLease.delete({ where: { resource: "device-files" } });
    expect(await service.clear([staged.item.id], request())).toEqual({ cleared: 1 });
    expect(await fixture.client.filePlan.findUnique({ where: { id: staged.plan.id } })).not.toBeNull();
  });

  it("blocks a second database client's namespace owner before any staging connection or draft", async () => {
    const title = await game("One"); const source = await file("One.nes", title.id);
    const otherClient = new PrismaClient({ datasourceUrl: fixture.url });
    const lease = await new AdmissionStore(otherClient).acquire("device-files");
    try { await expect(service.stage({ type: "delete", deviceId: device.id, gameId: title.id, filePath: source }, request())).rejects.toMatchObject({ status: 409 }); }
    finally { await lease.release(); await otherClient.$disconnect(); }
    expect(await fixture.client.syncQueue.count()).toBe(0); expect(await fixture.client.filePlan.count()).toBe(0);
    expect(connect).not.toHaveBeenCalled(); expect(await readFile(source, "utf8")).toBe("own ROM");
  });
});
