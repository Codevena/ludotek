import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildDoctorSnapshot, runSyncDoctor } from "@/lib/sync-doctor";
import type { scanDevice } from "@/lib/scanner";
import { createTestDatabase } from "../helpers/temp-database";

const file = (name: string, size = 3, modifiedAt = "2026-10-12T00:00:00.000Z") => ({ path: `/fixture/roms/snes/${name}`, scanRoot: "/fixture/roms", platformAlias: "snes", relativePath: name, platform: "snes", source: "rom" as const, size, modifiedAt, type: "file" as const });
const manifest = (name: string, gameId: number | null = 1) => ({ id: 1, deviceId: 1, gameId, path: file(name).path, scanRoot: "/fixture/roms", size: BigInt(3), modifiedAt: file(name).modifiedAt, kind: "file", generation: "fixture-generation" });
const inventory = { generation: "fixture-generation", complete: true };

describe("read-only Sync Doctor comparison", () => {
  it("reports exact missing/extra/changed paths without inventing paths for legacy links", () => {
    const snapshot = buildDoctorSnapshot({ observed: [file("unchanged.sfc"), file("changed.sfc", 4), file("extra.sfc")], reliable: true,
      manifest: [manifest("unchanged.sfc"), manifest("changed.sfc"), manifest("missing.sfc")], inventory,
      links: [{ gameId: 1, originalFile: "unchanged.sfc", title: "Confirmed" }, { gameId: 2, originalFile: "legacy.sfc", title: "Legacy" }], roots: ["/fixture/roms"] });
    expect(snapshot.complete).toBe(true);
    expect(snapshot.summary).toMatchObject({ unchanged: 1, counts: { missing: 1, extra: 1, changed: 1, legacy: 1 } });
    expect(snapshot.findings.find((finding) => finding.kind === "missing")).toMatchObject({ path: file("missing.sfc").path, repair: "rescan" });
    expect(snapshot.findings.find((finding) => finding.kind === "extra")).toMatchObject({ path: file("extra.sfc").path, repair: "review" });
    expect(snapshot.findings.find((finding) => finding.kind === "legacy")).toMatchObject({ gameId: 2, legacyFile: "legacy.sfc" });
    expect(snapshot.findings.find((finding) => finding.kind === "legacy")).not.toHaveProperty("path");
  });

  it("incomplete inventories cannot call unseen files missing or offer any file-removal review", () => {
    const snapshot = buildDoctorSnapshot({ observed: [file("extra.sfc")], reliable: false,
      manifest: [manifest("unseen.sfc")], inventory, links: [], roots: ["/fixture/roms"] });
    expect(snapshot.complete).toBe(false);
    expect(snapshot.summary.counts.missing).toBe(0);
    expect(snapshot.findings.find((finding) => finding.path === file("unseen.sfc").path)).toMatchObject({ kind: "unknown", repair: "rescan" });
    expect(snapshot.findings.every((finding) => finding.repair !== "review")).toBe(true);
  });

  it("marks stale generations and unsafe symlinks/outside paths without suggesting file changes", () => {
    const snapshot = buildDoctorSnapshot({ observed: [{ ...file("link.sfc"), type: "symlink" }, { ...file("outside.sfc"), path: "/outside/rom.sfc" }], reliable: true,
      manifest: [{ ...manifest("link.sfc"), generation: "old" }], inventory, links: [], roots: ["/fixture/roms"] });
    expect(snapshot.summary.counts.unsafe).toBe(2);
    expect(snapshot.findings.filter((finding) => finding.kind === "unsafe").every((finding) => finding.repair === null)).toBe(true);
    expect(snapshot.complete).toBe(false);
  });

  it("caps findings at100000 and turns every missing/deletion-review finding into an incomplete-safe result", () => {
    const observed = Array.from({ length: 100000 }, (_, n) => file(`extra-${n}.sfc`));
    const snapshot = buildDoctorSnapshot({ observed, reliable: true, manifest: [manifest("missing.sfc")], inventory,
      links: [{ gameId: 2, originalFile: null, title: "Legacy" }], roots: ["/fixture/roms"] });
    expect(snapshot.findings.length).toBeLessThanOrEqual(100000);
    expect(Buffer.byteLength(JSON.stringify(snapshot.findings))).toBeLessThan(32 * 1024 * 1024);
    expect(snapshot.complete).toBe(false);
    expect(snapshot.summary.truncated).toBe(true);
    expect(snapshot.findings.every((finding) => finding.kind !== "missing" && finding.repair !== "review")).toBe(true);
    const missing = buildDoctorSnapshot({ observed: [], reliable: true, manifest: Array.from({ length: 100000 }, (_, n) => manifest(`missing-${n}.sfc`)), inventory, links: [], roots: ["/fixture/roms"] });
    expect(missing.complete).toBe(false);
    expect(missing.summary.counts.missing).toBe(0);
    expect(missing.summary.counts.unknown).toBe(100000);
  });
});

let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => { fixture = await createTestDatabase(); });
afterAll(async () => { await fixture.cleanup(); });
describe("persistent immutable Doctor snapshots", () => {
  it("stores a report using an isolated DB and leaves catalog/manifest links unchanged", async () => {
    const device = await fixture.client.device.create({ data: { name: "Doctor fixture", host: "test.invalid", port: 22, user: "", password: "", protocol: "ssh", scanPaths: JSON.stringify([{ path: "/fixture/roms", type: "rom" }]) } });
    const game = await fixture.client.game.create({ data: { title: "Fixture", platform: "snes", platformLabel: "SNES", originalFile: "doctor-fixture.sfc" } });
    await fixture.client.gameDevice.create({ data: { gameId: game.id, deviceId: device.id, originalFile: "legacy.sfc" } });
    const before = await fixture.client.gameDevice.findMany({ where: { deviceId: device.id } });
    const scan = vi.fn<typeof scanDevice>(async () => ({ games: [], files: [file("extra.sfc")], reliable: true }));
    const jobs = { signal: new AbortController().signal, assertActive: vi.fn(async () => {}), close: vi.fn(async () => {}) };
    const result = await runSyncDoctor(fixture.client, { ...device, password: "" }, jobs, scan);
    expect(result.complete).toBe(true);
    const stored = await fixture.client.doctorReport.findUniqueOrThrow({ where: { id: result.reportId } });
    expect(JSON.parse(stored.findings)).toEqual(result.findings);
    expect(await fixture.client.gameDevice.findMany({ where: { deviceId: device.id } })).toEqual(before);
    expect(await fixture.client.deviceFile.count({ where: { deviceId: device.id } })).toBe(0);
    expect(scan.mock.calls[0][2]).toMatchObject({ signal: jobs.signal, assertActive: expect.any(Function) });
  });

  it("aborts before reporting and never persists a misleading completed snapshot", async () => {
    const device = await fixture.client.device.findFirstOrThrow();
    const controller = new AbortController();
    const jobs = { signal: controller.signal, assertActive: async () => controller.signal.throwIfAborted(), close: async () => {} };
    const before = await fixture.client.doctorReport.count();
    const scan = vi.fn(async () => { controller.abort(); return { files: [file("extra.sfc")], games: [], reliable: true }; });
    await expect(runSyncDoctor(fixture.client, device, jobs, scan)).rejects.toThrow();
    expect(await fixture.client.doctorReport.count()).toBe(before);
  });

  it("keeps a completed immutable report when its device is removed", async () => {
    const device = await fixture.client.device.create({ data: { name: "Retained Doctor report", host: "test.invalid", user: "", password: "", protocol: "ssh", scanPaths: JSON.stringify([{ path: "/fixture/roms", type: "rom" }]) } });
    const jobs = { signal: new AbortController().signal, assertActive: async () => {}, close: async () => {} };
    const report = await runSyncDoctor(fixture.client, device, jobs, async () => ({ games: [], files: [], reliable: true }));
    await fixture.client.device.delete({ where: { id: device.id } });
    expect(await fixture.client.doctorReport.findUnique({ where: { id: report.reportId } })).toMatchObject({ deviceId: device.id, complete: true });
  });
});
