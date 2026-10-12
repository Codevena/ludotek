import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DeviceConnection, DirEntry } from "@/lib/connection";

const dependencies = vi.hoisted(() => ({ createConnection: vi.fn() }));
vi.mock("@/lib/connection", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/connection")>(),
  createConnection: dependencies.createConnection,
}));

import { scanDevice } from "@/lib/scanner";

const device = {
  id: 1, protocol: "local" as const, host: "", port: 0, user: "", password: "",
  scanPaths: [{ path: "/roms", type: "rom" as const }], blacklist: [],
};
const temporaryPaths: string[] = [];
let connection: DeviceConnection;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  connection = {
    listDir: vi.fn().mockResolvedValue([]),
    listDirDetailed: vi.fn(), mkdir: vi.fn(), rename: vi.fn(), remove: vi.fn(),
    readFile: vi.fn(), writeFile: vi.fn(),
    stat: vi.fn().mockResolvedValue({ size: 0, isDirectory: true }),
    disconnect: vi.fn(),
  };
  dependencies.createConnection.mockResolvedValue(connection);
});

afterEach(async () => {
  for (const path of temporaryPaths.splice(0)) await rm(path, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function listings(paths: Record<string, DirEntry[] | Error>) {
  vi.mocked(connection.listDir).mockImplementation(async (path) => {
    const listing = paths[path];
    if (listing instanceof Error) throw listing;
    if (!listing) throw new Error("unexpected listing path");
    return listing;
  });
}

describe("scan completeness", () => {
  it.each([
    [], [{ path: "", type: "rom" }], [{ path: "relative", type: "rom" }],
    [{ path: "/roms", type: "other" }], [{ path: null, type: "rom" }], null,
  ].map((scanPaths) => ({ scanPaths })))("rejects an invalid or empty path configuration without connecting: $scanPaths", async ({ scanPaths }) => {
    const result = await scanDevice({ ...device, scanPaths } as Parameters<typeof scanDevice>[0]);
    expect(result).toEqual({ games: [], reliable: false });
    expect(dependencies.createConnection).not.toHaveBeenCalled();
  });

  it("rejects a root that is a file without listing it", async () => {
    vi.mocked(connection.stat).mockResolvedValue({ size: 12, isDirectory: false });
    expect(await scanDevice(device)).toEqual({ games: [], reliable: false });
    expect(connection.listDir).not.toHaveBeenCalled();
    expect(connection.disconnect).toHaveBeenCalledTimes(1);
  });

  it("marks a failed configured root as unreliable", async () => {
    vi.mocked(connection.stat).mockRejectedValue(new Error("mount missing"));
    expect(await scanDevice(device)).toEqual({ games: [], reliable: false });
    expect(connection.listDir).not.toHaveBeenCalled();
    expect(connection.disconnect).toHaveBeenCalledTimes(1);
  });

  it("marks connection failure as unreliable", async () => {
    dependencies.createConnection.mockRejectedValue(new Error("offline"));
    await expect(scanDevice(device)).resolves.toEqual({ games: [], reliable: false });
  });

  it("retains games from readable platforms but marks a known platform failure as unreliable", async () => {
    listings({
      "/roms": [{ name: "nes", type: "dir" }, { name: "snes", type: "dir" }],
      "/roms/nes": [{ name: "Mario.nes", type: "file" }],
      "/roms/snes": new Error("platform unreadable"),
    });
    const result = await scanDevice(device);
    expect(result.reliable).toBe(false);
    expect(result.games.map((game) => game.originalFile)).toEqual(["Mario.nes"]);
  });

  it("retains games from readable regions but marks a region failure as unreliable", async () => {
    listings({
      "/roms": [{ name: "nes", type: "dir" }],
      "/roms/nes": [{ name: "Mario.nes", type: "file" }, { name: "USA", type: "dir" }],
      "/roms/nes/USA": new Error("region unreadable"),
    });
    const result = await scanDevice(device);
    expect(result.reliable).toBe(false);
    expect(result.games.map((game) => game.originalFile)).toEqual(["Mario.nes"]);
  });

  it("ignores unknown platform directories without attempting to read them", async () => {
    listings({ "/roms": [{ name: "unknown-platform", type: "dir" }] });
    expect(await scanDevice(device)).toEqual({ games: [], reliable: true });
    expect(connection.listDir).toHaveBeenCalledTimes(1);
  });

  it("uses complete listings for roots, platforms, regions and Steam", async () => {
    listings({
      "/roms": [{ name: "nes", type: "dir" }],
      "/roms/nes": [{ name: "USA", type: "dir" }],
      "/roms/nes/USA": [{ name: "Mario.nes", type: "file" }],
      "/steam": [{ name: "Portal", type: "dir" }],
    });
    const result = await scanDevice({
      ...device, scanPaths: [...device.scanPaths, { path: "/steam", type: "steam" }],
    });
    expect(result.reliable).toBe(true);
    expect(result.games.map((game) => game.originalFile)).toEqual(["USA/Mario.nes", "Portal"]);
    for (const path of ["/roms", "/roms/nes", "/roms/nes/USA", "/steam"]) {
      expect(connection.listDir).toHaveBeenCalledWith(path, { requireComplete: true });
    }
  });

  it("accepts a completely read empty device as reliable", async () => {
    expect(await scanDevice(device)).toEqual({ games: [], reliable: true });
    expect(connection.disconnect).toHaveBeenCalledTimes(1);
  });

  it("discovers all 501 valid local ROMs instead of using the browser's first 500", async () => {
    const root = await mkdtemp(join(tmpdir(), "ludotek-scan-"));
    temporaryPaths.push(root);
    const platform = join(root, "nes");
    await mkdir(platform);
    for (let index = 0; index < 501; index++) await writeFile(join(platform, `Game ${index}.nes`), "");
    const actual = await vi.importActual<typeof import("@/lib/connection")>("@/lib/connection");
    dependencies.createConnection.mockImplementation(actual.createConnection);
    const result = await scanDevice({ ...device, scanPaths: [{ path: root, type: "rom" }] });
    expect(result.reliable).toBe(true);
    expect(result.games).toHaveLength(501);
    expect(result.games.some((game) => game.originalFile === "Game 500.nes")).toBe(true);
  });
});
