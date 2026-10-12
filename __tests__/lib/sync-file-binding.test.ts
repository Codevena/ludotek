import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createTestDatabase } from "../helpers/temp-database";
const dependencies = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock("@/lib/prisma", () => ({ prisma: new Proxy({}, { get(_target, key) {
  const db = dependencies.db as Record<PropertyKey, unknown>;
  const value = db[key]; return typeof value === "function" ? value.bind(db) : value;
} }) }));
vi.mock("@/lib/auth", () => ({ requireAuth: () => null }));
import { POST } from "@/app/api/sync/queue/route";
let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => { fixture = await createTestDatabase(); dependencies.db = fixture.client; });
afterAll(async () => { await fixture.cleanup(); });

it("rejects a different game's path before staging any remote operation", async () => {
  const device = await fixture.client.device.create({ data: { name: "Own fixture", protocol: "local", host: "", user: "", password: "", scanPaths: '[{"path":"/fixture","type":"rom"}]' } });
  const gameA = await fixture.client.game.create({ data: { title: "A", originalFile: "A.bin", platform: "psx", platformLabel: "PSX", devices: { create: { deviceId: device.id, originalFile: "A.bin" } } } });
  const gameB = await fixture.client.game.create({ data: { title: "B", originalFile: "B.bin", platform: "psx", platformLabel: "PSX", devices: { create: { deviceId: device.id, originalFile: "B.bin" } } } });
  await fixture.client.deviceFile.create({ data: { deviceId: device.id, gameId: gameA.id, path: "/fixture/ps1/A.bin", scanRoot: "/fixture", platformAlias: "ps1", relativePath: "A.bin", platform: "psx", source: "rom", kind: "file", size: BigInt(1), generation: "own" } });
  const request = new NextRequest("http://fixture/api/sync/queue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "delete", deviceId: device.id, gameId: gameB.id, filePath: "/fixture/ps1/A.bin" }) });
  const result = await POST(request);
  expect(result.status).toBe(409);
  expect(await fixture.client.syncQueue.count()).toBe(0);
});
