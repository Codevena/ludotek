import { mkdir, mkdtemp, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Device } from "@prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { createTestDatabase } from "../helpers/temp-database";
import { acquireDeviceFiles } from "@/lib/device-jobs";
import { deviceProfileAcquire, getDeviceProfile, saveDeviceProfile } from "@/lib/device-profiles";
import { runSyncDoctor } from "@/lib/sync-doctor";

let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
let sandbox: string;
let canonicalRoot: string;
let aliasRoot: string;
let device: Device;
const request = () => new Request("http://fixture.invalid", { method: "POST" });
const profile = (romPath: string, savePath = path.join(romPath, "saves")) => ({ template: "custom", romRoots: [{ path: romPath }], saveRoots: [{ path: savePath }], formats: [".nes"], reserveBytes: "0" });
beforeAll(async () => { fixture = await createTestDatabase(); });
afterAll(async () => { await fixture.cleanup(); });
beforeEach(async () => {
  // On macOS this preserves the native /var -> /private/var alias. On another
  // OS, create an equivalent symlink entirely inside this owned fixture.
  sandbox = await mkdtemp(path.join(tmpdir(), "ludotek-local-root-alias-"));
  const rawRoot = path.join(sandbox, "roms"); await mkdir(rawRoot); canonicalRoot = await realpath(rawRoot); aliasRoot = rawRoot;
  if (aliasRoot === canonicalRoot) { aliasRoot = path.join(sandbox, "permitted-root-alias"); await symlink(canonicalRoot, aliasRoot, "dir"); }
  expect(aliasRoot).not.toBe(canonicalRoot);
  await mkdir(path.join(canonicalRoot, "nes")); await mkdir(path.join(canonicalRoot, "saves")); await writeFile(path.join(canonicalRoot, "nes", "Own.nes"), "OWN");
  vi.stubEnv("LOCAL_FILES_ROOT", ""); vi.stubEnv("LOCAL_FILES_ROOTS", JSON.stringify([aliasRoot])); vi.stubEnv("DATABASE_URL", fixture.url);
  device = await fixture.client.device.create({ data: { name: "Own native alias fixture", protocol: "local", host: "", user: "", password: "", scanPaths: JSON.stringify([{ path: aliasRoot, type: "rom" }]) } });
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(sandbox, { recursive: true, force: true }); });

describe("permitted LOCAL native roots stay canonical without rewriting device configuration", () => {
  it("Doctor recognizes the reliable canonical scan and existing physical manifest inside a raw alias root", async () => {
    const filename = path.join(canonicalRoot, "nes", "Own.nes"); const metadata = await stat(filename, { bigint: true });
    const game = await fixture.client.game.create({ data: { title: `Own alias ${device.id}`, platform: "nes", platformLabel: "NES", originalFile: `own-alias-${device.id}.nes` } });
    await fixture.client.gameDevice.create({ data: { gameId: game.id, deviceId: device.id, originalFile: "Own.nes" } });
    await fixture.client.deviceInventory.create({ data: { deviceId: device.id, generation: "own-alias-generation", complete: true } });
    await fixture.client.deviceFile.create({ data: { deviceId: device.id, gameId: game.id, path: filename, scanRoot: canonicalRoot, relativePath: "Own.nes", platformAlias: "nes", platform: "nes", source: "rom", kind: "file", size: BigInt(metadata.size), modifiedAt: metadata.mtime.toISOString(), generation: "own-alias-generation" } });
    const originalManifest = await fixture.client.deviceFile.findMany({ where: { deviceId: device.id } });
    const jobs = await acquireDeviceFiles([device.id], request(), deviceProfileAcquire({ db: fixture.client }));
    try {
      const report = await runSyncDoctor(fixture.client, device, jobs);
      expect(report.complete).toBe(true); expect(report.summary.counts.unsafe).toBe(0); expect(report.summary.unchanged).toBe(1);
      expect(report.findings.every((finding) => !finding.path || finding.path.startsWith(canonicalRoot + "/"))).toBe(true);
    } finally { await jobs.close(); }
    expect(await fixture.client.device.findUnique({ where: { id: device.id } })).toEqual(device);
    expect(await fixture.client.deviceFile.findMany({ where: { deviceId: device.id } })).toEqual(originalManifest);
  });
  it("GET defaults use the permitted canonical scan root", async () => {
    const defaults = await getDeviceProfile(device.id, { db: fixture.client });
    expect(defaults.configuredRomRoots).toEqual([canonicalRoot]); expect(defaults.profile.romRoots).toEqual([{ path: canonicalRoot }]);
    expect(await fixture.client.device.findUnique({ where: { id: device.id } })).toEqual(device);
  });
  it("accepts a canonical profile Save against a raw configured alias root", async () => {
    const saved = await saveDeviceProfile(device.id, profile(canonicalRoot), request(), { db: fixture.client });
    expect(saved.profile).toEqual(profile(canonicalRoot)); expect((await getDeviceProfile(device.id, { db: fixture.client })).profile).toEqual(saved.profile);
    expect(await fixture.client.device.findUnique({ where: { id: device.id } })).toEqual(device);
  });
  it("accepts an explicitly declared operator symlink alias for defaults, Save and Doctor", async () => {
    const declaredAlias = path.join(sandbox, "operator-declared-alias"); await symlink(canonicalRoot, declaredAlias, "dir");
    vi.stubEnv("LOCAL_FILES_ROOTS", JSON.stringify([declaredAlias]));
    const configured = await fixture.client.device.create({ data: { name: "Own declared symlink fixture", protocol: "local", host: "", user: "", password: "", scanPaths: JSON.stringify([{ path: declaredAlias, type: "rom" }]) } });
    expect((await getDeviceProfile(configured.id, { db: fixture.client })).profile.romRoots).toEqual([{ path: canonicalRoot }]);
    expect((await saveDeviceProfile(configured.id, profile(declaredAlias), request(), { db: fixture.client })).profile).toEqual(profile(canonicalRoot));
    const jobs = await acquireDeviceFiles([configured.id], request(), deviceProfileAcquire({ db: fixture.client }));
    try { const report = await runSyncDoctor(fixture.client, configured, jobs); expect(report.complete).toBe(true); expect(report.summary.counts.unsafe).toBe(0); } finally { await jobs.close(); }
    expect(await fixture.client.device.findUnique({ where: { id: configured.id } })).toEqual(configured);
  });
  it("accepts an explicitly permitted alias input and reads preexisting raw profile roots consistently without rewriting stored rows on GET", async () => {
    const raw = await fixture.client.deviceProfile.create({ data: { deviceId: device.id, template: "custom", romRoots: JSON.stringify([{ path: aliasRoot }]), saveRoots: JSON.stringify([{ path: path.join(aliasRoot, "saves") }]), formats: '[".nes"]', reserveBytes: BigInt(0) } });
    expect((await getDeviceProfile(device.id, { db: fixture.client })).profile).toEqual(profile(canonicalRoot));
    expect(await fixture.client.deviceProfile.findUnique({ where: { deviceId: device.id } })).toEqual(raw);
    expect((await saveDeviceProfile(device.id, profile(aliasRoot), request(), { db: fixture.client })).profile).toEqual(profile(canonicalRoot));
    expect(await fixture.client.device.findUnique({ where: { id: device.id } })).toEqual(device);
  });
  it("keeps outside, protected and escaping alias paths rejected without expanding the operator allowlist", async () => {
    const outside = path.join(sandbox, "outside"); await mkdir(outside); const escape = path.join(canonicalRoot, "escape"); await symlink(outside, escape, "dir");
    for (const input of [profile(canonicalRoot, outside), profile(escape), profile(canonicalRoot, path.join(process.cwd(), "data"))]) await expect(saveDeviceProfile(device.id, input, request(), { db: fixture.client })).rejects.toThrow();
    expect(await fixture.client.deviceProfile.findUnique({ where: { deviceId: device.id } })).toBeNull();
    for (const forbidden of [outside, path.join(process.cwd(), "data")]) {
      const invalidDevice = { ...device, scanPaths: JSON.stringify([{ path: forbidden, type: "rom" }]) };
      const jobs = await acquireDeviceFiles([device.id], request(), deviceProfileAcquire({ db: fixture.client }));
      try { await expect(runSyncDoctor(fixture.client, invalidDevice, jobs)).rejects.toThrow(); } finally { await jobs.close(); }
    }
    expect(await fixture.client.doctorReport.count({ where: { deviceId: device.id } })).toBe(0); expect(await fixture.client.device.findUnique({ where: { id: device.id } })).toEqual(device);
    // The operator may permit a wider area; that still does not permit a ROM
    // profile to escape this device's actual scan root.
    vi.stubEnv("LOCAL_FILES_ROOTS", JSON.stringify([sandbox]));
    await expect(saveDeviceProfile(device.id, profile(outside), request(), { db: fixture.client })).rejects.toThrow("ROM-Profilwurzeln");
    expect(await fixture.client.deviceProfile.findUnique({ where: { deviceId: device.id } })).toBeNull();
  });
});
