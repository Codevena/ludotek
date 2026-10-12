import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestDatabase } from "../helpers/temp-database";
import { getConfirmedGameFiles, persistDeviceManifest } from "@/lib/device-manifest";

let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => { fixture = await createTestDatabase(); });
afterAll(async () => { await fixture.cleanup(); });

it("preserves physical revisions and actual aliases while binding only confirmed games", async () => {
  const device = await fixture.client.device.create({ data: { name: "Manifest fixture", host: "", user: "", password: "", protocol: "local" } });
  const game = await fixture.client.game.create({ data: { title: "Toy", originalFile: "Toy.m3u", platform: "psx", platformLabel: "PlayStation" } });
  const files = ["Toy.m3u", "USA/Toy (Disc 1).bin", "USA/Toy (Disc 2).bin", "Europe/Toy (Rev 1).bin", "unrelated.txt"].map((relativePath) => ({
    path: `/actual/ps1/${relativePath}`, scanRoot: "/actual", platformAlias: "ps1", relativePath, platform: "psx", source: "rom" as const,
    size: 12, type: "file" as const, gameKey: relativePath.endsWith(".txt") ? undefined : "Toy|psx",
  }));
  await persistDeviceManifest(fixture.client, device.id, files, true, new Map([["Toy|psx", game.id]]));
  const rows = await fixture.client.deviceFile.findMany({ where: { deviceId: device.id }, orderBy: { path: "asc" } });
  expect(rows).toHaveLength(5);
  expect(rows.filter((row) => row.gameId === game.id)).toHaveLength(4);
  expect(rows.every((row) => row.scanRoot === "/actual" && row.platformAlias === "ps1")).toBe(true);
  expect(rows.find((row) => row.path.endsWith("unrelated.txt"))?.gameId).toBeNull();
  const confirmed = await getConfirmedGameFiles(fixture.client, game.id);
  expect(confirmed.map((file) => file.filePath)).toEqual(expect.arrayContaining(["/actual/ps1/Toy.m3u", "/actual/ps1/Europe/Toy (Rev 1).bin"]));
  expect(confirmed.every((file) => !file.filePath.includes("/psx/") && !file.fileName.includes("/"))).toBe(true);
  await persistDeviceManifest(fixture.client, device.id, files.slice(0, 1), false, new Map([["Toy|psx", game.id]]));
  expect(await fixture.client.deviceFile.count({ where: { deviceId: device.id } })).toBe(5);
  expect(await fixture.client.deviceInventory.findUnique({ where: { deviceId: device.id } })).toMatchObject({ complete: false });
  await persistDeviceManifest(fixture.client, device.id, [], true, new Map());
  expect(await fixture.client.deviceFile.count({ where: { deviceId: device.id } })).toBe(0);
});

it("does not invent legacy paths and invalidates cached hashes on size/mtime changes", async () => {
  const device = await fixture.client.device.create({ data: { name: "Legacy fixture", host: "", user: "", password: "", protocol: "local" } });
  const game = await fixture.client.game.create({ data: { title: "Legacy", originalFile: "Old.sfc", platform: "snes", platformLabel: "SNES", devices: { create: { deviceId: device.id, originalFile: "Old.sfc" } } } });
  expect(await fixture.client.deviceFile.count({ where: { gameId: game.id } })).toBe(0);
  expect(await getConfirmedGameFiles(fixture.client, game.id)).toEqual([]);
  const file = { path: "/actual/superfamicom/Toy.sfc", scanRoot: "/actual", platformAlias: "superfamicom", relativePath: "Toy.sfc", platform: "snes", source: "rom" as const, size: 12, modifiedAt: "2026-01-01T00:00:00.000Z", type: "file" as const };
  await persistDeviceManifest(fixture.client, device.id, [file], true, new Map());
  await fixture.client.deviceFile.updateMany({ where: { deviceId: device.id }, data: { sha256: "verified-old-hash" } });
  await persistDeviceManifest(fixture.client, device.id, [{ ...file, size: 13 }], true, new Map());
  expect(await fixture.client.deviceFile.findFirst({ where: { deviceId: device.id } })).toMatchObject({ size: BigInt(13), sha256: null });
});
