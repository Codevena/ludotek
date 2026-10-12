import { mkdtemp, mkdir, readFile, rm, readdir, writeFile, stat, utimes, realpath, rename, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Device } from "@prisma/client";
import { Client } from "basic-ftp";
import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { createConnection, type DeviceConnection, type FileIo } from "@/lib/connection";
import { capability, type FileIoCapabilities } from "@/lib/file-io";
import { applyFilePlan, createFilePlan, createSaveRestorePlan, undoFilePlan, reconcileFilePlan, getFilePlan, assertFilePlanSpace, type FilePlanOptions } from "@/lib/file-plans";
import { createDeviceSyncPlan, applyDeviceSyncPlan } from "@/lib/device-profile-sync";
import { receiveUpload, processUploadThroughJournal, UPLOAD_BASE } from "@/lib/upload-journal";
import { loadUploadSession } from "@/lib/disc-inputs";
import { prepareSaveRestore, backupDeviceSave } from "@/lib/device-saves";
import { AdmissionStore, EnrichmentJob, AdmissionError } from "@/lib/job-admission";
import { FtpFileIo } from "@/lib/ftp-file-io";
import { createTestDatabase } from "../helpers/temp-database";
import { ftpWireServer, type FtpWireServer, type FtpWireOptions } from "../helpers/ftp-wire-server";
import { startSshWireServer } from "../helpers/ssh-wire-server";

// This policy regression double deliberately has no writer/native identity.
// Transport acceptance is exercised separately with the real wire fixtures.
describe("read-only source journal policy", () => {
  let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
  let sandbox: string;
  let devices: Device[];
  let sourceBytes: Buffer;
  let options: FilePlanOptions;
  let mutation: ReturnType<typeof vi.fn<() => Promise<never>>>;
  beforeAll(async () => { fixture = await createTestDatabase(); });
  afterAll(async () => { await fixture.cleanup(); });
  beforeEach(async () => {
    sandbox = await mkdtemp(path.join(tmpdir(), "ludotek-readonly-policy-"));
    await mkdir(path.join(sandbox, "local"));
    vi.stubEnv("LOCAL_FILES_ROOTS", JSON.stringify([path.join(sandbox, "local")]));
    vi.stubEnv("LOCAL_FILES_ROOT", "");
    vi.stubEnv("DATABASE_URL", fixture.url);
    sourceBytes = Buffer.from("OWN"); mutation = vi.fn(async () => { throw new Error("read-only source mutation"); });
    devices = [];
    for (const [protocol, root] of [["ssh", "/roms"], ["local", path.join(sandbox, "local")]]) {
      const device = await fixture.client.device.create({ data: { name: "Policy fixture", protocol, host: "", user: "", password: "", scanPaths: JSON.stringify([{ path: root, type: "rom" }]) } });
      devices.push(device); await fixture.client.deviceInventory.create({ data: { deviceId: device.id, complete: true, generation: "policy" } });
    }
    await fixture.client.deviceFile.create({ data: { deviceId: devices[0].id, path: "/roms/own.nes", scanRoot: "/roms", platformAlias: "", relativePath: "own.nes", kind: "file", source: "rom", size: BigInt(3), generation: "policy" } });
    const caps: FileIoCapabilities = Object.fromEntries(["readStream", "exclusiveTemp", "publishNoReplace", "renameNoReplace", "fileFlush", "directoryFlush", "freeBytes"].map((name) => [name, capability(name === "readStream" ? "supported" : "unsupported", "read-only fixture")])) as unknown as FileIoCapabilities;
    const io: FileIo = { capabilities: async () => caps,
      lstat: async (name) => { if (name !== "/roms/own.nes") throw Object.assign(new Error("missing"), { code: "ENOENT" }); return { size: sourceBytes.length, type: "file", isDirectory: false }; },
      readTo: async (_name, destination) => { for await (const chunk of Readable.from(sourceBytes)) destination.write(chunk); destination.end(); return { bytes: sourceBytes.length }; },
      freeBytes: async () => ({ state: "unknown", reason: "read-only" }),
      writeExclusiveTempFrom: mutation, publishFileNoReplace: mutation, renameNoReplace: mutation, flushDirectory: mutation, flushFile: mutation };
    const readOnly = { fileIo: io, disconnect() {} } as unknown as DeviceConnection;
    options = { db: fixture.client, connect: async (device) => device.id === devices[0].id ? readOnly : createConnection({ ...device, protocol: "local" }), ioTimeoutMs: 1000, totalTimeoutMs: 10000 };
  });
  afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); await rm(sandbox, { recursive: true, force: true }); });
  const request = () => new Request("http://localhost/api/file-plans", { method: "POST" });
  const preview = () => createFilePlan({ kind: "copy", operations: [{ deviceId: devices[0].id, filePath: "/roms/own.nes", targetDeviceId: devices[1].id, newPath: path.join(sandbox, "local/own.nes") }] }, request(), options);
  it("copies content-bound read-only sources without demanding any source write or flush", async () => {
    const plan = await preview();
    expect(await readdir(path.join(sandbox, "local"))).toEqual([]);
    expect(await applyFilePlan(plan.id, request(), options)).toMatchObject({ status: "applied" });
    expect(await readFile(path.join(sandbox, "local/own.nes"), "utf8")).toBe("OWN");
    expect(mutation).not.toHaveBeenCalled();
  });
  it("checks raw source SHA even when remote size and metadata stay equal", async () => {
    const plan = await preview(); sourceBytes = Buffer.from("NEW");
    await expect(applyFilePlan(plan.id, request(), options)).rejects.toThrow(/content|changed|ownership/i);
    expect(await readdir(path.join(sandbox, "local"))).toEqual([]); expect(mutation).not.toHaveBeenCalled();
  });
  it("undoes an owned copy when its unmutated source subsequently changes", async () => {
    const plan = await preview(); await applyFilePlan(plan.id, request(), options); sourceBytes = Buffer.from("NEW");
    expect(await undoFilePlan(plan.id, request(), options)).toMatchObject({ status: "undone" });
    expect(mutation).not.toHaveBeenCalled();
  });
});

describe("actual remote journal transfers", () => {
  let db: Awaited<ReturnType<typeof createTestDatabase>>;
  let local: string;
  let server: FtpWireServer | undefined;
  let ssh: Awaited<ReturnType<typeof startSshWireServer>> | undefined;
  let devices: Device[];
  let options: FilePlanOptions;
  const clients: Client[] = [];
  const sessions: string[] = [];
  const request = () => new Request("http://localhost/api/file-plans", { method: "POST" });
  beforeAll(async () => { db = await createTestDatabase(); });
  afterAll(async () => { await db.cleanup(); });
  beforeEach(async () => {
    local = await realpath(await mkdtemp(path.join(tmpdir(), "ludotek-journal-wire-")));
    vi.stubEnv("LOCAL_FILES_ROOTS", JSON.stringify([local])); vi.stubEnv("LOCAL_FILES_ROOT", ""); vi.stubEnv("DATABASE_URL", db.url);
    devices = [];
  });
  afterEach(async () => {
    for (const client of clients.splice(0)) client.close();
    for (const session of sessions.splice(0)) await rm(path.join(UPLOAD_BASE, session), { recursive: true, force: true });
    await server?.close(); server = undefined; await ssh?.close(); ssh = undefined;
    vi.restoreAllMocks(); vi.unstubAllEnvs(); await rm(local, { recursive: true, force: true });
  });
  async function setup(wireOptions: FtpWireOptions = {}, sftp = false, sshOptions: Parameters<typeof startSshWireServer>[0] = {}) {
    if (sftp) ssh = await startSshWireServer(sshOptions); else server = await ftpWireServer(wireOptions);
    for (const [protocol, root] of [["local", local], [sftp ? "ssh" : "ftp", sftp ? ssh!.root : "/roms"]]) {
      const device = await db.client.device.create({ data: { name: "Owned wire fixture", protocol, host: "127.0.0.1", port: sftp ? ssh!.config.port : server!.port, user: "fixture", password: "fixture", ftps: Boolean(wireOptions.tls), scanPaths: JSON.stringify([{ path: root, type: "rom" }]) } });
      devices.push(device); await db.client.deviceInventory.create({ data: { deviceId: device.id, complete: true, generation: "wire" } });
    }
    options = { db: db.client, ioTimeoutMs: 3000, totalTimeoutMs: 60000, connect: async (device) => {
      if (device.protocol === "local") return createConnection({ ...device, protocol: "local" });
      if (sftp) return createConnection(ssh!.config);
      if (!wireOptions.tls) return createConnection({ ...device, protocol: "ftp" });
      const client = new Client(3000); clients.push(client);
      await client.access({ host: "127.0.0.1", port: server!.port, user: "fixture", password: "fixture", secure: wireOptions.tls, secureOptions: wireOptions.tls ? { ca: server!.ca } : undefined });
      return { fileIo: new FtpFileIo(client), disconnect: () => client.close(), listDir: async (directory: string) => (await client.list(directory)).map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory, size: entry.size })) } as unknown as DeviceConnection;
    } };
  }
  async function file(index: number, name: string, contents: string) {
    const root = index === 0 ? local : ssh?.root ?? "/roms";
    const filename = path.posix.join(root, name); const disk = index === 0 || ssh ? filename : server!.file(filename);
    await writeFile(disk, contents);
    const info = await stat(disk, { bigint: true });
    await db.client.deviceFile.create({ data: { deviceId: devices[index].id, path: filename, scanRoot: root, platformAlias: "", relativePath: name, kind: "file", source: "rom", size: BigInt(Buffer.byteLength(contents)), ...(index === 0 ? { modifiedAt: info.mtime.toISOString() } : {}), generation: "wire" } });
    return filename;
  }
  it.each([false, true])("copies and undoes a checked FTP target over verified TLS=%s with an explicit preview warning", async (tls) => {
    await setup({ tls, uniqueFacts: false }); const source = await file(0, "own.nes", "OWN");
    const plan = await createFilePlan({ kind: "copy", operations: [{ deviceId: devices[0].id, filePath: source, targetDeviceId: devices[1].id, newPath: "/roms/own.nes" }] }, request(), options);
    expect(plan).toMatchObject({ status: "ready", warningLevel: "checked_ftp" }); expect(plan.limitations?.join(" ")).toMatch(/identisch|Stromausfall/);
    expect(server!.commands.some((entry) => ["STOR", "RNTO", "MKD"].includes(entry.command))).toBe(false);
    expect(await applyFilePlan(plan.id, request(), options)).toMatchObject({ status: "applied" });
    expect(await readFile(server!.file("/roms/own.nes"), "utf8")).toBe("OWN");
    expect(await undoFilePlan(plan.id, request(), options)).toMatchObject({ status: "undone" });
    expect(await readFile(source, "utf8")).toBe("OWN");
    expect((await readdir(server!.file("/roms"))).filter((name) => !name.startsWith(".ludotek-"))).toEqual([]);
  }, 30000);
  it.each(["ftp", "sftp"])("creates and undoes only an owned empty %s directory", async (protocol) => {
    await setup({ uniqueFacts: false }, protocol === "sftp"); const filename = path.posix.join(ssh?.root ?? "/roms", "owned");
    const plan = await createFilePlan({ kind: "mkdir", operations: [{ deviceId: devices[1].id, filePath: filename }] }, request(), options);
    if (!ssh) expect(plan.warningLevel).toBe("checked_ftp");
    expect(await applyFilePlan(plan.id, request(), options)).toMatchObject({ status: "applied" });
    expect(await readdir(ssh ? filename : server!.file(filename))).toEqual(ssh ? [] : [expect.stringContaining(".ludotek-directory-receipt-")]);
    expect(await undoFilePlan(plan.id, request(), options)).toMatchObject({ status: "undone" });
    expect(await readdir(ssh?.root ?? server!.file("/roms"))).toEqual([]);
  }, 20000);
  it("copies a complete remote SFTP CUE graph to LOCAL without any source fsync or mutation", async () => {
    await setup({}, true); await file(1, "disc.bin", "TRACK");
    const cueBytes = '\uFEFFFILE "disc.bin" BINARY\r\n TRACK 01 MODE1/2352\r\n';
    const cue = await file(1, "disc.cue", cueBytes);
    const plan = await createFilePlan({ kind: "copy", operations: [{ deviceId: devices[1].id, filePath: cue, targetDeviceId: devices[0].id, newPath: path.join(local, "disc.cue") }] }, request(), options);
    expect(await applyFilePlan(plan.id, request(), options)).toMatchObject({ status: "applied" });
    expect(await readFile(path.join(local, "disc.bin"), "utf8")).toBe("TRACK");
    expect(await readFile(path.join(local, "disc.cue"), "utf8")).toBe(cueBytes);
    expect(ssh!.events.filter((event) => ["FSYNC", "WRITE", "HARDLINK", "MKDIR", "REMOVE", "RMDIR"].includes(event.op))).toEqual([]);
    await writeFile(cue, "subsequently changed source");
    expect(await undoFilePlan(plan.id, request(), options)).toMatchObject({ status: "undone" });
  }, 30000);
  it.each(["ftp", "sftp"])("renames an actual %s file through quarantine and restores its exact bytes on Undo", async (protocol) => {
    await setup({ uniqueFacts: false }, protocol === "sftp");
    const source = await file(1, "old.nes", "OWN"); const target = path.posix.join(path.posix.dirname(source), "new.nes");
    const plan = await createFilePlan({ kind: "rename", operations: [{ deviceId: devices[1].id, filePath: source, newPath: target }] }, request(), options);
    expect(await applyFilePlan(plan.id, request(), options)).toMatchObject({ status: "applied" });
    expect(await readFile(ssh ? target : server!.file(target), "utf8")).toBe("OWN");
    expect(await undoFilePlan(plan.id, request(), options)).toMatchObject({ status: "undone" });
    expect(await readFile(ssh ? source : server!.file(source), "utf8")).toBe("OWN");
  }, 30000);
  it.each(["ftp", "sftp"])("deletes to quarantine and restores exact bytes on actual %s", async (protocol) => {
    await setup({ uniqueFacts: false }, protocol === "sftp"); const source = await file(1, "own.nes", "OWN");
    const plan = await createFilePlan({ kind: "delete", operations: [{ deviceId: devices[1].id, filePath: source }] }, request(), options);
    expect(await applyFilePlan(plan.id, request(), options)).toMatchObject({ status: "applied" });
    await expect(stat(ssh ? source : server!.file(source))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await undoFilePlan(plan.id, request(), options)).toMatchObject({ status: "undone" });
    expect(await readFile(ssh ? source : server!.file(source), "utf8")).toBe("OWN");
  }, 30000);
  it("leaves a matching public FTP file as a conflict after its publication response is lost", async () => {
    await setup({ uniqueFacts: false, dropReply: "RNTO" }); const source = await file(0, "own.nes", "OWN");
    const plan = await createFilePlan({ kind: "copy", operations: [{ deviceId: devices[0].id, filePath: source, targetDeviceId: devices[1].id, newPath: "/roms/own.nes" }] }, request(), options);
    await expect(applyFilePlan(plan.id, request(), options)).rejects.toThrow();
    expect(await getFilePlan(plan.id, options)).toMatchObject({ status: "recovery_needed" });
    await expect(reconcileFilePlan(plan.id, request(), options)).rejects.toThrow(/acknowledgement|manual|ownership/i);
    expect(await readFile(server!.file("/roms/own.nes"), "utf8")).toBe("OWN");
    expect(server!.commands.filter((entry) => entry.command === "RNTO")).toHaveLength(1);
    expect(await db.client.deviceFile.count({ where: { deviceId: devices[1].id } })).toBe(0);
  }, 20000);
  it("does not adopt FTP publication when SQLite rejects the receipt after the successful effect", async () => {
    await setup({ uniqueFacts: false }); const source = await file(0, "own.nes", "OWN");
    const plan = await createFilePlan({ kind: "copy", operations: [{ deviceId: devices[0].id, filePath: source, targetDeviceId: devices[1].id, newPath: "/roms/own.nes" }] }, request(), options);
    const failing = db.client.$extends({ query: { $allModels: { async $allOperations({ model, operation, args, query }) {
      if (model === "FilePlanOperation" && operation === "update" && "data" in args && args.data && "phase" in args.data && args.data.phase === "published") throw new Error("owned SQLite publication receipt failure");
      return query(args);
    } } } }) as unknown as PrismaClient;
    const store = new AdmissionStore(db.client); const acquire = async (resource: string, req: Request) => new EnrichmentJob(await store.acquire(resource), req.signal);
    await expect(applyFilePlan(plan.id, request(), { ...options, db: failing, acquire })).rejects.toThrow();
    expect(await getFilePlan(plan.id, options)).toMatchObject({ status: "recovery_needed" });
    await expect(reconcileFilePlan(plan.id, request(), options)).rejects.toThrow(/acknowledgement|manual|ownership/i);
    expect(await readFile(server!.file("/roms/own.nes"), "utf8")).toBe("OWN");
    expect(server!.commands.filter((entry) => entry.command === "RNTO")).toHaveLength(1);
  }, 20000);
  it("rejects real FTP source edits with unchanged size and mtime before any target mutation", async () => {
    await setup({ uniqueFacts: false }); const source = await file(1, "own.nes", "OWN");
    const plan = await createFilePlan({ kind: "copy", operations: [{ deviceId: devices[1].id, filePath: source, targetDeviceId: devices[0].id, newPath: path.join(local, "own.nes") }] }, request(), options);
    const old = await stat(server!.file(source)); await writeFile(server!.file(source), "NEW"); await utimes(server!.file(source), old.atime, old.mtime);
    await expect(applyFilePlan(plan.id, request(), options)).rejects.toThrow(/content|changed|ownership/i);
    expect(await readdir(local)).toEqual([]);
    expect(server!.commands.some((entry) => ["STOR", "RNTO", "MKD"].includes(entry.command))).toBe(false);
  });
  it("refuses existing FTP targets after preview and preserves their original bytes", async () => {
    await setup({ uniqueFacts: false }); const source = await file(0, "own.nes", "OWN");
    const plan = await createFilePlan({ kind: "copy", operations: [{ deviceId: devices[0].id, filePath: source, targetDeviceId: devices[1].id, newPath: "/roms/own.nes" }] }, request(), options);
    await writeFile(server!.file("/roms/own.nes"), "foreign");
    await expect(applyFilePlan(plan.id, request(), options)).rejects.toThrow(/collision/i);
    expect(await readFile(server!.file("/roms/own.nes"), "utf8")).toBe("foreign");
    expect(server!.commands.some((entry) => ["STOR", "RNTO", "MKD"].includes(entry.command))).toBe(false);
  });
  it("permits unknown FTP capacity only at zero reserve and never invents available bytes", async () => {
    await setup(); const connection = await options.connect!(devices[1]);
    try {
      expect(await assertFilePlanSpace(connection.fileIo!, "/roms", BigInt(100), BigInt(0), "ftp")).toMatchObject({ state: "unknown" });
      await expect(assertFilePlanSpace(connection.fileIo!, "/roms", BigInt(0), BigInt(1), "ftp")).rejects.toThrow(/reserve|unknown/i);
      await expect(assertFilePlanSpace(connection.fileIo!, "/roms", BigInt(0), BigInt(0), "local")).rejects.toThrow(/reserve|unknown/i);
      expect(server!.commands.some((entry) => ["STOR", "RNTO", "MKD"].includes(entry.command))).toBe(false);
    } finally { connection.disconnect(); }
  });
  it.each(["ftp", "sftp"])("applies an actual %s profile copy and advances baselines only after readback", async (protocol) => {
    await setup({ uniqueFacts: false }, protocol === "sftp"); await file(0, "own.nes", "OWN");
    await db.client.deviceFile.updateMany({ where: { deviceId: devices[0].id }, data: { platform: "nes" } });
    for (const [index, device] of devices.entries()) await db.client.deviceProfile.create({ data: { deviceId: device.id, template: "custom", romRoots: JSON.stringify([{ path: index === 0 ? local : ssh?.root ?? "/roms", platform: "nes" }]), saveRoots: "[]", formats: JSON.stringify([".nes"]), reserveBytes: BigInt(0) } });
    const plan = await createDeviceSyncPlan({ masterDeviceId: devices[0].id, deviceId: devices[1].id, direction: "push" }, request(), options);
    expect(plan.status).toBe("ready"); expect(await applyDeviceSyncPlan(plan.id, request(), options)).toMatchObject({ status: "applied" });
    expect(await readFile(ssh ? path.join(ssh.root, "own.nes") : server!.file("/roms/own.nes"), "utf8")).toBe("OWN");
    expect(await db.client.deviceSyncBaseline.count({ where: { deviceId: devices[1].id } })).toBe(1);
  }, 20000);
  it.each(["ftp", "sftp"])("restores an immutable save to actual %s with the mandatory existing-target backup", async (protocol) => {
    await setup({ uniqueFacts: false }, protocol === "sftp"); const root = ssh?.root ?? "/roms"; const saves = path.posix.join(root, "saves"); const target = path.posix.join(saves, "own.sav");
    await mkdir(ssh ? saves : server!.file(saves));
    await db.client.deviceProfile.create({ data: { deviceId: devices[1].id, template: "custom", romRoots: JSON.stringify([{ path: root }]), saveRoots: JSON.stringify([{ path: saves, platform: "nes" }]), formats: "[]", reserveBytes: BigInt(0) } });
    const storageDirectory = path.join(local, "protected"); await mkdir(storageDirectory);
    const version = async (bytes: string) => { const sha256 = createHash("sha256").update(bytes).digest("hex"); await writeFile(path.join(storageDirectory, sha256), bytes); return db.client.saveVersion.create({ data: { deviceId: devices[1].id, deviceName: "own fixture", sourcePath: target, fileKey: "own.sav", platform: "nes", sha256, storageKey: sha256, size: BigInt(bytes.length) } }); };
    const previous = await version("previous"); const replacement = await version("restored"); await writeFile(ssh ? target : server!.file(target), "previous");
    const input = { versionId: replacement.id, targetDeviceId: devices[1].id, targetPath: target };
    await expect(createSaveRestorePlan(input, request(), { ...options, storageDirectory })).rejects.toThrow(/back.?up/i);
    const plan = await createSaveRestorePlan(input, request(), { ...options, storageDirectory, targetBackupVersionId: previous.id });
    expect(await applyFilePlan(plan.id, request(), { ...options, storageDirectory })).toMatchObject({ status: "applied" });
    expect(await readFile(ssh ? target : server!.file(target), "utf8")).toBe("restored");
    expect(await undoFilePlan(plan.id, request(), { ...options, storageDirectory })).toMatchObject({ status: "undone" });
    expect(await readFile(ssh ? target : server!.file(target), "utf8")).toBe("previous");
  }, 20000);
  async function uploadFixture(reserve = BigInt(0)) {
    const root = ssh?.root ?? "/roms"; const platform = path.posix.join(root, "psx"); await mkdir(ssh ? platform : server!.file(platform));
    await db.client.deviceProfile.create({ data: { deviceId: devices[1].id, template: "custom", romRoots: JSON.stringify([{ path: root }]), saveRoots: "[]", formats: JSON.stringify([".chd"]), reserveBytes: reserve } });
    const body = new FormData(); body.append("files", new File(["ORIGINAL"], "Own Upload.iso"));
    const received = await receiveUpload(new Request("http://localhost/api/upload", { method: "POST", body }), options); sessions.push(received.sessionId);
    const session = await loadUploadSession(received.sessionId, "psx");
    return { received, platform, input: { sessionId: received.sessionId, platform: "psx", gameIds: session.games.map((game) => game.id), deviceId: devices[1].id } };
  }
  it.each(["ftp", "sftp"])("converts and uploads through the complete actual %s journal pipeline", async (protocol) => {
    await setup({ uniqueFacts: false }, protocol === "sftp"); const upload = await uploadFixture();
    const converter = vi.fn(async (input: { outputPath: string }) => { await writeFile(input.outputPath, "CHD:OWN"); });
    const response = await processUploadThroughJournal(upload.input, request(), { ...options, converter });
    const events = (await response.text()).split("\n\n").filter(Boolean).map((line) => JSON.parse(line.slice(6)) as Record<string, unknown>);
    const success = events.find((event) => event.type === "game-done")!;
    expect(success).toMatchObject({ transferredFiles: 1, planId: expect.any(String) }); expect(converter).toHaveBeenCalledTimes(1);
    const output = path.posix.join(upload.platform, "Own Upload.chd"); expect(await readFile(ssh ? output : server!.file(output), "utf8")).toBe("CHD:OWN");
    expect(await db.client.gameDevice.count({ where: { deviceId: devices[1].id } })).toBe(1);
    expect(await undoFilePlan(success.planId as string, request(), options)).toMatchObject({ status: "undone" });
  }, 30000);
  it("rejects an unknown positive FTP reserve before conversion or transfer", async () => {
    await setup({ uniqueFacts: false }); const upload = await uploadFixture(BigInt(1)); const converter = vi.fn();
    await expect(processUploadThroughJournal(upload.input, request(), { ...options, converter })).rejects.toMatchObject({ status: 422 });
    expect(converter).not.toHaveBeenCalled(); expect(server!.commands.some((entry) => ["MKD", "STOR", "RNTO"].includes(entry.command))).toBe(false);
    expect(await db.client.gameDevice.count({ where: { deviceId: devices[1].id } })).toBe(0);
  });
  it("does not bind a catalog success after an actual FTP quota failure", async () => {
    await setup({ uniqueFacts: false, quotaBytes: 3 }); const upload = await uploadFixture();
    const response = await processUploadThroughJournal(upload.input, request(), { ...options, converter: async (input) => { await writeFile(input.outputPath, "CHD:OWN"); } });
    const body = await response.text(); expect(body).toContain('"type":"game-error"'); expect(body).not.toContain('"type":"game-done"');
    expect(await db.client.gameDevice.count({ where: { deviceId: devices[1].id } })).toBe(0);
    expect(await readFile(upload.received.files[0].path, "utf8")).toBe("ORIGINAL");
    expect(server!.commands.some((entry) => entry.command === "RNTO")).toBe(false);
  }, 20000);
  it("binds the complete FTP descriptor graph and rejects a same-size unselected descriptor edit before staging", async () => {
    await setup({ uniqueFacts: false }); const track = await file(1, "disc.bin", "TRACK");
    const bytes = 'FILE "disc.bin" BINARY\r\n TRACK 01 MODE1/2352\r\n'; const cue = await file(1, "disc.cue", bytes);
    const plan = await createFilePlan({ kind: "copy", operations: [{ deviceId: devices[1].id, filePath: track, targetDeviceId: devices[0].id, newPath: path.join(local, "disc.bin") }] }, request(), options);
    const prior = await stat(server!.file(cue)); await writeFile(server!.file(cue), bytes.replace("TRACK 01", "TRACK 02")); await utimes(server!.file(cue), prior.atime, prior.mtime);
    await expect(applyFilePlan(plan.id, request(), options)).rejects.toThrow(/content|changed|ownership/i);
    expect(await readdir(local)).toEqual([]); expect(server!.commands.some((entry) => ["MKD", "STOR", "RNTO"].includes(entry.command))).toBe(false);
  });
  it("preserves an unacknowledged FTP directory after a lost MKD response", async () => {
    await setup({ uniqueFacts: false, dropReply: "MKD" });
    const plan = await createFilePlan({ kind: "mkdir", operations: [{ deviceId: devices[1].id, filePath: "/roms/uncertain" }] }, request(), options);
    await expect(applyFilePlan(plan.id, request(), options)).rejects.toThrow();
    expect(await getFilePlan(plan.id, options)).toMatchObject({ status: "recovery_needed" });
    await expect(reconcileFilePlan(plan.id, request(), options)).rejects.toThrow(/ownership|unknown|changed/i);
    expect((await stat(server!.file("/roms/uncertain"))).isDirectory()).toBe(true); expect(server!.commands.some((entry) => entry.command === "RMD")).toBe(false);
  });
  it("connects to no remote server when admission denies the shared device lease", async () => {
    await setup({ uniqueFacts: false }); const source = await file(0, "own.nes", "OWN"); const connect = vi.fn(options.connect!);
    await expect(createFilePlan({ kind: "copy", operations: [{ deviceId: devices[0].id, filePath: source, targetDeviceId: devices[1].id, newPath: "/roms/own.nes" }] }, request(), { ...options, connect, acquire: async () => { throw new AdmissionError(409, "owned denied lease"); } })).rejects.toThrow(/denied/i);
    expect(connect).not.toHaveBeenCalled(); expect(server!.commands).toEqual([]);
  });
  it("rejects Undo when a confirmed FTP publication disappears without a recorded Undo", async () => {
    await setup({ uniqueFacts: false }); const source = await file(0, "own.nes", "OWN");
    const plan = await createFilePlan({ kind: "copy", operations: [{ deviceId: devices[0].id, filePath: source, targetDeviceId: devices[1].id, newPath: "/roms/own.nes" }] }, request(), options);
    await applyFilePlan(plan.id, request(), options); await rename(server!.file("/roms/own.nes"), server!.file("/roms/external.nes"));
    await expect(undoFilePlan(plan.id, request(), options)).rejects.toThrow(/recorded|disappear|conflict/i);
    expect(await readFile(server!.file("/roms/external.nes"), "utf8")).toBe("OWN");
  });
  it("preserves changed FTP output on Undo without issuing another rename", async () => {
    await setup({ uniqueFacts: false }); const source = await file(0, "own.nes", "OWN");
    const plan = await createFilePlan({ kind: "copy", operations: [{ deviceId: devices[0].id, filePath: source, targetDeviceId: devices[1].id, newPath: "/roms/own.nes" }] }, request(), options);
    await applyFilePlan(plan.id, request(), options); const prior = await stat(server!.file("/roms/own.nes"));
    await writeFile(server!.file("/roms/own.nes"), "NEW"); await utimes(server!.file("/roms/own.nes"), prior.atime, prior.mtime);
    await expect(undoFilePlan(plan.id, request(), options)).rejects.toThrow(/content|changed|ownership/i);
    expect(await readFile(server!.file("/roms/own.nes"), "utf8")).toBe("NEW"); expect(server!.commands.filter((entry) => entry.command === "RNTO")).toHaveLength(1);
  });
  it("preserves an identical foreign native SFTP replacement on Undo", async () => {
    await setup({}, true); const source = await file(0, "own.nes", "OWN"); const target = path.join(ssh!.root, "own.nes");
    const plan = await createFilePlan({ kind: "copy", operations: [{ deviceId: devices[0].id, filePath: source, targetDeviceId: devices[1].id, newPath: target }] }, request(), options);
    await applyFilePlan(plan.id, request(), options); const prior = await stat(target);
    await rename(target, path.join(ssh!.root, "native-original.nes")); await writeFile(target, "OWN"); await utimes(target, prior.atime, prior.mtime);
    await expect(undoFilePlan(plan.id, request(), options)).rejects.toThrow(/content|identity|ownership|changed/i); expect(await readFile(target, "utf8")).toBe("OWN");
  });
  it("copies from an actual read-only SFTP server without SSH native metadata", async () => {
    await setup({}, true, { refuseExec: true }); const source = await file(1, "own.nes", "OWN");
    const plan = await createFilePlan({ kind: "copy", operations: [{ deviceId: devices[1].id, filePath: source, targetDeviceId: devices[0].id, newPath: path.join(local, "own.nes") }] }, request(), options);
    expect(await applyFilePlan(plan.id, request(), options)).toMatchObject({ status: "applied" }); expect(await readFile(path.join(local, "own.nes"), "utf8")).toBe("OWN");
    expect(ssh!.events.filter((event) => ["FSYNC", "WRITE", "HARDLINK", "MKDIR", "REMOVE", "RMDIR"].includes(event.op))).toEqual([]);
  });
  it("preserves a later foreign file inside an acknowledged FTP directory", async () => {
    await setup({ uniqueFacts: false }); const plan = await createFilePlan({ kind: "mkdir", operations: [{ deviceId: devices[1].id, filePath: "/roms/owned" }] }, request(), options);
    await applyFilePlan(plan.id, request(), options); await writeFile(server!.file("/roms/owned/foreign.nes"), "FOREIGN");
    await expect(undoFilePlan(plan.id, request(), options)).rejects.toThrow(/empty|directory/i); expect(await readFile(server!.file("/roms/owned/foreign.nes"), "utf8")).toBe("FOREIGN");
    expect(server!.commands.some((entry) => entry.command === "RMD" || entry.command === "DELE")).toBe(false);
  });
  it("prepares a restore to a missing actual SFTP target through the save consumer", async () => {
    await setup({}, true); const target = path.join(ssh!.root, "new.sav");
    await db.client.deviceProfile.create({ data: { deviceId: devices[1].id, template: "custom", romRoots: JSON.stringify([{ path: ssh!.root }]), saveRoots: JSON.stringify([{ path: ssh!.root, platform: "nes" }]), formats: "[]", reserveBytes: BigInt(0) } });
    const storageDirectory = path.join(local, "protected"); await mkdir(storageDirectory); const bytes = "SAVE"; const sha256 = createHash("sha256").update(bytes).digest("hex"); await writeFile(path.join(storageDirectory, sha256), bytes);
    const version = await db.client.saveVersion.create({ data: { deviceId: devices[1].id, deviceName: "own", sourcePath: target, fileKey: "new.sav", platform: "nes", sha256, storageKey: sha256, size: BigInt(bytes.length) } });
    const restore = await prepareSaveRestore({ versionId: version.id, targetDeviceId: devices[1].id, targetPath: target }, request(), { ...options, storageDirectory });
    expect(restore.targetBackupVersionId).toBeNull(); expect(await applyFilePlan(restore.plan.id, request(), { ...options, storageDirectory })).toMatchObject({ status: "applied" });
    expect(await readFile(target, "utf8")).toBe("SAVE");
  });
  it("refuses a profile source whose SFTP parent resolves outside its declared root before reading bytes", async () => {
    await setup({}, true); const filename = path.join(ssh!.root, "escape/foreign.nes");
    await writeFile(path.join(ssh!.outside, "foreign.nes"), "FOREIGN"); await symlink(ssh!.outside, path.join(ssh!.root, "escape"));
    const info = await stat(path.join(ssh!.outside, "foreign.nes"));
    await db.client.deviceFile.create({ data: { deviceId: devices[1].id, path: filename, scanRoot: ssh!.root, platformAlias: "", relativePath: "escape/foreign.nes", kind: "file", source: "rom", platform: "nes", size: BigInt(7), modifiedAt: new Date(Math.floor(info.mtimeMs / 1000) * 1000).toISOString(), generation: "wire" } });
    for (const [index, device] of devices.entries()) await db.client.deviceProfile.create({ data: { deviceId: device.id, template: "custom", romRoots: JSON.stringify([{ path: index === 0 ? local : ssh!.root, platform: "nes" }]), saveRoots: "[]", formats: "[]", reserveBytes: BigInt(0) } });
    await expect(createDeviceSyncPlan({ masterDeviceId: devices[0].id, deviceId: devices[1].id, direction: "pull" }, request(), options)).rejects.toThrow();
    expect(ssh!.events.filter((event) => event.op === "READ")).toEqual([]);
  });
  it("refuses an escaped SFTP save before its protected backup can read or store bytes", async () => {
    await setup({}, true); await writeFile(path.join(ssh!.outside, "foreign.sav"), "FOREIGN"); await symlink(ssh!.outside, path.join(ssh!.root, "escape"));
    await db.client.deviceProfile.create({ data: { deviceId: devices[1].id, template: "custom", romRoots: JSON.stringify([{ path: ssh!.root }]), saveRoots: JSON.stringify([{ path: ssh!.root, platform: "nes" }]), formats: "[]", reserveBytes: BigInt(0) } });
    const storageDirectory = path.join(local, "protected"); await mkdir(storageDirectory);
    await expect(backupDeviceSave({ deviceId: devices[1].id, filePath: path.join(ssh!.root, "escape/foreign.sav") }, request(), { ...options, storageDirectory })).rejects.toThrow();
    expect(ssh!.events.filter((event) => event.op === "READ")).toEqual([]); expect(await readdir(storageDirectory)).toEqual([]);
    expect(await db.client.saveVersion.count({ where: { deviceId: devices[1].id } })).toBe(0);
  });
  it("refuses an ordinary ROM copy to unknown FTP capacity with a configured positive reserve before any mutation", async () => {
    await setup({ uniqueFacts: false }); const source = await file(0, "own.nes", "OWN");
    await db.client.deviceProfile.create({ data: { deviceId: devices[1].id, template: "custom", romRoots: JSON.stringify([{ path: "/roms" }]), saveRoots: "[]", formats: "[]", reserveBytes: BigInt(1) } });
    await expect(createFilePlan({ kind: "copy", operations: [{ deviceId: devices[0].id, filePath: source, targetDeviceId: devices[1].id, newPath: "/roms/own.nes" }] }, request(), options)).rejects.toThrow(/reserve|unknown/i);
    expect(server!.commands.some((entry) => ["MKD", "STOR", "RNTO"].includes(entry.command))).toBe(false);
    expect(await readFile(source, "utf8")).toBe("OWN"); expect(await readdir(server!.file("/roms"))).toEqual([]);
  });
  it("refuses a checked FTP mkdir receipt at unknown capacity with a configured positive reserve before any mutation", async () => {
    await setup({ uniqueFacts: false });
    await db.client.deviceProfile.create({ data: { deviceId: devices[1].id, template: "custom", romRoots: JSON.stringify([{ path: "/roms" }]), saveRoots: "[]", formats: "[]", reserveBytes: BigInt(1) } });
    await expect(createFilePlan({ kind: "mkdir", operations: [{ deviceId: devices[1].id, filePath: "/roms/owned" }] }, request(), options)).rejects.toThrow(/reserve|unknown/i);
    expect(server!.commands.some((entry) => ["MKD", "STOR", "RNTO"].includes(entry.command))).toBe(false);
    expect(await readdir(server!.file("/roms"))).toEqual([]);
  });
});
