import { mkdtemp, mkdir, realpath, readFile, writeFile, rm, readdir, lstat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Device } from "@prisma/client";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/igdb", () => ({ searchIgdb: vi.fn(() => { throw new Error("No live provider is allowed in this fixture"); }) }));
vi.mock("@/lib/steamgriddb", () => ({ searchSteamGridDb: vi.fn(() => { throw new Error("No live provider is allowed in this fixture"); }) }));
import { createTestDatabase } from "../helpers/temp-database";
import { createConnection } from "@/lib/connection";
import { acquireDeviceFiles } from "@/lib/device-jobs";
import { deviceProfileAcquire } from "@/lib/device-profiles";
import { AdmissionStore } from "@/lib/job-admission";
import { createUploadFilePlan, undoFilePlan } from "@/lib/file-plans";
import { loadUploadSession } from "@/lib/disc-inputs";
import { processUploadThroughJournal, receiveUpload, removeOwnedUploadSession, UPLOAD_BASE, type UploadPipelineOptions } from "@/lib/upload-journal";

let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
let sandbox: string;
let root: string;
let device: Device;
let options: UploadPipelineOptions;
let sessions: string[];
const request = () => new Request("http://localhost/api/upload/process", { method: "POST" });
beforeAll(async () => { fixture = await createTestDatabase(); });
afterAll(async () => { await fixture.cleanup(); });
beforeEach(async () => {
  sandbox = await mkdtemp(path.join(tmpdir(), "ludotek-upload-journal-"));
  root = await realpath(sandbox); await mkdir(path.join(root, "psx"));
  vi.stubEnv("LOCAL_FILES_ROOT", ""); vi.stubEnv("LOCAL_FILES_ROOTS", JSON.stringify([root])); vi.stubEnv("DATABASE_URL", fixture.url);
  device = await fixture.client.device.create({ data: { name: "Own LOCAL upload fixture", protocol: "local", host: "", user: "", password: "", scanPaths: JSON.stringify([{ path: root, type: "rom" }]) } });
  await fixture.client.deviceProfile.create({ data: { deviceId: device.id, template: "custom", romRoots: JSON.stringify([{ path: root }]), saveRoots: "[]", formats: "[]", reserveBytes: BigInt(0) } });
  options = { db: fixture.client, connect: (item) => createConnection({ ...item, protocol: "local" }), ioTimeoutMs: 1000, totalTimeoutMs: 10000 };
  sessions = [];
});
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); for (const session of sessions) await rm(path.join(UPLOAD_BASE, session), { recursive: true, force: true }); await rm(sandbox, { recursive: true, force: true }); });

async function intake(files: Array<[string, string]>) {
  const form = new FormData(); for (const [name, bytes] of files) form.append("files", new File([bytes], name));
  const result = await receiveUpload(new Request("http://localhost/api/upload", { method: "POST", body: form }), options); sessions.push(result.sessionId); return result;
}
async function processSession(sessionId: string, extra: Partial<UploadPipelineOptions> = {}) {
  const session = await loadUploadSession(sessionId, "psx");
  const response = await processUploadThroughJournal({ sessionId, platform: "psx", gameIds: session.games.map((game) => game.id), deviceId: device.id }, request(), { ...options, ...extra });
  return (await response.text()).split("\n\n").filter(Boolean).map((line) => JSON.parse(line.slice(6)) as Record<string, unknown>);
}

describe("upload intake and the actual LOCAL journal pipeline", () => {
  it("applies one converted multidisc group, binds every actual manifest path and undoes after verified cache release", async () => {
    const received = await intake([["Own Toy (Disc 1).iso", "disc-one"], ["Own Toy (Disc 2).iso", "disc-two"]]);
    const converter = vi.fn(async (input: Parameters<NonNullable<UploadPipelineOptions["converter"]>>[0]) => { expect(input.signal).toBeInstanceOf(AbortSignal); expect(input.maxOutputBytes).toBeGreaterThan(0); await writeFile(input.outputPath, `CHD:${await readFile(input.inputPath, "utf8")}`); });
    const events = await processSession(received.sessionId, { converter });
    const success = events.find((event) => event.type === "game-done")!;
    expect(success).toMatchObject({ transferredFiles: 3, title: "Own Toy", planId: expect.any(String) }); expect(converter).toHaveBeenCalledTimes(2);
    const targetDirectory = path.join(root, "psx");
    expect(await readFile(path.join(targetDirectory, "Own Toy.m3u"), "utf8")).toBe("Own Toy (Disc 1).chd\nOwn Toy (Disc 2).chd\n");
    expect(await readFile(path.join(targetDirectory, "Own Toy (Disc 1).chd"), "utf8")).toBe("CHD:disc-one");
    const manifest = await fixture.client.deviceFile.findMany({ where: { deviceId: device.id } });
    expect(manifest).toHaveLength(3); expect(manifest.every((file) => file.gameId === success.dbId && file.path.startsWith(targetDirectory + "/") && file.platform === "psx")).toBe(true);
    expect(await fixture.client.gameDevice.findUnique({ where: { gameId_deviceId: { gameId: success.dbId as number, deviceId: device.id } } })).toMatchObject({ originalFile: "Own Toy.m3u" });
    expect(await fixture.client.uploadFileSource.count({ where: { sessionId: received.sessionId, released: true } })).toBe(3);
    await expect(lstat(path.join(UPLOAD_BASE, received.sessionId))).rejects.toHaveProperty("code", "ENOENT");
    expect(await undoFilePlan(success.planId as string, request(), options)).toMatchObject({ status: "undone" });
    expect((await readdir(targetDirectory)).every((name) => name.startsWith(".ludotek-"))).toBe(true);
    expect(await fixture.client.deviceFile.count({ where: { deviceId: device.id } })).toBe(0);
  });
  it("retains originals and publishes no success/catalog entry when conversion fails", async () => {
    const received = await intake([["Own Failure.iso", "ORIGINAL"]]);
    const events = await processSession(received.sessionId, { converter: async () => { throw new Error("Own synthetic conversion failure"); } });
    expect(events.some((event) => event.type === "game-error")).toBe(true); expect(events.some((event) => event.type === "game-done")).toBe(false);
    expect(await readFile(received.files[0].path, "utf8")).toBe("ORIGINAL"); expect(await readdir(path.join(root, "psx"))).toEqual([]);
    expect(await fixture.client.gameDevice.count({ where: { deviceId: device.id } })).toBe(0);
    expect(await fixture.client.uploadFileSource.count({ where: { sessionId: received.sessionId } })).toBe(0);
  });
  it("rejects an existing native target before conversion or positive-source registration", async () => {
    const received = await intake([["Own Collision.iso", "ORIGINAL"]]); const target = path.join(root, "psx", "Own Collision.chd"); await writeFile(target, "NATIVE"); const converter = vi.fn();
    const events = await processSession(received.sessionId, { converter });
    expect(events.find((event) => event.type === "game-error")).toMatchObject({ status: 409 }); expect(converter).not.toHaveBeenCalled();
    expect(await readFile(target, "utf8")).toBe("NATIVE"); expect(await readFile(received.files[0].path, "utf8")).toBe("ORIGINAL");
    expect(await fixture.client.uploadFileSource.count({ where: { sessionId: received.sessionId } })).toBe(0); expect(await fixture.client.gameDevice.count({ where: { deviceId: device.id } })).toBe(0);
  });
  it("rejects a source changed after its persisted plan and retains that plan and cache for explicit recovery", async () => {
    const received = await intake([["Own Race.chd", "OLD"]]);
    const events = await processSession(received.sessionId, { createPlan: async (input, req, planOptions) => { const plan = await createUploadFilePlan(input, req, planOptions); await writeFile(received.files[0].path, "NEW"); return plan; } });
    const failure = events.find((event) => event.type === "game-error")!; expect(failure.planId).toEqual(expect.any(String)); expect(events.some((event) => event.type === "game-done")).toBe(false);
    expect(await readdir(path.join(root, "psx"))).toEqual([]); expect(await readFile(received.files[0].path, "utf8")).toBe("NEW");
    expect(await fixture.client.uploadFileSource.count({ where: { sessionId: received.sessionId, released: false } })).toBe(1); expect(await fixture.client.gameDevice.count({ where: { deviceId: device.id } })).toBe(0);
    expect(await fixture.client.filePlan.findUnique({ where: { id: failure.planId as string } })).not.toBeNull();
  });
  it("fails closed before target I/O when the common lease is busy or its store cannot transact", async () => {
    const received = await intake([["Own Busy.chd", "ROM"]]); const session = await loadUploadSession(received.sessionId, "psx"); const connect = vi.fn(options.connect!);
    const input = { sessionId: received.sessionId, platform: "psx", gameIds: session.games.map((game) => game.id), deviceId: device.id };
    const held = await new AdmissionStore(fixture.client).acquire("device-files");
    try { await expect(processUploadThroughJournal(input, request(), { ...options, connect })).rejects.toMatchObject({ status: 409 }); } finally { await held.release(); }
    const unavailable = new Proxy(fixture.client, { get(target, key) { return key === "$transaction" ? vi.fn(async () => { throw new Error("Own fixture store unavailable"); }) : Reflect.get(target, key); } });
    await expect(processUploadThroughJournal(input, request(), { ...options, db: unavailable, connect })).rejects.toMatchObject({ status: 503 });
    expect(connect).not.toHaveBeenCalled(); expect(await readdir(path.join(root, "psx"))).toEqual([]); expect(await fixture.client.gameDevice.count({ where: { deviceId: device.id } })).toBe(0);
  });
  it("retains a marked session while any unreleased positive source needs it and refuses unowned-directory cleanup", async () => {
    const received = await intake([["Own Keep.chd", "ROM"]]);
    await processSession(received.sessionId, { createPlan: async (input, req, planOptions) => { await createUploadFilePlan(input, req, planOptions); throw new Error("Own pending plan stays ready"); } });
    const jobs = await acquireDeviceFiles([], request(), deviceProfileAcquire(options));
    const unownedId = randomUUID(); sessions.push(unownedId); const unowned = path.join(UPLOAD_BASE, unownedId); await mkdir(unowned); await writeFile(path.join(unowned, "private.chd"), "PRIVATE");
    try { expect(await removeOwnedUploadSession(received.sessionId, jobs, fixture.client)).toBe(false); expect(await removeOwnedUploadSession(unownedId, jobs, fixture.client)).toBe(false); } finally { await jobs.close(); }
    expect(await readFile(received.files[0].path, "utf8")).toBe("ROM"); expect(await readFile(path.join(unowned, "private.chd"), "utf8")).toBe("PRIVATE");
  });
  it("rejects a lost owner after plan preparation before target writes or catalog binding", async () => {
    const received = await intake([["Own Expired.chd", "ROM"]]);
    const events = await processSession(received.sessionId, { createPlan: async (input, req, planOptions) => { const plan = await createUploadFilePlan(input, req, planOptions); await fixture.client.jobLease.update({ where: { resource: "device-files" }, data: { expiresAt: BigInt(0) } }); return plan; } });
    expect(events.some((event) => event.type === "game-done")).toBe(false); expect(await readdir(path.join(root, "psx"))).toEqual([]);
    expect(await fixture.client.gameDevice.count({ where: { deviceId: device.id } })).toBe(0); expect(await readFile(received.files[0].path, "utf8")).toBe("ROM");
  });
  it("holds the authoritative lease until an already started cancelled converter actually drains", async () => {
    const received = await intake([["Own Cancel.iso", "ORIGINAL"]]); const session = await loadUploadSession(received.sessionId, "psx");
    let started!: () => void; const startedPromise = new Promise<void>((resolve) => { started = resolve; });
    let drain!: () => void; const drainedPromise = new Promise<void>((resolve) => { drain = resolve; }); let signal!: AbortSignal;
    const response = await processUploadThroughJournal({ sessionId: received.sessionId, platform: "psx", gameIds: [session.games[0].id], deviceId: device.id }, request(), { ...options, converter: async (input) => { signal = input.signal!; started(); await drainedPromise; signal.throwIfAborted(); } });
    await startedPromise; const cancellation = response.body!.cancel(); await Promise.resolve(); expect(signal.aborted).toBe(true);
    await expect(new AdmissionStore(fixture.client).acquire("device-files")).rejects.toMatchObject({ status: 409 });
    drain(); await cancellation;
    const available = await new AdmissionStore(fixture.client).acquire("device-files"); await available.release();
    expect(await readdir(path.join(root, "psx"))).toEqual([]); expect(await readFile(received.files[0].path, "utf8")).toBe("ORIGINAL"); expect(await fixture.client.gameDevice.count({ where: { deviceId: device.id } })).toBe(0);
  });
  it("checks unknown target capabilities before reading even an invalid descriptor or starting conversion", async () => {
    const received = await intake([["Own Invalid.cue", "INVALID DESCRIPTOR BODY"]]); const converter = vi.fn();
    const connect = vi.fn(async (item: Device) => { const connection = await options.connect!(item); vi.spyOn(connection.fileIo!, "capabilities").mockImplementation(async () => ({ readStream: { state: "unknown", reason: "Own unsupported fixture" } } as never)); return connection; });
    await expect(processUploadThroughJournal({ sessionId: received.sessionId, platform: "psx", gameIds: ["game-own-fixture"], deviceId: device.id }, request(), { ...options, connect, converter })).rejects.toMatchObject({ status: 422, message: expect.stringContaining("readStream") });
    expect(connect).toHaveBeenCalledTimes(1); expect(converter).not.toHaveBeenCalled(); expect(await fixture.client.uploadFileSource.count({ where: { sessionId: received.sessionId } })).toBe(0); expect(await readdir(path.join(root, "psx"))).toEqual([]);
  });
});
