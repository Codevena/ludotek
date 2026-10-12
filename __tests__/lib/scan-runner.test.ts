import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  scanDevice: vi.fn(), deleteGameFiles: vi.fn(), setScanProgress: vi.fn(), clearScanProgress: vi.fn(),
  prisma: {
    device: { findMany: vi.fn() },
    game: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn(), groupBy: vi.fn() },
    gameDevice: { upsert: vi.fn(), deleteMany: vi.fn() },
    syncQueue: { deleteMany: vi.fn() },
    platform: { updateMany: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: dependencies.prisma }));
vi.mock("@/lib/scanner", () => ({ scanDevice: dependencies.scanDevice }));
vi.mock("@/lib/image-cache", () => ({ deleteGameFiles: dependencies.deleteGameFiles }));
vi.mock("@/lib/encryption", () => ({ decrypt: (value: string) => value }));
vi.mock("@/lib/scan-progress", () => ({ setScanProgress: dependencies.setScanProgress, clearScanProgress: dependencies.clearScanProgress }));

import { runScanInBackground } from "@/lib/scan-runner";

const device = {
  id: 1, name: "Fixture device", protocol: "local", host: "", port: 0, user: "", password: "",
  ftps: false, scanPaths: '[{"path":"/roms","type":"rom"}]', blacklist: "[]",
};
const game = { originalFile: "Mario.nes", title: "Mario", platform: "nes", platformLabel: "NES", source: "rom" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  dependencies.prisma.device.findMany.mockResolvedValue([device]);
  dependencies.prisma.game.findUnique.mockResolvedValue(null);
  dependencies.prisma.game.findFirst.mockResolvedValue(null);
  dependencies.prisma.game.create.mockResolvedValue({ id: 42 });
  dependencies.prisma.game.findMany.mockResolvedValue([{ id: 99 }]);
  dependencies.prisma.game.groupBy.mockResolvedValue([]);
  dependencies.scanDevice.mockResolvedValue({ games: [], reliable: false });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("scan runner pruning", () => {
  it.each([{ games: [] }, { games: [game] }])("performs no stale-link, queue, orphan or cache deletion for unreliable games $games", async ({ games }) => {
    dependencies.scanDevice.mockResolvedValue({ games, reliable: false });
    await runScanInBackground(1);
    expect(dependencies.prisma.gameDevice.deleteMany).toHaveBeenCalledTimes(0);
    expect(dependencies.prisma.syncQueue.deleteMany).toHaveBeenCalledTimes(0);
    expect(dependencies.prisma.game.deleteMany).toHaveBeenCalledTimes(0);
    expect(dependencies.deleteGameFiles).toHaveBeenCalledTimes(0);
    if (games.length > 0) {
      expect(dependencies.prisma.gameDevice.upsert).toHaveBeenCalledWith({
        where: { gameId_deviceId: { gameId: 42, deviceId: 1 } },
        update: { originalFile: "Mario.nes" },
        create: { gameId: 42, deviceId: 1, originalFile: "Mario.nes" },
      });
    }
  });

  it("allows stale links, queue entries and orphan cleanup after a reliable empty scan", async () => {
    dependencies.scanDevice.mockResolvedValue({ games: [], reliable: true });
    await runScanInBackground(1);
    expect(dependencies.prisma.gameDevice.deleteMany).toHaveBeenCalledWith({ where: { deviceId: 1 } });
    expect(dependencies.prisma.syncQueue.deleteMany).toHaveBeenCalledWith({
      where: { deviceId: 1, status: { in: ["pending", "failed"] } },
    });
    expect(dependencies.deleteGameFiles).toHaveBeenCalledWith([99]);
    expect(dependencies.prisma.game.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [99] } } });
  });

  it("performs no deletions after a connection exception", async () => {
    dependencies.scanDevice.mockRejectedValue(new Error("offline"));
    await runScanInBackground(1);
    expect(dependencies.prisma.gameDevice.deleteMany).not.toHaveBeenCalled();
    expect(dependencies.prisma.syncQueue.deleteMany).not.toHaveBeenCalled();
    expect(dependencies.prisma.game.deleteMany).not.toHaveBeenCalled();
    expect(dependencies.deleteGameFiles).not.toHaveBeenCalled();
  });
});
