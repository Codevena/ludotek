import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Device } from "@prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDatabase } from "../helpers/temp-database";
import { createConnection } from "@/lib/connection";
import { AdmissionStore, EnrichmentJob } from "@/lib/job-admission";
import { saveDeviceProfile } from "@/lib/device-profiles";
import { applyDeviceSyncPlan, createDeviceSyncPlan, type DeviceSyncOptions } from "@/lib/device-profile-sync";
import { applyFilePlan, createFilePlan, getFilePlan } from "@/lib/file-plans";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
let sandbox: string;
let roots: string[];
let devices: Device[];
let options: DeviceSyncOptions;
const request = () => new Request("http://fixture.invalid", { method: "POST" });
beforeAll(async () => { fixture = await createTestDatabase(); });
afterAll(async () => { await fixture.cleanup(); });
beforeEach(async () => {
  sandbox = await mkdtemp(path.join(tmpdir(), "ludotek-profile-sync-"));
  roots = [];
  for (const name of ["master", "device"]) { await mkdir(path.join(sandbox, name)); roots.push(await realpath(path.join(sandbox, name))); }
  vi.stubEnv("LOCAL_FILES_ROOT", undefined); vi.stubEnv("LOCAL_FILES_ROOTS", JSON.stringify(roots)); vi.stubEnv("DATABASE_URL", fixture.url);
  const store = new AdmissionStore(fixture.client);
  const acquire = async (resource: string, request: Request) => new EnrichmentJob(await store.acquire(resource), request.signal);
  options = { db: fixture.client, acquire, connect: (device) => createConnection({ ...device, protocol: "local" }), ioTimeoutMs: 1000, totalTimeoutMs: 10000 };
  devices = [];
  for (const root of roots) {
    for (const platform of ["snes", "psx"]) await mkdir(path.join(root, platform));
    const device = await fixture.client.device.create({ data: { name: "Own profile device", protocol: "local", host: "localhost", port: 0, user: "", password: "", scanPaths: JSON.stringify([{ path: root, type: "rom" }]) } });
    devices.push(device);
    await fixture.client.deviceInventory.create({ data: { deviceId: device.id, generation: "own-generation", complete: true } });
    await saveDeviceProfile(device.id, { template: "custom", romRoots: [{ path: root }], saveRoots: [], formats: [".sfc", ".chd", ".m3u"], reserveBytes: "0" }, request(), options);
  }
});
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); await rm(sandbox, { recursive: true }); });
async function file(index: number, name: string, contents: string, platform = "snes") {
  const filename = path.join(roots[index], platform, name); await writeFile(filename, contents);
  const metadata = await stat(filename, { bigint: true });
  await fixture.client.deviceFile.upsert({ where: { deviceId_path: { deviceId: devices[index].id, path: filename } },
    create: { deviceId: devices[index].id, path: filename, scanRoot: roots[index], platformAlias: platform, relativePath: name, platform, source: "rom", kind: "file", size: BigInt(metadata.size), modifiedAt: metadata.mtime.toISOString(), generation: "own-generation" },
    update: { size: BigInt(metadata.size), modifiedAt: metadata.mtime.toISOString(), sha256: null } });
  return filename;
}
const input = (direction = "two-way") => ({ masterDeviceId: devices[0].id, deviceId: devices[1].id, direction });

describe("complete profile preview/apply/content-baseline flow", () => {
  it("copies new ROMs through the actual common journal and advances a verified paired baseline", async () => {
    await file(0, "Toy.sfc", "ROM-own");
    const fixtureOptions = { ...options, acquire: undefined };
    const plan = await createDeviceSyncPlan(input("push"), request(), fixtureOptions);
    expect(plan.status).toBe("ready"); expect(plan.plans).toHaveLength(1);
    await expect(readFile(path.join(roots[1], "snes/Toy.sfc"))).rejects.toThrow();
    expect(await applyDeviceSyncPlan(plan.id, request(), fixtureOptions)).toMatchObject({ status: "applied" });
    expect(await readFile(path.join(roots[1], "snes/Toy.sfc"), "utf8")).toBe("ROM-own");
    const baseline = await fixture.client.deviceSyncBaseline.findFirstOrThrow({ where: { masterDeviceId: devices[0].id, deviceId: devices[1].id } });
    const fingerprints = JSON.parse(baseline.fingerprint);
    expect(fingerprints.master).toEqual(fingerprints.device);
    expect((await createDeviceSyncPlan(input(), request(), options)).summary.rows[0].action).toBe("equal");
  });
  it("pulls a new device file and follows only the side changed since the verified two-way baseline", async () => {
    await file(1, "Toy.sfc", "device first");
    const pull = await createDeviceSyncPlan(input("pull"), request(), options);
    expect(pull.summary.rows[0].action).toBe("copy-device");
    await applyDeviceSyncPlan(pull.id, request(), options);
    expect(await readFile(path.join(roots[0], "snes/Toy.sfc"), "utf8")).toBe("device first");
    await file(1, "Toy.sfc", "device changed");
    const fromDevice = await createDeviceSyncPlan(input(), request(), options);
    expect(fromDevice.summary.rows[0].action).toBe("copy-device");
    await applyDeviceSyncPlan(fromDevice.id, request(), options);
    expect(await readFile(path.join(roots[0], "snes/Toy.sfc"), "utf8")).toBe("device changed");
    await file(0, "Toy.sfc", "master changed");
    const fromMaster = await createDeviceSyncPlan(input(), request(), options);
    expect(fromMaster.summary.rows[0].action).toBe("copy-master");
    await applyDeviceSyncPlan(fromMaster.id, request(), options);
    expect(await readFile(path.join(roots[1], "snes/Toy.sfc"), "utf8")).toBe("master changed");
  });
  it("surfaces initial differences and both-edited conflicts, then applies only explicit winner selection with quarantine", async () => {
    await file(0, "Toy.sfc", "master version"); await file(1, "Toy.sfc", "device version");
    const conflict = await createDeviceSyncPlan(input(), request(), options);
    expect(conflict.status).toBe("conflict"); expect(conflict.plans).toEqual([]);
    await expect(applyDeviceSyncPlan(conflict.id, request(), options)).rejects.toMatchObject({ status: 409 });
    const resolved = await createDeviceSyncPlan({ ...input(), resolutions: { "snes|Toy.sfc": "master" } }, request(), options);
    const common = await getFilePlan(resolved.plans[0], options);
    expect(common.operations.some((operation) => operation.kind === "delete")).toBe(true);
    await applyDeviceSyncPlan(resolved.id, request(), options);
    expect(await readFile(path.join(roots[1], "snes/Toy.sfc"), "utf8")).toBe("master version");
    await file(0, "Toy.sfc", "master edit2"); await file(1, "Toy.sfc", "device edit2");
    expect(await createDeviceSyncPlan(input(), request(), options)).toMatchObject({ status: "conflict" });
  });
  it("uses per-side baseline hashes for legitimate absolute M3U target rewrites", async () => {
    const track = await file(0, "Disc.chd", "CHD-own", "psx");
    await file(0, "Game.m3u", `${track}\n`, "psx");
    const preview = await createDeviceSyncPlan(input("push"), request(), options);
    await applyDeviceSyncPlan(preview.id, request(), options);
    expect(await readFile(path.join(roots[1], "psx/Game.m3u"), "utf8")).toBe("Disc.chd\n");
    const baseline = await fixture.client.deviceSyncBaseline.findUniqueOrThrow({ where: { masterDeviceId_deviceId_fileKey: { masterDeviceId: devices[0].id, deviceId: devices[1].id, fileKey: "psx|Game.m3u" } } });
    const hashes = JSON.parse(baseline.fingerprint);
    expect(hashes.master.sha256).not.toBe(hashes.device.sha256);
    const next = await createDeviceSyncPlan(input(), request(), options);
    expect(next.summary.rows.every((row) => row.action === "equal")).toBe(true);
  });
  it("rejects unknown/insufficient capacity and incomplete manifests before any write or journal creation", async () => {
    await file(0, "Toy.sfc", "own ROM");
    await fixture.client.deviceProfile.update({ where: { deviceId: devices[1].id }, data: { reserveBytes: BigInt(Number.MAX_SAFE_INTEGER) } });
    const create = vi.fn(createFilePlan);
    await expect(createDeviceSyncPlan(input("push"), request(), { ...options, journal: { create, apply: applyFilePlan, get: getFilePlan } })).rejects.toMatchObject({ status: 422 });
    expect(create).not.toHaveBeenCalled();
    await fixture.client.deviceInventory.update({ where: { deviceId: devices[0].id }, data: { complete: false } });
    const connect = vi.fn(options.connect!);
    await expect(createDeviceSyncPlan(input("push"), request(), { ...options, connect })).rejects.toMatchObject({ status: 422 });
    expect(connect).not.toHaveBeenCalled();
  });
  it("does not adopt a source edit after preview or an output edit after journal apply into the baseline", async () => {
    const source = await file(0, "Toy.sfc", "own old");
    const preview = await createDeviceSyncPlan(input("push"), request(), options);
    await writeFile(source, "own new");
    await expect(applyDeviceSyncPlan(preview.id, request(), options)).rejects.toThrow();
    expect(await fixture.client.deviceSyncBaseline.count({ where: { masterDeviceId: devices[0].id, deviceId: devices[1].id } })).toBe(0);
    await file(0, "Toy.sfc", "own verified");
    const fresh = await createDeviceSyncPlan(input("push"), request(), options);
    const apply = vi.fn(async (...args: Parameters<typeof applyFilePlan>) => {
      const result = await applyFilePlan(...args);
      await writeFile(path.join(roots[1], "snes/Toy.sfc"), "foreign late edit");
      return result;
    });
    await expect(applyDeviceSyncPlan(fresh.id, request(), { ...options, journal: { create: createFilePlan, get: getFilePlan, apply } })).rejects.toMatchObject({ status: 409 });
    expect(await fixture.client.deviceSyncBaseline.count({ where: { masterDeviceId: devices[0].id, deviceId: devices[1].id } })).toBe(0);
  });
  it("resumes only the saved verified journal after a crash before the baseline transaction", async () => {
    await file(0, "Toy.sfc", "own crash fixture");
    const preview = await createDeviceSyncPlan(input("push"), request(), options);
    await applyFilePlan(preview.plans[0], request(), options);
    await fixture.client.deviceSyncPlan.update({ where: { id: preview.id }, data: { status: "applying" } });
    expect(await applyDeviceSyncPlan(preview.id, request(), options)).toMatchObject({ status: "applied" });
    expect(await fixture.client.deviceSyncBaseline.count({ where: { masterDeviceId: devices[0].id, deviceId: devices[1].id } })).toBe(1);
  });
});
