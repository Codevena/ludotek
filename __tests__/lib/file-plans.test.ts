import { mkdtemp, mkdir, readdir, readFile, rm, stat, writeFile, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { createHash, randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Device } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { AdmissionStore, EnrichmentJob } from "@/lib/job-admission";
import { createTestDatabase } from "../helpers/temp-database";
import { createConnection } from "@/lib/connection";
import { applyFilePlan, createFilePlan, createSaveRestorePlan, createUploadFilePlan, getFilePlan, getFilePlanFingerprints, getUploadSourceReleaseProof, reconcileFilePlan, undoFilePlan, type FilePlanOptions } from "@/lib/file-plans";

let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
let sandbox: string;
let roots: string[];
let devices: Device[];
let options: FilePlanOptions;
let uploadDirectory: string | undefined;
const request = () => new Request("http://localhost/api/file-plans", { method: "POST" });
beforeAll(async () => { fixture = await createTestDatabase(); });
afterAll(async () => { await fixture.cleanup(); });
beforeEach(async () => {
  sandbox = await mkdtemp(path.join(tmpdir(), "ludotek-file-plans-"));
  roots = [path.join(sandbox, "master"), path.join(sandbox, "deck")];
  for (const root of roots) await mkdir(root);
  vi.stubEnv("LOCAL_FILES_ROOT", "");
  vi.stubEnv("LOCAL_FILES_ROOTS", JSON.stringify(roots));
  vi.stubEnv("DATABASE_URL", fixture.url);
  devices = [];
  for (const [index, root] of roots.entries()) {
    const device = await fixture.client.device.create({ data: { name: `Plan ${index}`, protocol: "local", host: "", user: "", password: "", scanPaths: JSON.stringify([{ path: root, type: "rom" }]) } });
    devices.push(device);
    await fixture.client.deviceInventory.create({ data: { deviceId: device.id, generation: "fixture", complete: true } });
  }
  options = { db: fixture.client, connect: (device) => createConnection({ ...device, protocol: "local" }), ioTimeoutMs: 1000, totalTimeoutMs: 10000 };
});
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); if (uploadDirectory) { await rm(uploadDirectory, { recursive: true, force: true }); uploadDirectory = undefined; } await rm(sandbox, { recursive: true, force: true }); });

async function file(index: number, name: string, contents: string, gameId?: number) {
  const filename = path.join(roots[index], name);
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, contents);
  const info = await stat(filename, { bigint: true });
  await fixture.client.deviceFile.create({ data: { deviceId: devices[index].id, path: filename, gameId, scanRoot: roots[index], platformAlias: "", relativePath: name, source: "rom", kind: "file", size: BigInt(info.size), modifiedAt: info.mtime.toISOString(), generation: "fixture" } });
  return filename;
}
async function saveFixture(contents: string, deviceId: number | null = null, sourcePath = "/former-device/own.sav") {
  const storageDirectory = path.join(sandbox, "protected-save-store");
  await mkdir(storageDirectory, { recursive: true });
  const sha256 = createHash("sha256").update(contents).digest("hex");
  await writeFile(path.join(storageDirectory, sha256), contents, { flag: "wx" });
  const version = await fixture.client.saveVersion.create({ data: { deviceId, deviceName: "Former private device", gameId: 999999, gameTitle: "Former game", fileKey: "own.sav", sourcePath, sha256, size: BigInt(Buffer.byteLength(contents)), storageKey: sha256 } });
  return { version, storageDirectory };
}
async function saveRoot() {
  const directory = path.join(roots[0], "save-data"); await mkdir(directory);
  await fixture.client.deviceProfile.create({ data: { deviceId: devices[0].id, template: "custom", romRoots: JSON.stringify([{ path: roots[0] }]), saveRoots: JSON.stringify([{ path: directory, platform: "snes" }]), formats: JSON.stringify([".nes"]), reserveBytes: BigInt(0) } });
  return directory;
}
async function uploadSource(filename: string, contents: string) {
  if (!uploadDirectory) {
    const base = "/tmp/ludotek-uploads"; await mkdir(base, { recursive: true });
    const sessionId = `file-plan-own-${randomUUID()}`; uploadDirectory = path.join(base, sessionId); await mkdir(uploadDirectory);
  }
  const pathname = path.join(uploadDirectory, filename); await writeFile(pathname, contents, { flag: "wx" });
  const info = await stat(pathname, { bigint: true });
  return fixture.client.uploadFileSource.create({ data: { sessionId: path.basename(uploadDirectory), path: pathname, filename, platform: "psx", sha256: createHash("sha256").update(contents).digest("hex"), size: info.size, identity: `${info.dev}:${info.ino}`, modifiedAt: info.mtime.toISOString() } });
}

describe("durable verified file plans", () => {
  it("creates a read-only server-derived preview then copies, persists the manifest and undoes without deleting bytes", async () => {
    const source = await file(0, "Toy.nes", "own ROM");
    const target = path.join(roots[1], "Toy.nes");
    const plan = await createFilePlan({ kind: "copy", operations: [{ deviceId: devices[0].id, filePath: source, targetDeviceId: devices[1].id, newPath: target }] }, request(), options);
    expect(plan).toMatchObject({ status: "ready", totalBytes: "7" });
    expect(await readdir(roots[1])).toEqual([]);
    expect(JSON.stringify(plan)).not.toContain("identity");
    expect(await applyFilePlan(plan.id, request(), options)).toMatchObject({ status: "applied" });
    expect(await readFile(target, "utf8")).toBe("own ROM");
    expect(await fixture.client.deviceFile.findUnique({ where: { deviceId_path: { deviceId: devices[1].id, path: plan.operations[0].targetPath! } } })).toMatchObject({ size: BigInt(7) });
    expect(await undoFilePlan(plan.id, request(), options)).toMatchObject({ status: "undone" });
    expect(await readFile(source, "utf8")).toBe("own ROM");
    expect(await readdir(roots[1])).toEqual([expect.stringContaining(".ludotek-")]);
    expect(await getFilePlan(plan.id, options)).toMatchObject({ status: "undone" });
  });
  it("rewrites a CUE track rename with exact quotes and restores all original bytes/references on undo", async () => {
    const track = await file(0, "disc old.bin", "TRACK");
    const original = '\uFEFFFILE "disc old.bin" BINARY\r\n  TRACK 01 MODE1/2352\r\n';
    const cue = await file(0, "Toy.cue", original);
    const target = path.join(roots[0], "disc new.bin");
    const plan = await createFilePlan({ kind: "rename", operations: [{ deviceId: devices[0].id, filePath: track, newPath: target }] }, request(), options);
    expect(plan.operations).toHaveLength(2);
    expect(await applyFilePlan(plan.id, request(), options)).toMatchObject({ status: "applied" });
    expect(await readFile(cue, "utf8")).toBe(original.replace("disc old.bin", "disc new.bin"));
    expect(await readFile(target, "utf8")).toBe("TRACK");
    expect(await undoFilePlan(plan.id, request(), options)).toMatchObject({ status: "undone" });
    expect(await readFile(cue, "utf8")).toBe(original);
    expect(await readFile(track, "utf8")).toBe("TRACK");
  });
  it("copies an absolute M3U set to another device with complete dependencies and relative target references", async () => {
    const track = await file(0, "Toy.chd", "CHD");
    const m3u = await file(0, "Toy.m3u", `# own playlist\n${track}\n`);
    const target = path.join(roots[1], "Toy.m3u");
    const plan = await createFilePlan({ kind: "copy", operations: [{ deviceId: devices[0].id, filePath: m3u, targetDeviceId: devices[1].id, newPath: target }] }, request(), options);
    expect(plan.operations).toHaveLength(2);
    await applyFilePlan(plan.id, request(), options);
    expect(await readFile(target, "utf8")).toBe("# own playlist\nToy.chd\n");
    expect(await readFile(path.join(roots[1], "Toy.chd"), "utf8")).toBe("CHD");
    expect(await readFile(m3u, "utf8")).toContain(track);
  });
  it("rejects wrong game binding, unconfirmed legacy files and protected paths with zero file writes", async () => {
    const game = await fixture.client.game.create({ data: { title: "Own", originalFile: "Own.nes", platform: "nes", platformLabel: "NES" } });
    const filename = await file(0, "Own.nes", "ROM", game.id);
    const connect = vi.fn(options.connect!);
    for (const operation of [
      { deviceId: devices[0].id, filePath: filename, gameId: game.id + 100000 },
      { deviceId: devices[1].id, filePath: filename },
      { deviceId: devices[0].id, filePath: path.join(roots[0], "legacy.nes") },
      { deviceId: devices[0].id, filePath: path.join(roots[0], ".ludotek-foreign") },
    ]) await expect(createFilePlan({ kind: "delete", operations: [operation] }, request(), { ...options, connect })).rejects.toThrow();
    expect(connect).not.toHaveBeenCalled();
    expect(await readdir(roots[0])).toEqual(["Own.nes"]);
  });
  it("rejects unresolved or escaping descriptor references before any temp/quarantine write", async () => {
    const cue = await file(0, "Broken.cue", 'FILE "../outside.bin" BINARY\n TRACK 01 MODE1/2352\n');
    await expect(createFilePlan({ kind: "delete", operations: [{ deviceId: devices[0].id, filePath: cue }] }, request(), options)).rejects.toThrow(/descriptor|reference|root/i);
    expect(await readdir(roots[0])).toEqual(["Broken.cue"]);
  });
  it("does not overwrite a target created after preview, even when its bytes equal our source", async () => {
    const source = await file(0, "Toy.nes", "ROM");
    const target = path.join(roots[1], "Toy.nes");
    const plan = await createFilePlan({ kind: "copy", operations: [{ deviceId: devices[0].id, filePath: source, targetDeviceId: devices[1].id, newPath: target }] }, request(), options);
    await writeFile(target, "ROM");
    await expect(applyFilePlan(plan.id, request(), options)).rejects.toThrow(/collision|target|exists/i);
    expect(await readFile(target, "utf8")).toBe("ROM");
    expect(await readFile(source, "utf8")).toBe("ROM");
  });
  it("refuses undo/reconcile ownership of an identical foreign replacement", async () => {
    const source = await file(0, "Toy.nes", "ROM");
    const target = path.join(roots[1], "Toy.nes");
    const plan = await createFilePlan({ kind: "copy", operations: [{ deviceId: devices[0].id, filePath: source, targetDeviceId: devices[1].id, newPath: target }] }, request(), options);
    await applyFilePlan(plan.id, request(), options);
    // Keep the old inode occupied, ensuring the replacement is a different object.
    const { rename } = await import("node:fs/promises");
    const prior = await stat(target, { bigint: true });
    await rename(target, path.join(roots[1], "native-own-backup.nes"));
    await writeFile(target, "ROM");
    await utimes(target, prior.mtime, prior.mtime);
    await expect(undoFilePlan(plan.id, request(), options)).rejects.toThrow(/identity|ownership|changed|conflict/i);
    await expect(reconcileFilePlan(plan.id, request(), options)).rejects.toThrow(/identity|ownership|changed|conflict/i);
    expect(await readFile(target, "utf8")).toBe("ROM");
  });
  it("rejects a changed source even when size, path, inode and visible mtime match its immutable preview", async () => {
    const source = await file(0, "Toy.nes", "old");
    const target = path.join(roots[1], "Toy.nes");
    const plan = await createFilePlan({ kind: "copy", operations: [{ deviceId: devices[0].id, filePath: source, targetDeviceId: devices[1].id, newPath: target }] }, request(), options);
    const prior = await stat(source, { bigint: true });
    await writeFile(source, "new"); await utimes(source, prior.mtime, prior.mtime);
    await expect(applyFilePlan(plan.id, request(), options)).rejects.toThrow(/content|changed|identity/i);
    expect(await readdir(roots[1])).toEqual([]);
    expect(await readFile(source, "utf8")).toBe("new");
  });
  it("replaces only an explicitly server-selected confirmed target, preserving its bytes and restoring them on Undo", async () => {
    const source = await file(0, "Toy.nes", "new version");
    const target = await file(1, "Toy.nes", "old version");
    const replacementOptions = { ...options, replaceTargets: [{ deviceId: devices[1].id, path: target }] };
    const plan = await createFilePlan({ kind: "copy", operations: [{ deviceId: devices[0].id, filePath: source, targetDeviceId: devices[1].id, newPath: target }] }, request(), replacementOptions);
    expect(plan.operations).toHaveLength(2);
    await applyFilePlan(plan.id, request(), options);
    expect(await readFile(target, "utf8")).toBe("new version");
    await undoFilePlan(plan.id, request(), options);
    expect(await readFile(target, "utf8")).toBe("old version");
    expect(await readFile(source, "utf8")).toBe("new version");
  });
  it("recovers a crash after publication from the durable staged identity without claiming false completion", async () => {
    const source = await file(0, "Toy.nes", "ROM");
    const target = path.join(roots[1], "Toy.nes");
    const plan = await createFilePlan({ kind: "copy", operations: [{ deviceId: devices[0].id, filePath: source, targetDeviceId: devices[1].id, newPath: target }] }, request(), options);
    let offline = false;
    const crashDb = fixture.client.$extends({ query: { $allModels: { async $allOperations({ model, operation, args, query }) {
      if (model === "FilePlanOperation" && operation === "update" && "data" in args && args.data && "phase" in args.data && args.data.phase === "published") offline = true;
      if (offline) throw new Error("injected unavailable store");
      return query(args);
    } } } }) as unknown as PrismaClient;
    const store = new AdmissionStore(fixture.client);
    const acquire = async (resource: string, req: Request) => new EnrichmentJob(await store.acquire(resource), req.signal);
    await expect(applyFilePlan(plan.id, request(), { ...options, db: crashDb, acquire })).rejects.toThrow();
    expect(await getFilePlan(plan.id, options)).toMatchObject({ status: "applying" });
    expect(await readFile(target, "utf8")).toBe("ROM");
    expect(await reconcileFilePlan(plan.id, request(), options)).toMatchObject({ status: "ready" });
    expect(await readdir(roots[1])).toEqual([expect.stringContaining(".ludotek-")]);
    expect(await readFile(source, "utf8")).toBe("ROM");
    await applyFilePlan(plan.id, request(), options);
    expect(await readFile(target, "utf8")).toBe("ROM");
  });
  it("compensates a failure after track publication and restores descriptor bytes and references", async () => {
    const track = await file(0, "old.bin", "TRACK");
    const original = 'FILE "old.bin" BINARY\n TRACK 01 MODE1/2352\n';
    const cue = await file(0, "Toy.cue", original);
    const target = path.join(roots[0], "new.bin");
    const plan = await createFilePlan({ kind: "rename", operations: [{ deviceId: devices[0].id, filePath: track, newPath: target }] }, request(), options);
    let fail = true;
    const connect = async (device: Device) => {
      const connection = await options.connect!(device);
      const io = connection.fileIo!;
      const publish = io.publishFileNoReplace.bind(io);
      io.publishFileNoReplace = async (temp, filename) => {
        if (filename.endsWith("Toy.cue") && fail) { fail = false; throw new Error("injected publish failure"); }
        await publish(temp, filename);
      };
      return connection;
    };
    await expect(applyFilePlan(plan.id, request(), { ...options, connect })).rejects.toThrow();
    expect(await readFile(cue, "utf8")).toBe(original);
    expect(await readFile(track, "utf8")).toBe("TRACK");
    expect(await getFilePlan(plan.id, options)).toMatchObject({ status: "ready" });
    await expect(readFile(target)).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("borrows parent device leases without releasing them before baseline owners finish", async () => {
    const source = await file(0, "Toy.nes", "ROM");
    const target = path.join(roots[1], "Toy.nes");
    const store = new AdmissionStore(fixture.client);
    const { acquireDeviceFiles } = await import("@/lib/device-jobs");
    const parent = await acquireDeviceFiles(devices.map((device) => device.id), request(), async (resource, req) => new EnrichmentJob(await store.acquire(resource), req.signal));
    try {
      const heldJobs = { deviceIds: devices.map((device) => device.id), jobs: parent };
      const plan = await createFilePlan({ kind: "copy", operations: [{ deviceId: devices[0].id, filePath: source, targetDeviceId: devices[1].id, newPath: target }] }, request(), { ...options, heldJobs });
      await expect(store.acquire(`files:${devices[0].id}`)).rejects.toMatchObject({ status: 409 });
      await applyFilePlan(plan.id, request(), { ...options, heldJobs });
      await expect(store.acquire(`files:${devices[1].id}`)).rejects.toMatchObject({ status: 409 });
    } finally { await parent.close(); }
    const next = await store.acquire(`files:${devices[0].id}`); await next.release();
  });
  it("keeps actual cross-client device leases held until an aborted transport finishes draining", async () => {
    const { PrismaClient } = await import("@prisma/client");
    const second = new PrismaClient({ datasourceUrl: fixture.url });
    const store = new AdmissionStore(second);
    const source = await file(0, "Toy.nes", "ROM");
    const target = path.join(roots[1], "Toy.nes");
    const plan = await createFilePlan({ kind: "copy", operations: [{ deviceId: devices[0].id, filePath: source, targetDeviceId: devices[1].id, newPath: target }] }, request(), options);
    let entered!: () => void; let releaseDrain!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const drain = new Promise<void>((resolve) => { releaseDrain = resolve; });
    const connect = async (device: Device) => {
      const connection = await options.connect!(device);
      if (device.id === devices[0].id) {
        const io = connection.fileIo!; const read = io.readTo.bind(io);
        io.readTo = async (filename, destination, limits) => {
          if (destination instanceof PassThrough) { entered(); await drain; if (limits.signal?.aborted) throw new Error("transport aborted after drain"); }
          return read(filename, destination, limits);
        };
      }
      return connection;
    };
    const abort = new AbortController();
    const pending = applyFilePlan(plan.id, new Request("http://localhost/api/file-plans", { method: "POST", signal: abort.signal }), { ...options, connect });
    const outcome = expect(pending).rejects.toThrow();
    try {
      await started; abort.abort();
      await expect(store.acquire(`files:${devices[1].id}`)).rejects.toMatchObject({ status: 409 });
      releaseDrain(); await outcome;
      const next = await store.acquire(`files:${devices[1].id}`); await next.release();
      expect(await getFilePlan(plan.id, options)).toMatchObject({ status: "recovery_needed" });
      expect(await readFile(source, "utf8")).toBe("ROM");
    } finally { releaseDrain(); await second.$disconnect(); }
  });
  it("previews and journals mkdir, then undoes only its own still-empty directory", async () => {
    const directory = path.join(roots[0], "new-folder");
    const plan = await createFilePlan({ kind: "mkdir", operations: [{ deviceId: devices[0].id, filePath: directory }] }, request(), options);
    expect(plan).toMatchObject({ status: "ready", totalBytes: "0" });
    await expect(stat(directory)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await applyFilePlan(plan.id, request(), options)).toMatchObject({ status: "applied" });
    expect((await stat(directory)).isDirectory()).toBe(true);
    expect(await undoFilePlan(plan.id, request(), options)).toMatchObject({ status: "undone" });
    await expect(stat(directory)).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("refuses mkdir Undo when the created directory contains later user bytes", async () => {
    const directory = path.join(roots[0], "new-folder");
    const plan = await createFilePlan({ kind: "mkdir", operations: [{ deviceId: devices[0].id, filePath: directory }] }, request(), options);
    await applyFilePlan(plan.id, request(), options);
    await writeFile(path.join(directory, "user.nes"), "foreign later bytes");
    await expect(undoFilePlan(plan.id, request(), options)).rejects.toThrow(/empty|recovery|directory/i);
    expect(await readFile(path.join(directory, "user.nes"), "utf8")).toBe("foreign later bytes");
  });
  it("never removes a foreign empty directory that replaced the created directory", async () => {
    const directory = path.join(roots[0], "new-folder");
    const plan = await createFilePlan({ kind: "mkdir", operations: [{ deviceId: devices[0].id, filePath: directory }] }, request(), options);
    await applyFilePlan(plan.id, request(), options);
    const { rename } = await import("node:fs/promises");
    await rename(directory, path.join(roots[0], "native-original")); await mkdir(directory);
    await expect(undoFilePlan(plan.id, request(), options)).rejects.toThrow(/ownership|changed/i);
    expect((await stat(directory)).isDirectory()).toBe(true);
    expect((await stat(path.join(roots[0], "native-original"))).isDirectory()).toBe(true);
  });
  it("compensates prior owned empty directories when a later mkdir races with a foreign collision", async () => {
    const first = path.join(roots[0], "first-folder");
    const second = path.join(roots[0], "second-folder");
    const plan = await createFilePlan({ kind: "mkdir", operations: [{ deviceId: devices[0].id, filePath: first }, { deviceId: devices[0].id, filePath: second }] }, request(), options);
    const connect = async (device: Device) => {
      const connection = await options.connect!(device); const io = connection.fileIo!;
      const create = io.createDirectoryNoReplace!.bind(io);
      io.createDirectoryNoReplace = async (filename) => {
        if (filename.endsWith("second-folder")) { await mkdir(filename); await writeFile(path.join(filename, "foreign.nes"), "foreign bytes"); }
        return create(filename);
      };
      return connection;
    };
    await expect(applyFilePlan(plan.id, request(), { ...options, connect })).rejects.toThrow();
    await expect(stat(first)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(path.join(second, "foreign.nes"), "utf8")).toBe("foreign bytes");
    expect(await getFilePlan(plan.id, options)).toMatchObject({ status: "ready" });
  });
  it("restores a protected immutable save without requiring its deleted original device/game or a ROM inventory", async () => {
    const directory = await saveRoot();
    await fixture.client.deviceInventory.delete({ where: { deviceId: devices[0].id } });
    const { version, storageDirectory } = await saveFixture("immutable save");
    const target = path.join(directory, "own.sav");
    const saveOptions = { ...options, storageDirectory };
    const plan = await createSaveRestorePlan({ versionId: version.id, targetDeviceId: devices[0].id, targetPath: target }, request(), saveOptions);
    expect(plan).toMatchObject({ kind: "save_restore", status: "ready" });
    expect(JSON.stringify(plan)).not.toContain(storageDirectory);
    await applyFilePlan(plan.id, request(), saveOptions);
    expect(await readFile(target, "utf8")).toBe("immutable save");
    expect(await getFilePlanFingerprints(plan.id, saveOptions)).toEqual([{ deviceId: devices[0].id, path: plan.operations[0].targetPath, sha256: version.sha256, size: "14" }]);
    expect(await fixture.client.deviceFile.count({ where: { deviceId: devices[0].id } })).toBe(0);
    await undoFilePlan(plan.id, request(), saveOptions);
    await expect(readFile(target)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(path.join(storageDirectory, version.storageKey), "utf8")).toBe("immutable save");
  });
  it("requires an exact immutable current-target backup and restores original save bytes on Undo", async () => {
    const directory = await saveRoot(); const target = path.join(directory, "own.sav"); await writeFile(target, "current save");
    const restored = await saveFixture("earlier save");
    const previous = await saveFixture("current save", devices[0].id, target);
    const saveOptions = { ...options, storageDirectory: restored.storageDirectory };
    await expect(createSaveRestorePlan({ versionId: restored.version.id, targetDeviceId: devices[0].id, targetPath: target }, request(), saveOptions)).rejects.toThrow(/backup|back up/i);
    const plan = await createSaveRestorePlan({ versionId: restored.version.id, targetDeviceId: devices[0].id, targetPath: target }, request(), { ...saveOptions, targetBackupVersionId: previous.version.id });
    expect(plan.operations).toHaveLength(2);
    await applyFilePlan(plan.id, request(), saveOptions);
    expect(await readFile(target, "utf8")).toBe("earlier save");
    await undoFilePlan(plan.id, request(), saveOptions);
    expect(await readFile(target, "utf8")).toBe("current save");
    expect(await fixture.client.saveVersion.findUnique({ where: { id: previous.version.id } })).not.toBeNull();
  });
  it("does not widen save target roots or permit a protected source through ordinary client file-plan input", async () => {
    await saveRoot(); const { version, storageDirectory } = await saveFixture("save");
    await expect(createSaveRestorePlan({ versionId: version.id, targetDeviceId: devices[0].id, targetPath: path.join(roots[0], "outside-save-root.sav") }, request(), { ...options, storageDirectory })).rejects.toThrow(/root/i);
    await expect(createFilePlan({ kind: "copy", operations: [{ deviceId: devices[0].id, filePath: path.join(storageDirectory, version.storageKey), newPath: path.join(roots[0], "arbitrary.nes") }] }, request(), options)).rejects.toThrow(/confirmed|association/i);
    expect(await readdir(roots[0])).toEqual(["save-data"]);
  });
  it("rejects a corrupted protected save before any target write", async () => {
    const directory = await saveRoot(); const { version, storageDirectory } = await saveFixture("save");
    await writeFile(path.join(storageDirectory, version.storageKey), "corrupt");
    await expect(createSaveRestorePlan({ versionId: version.id, targetDeviceId: devices[0].id, targetPath: path.join(directory, "own.sav") }, request(), { ...options, storageDirectory })).rejects.toThrow();
    expect(await readdir(directory)).toEqual([]);
  });
  it("updates actual GameDevice representatives and keeps the link while any confirmed physical revision remains", async () => {
    const game = await fixture.client.game.create({ data: { title: "Linked", originalFile: "Shared representative.nes", platform: "nes", platformLabel: "NES" } });
    const source = await file(0, "Own.nes", "ROM", game.id); const revision = await file(0, "Own Rev 2.nes", "revision", game.id);
    const target = path.join(roots[1], "Actual copied name.nes");
    const copy = await createFilePlan({ kind: "copy", operations: [{ deviceId: devices[0].id, filePath: source, gameId: game.id, targetDeviceId: devices[1].id, newPath: target }] }, request(), options);
    await applyFilePlan(copy.id, request(), options);
    expect(await fixture.client.gameDevice.findUnique({ where: { gameId_deviceId: { gameId: game.id, deviceId: devices[1].id } } })).toMatchObject({ originalFile: "Actual copied name.nes" });
    const remove = await createFilePlan({ kind: "delete", operations: [{ deviceId: devices[0].id, filePath: source, gameId: game.id }] }, request(), options);
    await applyFilePlan(remove.id, request(), options);
    expect(await fixture.client.gameDevice.findUnique({ where: { gameId_deviceId: { gameId: game.id, deviceId: devices[0].id } } })).toMatchObject({ originalFile: "Own Rev 2.nes" });
    expect(await readFile(revision, "utf8")).toBe("revision");
    await undoFilePlan(remove.id, request(), options);
    expect(await fixture.client.gameDevice.findUnique({ where: { gameId_deviceId: { gameId: game.id, deviceId: devices[0].id } } })).not.toBeNull();
    await undoFilePlan(copy.id, request(), options);
    expect(await fixture.client.gameDevice.findUnique({ where: { gameId_deviceId: { gameId: game.id, deviceId: devices[1].id } } })).toBeNull();
    expect((await fixture.client.game.findUnique({ where: { id: game.id } }))?.originalFile).toBe("Shared representative.nes");
  });
  it("rewrites GDI track moves and restores original references on Undo", async () => {
    const track = await file(0, "old track.bin", "TRACK");
    const original = '1\n1 0 4 2352 "old track.bin" 0\n'; const gdi = await file(0, "Toy.gdi", original);
    const directory = path.join(roots[0], "tracks"); await mkdir(directory);
    const target = path.join(directory, "new track.bin");
    const plan = await createFilePlan({ kind: "move", operations: [{ deviceId: devices[0].id, filePath: track, newPath: target }] }, request(), options);
    await applyFilePlan(plan.id, request(), options);
    expect(await readFile(gdi, "utf8")).toBe(original.replace("old track.bin", "tracks/new track.bin"));
    expect(await readFile(target, "utf8")).toBe("TRACK");
    await undoFilePlan(plan.id, request(), options); expect(await readFile(gdi, "utf8")).toBe(original); expect(await readFile(track, "utf8")).toBe("TRACK");
  });
  it("fences a journal write when another real SQLite client takes the lease after a successful pre-transaction assertion", async () => {
    const { PrismaClient } = await import("@prisma/client"); const second = new PrismaClient({ datasourceUrl: fixture.url });
    const { acquireDeviceFiles } = await import("@/lib/device-jobs"); const store = new AdmissionStore(fixture.client);
    const source = await file(0, "Toy.nes", "ROM"); const target = path.join(roots[1], "Toy.nes");
    const parent = await acquireDeviceFiles(devices.map((device) => device.id), request(), async (resource, req) => new EnrichmentJob(await store.acquire(resource), req.signal));
    let published = false; let stolen = false;
    const jobs = { signal: parent.signal, close: async () => {}, assertOwned: parent.assertOwned!.bind(parent), async assertActive() {
      await parent.assertActive();
      if (published && !stolen) { stolen = true; await second.jobLease.update({ where: { resource: `files:${devices[1].id}` }, data: { owner: "foreign-fixture-owner", expiresAt: BigInt(Date.now() + 90000) } }); }
    } };
    const heldJobs = { deviceIds: devices.map((device) => device.id), jobs };
    try {
      const plan = await createFilePlan({ kind: "copy", operations: [{ deviceId: devices[0].id, filePath: source, targetDeviceId: devices[1].id, newPath: target }] }, request(), { ...options, heldJobs });
      const connect = async (device: Device) => {
        const connection = await options.connect!(device); const io = connection.fileIo!; const publish = io.publishFileNoReplace.bind(io);
        io.publishFileNoReplace = async (temp, filename) => { await publish(temp, filename); published = true; }; return connection;
      };
      await expect(applyFilePlan(plan.id, request(), { ...options, heldJobs, connect })).rejects.toThrow();
      const saved = await getFilePlan(plan.id, options);
      expect(saved.status).toBe("applying"); expect(saved.operations[0].phase).toBe("publish_intent");
      expect(await fixture.client.deviceFile.findUnique({ where: { deviceId_path: { deviceId: devices[1].id, path: saved.operations[0].targetPath! } } })).toBeNull();
      expect(await readFile(source, "utf8")).toBe("ROM");
    } finally {
      await parent.close(); await second.jobLease.deleteMany({ where: { resource: `files:${devices[1].id}`, owner: "foreign-fixture-owner" } }); await second.$disconnect();
    }
  });
  it("publishes a closed upload CUE/track/M3U set and can Undo after the original cache is released", async () => {
    await fixture.client.deviceInventory.delete({ where: { deviceId: devices[1].id } });
    const track = await uploadSource("old track.bin", "TRACK");
    const cue = await uploadSource("Toy.cue", 'FILE "old track.bin" BINARY\n TRACK 01 MODE1/2352\n');
    const cueTarget = path.join(roots[1], "Toy.cue");
    const m3u = await uploadSource("Toy.m3u", `# own playlist\n${cueTarget}\n`);
    const trackTarget = path.join(roots[1], "new track.bin"); const m3uTarget = path.join(roots[1], "Toy.m3u");
    const plan = await createUploadFilePlan({ targetDeviceId: devices[1].id, sources: [{ sourceId: track.id, targetPath: trackTarget }, { sourceId: cue.id, targetPath: cueTarget }, { sourceId: m3u.id, targetPath: m3uTarget }] }, request(), options);
    expect(JSON.stringify(plan)).not.toContain("/tmp/ludotek-uploads"); expect(await readdir(roots[1])).toEqual([]);
    await applyFilePlan(plan.id, request(), options);
    expect(await readFile(trackTarget, "utf8")).toBe("TRACK"); expect(await readFile(cueTarget, "utf8")).toContain('FILE "new track.bin"'); expect(await readFile(m3uTarget, "utf8")).toBe("# own playlist\nToy.cue\n");
    const paths = await fixture.client.deviceFile.findMany({ where: { deviceId: devices[1].id } }); expect(paths).toHaveLength(3); expect(paths.every((file) => file.gameId === null && file.platform === "psx" && file.sha256)).toBe(true);
    expect(await getUploadSourceReleaseProof(plan.id, options)).toMatchObject({ releasable: true, blockingPlanIds: [] });
    await fixture.client.uploadFileSource.updateMany({ where: { id: { in: [track.id, cue.id, m3u.id] } }, data: { released: true } });
    await rm(uploadDirectory!, { recursive: true }); uploadDirectory = undefined;
    expect(await reconcileFilePlan(plan.id, request(), options)).toMatchObject({ status: "applied" });
    await undoFilePlan(plan.id, request(), options);
    expect(await fixture.client.deviceFile.count({ where: { deviceId: devices[1].id } })).toBe(0);
    expect((await readdir(roots[1])).every((filename) => filename.startsWith(".ludotek-"))).toBe(true);
  });
  it("rejects an unknown positive upload ID before connecting to a target or touching its cache", async () => {
    const connect = vi.fn(options.connect!);
    await expect(createUploadFilePlan({ targetDeviceId: devices[1].id, sources: [{ sourceId: randomUUID(), targetPath: path.join(roots[1], "Toy.chd") }] }, request(), { ...options, connect })).rejects.toThrow(/missing|unconfirmed|source/i);
    expect(connect).not.toHaveBeenCalled(); expect(await readdir(roots[1])).toEqual([]);
  });
  it("requires every upload descriptor dependency in the closed source mapping", async () => {
    const cue = await uploadSource("Toy.cue", 'FILE "missing.bin" BINARY\n TRACK 01 MODE1/2352\n');
    await expect(createUploadFilePlan({ targetDeviceId: devices[1].id, sources: [{ sourceId: cue.id, targetPath: path.join(roots[1], "Toy.cue") }] }, request(), options)).rejects.toThrow(/dependency|closed|descriptor/i);
    expect(await readdir(roots[1])).toEqual([]);
  });
  it("refuses changed or released upload cache bodies before target writes", async () => {
    const source = await uploadSource("Toy.chd", "old"); const target = path.join(roots[1], "Toy.chd");
    const plan = await createUploadFilePlan({ targetDeviceId: devices[1].id, sources: [{ sourceId: source.id, targetPath: target }] }, request(), options);
    const prior = await stat(source.path, { bigint: true }); await writeFile(source.path, "new"); await utimes(source.path, prior.mtime, prior.mtime);
    await expect(applyFilePlan(plan.id, request(), options)).rejects.toThrow(); expect(await readdir(roots[1])).toEqual([]);
    await fixture.client.uploadFileSource.update({ where: { id: source.id }, data: { released: true } });
    await expect(applyFilePlan(plan.id, request(), options)).rejects.toThrow(); expect(await readdir(roots[1])).toEqual([]);
  });
  it("blocks upload source release while any other bound plan is pending", async () => {
    const source = await uploadSource("Toy.chd", "CHD");
    const first = await createUploadFilePlan({ targetDeviceId: devices[1].id, sources: [{ sourceId: source.id, targetPath: path.join(roots[1], "first.chd") }] }, request(), options);
    const second = await createUploadFilePlan({ targetDeviceId: devices[1].id, sources: [{ sourceId: source.id, targetPath: path.join(roots[1], "second.chd") }] }, request(), options);
    await applyFilePlan(first.id, request(), options);
    expect(await getUploadSourceReleaseProof(first.id, options)).toMatchObject({ releasable: false, blockingPlanIds: [second.id] });
    await expect(getUploadSourceReleaseProof(second.id, options)).rejects.toThrow(/terminal|release/i);
    await applyFilePlan(second.id, request(), options); expect(await getUploadSourceReleaseProof(first.id, options)).toMatchObject({ releasable: true });
  });
});
