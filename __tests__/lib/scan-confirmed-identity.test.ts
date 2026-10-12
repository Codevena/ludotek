import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { createTestDatabase } from "../helpers/temp-database";
const deps = vi.hoisted(() => ({ db: undefined as unknown, scan: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: new Proxy({}, { get(_target, key) {
  const db = deps.db as Record<PropertyKey, unknown>; const value = db[key]; return typeof value === "function" ? value.bind(db) : value;
} }) }));
vi.mock("@/lib/scanner", () => ({ scanDevice: deps.scan }));
vi.mock("@/lib/image-cache", () => ({ deleteGameFiles: vi.fn() }));
vi.mock("@/lib/encryption", () => ({ decrypt: (value: string) => value }));
import { runScanInBackground } from "@/lib/scan-runner";
let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => { fixture = await createTestDatabase(); deps.db = fixture.client; });
afterAll(async () => { await fixture.cleanup(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

it("rescans a journal-renamed file into its existing game without replacing metadata or another device's representative", async () => {
  vi.useFakeTimers();
  const a = await fixture.client.device.create({ data: { name: "Own A", protocol: "local", host: "", user: "", password: "", scanPaths: '[{"path":"/fixture","type":"rom"}]' } });
  const b = await fixture.client.device.create({ data: { name: "Own B", protocol: "local", host: "", user: "", password: "" } });
  const game = await fixture.client.game.create({ data: { title: "Original identity", originalFile: "One.nes", platform: "nes", platformLabel: "NES", summary: "Preserve this metadata", devices: { create: [{ deviceId: a.id, originalFile: "Two.nes" }, { deviceId: b.id, originalFile: "One.nes" }] } } });
  await fixture.client.deviceFile.create({ data: { deviceId: a.id, gameId: game.id, path: "/fixture/nes/Two.nes", scanRoot: "/fixture", platformAlias: "nes", relativePath: "Two.nes", platform: "nes", source: "rom", kind: "file", size: BigInt(1), generation: "journal" } });
  deps.scan.mockResolvedValue({ reliable: true, games: [{ title: "Two", originalFile: "Two.nes", platform: "nes", platformLabel: "NES", source: "rom" }], files: [{ path: "/fixture/nes/Two.nes", scanRoot: "/fixture", platformAlias: "nes", relativePath: "Two.nes", platform: "nes", source: "rom", type: "file", size: 1, gameKey: "Two|nes" }] });
  await runScanInBackground(a.id);
  expect(await fixture.client.game.count()).toBe(1);
  expect(await fixture.client.game.findUnique({ where: { id: game.id } })).toMatchObject({ title: "Original identity", originalFile: "One.nes", summary: "Preserve this metadata" });
  expect(await fixture.client.gameDevice.findUnique({ where: { gameId_deviceId: { gameId: game.id, deviceId: b.id } } })).toMatchObject({ originalFile: "One.nes" });
  expect(await fixture.client.deviceFile.findUnique({ where: { deviceId_path: { deviceId: a.id, path: "/fixture/nes/Two.nes" } } })).toMatchObject({ gameId: game.id });
});
