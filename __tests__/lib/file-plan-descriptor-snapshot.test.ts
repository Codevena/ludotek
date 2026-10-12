import { mkdtemp, mkdir, readFile, readdir, realpath, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Device } from "@prisma/client";
import { createConnection } from "@/lib/connection";
import { applyFilePlan, createFilePlan, type FilePlanOptions } from "@/lib/file-plans";
import { createTestDatabase } from "../helpers/temp-database";

const FIXED_TIME = new Date("2026-03-01T12:00:00.000Z");
const cueFor = (track: string) => `FILE "${track}" BINARY\n TRACK 01 MODE1/2352\n`;
let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
let sandbox: string;
let root: string;
let device: Device;
let options: FilePlanOptions;
const request = () => new Request("http://localhost/api/file-plans", { method: "POST" });
beforeAll(async () => { fixture = await createTestDatabase(); });
afterAll(async () => { await fixture.cleanup(); });
beforeEach(async () => {
  sandbox = await mkdtemp(path.join(tmpdir(), "ludotek-descriptor-snapshot-"));
  root = path.join(await realpath(sandbox), "roms"); await mkdir(root);
  vi.stubEnv("LOCAL_FILES_ROOT", root); vi.stubEnv("LOCAL_FILES_ROOTS", ""); vi.stubEnv("DATABASE_URL", fixture.url);
  device = await fixture.client.device.create({ data: { name: "Own descriptor snapshot", protocol: "local", host: "", user: "", password: "", scanPaths: JSON.stringify([{ path: root, type: "rom" }]) } });
  await fixture.client.deviceInventory.create({ data: { deviceId: device.id, generation: "own-complete", complete: true } });
  options = { db: fixture.client, connect: (entry) => createConnection({ ...entry, protocol: "local" }), ioTimeoutMs: 1000, totalTimeoutMs: 10000 };
});
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); await rm(sandbox, { recursive: true, force: true }); });
async function file(name: string, contents: string) {
  const filename = path.join(root, name); await writeFile(filename, contents); await utimes(filename, FIXED_TIME, FIXED_TIME);
  const actual = await stat(filename, { bigint: true });
  await fixture.client.deviceFile.create({ data: { deviceId: device.id, path: filename, scanRoot: root, platformAlias: "", relativePath: name, platform: "psx", source: "rom", kind: "file", size: actual.size, modifiedAt: actual.mtime.toISOString(), generation: "own-complete" } });
  return filename;
}
async function editPreservingMetadata(filename: string, contents: string) {
  const before = await stat(filename, { bigint: true });
  await writeFile(filename, contents); await utimes(filename, FIXED_TIME, FIXED_TIME);
  const after = await stat(filename, { bigint: true });
  expect(after.ino).toBe(before.ino); expect(after.dev).toBe(before.dev); expect(after.size).toBe(before.size);
  expect(after.mtime.toISOString()).toBe(before.mtime.toISOString());
}
function countTemps() {
  const write = vi.fn();
  const connect = async (entry: Device) => {
    const connection = await options.connect!(entry); const io = connection.fileIo!; const actual = io.writeExclusiveTempFrom.bind(io);
    io.writeExclusiveTempFrom = async (...args) => { write(); return actual(...args); };
    return connection;
  };
  return { write, connect };
}

describe("immutable whole-descriptor graph preconditions", () => {
  it("rejects a same-inode/same-size/fixed-mtime edit just after the real bounded descriptor read without persisting stale payload", async () => {
    const trackA = await file("trackA.bin", "AAA"); await file("trackB.bin", "BBB");
    const cue = await file("Toy.cue", cueFor("trackA.bin"));
    const beforePlans = await fixture.client.filePlan.count(); const temps = countTemps(); let edited = false;
    const connect = async (entry: Device) => {
      const connection = await temps.connect(entry); const io = connection.fileIo!; const read = io.readTo.bind(io);
      io.readTo = async (...args) => {
        const result = await read(...args);
        if (args[0] === cue && !edited) { edited = true; await editPreservingMetadata(cue, cueFor("trackB.bin")); }
        return result;
      };
      return connection;
    };
    await expect(createFilePlan({ kind: "rename", operations: [{ deviceId: device.id, filePath: trackA, newPath: path.join(root, "renamed.bin") }] }, request(), { ...options, connect })).rejects.toThrow(/descriptor|content|changed|snapshot|identity/i);
    expect(edited).toBe(true); expect(await readFile(cue, "utf8")).toBe(cueFor("trackB.bin"));
    expect(await fixture.client.filePlan.count()).toBe(beforePlans); expect(temps.write).not.toHaveBeenCalled();
    expect((await readdir(root)).filter((entry) => entry.startsWith(".ludotek-"))).toEqual([]);
  });
  it("rejects a formerly unselected descriptor that newly references the selected track after preview, before any exclusive temp write", async () => {
    const trackA = await file("trackA.bin", "AAA"); await file("trackB.bin", "BBB"); const cue = await file("Toy.cue", cueFor("trackB.bin"));
    const plan = await createFilePlan({ kind: "rename", operations: [{ deviceId: device.id, filePath: trackA, newPath: path.join(root, "renamed.bin") }] }, request(), options);
    expect(plan.operations).toHaveLength(1);
    await editPreservingMetadata(cue, cueFor("trackA.bin")); const temps = countTemps();
    await expect(applyFilePlan(plan.id, request(), { ...options, connect: temps.connect })).rejects.toThrow(/descriptor|content|changed|snapshot|identity/i);
    expect(temps.write).not.toHaveBeenCalled(); expect(await readFile(trackA, "utf8")).toBe("AAA"); expect(await readFile(cue, "utf8")).toBe(cueFor("trackA.bin"));
    expect((await readdir(root)).filter((entry) => entry.startsWith(".ludotek-"))).toEqual([]);
  });
  it("rejects changed source bytes with exactly equal path/inode/size/visible mtime BEFORE the first exclusive temp, independently of staged-hash rejection", async () => {
    const source = await file("Toy.bin", "old");
    const plan = await createFilePlan({ kind: "copy", operations: [{ deviceId: device.id, filePath: source, newPath: path.join(root, "Copy.bin") }] }, request(), options);
    await editPreservingMetadata(source, "new"); const temps = countTemps();
    await expect(applyFilePlan(plan.id, request(), { ...options, connect: temps.connect })).rejects.toThrow();
    expect(temps.write).not.toHaveBeenCalled(); expect(await readFile(source, "utf8")).toBe("new");
    expect((await readdir(root)).filter((entry) => entry.startsWith(".ludotek-"))).toEqual([]);
  });
  it("captures an explicit empty graph and refuses a legacy ready preview with missing graph metadata", async () => {
    const source = await file("Toy.bin", "ROM");
    const plan = await createFilePlan({ kind: "rename", operations: [{ deviceId: device.id, filePath: source, newPath: path.join(root, "New.bin") }] }, request(), options);
    const stored = await fixture.client.filePlan.findUniqueOrThrow({ where: { id: plan.id } }); const states = JSON.parse(stored.deviceState);
    expect(states.find((state: { id: number }) => state.id === device.id).descriptorGraph).toEqual({ version: 1, files: [] });
    for (const state of states) delete state.descriptorGraph;
    await fixture.client.filePlan.update({ where: { id: plan.id }, data: { deviceState: JSON.stringify(states) } });
    const temps = countTemps();
    await expect(applyFilePlan(plan.id, request(), { ...options, connect: temps.connect })).rejects.toThrow(/descriptor|snapshot|preview|legacy/i);
    expect(temps.write).not.toHaveBeenCalled(); expect(await readFile(source, "utf8")).toBe("ROM");
  });
  it("refuses a newly confirmed parent added to a previously empty graph before Apply can write", async () => {
    const source = await file("Toy.bin", "ROM");
    const plan = await createFilePlan({ kind: "rename", operations: [{ deviceId: device.id, filePath: source, newPath: path.join(root, "New.bin") }] }, request(), options);
    const cue = await file("New parent.cue", cueFor("Toy.bin")); const temps = countTemps();
    await expect(applyFilePlan(plan.id, request(), { ...options, connect: temps.connect })).rejects.toThrow(/descriptor|graph|changed|snapshot/i);
    expect(temps.write).not.toHaveBeenCalled(); expect(await readFile(cue, "utf8")).toBe(cueFor("Toy.bin")); expect(await readFile(source, "utf8")).toBe("ROM");
  });
});
