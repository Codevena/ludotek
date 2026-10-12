import { mkdir, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import { PassThrough } from "node:stream";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createConnection, type DeviceConnection } from "@/lib/connection";
import { AdmissionStore, EnrichmentJob } from "@/lib/job-admission";
import { acquireDeviceFiles } from "@/lib/device-jobs";
import { hashReadable } from "@/lib/integrity";
import { DeviceIntegrityService } from "@/lib/device-integrity";
import { createTestDatabase } from "../helpers/temp-database";

let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
let service: DeviceIntegrityService;
let deviceId: number;
let romRoot: string;
let connect: ReturnType<typeof vi.fn<(config: Parameters<typeof createConnection>[0]) => Promise<DeviceConnection>>>;

beforeAll(async () => { fixture = await createTestDatabase(); });
afterAll(async () => { await fixture?.cleanup(); });
beforeEach(async () => {
  await fixture.client.integrityResult.deleteMany();
  await fixture.client.integrityJob.deleteMany();
  await fixture.client.datSource.deleteMany();
  await fixture.client.device.deleteMany();
  await fixture.client.jobLease.deleteMany();
  await fixture.client.admissionClock.deleteMany();
  romRoot = path.join(fixture.directory, "roms");
  await mkdir(romRoot, { recursive: true });
  vi.stubEnv("LOCAL_FILES_ROOT", romRoot);
  vi.stubEnv("LOCAL_FILES_ROOTS", "");
  const device = await fixture.client.device.create({ data: { name: "Integrity toy", protocol: "local", host: "", user: "", password: "", scanPaths: JSON.stringify([{ path: romRoot, type: "rom" }]) } });
  deviceId = device.id;
  connect = vi.fn(createConnection);
  service = new DeviceIntegrityService(fixture.client, { connect });
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.useRealTimers(); });

async function file(name: string, content: string) {
  const filename = path.join(romRoot, name);
  await writeFile(filename, content);
  const conn = await createConnection({ protocol: "local", host: "", user: "", password: "", port: 0 });
  const metadata = await conn.stat(filename);
  conn.disconnect();
  return fixture.client.deviceFile.create({ data: { deviceId, path: filename, scanRoot: romRoot, platformAlias: "nes", relativePath: name,
    platform: "nes", source: "rom", kind: "file", size: BigInt(metadata.size), modifiedAt: metadata.modifiedAt, generation: "own-test" } });
}

async function fingerprint(content: string) {
  const stream = new PassThrough();
  const pending = hashReadable(stream, { maxBytes: 1024 });
  stream.end(Buffer.from(content));
  return pending;
}

describe("persistent device integrity jobs", () => {
  it("imports parsed local DAT sources once without retaining raw documents", async () => {
    const contents = '<datafile><header><name>Toy DAT</name></header><game name="Mario"><rom name="Mario.nes" size="3" crc="352441c2"/></game></datafile>';
    const source = await service.importDat(Buffer.from(contents), "My toy source");
    const repeated = await service.importDat(Buffer.from(contents), "Another friendly name");
    expect(repeated.id).toBe(source.id);
    expect(await fixture.client.datSource.count()).toBe(1);
    expect(source).toMatchObject({ name: "My toy source", format: "logiqx", romCount: 1 });
    const stored = await fixture.client.datSource.findUniqueOrThrow({ where: { id: source.id } });
    expect(stored.roms).not.toContain("<datafile>");
    expect(JSON.parse(stored.roms)[0]).toMatchObject({ name: "Mario.nes", crc32: "352441c2" });
  });

  it("streams actual bytes, checks every supplied checksum and finds content duplicates across filenames", async () => {
    const first = await file("Mario.nes", "abc");
    const duplicate = await file("Another name.nes", "abc");
    const unknown = await file("Unknown.nes", "xyz");
    const expected = await fingerprint("abc");
    const dat = await service.importDat(Buffer.from(`<datafile><game name="Mario (Rev 1)"><rom name="Mario.nes" size="3" crc="${expected.crc32}" md5="${expected.md5}" sha1="${expected.sha1}" sha256="${expected.sha256}"/></game></datafile>`), "Known revisions");
    const job = await service.start(deviceId, { datSourceId: dat.id });
    await service.wait(job.id);
    const snapshot = await service.snapshot(job.id);
    expect(snapshot.job).toMatchObject({ status: "completed", checked: 3, total: 3, progress: 100 });
    expect(snapshot.results.find((result) => result.path === first.path)).toMatchObject({ status: "verified", stale: false, duplicateCount: 2, matchCount: 1 });
    expect(snapshot.results.find((result) => result.path === duplicate.path)?.fingerprint.sha256).toBe(expected.sha256);
    expect(snapshot.results.find((result) => result.path === unknown.path)).toMatchObject({ status: "unknown", matchCount: 0 });
    expect(snapshot.results.find((result) => result.path === first.path)?.matches[0].gameName).toBe("Mario (Rev 1)");
    expect((await fixture.client.deviceFile.findUniqueOrThrow({ where: { id: first.id } })).sha256).toBe(expected.sha256);
  });

  it("calls a nonmatch unknown until a concrete DAT revision is explicitly selected", async () => {
    const target = await file("Mario.nes", "xyz");
    const dat = await service.importDat(Buffer.from('<datafile><game name="Mario"><rom name="Mario.nes" size="3" crc="352441c2"/></game></datafile>'), "Toy");
    const unknown = await service.start(deviceId, { datSourceId: dat.id, fileIds: [target.id] });
    await service.wait(unknown.id);
    expect((await service.snapshot(unknown.id)).results[0].status).toBe("unknown");
    const mismatch = await service.start(deviceId, { datSourceId: dat.id, fileIds: [target.id], expected: [{ deviceFileId: target.id, romIndex: 0 }] });
    await service.wait(mismatch.id);
    expect((await service.snapshot(mismatch.id)).results[0]).toMatchObject({ status: "mismatch", expectedRom: { name: "Mario.nes" } });
  });

  it("rejects foreign files and invalid revision indices before a connection or credential read", async () => {
    const target = await file("One.nes", "abc");
    const dat = await service.importDat(Buffer.from('<datafile><game name="One"><rom name="One.nes" size="3" crc="352441c2"/></game></datafile>'), "Toy");
    await expect(service.start(deviceId, { fileIds: [target.id + 10000] })).rejects.toMatchObject({ status: 400 });
    await expect(service.start(deviceId, { datSourceId: dat.id, expected: [{ deviceFileId: target.id, romIndex: 100 }] })).rejects.toMatchObject({ status: 400 });
    expect(connect).not.toHaveBeenCalled();
    expect(await fixture.client.integrityJob.count()).toBe(0);
  });

  it("acquires the same files lock as scans and plans before opening a device", async () => {
    await file("One.nes", "abc");
    const lease = await new AdmissionStore(fixture.client).acquire(`files:${deviceId}`);
    try { await expect(service.start(deviceId, {})).rejects.toMatchObject({ status: 409 }); }
    finally { await lease.release(); }
    expect(connect).not.toHaveBeenCalled();
    expect(await fixture.client.integrityJob.count()).toBe(0);
  });

  it("marks historical results stale when the scanner invalidates their current fingerprint", async () => {
    const target = await file("One.nes", "abc");
    const job = await service.start(deviceId, {});
    await service.wait(job.id);
    expect((await service.snapshot(job.id)).results[0].stale).toBe(false);
    await fixture.client.deviceFile.update({ where: { id: target.id }, data: { sha256: null, modifiedAt: "changed-by-next-scan" } });
    expect((await service.snapshot(job.id)).results[0]).toMatchObject({ stale: true, status: "stale" });
    await fixture.client.device.delete({ where: { id: deviceId } });
    expect((await service.snapshot(job.id)).results[0]).toMatchObject({ stale: true, deviceFileId: null });
    expect(await fixture.client.integrityResult.count()).toBe(1);
  });

  it("does not trust a CRC match when another DAT checksum disagrees", async () => {
    const target = await file("One.nes", "abc");
    const dat = await service.importDat(Buffer.from('<datafile><game name="One"><rom name="One.nes" size="3" crc="352441c2" md5="00000000000000000000000000000000"/></game></datafile>'), "Both checksums");
    const job = await service.start(deviceId, { datSourceId: dat.id, expected: [{ deviceFileId: target.id, romIndex: 0 }] });
    await service.wait(job.id);
    expect((await service.snapshot(job.id)).results[0]).toMatchObject({ status: "mismatch", matchCount: 0 });
  });

  it("detects a same-size source change after streaming and never installs its fingerprint as current", async () => {
    const target = await file("Change.nes", "abc");
    const native = await createConnection({ protocol: "local", host: "", user: "", password: "", port: 0 });
    const read = native.fileIo!.readTo.bind(native.fileIo);
    vi.spyOn(native.fileIo!, "readTo").mockImplementation(async (...args) => {
      const result = await read(...args);
      await writeFile(target.path, "xyz");
      await utimes(target.path, new Date(), new Date(Date.now() + 10000));
      return result;
    });
    connect.mockResolvedValue(native);
    const job = await service.start(deviceId, {});
    await service.wait(job.id);
    expect((await service.snapshot(job.id))).toMatchObject({ job: { status: "completed_with_stale" }, results: [{ status: "stale", stale: true }] });
    expect((await fixture.client.deviceFile.findUniqueOrThrow({ where: { id: target.id } })).sha256).toBeNull();
  });

  it("persists partial cancellation and retains the device lease until the current stream drains", async () => {
    const first = await file("First.nes", "abc");
    await file("Second.nes", "xyz");
    await file("Third.nes", "later");
    const native = await createConnection({ protocol: "local", host: "", user: "", password: "", port: 0 });
    const disconnect = vi.spyOn(native, "disconnect");
    const realRead = native.fileIo!.readTo.bind(native.fileIo);
    let started!: () => void;
    let aborted!: () => void;
    let drain!: () => void;
    const secondStarted = new Promise<void>((resolve) => { started = resolve; });
    const abortSeen = new Promise<void>((resolve) => { aborted = resolve; });
    const drained = new Promise<void>((resolve) => { drain = resolve; });
    let readCount = 0;
    const reading = vi.spyOn(native.fileIo!, "readTo").mockImplementation(async (filename, destination, limits) => {
      readCount++;
      if (readCount === 1) return realRead(filename, destination, limits);
      started();
      await new Promise<void>((_, reject) => {
        const abort = () => { aborted(); void drained.then(() => reject(new Error("Own delayed driver cleanup"))); };
        limits.signal!.addEventListener("abort", abort, { once: true });
      });
      return { bytes: 0 };
    });
    connect.mockResolvedValue(native);
    const job = await service.start(deviceId, {});
    await secondStarted;
    const cancellation = service.cancel(job.id);
    await abortSeen;
    expect(disconnect).not.toHaveBeenCalled();
    await expect(new AdmissionStore(fixture.client).acquire(`files:${deviceId}`)).rejects.toMatchObject({ status: 409 });
    expect((await fixture.client.integrityJob.findUniqueOrThrow({ where: { id: job.id } }))).toMatchObject({ status: "running", cancelRequested: true, checked: 1 });
    drain();
    const final = await cancellation;
    expect(final.job).toMatchObject({ status: "cancelled", checked: 1, total: 3, progress: 33 });
    expect(final.results).toHaveLength(1);
    expect(reading).toHaveBeenCalledTimes(2);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect((await fixture.client.deviceFile.findUniqueOrThrow({ where: { id: first.id } })).sha256).not.toBeNull();
    expect(await fixture.client.jobLease.findUnique({ where: { resource: `files:${deviceId}` } })).toBeNull();
  });

  it("derives interrupted status from exact authoritative lease ownership rather than job age", async () => {
    const store = new AdmissionStore(fixture.client);
    const acquire = () => acquireDeviceFiles([deviceId], new Request("http://ludotek.internal"), async (resource, request) => new EnrichmentJob(await store.acquire(resource), request.signal));
    const jobs = await acquire();
    const old = await fixture.client.integrityJob.create({ data: { deviceId, status: "running", total: 1, owner: jobs.resourceOwners!.get(`files:${deviceId}`), globalOwner: jobs.resourceOwners!.get("device-files"), createdAt: new Date(0) } });
    expect((await service.snapshot(old.id)).job.status).toBe("running");
    await jobs.close();
    const newLease = await acquire();
    try { expect((await service.snapshot(old.id)).job.status).toBe("interrupted"); }
    finally { await newLease.close(); }
    // GET is a read-only view; a new admitted run may persist recovery separately.
    expect((await fixture.client.integrityJob.findUniqueOrThrow({ where: { id: old.id } })).status).toBe("running");
  });

  it("caps stored matching revisions while retaining their true count and source pagination", async () => {
    const target = await file("One.nes", "abc");
    const dat = await service.importDat(Buffer.from(`<datafile>${Array.from({ length: 201 }, (_, index) => `<game name="Revision ${index}"><rom name="One.nes" size="3" crc="352441c2"/></game>`).join("")}</datafile>`), "Many revisions");
    const job = await service.start(deviceId, { datSourceId: dat.id, fileIds: [target.id] });
    await service.wait(job.id);
    const result = (await service.snapshot(job.id)).results[0];
    expect(result.matchCount).toBe(201); expect(result.matches).toHaveLength(100);
    const page = await service.sourceRoms(dat.id);
    expect(page.roms).toHaveLength(200); expect(page.nextCursor).toBe(199);
    const tail = await service.sourceRoms(dat.id, page.nextCursor!);
    expect(tail.roms).toHaveLength(1); expect(tail.roms[0].index).toBe(200);
    const source = (await service.sources()).sources[0];
    expect(source).toMatchObject({ id: dat.id, romCount: 201 });
    expect(Number.isFinite(source.createdAt.getTime())).toBe(true);
  });

  it("serves bounded nonoverlapping result and history pages without device I/O", async () => {
    await file("One.nes", "abc");
    const job = await service.start(deviceId, {});
    await service.wait(job.id);
    const original = (await service.snapshot(job.id)).results[0];
    await fixture.client.integrityResult.createMany({ data: Array.from({ length: 200 }, (_, index) => ({ jobId: job.id, deviceId, path: `/own-history/removed-${index}.nes`, fingerprint: JSON.stringify(original.fingerprint), status: "unknown", matches: "[]" })) });
    connect.mockClear();
    const first = await service.snapshot(job.id);
    expect(first.results).toHaveLength(200); expect(first.nextCursor).not.toBeNull();
    const last = await service.snapshot(job.id, first.nextCursor!);
    expect(last.results).toHaveLength(1); expect(last.nextCursor).toBeNull();
    expect(new Set([...first.results, ...last.results].map((row) => row.id)).size).toBe(201);
    expect(first.results[0].duplicateCount).toBe(201);
    await fixture.client.integrityJob.createMany({ data: Array.from({ length: 200 }, () => ({ deviceId, status: "completed", createdAt: new Date(0) })) });
    const history = await service.overview(deviceId);
    expect(history.jobs).toHaveLength(200); expect(history.nextJobsCursor).not.toBeNull();
    const tail = await service.overview(deviceId, 0, "", history.nextJobsCursor!);
    expect(tail.jobs).toHaveLength(1); expect(tail.nextJobsCursor).toBeNull();
    expect(new Set([...history.jobs, ...tail.jobs].map((entry) => entry.id)).size).toBe(201);
    expect(connect).not.toHaveBeenCalled();
  });

  it("persists a cross-process cancel request and stops the actual owner before later files", async () => {
    vi.useFakeTimers();
    await file("One.nes", "abc");
    await file("Later.nes", "xyz");
    const native = await createConnection({ protocol: "local", host: "", user: "", password: "", port: 0 });
    let started!: () => void;
    let abort!: () => void;
    let drain!: () => void;
    const startedReading = new Promise<void>((resolve) => { started = resolve; });
    const aborted = new Promise<void>((resolve) => { abort = resolve; });
    const drained = new Promise<void>((resolve) => { drain = resolve; });
    const reading = vi.spyOn(native.fileIo!, "readTo").mockImplementation(async (_filename, _destination, limits) => {
      started();
      await new Promise<void>((_, reject) => { limits.signal!.addEventListener("abort", () => { abort(); void drained.then(() => reject(new Error("Own drain"))); }, { once: true }); });
      return { bytes: 0 };
    });
    connect.mockResolvedValue(native);
    const job = await service.start(deviceId, {});
    await startedReading;
    const secondProcess = new DeviceIntegrityService(fixture.client);
    const accepted = await secondProcess.cancel(job.id);
    expect(accepted.job).toMatchObject({ status: "running", cancelRequested: true });
    await vi.advanceTimersByTimeAsync(500);
    await aborted;
    expect(await fixture.client.jobLease.findUnique({ where: { resource: `files:${deviceId}` } })).not.toBeNull();
    drain();
    await service.wait(job.id);
    expect((await service.snapshot(job.id)).job).toMatchObject({ status: "cancelled", checked: 0, total: 2 });
    expect(reading).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("fences a paused owner inside the result transaction and leaves a newer lease untouched", async () => {
    const target = await file("One.nes", "abc");
    const newerOwner = "12345678-1234-1234-1234-123456789abc";
    service = new DeviceIntegrityService(fixture.client, { connect, beforeResultWrite: async () => {
      await fixture.client.jobLease.update({ where: { resource: `files:${deviceId}` }, data: { owner: newerOwner, expiresAt: BigInt(Date.now() + 90000) } });
    } });
    const job = await service.start(deviceId, {});
    await service.wait(job.id);
    expect((await service.snapshot(job.id)).job).toMatchObject({ status: "interrupted", checked: 0 });
    expect(await fixture.client.integrityResult.count()).toBe(0);
    expect((await fixture.client.deviceFile.findUniqueOrThrow({ where: { id: target.id } })).sha256).toBeNull();
    expect(await fixture.client.jobLease.findUnique({ where: { resource: `files:${deviceId}` } })).toMatchObject({ owner: newerOwner });
  });

  it("rejects an unavailable admission store before credentials or connections", async () => {
    await file("One.nes", "abc");
    const decrypt = vi.fn((value: string) => value);
    service = new DeviceIntegrityService(fixture.client, { connect, decrypt });
    vi.spyOn(fixture.client, "$transaction").mockRejectedValueOnce(new Error("Own simulated store failure"));
    await expect(service.start(deviceId, {})).rejects.toMatchObject({ status: 503 });
    expect(connect).not.toHaveBeenCalled(); expect(decrypt).not.toHaveBeenCalled();
    expect(await fixture.client.integrityJob.count()).toBe(0);
  });

  it("marks legacy running jobs without a captured namespace owner interrupted", async () => {
    const store = new AdmissionStore(fixture.client);
    const namespace = await store.acquire("device-files");
    const local = await store.acquire(`files:${deviceId}`);
    try {
      const legacy = await fixture.client.integrityJob.create({ data: { deviceId, status: "running", owner: local.owner, createdAt: new Date() } });
      expect((await service.snapshot(legacy.id)).job.status).toBe("interrupted");
      expect((await fixture.client.integrityJob.findUniqueOrThrow({ where: { id: legacy.id } })).status).toBe("running");
    } finally { await local.release(); await namespace.release(); }
  });

  it("fences namespace takeover during result commit even while its device lease remains owned", async () => {
    const target = await file("One.nes", "abc");
    const newOwner = "12345678-1234-4234-8234-123456789abc";
    service = new DeviceIntegrityService(fixture.client, { connect, beforeResultWrite: async () => {
      await fixture.client.jobLease.update({ where: { resource: "device-files" }, data: { owner: newOwner, expiresAt: BigInt(Date.now() + 90000) } });
    } });
    const job = await service.start(deviceId, {}); await service.wait(job.id);
    expect((await service.snapshot(job.id)).job).toMatchObject({ status: "interrupted", checked: 0 });
    expect(await fixture.client.integrityResult.count()).toBe(0);
    expect((await fixture.client.deviceFile.findUniqueOrThrow({ where: { id: target.id } })).sha256).toBeNull();
    expect(await fixture.client.jobLease.findUnique({ where: { resource: "device-files" } })).toMatchObject({ owner: newOwner });
  });

  it("never writes false terminal success after losing namespace ownership at the completion boundary", async () => {
    await file("One.nes", "abc");
    service = new DeviceIntegrityService(fixture.client, { connect, beforeCompleteWrite: async () => {
      await fixture.client.jobLease.update({ where: { resource: "device-files" }, data: { owner: "12345678-1234-4234-8234-123456789abc", expiresAt: BigInt(Date.now() + 90000) } });
    } });
    const job = await service.start(deviceId, {}); await service.wait(job.id);
    expect((await service.snapshot(job.id)).job).toMatchObject({ status: "interrupted", checked: 1, total: 1 });
    expect(await fixture.client.integrityJob.findUnique({ where: { id: job.id } })).toMatchObject({ status: "running", completedAt: null });
    expect(await fixture.client.integrityResult.count()).toBe(1);
  });

  it("blocks a different device ID that aliases the same physical root before credentials or another connection", async () => {
    const target = await file("One.nes", "abc");
    const alias = await fixture.client.device.create({ data: { name: "Same-root alias", protocol: "local", host: "", user: "", password: "", scanPaths: JSON.stringify([{ path: romRoot, type: "rom" }]) } });
    const original = await fixture.client.deviceFile.findUniqueOrThrow({ where: { id: target.id } });
    await fixture.client.deviceFile.create({ data: { deviceId: alias.id, path: target.path, scanRoot: romRoot, platformAlias: original.platformAlias, relativePath: original.relativePath,
      platform: original.platform, source: "rom", kind: "file", size: original.size, modifiedAt: original.modifiedAt, generation: "own" } });
    const native = await createConnection({ protocol: "local", host: "", user: "", password: "", port: 0 });
    const read = native.fileIo!.readTo.bind(native.fileIo);
    let started!: () => void; let resume!: () => void;
    const begun = new Promise<void>((resolve) => { started = resolve; });
    const resumed = new Promise<void>((resolve) => { resume = resolve; });
    vi.spyOn(native.fileIo!, "readTo").mockImplementation(async (...args) => { started(); await resumed; return read(...args); });
    connect.mockResolvedValue(native);
    const first = await service.start(deviceId, {}); await begun;
    try {
      await expect(service.start(alias.id, {})).rejects.toMatchObject({ status: 409 });
      expect(connect).toHaveBeenCalledTimes(1);
    } finally { resume(); await service.wait(first.id); }
    expect((await service.snapshot(first.id)).job.status).toBe("completed");
  });
});
