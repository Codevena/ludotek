import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createTestDatabase } from "../helpers/temp-database";
const deps = vi.hoisted(() => ({ db: undefined as unknown, clear: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: new Proxy({}, { get(_target, key) {
  const db = deps.db as Record<PropertyKey, unknown>; const value = db[key]; return typeof value === "function" ? value.bind(db) : value;
} }) }));
vi.mock("@/lib/auth", () => ({ requireAuth: () => null }));
vi.mock("@/lib/image-cache", () => ({ clearCache: deps.clear, deleteGameFiles: deps.remove }));
import { AdmissionStore } from "@/lib/job-admission";
import { POST as wipeAll } from "@/app/api/devices/wipe-all/route";
import { POST as wipeOne } from "@/app/api/devices/[id]/wipe/route";
import { POST as cleanup } from "@/app/api/cleanup/route";
let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => { fixture = await createTestDatabase(); deps.db = fixture.client; });
afterAll(async () => { await fixture.cleanup(); });
const request = () => new NextRequest("http://fixture", { method: "POST" });

it("rejects catalog wipes before cache or queue effects when a file job holds the shared namespace", async () => {
  const device = await fixture.client.device.create({ data: { name: "Own fixture", host: "", user: "", password: "", protocol: "local" } });
  const hold = await new AdmissionStore(fixture.client).acquire("device-files");
  try {
    expect((await wipeAll(request())).status).toBe(409);
    expect((await wipeOne(request(), { params: Promise.resolve({ id: String(device.id) }) })).status).toBe(409);
    expect((await cleanup(request())).status).toBe(409);
    expect(deps.clear).not.toHaveBeenCalled(); expect(deps.remove).not.toHaveBeenCalled();
    expect(await fixture.client.device.count()).toBe(1);
  } finally { await hold.release(); }
});

it("transfers a duplicate's confirmed physical paths to the canonical game before deleting it", async () => {
  const device = (await fixture.client.device.findFirst())!;
  const winner = await fixture.client.game.create({ data: { title: "Toy", originalFile: "Toy.m3u", platform: "psx", platformLabel: "PSX", devices: { create: { deviceId: device.id, originalFile: "Toy.m3u" } } } });
  const loser = await fixture.client.game.create({ data: { title: "Toy", originalFile: "Toy (Disc 1).chd", platform: "psx", platformLabel: "PSX", devices: { create: { deviceId: device.id, originalFile: "Toy (Disc 1).chd" } } } });
  const physical = await fixture.client.deviceFile.create({ data: { deviceId: device.id, gameId: loser.id, path: "/fixture/psx/Toy (Disc 1).chd", scanRoot: "/fixture", platformAlias: "psx", relativePath: "Toy (Disc 1).chd", platform: "psx", source: "rom", kind: "file", size: BigInt(1), generation: "own" } });
  expect((await cleanup(request())).status).toBe(200);
  expect(await fixture.client.game.findUnique({ where: { id: loser.id } })).toBeNull();
  expect(await fixture.client.deviceFile.findUnique({ where: { id: physical.id } })).toMatchObject({ gameId: winner.id });
});

it("forgets catalog ownership without deleting physical paths, journal history or saved versions", async () => {
  const device = (await fixture.client.device.findFirst())!;
  const game = await fixture.client.game.create({ data: { title: "Own toy", originalFile: "Toy.sfc", platform: "snes", platformLabel: "SNES", devices: { create: { deviceId: device.id } } } });
  await fixture.client.deviceFile.create({ data: { deviceId: device.id, gameId: game.id, path: "/fixture/snes/Toy.sfc", scanRoot: "/fixture", platformAlias: "snes", relativePath: "Toy.sfc", platform: "snes", source: "rom", kind: "file", size: BigInt(1), generation: "own" } });
  await fixture.client.deviceInventory.create({ data: { deviceId: device.id, generation: "own", complete: true } });
  const version = await fixture.client.saveVersion.create({ data: { deviceId: device.id, gameId: game.id, deviceName: device.name, gameTitle: game.title, fileKey: "Toy.srm", sourcePath: "/fixture/saves/Toy.srm", sha256: "a".repeat(64), size: BigInt(1), storageKey: "a".repeat(64) } });
  const journal = await fixture.client.filePlan.create({ data: { kind: "copy", deviceState: "[]", totalBytes: BigInt(1), status: "applied" } });
  const result = await wipeOne(request(), { params: Promise.resolve({ id: String(device.id) }) });
  expect(result.status).toBe(200);
  expect(await fixture.client.game.count()).toBe(0);
  expect(await fixture.client.deviceFile.findFirst({ where: { deviceId: device.id, path: "/fixture/snes/Toy.sfc" } })).toMatchObject({ path: "/fixture/snes/Toy.sfc", gameId: null });
  expect(await fixture.client.deviceInventory.findUnique({ where: { deviceId: device.id } })).toMatchObject({ complete: false });
  expect(await fixture.client.saveVersion.findUnique({ where: { id: version.id } })).not.toBeNull();
  expect(await fixture.client.filePlan.findUnique({ where: { id: journal.id } })).not.toBeNull();
});
