import { mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { configuredRomRoots, getDeviceProfile, parseDeviceProfile, PROFILE_TEMPLATES, saveDeviceProfile } from "@/lib/device-profiles";
import { AdmissionStore, EnrichmentJob } from "@/lib/job-admission";
import { createTestDatabase } from "../helpers/temp-database";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
const device = { scanPaths: JSON.stringify([{ path: "/fixture/roms", type: "rom" }]) };
const input = () => ({ template: "custom", romRoots: [{ path: "/fixture/roms" }], saveRoots: [], formats: [".sfc", ".chd"], reserveBytes: "1024" });
describe("editable device profiles", () => {
  it("provides four credential-free templates and parses explicit platform roots", () => {
    expect(PROFILE_TEMPLATES.map((template) => template.id)).toEqual(["steamdeck", "retroid", "miyoo", "custom"]);
    expect(PROFILE_TEMPLATES.every((template) => !("password" in template))).toBe(true);
    expect(parseDeviceProfile({ ...input(), romRoots: [{ platform: "snes", path: "/fixture/roms/SFC" }] }, device).romRoots).toEqual([{ platform: "snes", path: "/fixture/roms/SFC" }]);
    expect(configuredRomRoots(device)).toEqual(["/fixture/roms"]);
  });
  it("rejects scan-root siblings, traversal, invalid platforms, duplicate formats and arbitrary fields", () => {
    for (const patch of [{ romRoots: [{ path: "/fixture/roms-other" }] }, { romRoots: [{ path: "/fixture/roms/../other" }] }, { romRoots: [{ platform: "unknown", path: "/fixture/roms" }] },
      { formats: [".sfc", ".sfc"] }, { formats: [".SFC"] }, { reserveBytes: "-1" }, { password: "fixture-secret" }]) {
      expect(() => parseDeviceProfile({ ...input(), ...patch }, device)).toThrow();
    }
  });
});
let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => { fixture = await createTestDatabase(); });
afterAll(async () => { await fixture.cleanup(); });
afterEach(() => { vi.unstubAllEnvs(); });
describe("profile persistence and device coordination", () => {
  it("persists editable roots/formats/reserve under the actual shared files lease", async () => {
    await mkdir(path.join(fixture.directory, "roms")); const root = await realpath(path.join(fixture.directory, "roms"));
    vi.stubEnv("LOCAL_FILES_ROOT", root); vi.stubEnv("LOCAL_FILES_ROOTS", undefined);
    const device = await fixture.client.device.create({ data: { name: "Profile fixture", protocol: "local", host: "localhost", user: "", password: "", scanPaths: JSON.stringify([{ path: root, type: "rom" }]) } });
    const store = new AdmissionStore(fixture.client);
    const acquire = async (resource: string, request: Request) => new EnrichmentJob(await store.acquire(resource), request.signal);
    const profile = { ...input(), romRoots: [{ path: root }], reserveBytes: "4096" };
    await saveDeviceProfile(device.id, profile, new Request("http://fixture.invalid"), { db: fixture.client });
    expect((await getDeviceProfile(device.id, { db: fixture.client })).profile).toEqual(profile);
    const lease = await store.acquire(`files:${device.id}`);
    await expect(saveDeviceProfile(device.id, { ...profile, reserveBytes: "8192" }, new Request("http://fixture.invalid"), { db: fixture.client, acquire })).rejects.toMatchObject({ status: 409 });
    expect((await getDeviceProfile(device.id, { db: fixture.client })).profile.reserveBytes).toBe("4096");
    await lease.release();
    await expect(saveDeviceProfile(device.id, { ...profile, saveRoots: [{ path: path.join(fixture.directory, "outside") }] }, new Request("http://fixture.invalid"), { db: fixture.client, acquire })).rejects.toThrow();
    expect((await getDeviceProfile(device.id, { db: fixture.client })).profile.saveRoots).toEqual([]);
  });
});
