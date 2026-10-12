import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DeviceConnection } from "@/lib/connection";

const dependencies = vi.hoisted(() => ({ createConnection: vi.fn() }));
vi.mock("@/lib/connection", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/connection")>(),
  createConnection: dependencies.createConnection,
}));

import { parseScanDescriptor, scanDevice } from "@/lib/scanner";

const roots: string[] = [];
let connection: DeviceConnection;
const device = { id: 1, protocol: "local" as const, host: "", port: 0, user: "", password: "", blacklist: [] };

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "ludotek-physical-manifest-"));
  roots.push(root);
  return root;
}

async function put(root: string, relative: string, contents: string) {
  const filename = path.join(root, relative);
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, contents);
  return filename;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  connection = {
    listDir: vi.fn(async (directory: string) => (await readdir(directory, { withFileTypes: true })).map((entry) => ({
      name: entry.name,
      type: entry.isSymbolicLink() ? "symlink" as const : entry.isDirectory() ? "dir" as const : "file" as const,
    }))),
    stat: vi.fn(async (filename: string) => {
      const info = await stat(filename);
      return { size: info.size, modifiedAt: info.mtime.toISOString(), isDirectory: info.isDirectory() };
    }),
    readFile: vi.fn(async (filename: string, maxBytes?: number) => {
      const bytes = await readFile(filename);
      return maxBytes === undefined ? bytes : bytes.subarray(0, maxBytes);
    }),
    listDirDetailed: vi.fn(), mkdir: vi.fn(), rename: vi.fn(), remove: vi.fn(), writeFile: vi.fn(), disconnect: vi.fn(),
    // Connection's additive API keeps metadata of a link separate from its target.
    lstat: vi.fn(async (filename: string) => {
      const info = await lstat(filename);
      return { size: info.size, modifiedAt: info.mtime.toISOString(), isDirectory: info.isDirectory(),
        type: info.isSymbolicLink() ? "symlink" as const : info.isDirectory() ? "directory" as const : "file" as const };
    }),
  } as DeviceConnection;
  dependencies.createConnection.mockResolvedValue(connection);
});

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("physical device manifest", () => {
  it("preserves every root, real alias and nested revision before catalog deduplication", async () => {
    const first = await fixture();
    const second = await fixture();
    const one = await put(first, "gc/USA/revisions/Zelda (USA) (Rev 1).rvz", "first");
    const two = await put(second, "gamecube/Europe/Zelda (Europe) (Rev 2).rvz", "second version");
    const result = await scanDevice({ ...device, scanPaths: [{ path: first, type: "rom" }, { path: second, type: "rom" }] });
    expect(result.reliable).toBe(true);
    expect(result.games).toHaveLength(1);
    expect(result.files.filter((file) => file.type === "file")).toEqual([
      expect.objectContaining({ path: one, scanRoot: first, platformAlias: "gc", relativePath: "USA/revisions/Zelda (USA) (Rev 1).rvz", platform: "gc", source: "rom", size: 5, gameKey: "Zelda|gc" }),
      expect.objectContaining({ path: two, scanRoot: second, platformAlias: "gamecube", relativePath: "Europe/Zelda (Europe) (Rev 2).rvz", platform: "gc", source: "rom", size: 14, gameKey: "Zelda|gc" }),
    ]);
    expect(result.files.find((file) => file.path === one)?.modifiedAt).toBe((await stat(one)).mtime.toISOString());
    expect(connection.readFile).not.toHaveBeenCalled();
  });

  it("captures multidisc descriptors and all tracks without phantom track games", async () => {
    const root = await fixture();
    const track = await put(root, "psx-multidisc/Chrono Cross/track01.bin", "track payload");
    const audio = await put(root, "psx-multidisc/Chrono Cross/track02.wav", "audio payload");
    const cue = await put(root, "psx-multidisc/Chrono Cross/Chrono Cross (Disc 1).cue", 'FILE "track01.bin" BINARY\n TRACK 01 MODE2/2352\nFILE "track02.wav" WAVE\n TRACK 02 AUDIO\n');
    const discTwo = await put(root, "psx-multidisc/Chrono Cross/Chrono Cross (Disc 2).chd", "second disc");
    const playlist = await put(root, "playstation/Chrono Cross.m3u", `${cue}\n${discTwo}\n`);
    const result = await scanDevice({ ...device, scanPaths: [{ path: root, type: "rom" }] });
    expect(result.reliable).toBe(true);
    expect(result.games).toEqual([expect.objectContaining({ title: "Chrono Cross", platform: "psx", originalFile: "Chrono Cross.m3u" })]);
    for (const filename of [track, audio, cue, discTwo, playlist]) {
      expect(result.files.find((file) => file.path === filename)).toEqual(expect.objectContaining({ type: "file", gameKey: "Chrono Cross|psx", size: (await stat(filename)).size }));
    }
    expect(vi.mocked(connection.readFile).mock.calls.map(([filename]) => filename).sort()).toEqual([cue, playlist].sort());
    expect(vi.mocked(connection.readFile).mock.calls.every(([, limit]) => limit === 1024 * 1024 + 1)).toBe(true);
  });

  it("handles GDI references while retaining an unrelated standalone BIN", async () => {
    const root = await fixture();
    const track = await put(root, "dreamcast/tracks/track01.bin", "track");
    const descriptor = await put(root, "dreamcast/Sonic Adventure.gdi", '1\n1 0 4 2352 "tracks/track01.bin" 0\n');
    const standalone = await put(root, "dreamcast/Standalone.bin", "standalone");
    const result = await scanDevice({ ...device, scanPaths: [{ path: root, type: "rom" }] });
    expect(result.games.map((game) => game.title).sort()).toEqual(["Sonic Adventure", "Standalone"]);
    expect(result.files.find((file) => file.path === track)?.gameKey).toBe("Sonic Adventure|dreamcast");
    expect(result.files.find((file) => file.path === descriptor)?.gameKey).toBe("Sonic Adventure|dreamcast");
    expect(result.files.find((file) => file.path === standalone)?.gameKey).toBe("Standalone|dreamcast");
  });

  it("maps a standalone valid CUE to its named game after proving actual tracks", async () => {
    const root = await fixture();
    const track = await put(root, "psx/track01.bin", "track");
    const cue = await put(root, "psx/Silent Hill.cue", 'FILE "track01.bin" BINARY\n TRACK 01 MODE2/2352\n');
    const result = await scanDevice({ ...device, scanPaths: [{ path: root, type: "rom" }] });
    expect(result.games).toEqual([expect.objectContaining({ title: "Silent Hill", originalFile: "Silent Hill.cue" })]);
    expect(result.files.find((file) => file.path === track)?.gameKey).toBe("Silent Hill|psx");
    expect(result.files.find((file) => file.path === cue)?.gameKey).toBe("Silent Hill|psx");
  });

  it("uses native bounded LOCAL descriptor streams and safely inventories an escaping symlink", async () => {
    const root = await fixture();
    const outside = await fixture();
    const track = await put(root, "psx/track.bin", "own track");
    const cue = await put(root, "psx/Game.cue", 'FILE "track.bin" BINARY\n TRACK 01 MODE2/2352\n');
    const link = path.join(root, "psx", "escape");
    await symlink(outside, link);
    vi.stubEnv("LOCAL_FILES_ROOT", root);
    vi.stubEnv("LOCAL_FILES_ROOTS", "");
    const actual = await vi.importActual<typeof import("@/lib/connection")>("@/lib/connection");
    connection = await actual.createConnection(device);
    dependencies.createConnection.mockResolvedValue(connection);
    const legacyRead = vi.spyOn(connection, "readFile");
    const boundedRead = vi.spyOn(connection.fileIo!, "readTo");
    const result = await scanDevice({ ...device, scanPaths: [{ path: root, type: "rom" }] });
    const canonicalRoot = await realpath(root);
    expect(result.reliable).toBe(true);
    expect(result.games).toEqual([expect.objectContaining({ title: "Game", originalFile: "Game.cue" })]);
    expect(result.files.find((file) => file.path === path.join(canonicalRoot, "psx", "track.bin"))?.gameKey).toBe("Game|psx");
    expect(result.files.find((file) => file.path === path.join(canonicalRoot, "psx", "escape"))).toEqual(expect.objectContaining({ type: "symlink", size: (await lstat(link)).size }));
    expect(legacyRead).not.toHaveBeenCalled();
    expect(boundedRead).toHaveBeenCalledTimes(1);
    expect(boundedRead).toHaveBeenCalledWith(path.join(canonicalRoot, "psx", "Game.cue"), expect.anything(), expect.objectContaining({ maxBytes: 1024 * 1024 + 1, expectedBytes: (await stat(cue)).size, timeoutMs: 15_000 }));
  });

  it("does not invent one game owner for a track explicitly shared by different games", async () => {
    const root = await fixture();
    const track = await put(root, "psx/shared.bin", "shared track");
    await put(root, "psx/First.cue", 'FILE "shared.bin" BINARY\n TRACK 01 MODE2/2352\n');
    await put(root, "psx/Second.cue", 'FILE "shared.bin" BINARY\n TRACK 01 MODE2/2352\n');
    const result = await scanDevice({ ...device, scanPaths: [{ path: root, type: "rom" }] });
    expect(result.games.map((game) => game.title).sort()).toEqual(["First", "Second"]);
    expect(result.files.find((file) => file.path === track)?.gameKey).toBeUndefined();
  });

  it("inventories unknown and hidden content without inventing catalog mappings", async () => {
    const root = await fixture();
    const unknown = await put(root, "unknown-platform/deeper/Anything.bin", "unknown");
    const hidden = await put(root, "nes/.hidden/metadata.txt", "metadata");
    const stray = await put(root, "readme.txt", "root metadata");
    const result = await scanDevice({ ...device, scanPaths: [{ path: root, type: "rom" }] });
    expect(result.reliable).toBe(true);
    expect(result.games).toEqual([]);
    expect(result.files.find((file) => file.path === unknown)).toEqual(expect.objectContaining({ platform: null, platformAlias: "unknown-platform", size: 7 }));
    for (const filename of [unknown, hidden, stray]) expect(result.files.find((file) => file.path === filename)?.gameKey).toBeUndefined();
  });

  it("records a symlink itself and never traverses or reads its escaping target", async () => {
    const root = await fixture();
    const outside = await fixture();
    await put(outside, "Outside.nes", "not owned by scan");
    await mkdir(path.join(root, "nes"));
    const link = path.join(root, "nes", "escape");
    await symlink(outside, link);
    const result = await scanDevice({ ...device, scanPaths: [{ path: root, type: "rom" }] });
    expect(result.reliable).toBe(true);
    expect(result.games).toEqual([]);
    expect(result.files.find((file) => file.path === link)).toEqual(expect.objectContaining({ type: "symlink", size: (await lstat(link)).size }));
    expect(connection.listDir).not.toHaveBeenCalledWith(link, expect.anything());
    expect(connection.stat).not.toHaveBeenCalledWith(link);
    expect(connection.readFile).not.toHaveBeenCalled();
  });

  it("never follows a directory that became a symlink after its parent listing", async () => {
    const root = await fixture();
    const outside = await fixture();
    const link = path.join(root, "nes");
    await symlink(outside, link);
    vi.mocked(connection.listDir).mockResolvedValue([{ name: "nes", type: "dir" }]);
    const result = await scanDevice({ ...device, scanPaths: [{ path: root, type: "rom" }] });
    expect(result.reliable).toBe(false);
    expect(result.files).toEqual([expect.objectContaining({ type: "symlink", path: link })]);
    expect(connection.listDir).toHaveBeenCalledTimes(1);
    expect(connection.stat).not.toHaveBeenCalledWith(link);
  });

  it("marks an unsupported special file type unreliable without reading it", async () => {
    const root = await fixture();
    const filename = await put(root, "nes/Mario.nes", "game");
    const ownStat = vi.mocked(connection.lstat!).getMockImplementation()!;
    vi.mocked(connection.lstat!).mockImplementation(async (candidate) => candidate === filename
      ? { size: 0, isDirectory: false, type: "other" } : ownStat(candidate));
    const result = await scanDevice({ ...device, scanPaths: [{ path: root, type: "rom" }] });
    expect(result.reliable).toBe(false);
    expect(result.games).toEqual([]);
    expect(result.files.find((file) => file.path === filename)).toBeUndefined();
    expect(connection.stat).not.toHaveBeenCalledWith(filename);
    expect(connection.readFile).not.toHaveBeenCalled();
  });

  it("retains readable files and marks an unreadable subtree unreliable", async () => {
    const root = await fixture();
    const good = await put(root, "nes/Mario.nes", "game");
    const badDirectory = path.join(root, "nes", "bad");
    await mkdir(badDirectory);
    const realList = vi.mocked(connection.listDir).getMockImplementation()!;
    vi.mocked(connection.listDir).mockImplementation(async (directory, options) => {
      if (directory === badDirectory) throw new Error("unreadable subtree");
      return realList(directory, options);
    });
    const result = await scanDevice({ ...device, scanPaths: [{ path: root, type: "rom" }] });
    expect(result.reliable).toBe(false);
    expect(result.games).toHaveLength(1);
    expect(result.files.find((file) => file.path === good)?.size).toBe(4);
  });

  it("marks a file stat failure unreliable instead of reporting fabricated metadata", async () => {
    const root = await fixture();
    const filename = await put(root, "nes/Mario.nes", "game");
    const realStat = vi.mocked(connection.stat).getMockImplementation()!;
    vi.mocked(connection.stat).mockImplementation(async (candidate) => {
      if (candidate === filename) throw new Error("file vanished");
      return realStat(candidate);
    });
    const result = await scanDevice({ ...device, scanPaths: [{ path: root, type: "rom" }] });
    expect(result.reliable).toBe(false);
    expect(result.games).toEqual([]);
    expect(result.files.find((file) => file.path === filename)).toBeUndefined();
  });

  it("bounds recursive depth and never calls an incomplete inventory reliable", async () => {
    const root = await fixture();
    const filename = await put(root, `nes/${Array.from({ length: 20 }, (_, index) => `level${index}`).join("/")}/Deep.nes`, "deep");
    const result = await scanDevice({ ...device, scanPaths: [{ path: root, type: "rom" }] });
    expect(result.reliable).toBe(false);
    expect(result.files.find((file) => file.path === filename)).toBeUndefined();
    expect(connection.listDir).toHaveBeenCalledTimes(17);
  });

  it("bounds total entries across directories without reading beyond the limit", async () => {
    (connection as DeviceConnection & { lstat?: unknown }).lstat = undefined;
    vi.mocked(connection.stat).mockResolvedValue({ size: 1, isDirectory: false });
    vi.mocked(connection.stat).mockResolvedValueOnce({ size: 0, isDirectory: true });
    vi.mocked(connection.listDir).mockResolvedValue(Array.from({ length: 100_001 }, (_, index) => ({ name: `metadata${index}.txt`, type: "file" as const })));
    const result = await scanDevice({ ...device, scanPaths: [{ path: "/own-fixture", type: "rom" }] });
    expect(result.reliable).toBe(false);
    expect(result.files).toHaveLength(100_000);
    expect(connection.stat).toHaveBeenCalledTimes(100_001);
  });

  it("does no I/O for an already aborted scan", async () => {
    const controller = new AbortController();
    controller.abort(new Error("cancelled before opening"));
    await expect(scanDevice({ ...device, scanPaths: [{ path: "/own-fixture", type: "rom" }] }, undefined, { signal: controller.signal })).rejects.toThrow("cancelled before opening");
    expect(dependencies.createConnection).not.toHaveBeenCalled();
  });

  it("waits for an in-flight listing then disconnects without any later stat or descriptor read", async () => {
    const controller = new AbortController();
    let finish!: (entries: { name: string; type: "file" }[]) => void;
    let started!: () => void;
    const listingStarted = new Promise<void>((resolve) => { started = resolve; });
    vi.mocked(connection.stat).mockResolvedValue({ size: 0, isDirectory: true });
    vi.mocked(connection.listDir).mockImplementation(() => { started(); return new Promise((resolve) => { finish = resolve; }); });
    const running = scanDevice({ ...device, scanPaths: [{ path: "/own-fixture", type: "rom" }] }, undefined, { signal: controller.signal });
    await listingStarted;
    controller.abort(new Error("cancelled listing"));
    expect(connection.disconnect).not.toHaveBeenCalled();
    finish([{ name: "never-stat.nes", type: "file" }]);
    await expect(running).rejects.toThrow("cancelled listing");
    expect(connection.stat).toHaveBeenCalledTimes(1);
    expect(connection.readFile).not.toHaveBeenCalled();
    expect(connection.disconnect).toHaveBeenCalledTimes(1);
  });

  it("propagates lease loss and stops before traversing or reading any further entries", async () => {
    const root = await fixture();
    await put(root, "nes/Mario.nes", "game");
    const assertActive = vi.fn(async () => {
      if (vi.mocked(connection.listDir).mock.calls.length > 0) throw new Error("lease lost");
    });
    await expect(scanDevice({ ...device, scanPaths: [{ path: root, type: "rom" }] }, undefined, { assertActive })).rejects.toThrow("lease lost");
    expect(connection.listDir).toHaveBeenCalledTimes(1);
    expect(connection.stat).toHaveBeenCalledTimes(1);
    expect(connection.readFile).not.toHaveBeenCalled();
    expect(connection.disconnect).toHaveBeenCalledTimes(1);
  });

  it("does not map invalid, missing or escaping descriptor references to games", async () => {
    const root = await fixture();
    await put(root, "psx/Missing.cue", 'FILE "absent.bin" BINARY\n TRACK 01 MODE2/2352\n');
    await put(root, "psx/Escape.m3u", "/unconfigured/Outside.chd\n");
    await put(root, "dreamcast/Invalid.gdi", "2\n1 0 4 2352 track.bin 0\n");
    const result = await scanDevice({ ...device, scanPaths: [{ path: root, type: "rom" }] });
    expect(result.reliable).toBe(true);
    expect(result.games).toEqual([]);
    expect(result.files.filter((file) => file.type === "file").every((file) => file.gameKey === undefined)).toBe(true);
    expect(vi.mocked(connection.readFile).mock.calls.every(([filename]) => filename.startsWith(root + path.sep))).toBe(true);
  });

  it("records an oversized descriptor but refuses to read or map it", async () => {
    const root = await fixture();
    const filename = await put(root, "psx/Huge.m3u", "x".repeat(1024 * 1024 + 1));
    const result = await scanDevice({ ...device, scanPaths: [{ path: root, type: "rom" }] });
    expect(result.reliable).toBe(false);
    expect(result.files.find((file) => file.path === filename)).toEqual(expect.objectContaining({ size: 1024 * 1024 + 1, type: "file" }));
    expect(result.games).toEqual([]);
    expect(connection.readFile).not.toHaveBeenCalled();
  });

  it("marks a descriptor read failure unreliable without inventing a descriptor game", async () => {
    const root = await fixture();
    await put(root, "psx/Missing.m3u", "Game.chd\n");
    vi.mocked(connection.readFile).mockRejectedValue(new Error("descriptor became unreadable"));
    const result = await scanDevice({ ...device, scanPaths: [{ path: root, type: "rom" }] });
    expect(result.reliable).toBe(false);
    expect(result.games).toEqual([]);
    expect(result.files.some((file) => file.path.endsWith("Missing.m3u"))).toBe(true);
  });

  it("keeps platform-specific ROM subdirs while preserving their actual alias path", async () => {
    const root = await fixture();
    const filename = await put(root, "originalxbox/roms/USA/Halo.iso", "game");
    await put(root, "originalxbox/covers/Halo.zip", "cover metadata");
    const result = await scanDevice({ ...device, scanPaths: [{ path: root, type: "rom" }] });
    expect(result.reliable).toBe(true);
    expect(result.games).toEqual([expect.objectContaining({ originalFile: "roms/USA/Halo.iso", title: "Halo", platform: "xbox" })]);
    expect(result.files.find((file) => file.path === filename)).toEqual(expect.objectContaining({ platformAlias: "originalxbox", relativePath: "roms/USA/Halo.iso", gameKey: "Halo|xbox" }));
    expect(result.files.find((file) => file.path.endsWith("covers/Halo.zip"))?.gameKey).toBeUndefined();
  });

  it("does not call a missing required ROM subdir a reliable empty platform", async () => {
    const root = await fixture();
    await put(root, "originalxbox/covers/Halo.png", "cover metadata");
    const result = await scanDevice({ ...device, scanPaths: [{ path: root, type: "rom" }] });
    expect(result.reliable).toBe(false);
    expect(result.games).toEqual([]);
    expect(result.files.some((file) => file.path.endsWith("Halo.png"))).toBe(true);
  });

  it("records complete Steam physical content and keeps blacklist filtering on catalog entries", async () => {
    const root = await fixture();
    const portal = await put(root, "Portal/bin/client.so", "steam data");
    const ignored = await put(root, "Steamworks SDK/redist/helper.bin", "blacklisted data");
    const result = await scanDevice({ ...device, blacklist: ["Steamworks*"], scanPaths: [{ path: root, type: "steam" }] });
    expect(result.reliable).toBe(true);
    expect(result.games).toEqual([expect.objectContaining({ title: "Portal", originalFile: "Portal", source: "steam" })]);
    expect(result.files.find((file) => file.path === portal)).toEqual(expect.objectContaining({ platform: "steam", source: "steam", relativePath: "Portal/bin/client.so", gameKey: "Portal|steam" }));
    expect(result.files.find((file) => file.path === ignored)?.gameKey).toBeUndefined();
  });
});

describe("shared descriptor token spans", () => {
  it("preserves exact CUE filename tokens among BOM, CRLF, Unicode, comments and repeated lookalikes", () => {
    const contents = '\uFEFFREM "Äudio track.bin" is only a comment\r\n FILE "Äudio track.bin" BINARY\r\n TRACK 01 MODE2/2352\r\n FILE unquoted.bin BINARY\r\n TRACK 02 AUDIO\r\n';
    const parsed = parseScanDescriptor(contents, ".cue")!;
    expect(parsed.map((reference) => ({ reference: reference.reference, token: contents.slice(reference.start, reference.end), quote: reference.quote }))).toEqual([
      { reference: "Äudio track.bin", token: '"Äudio track.bin"', quote: '"' },
      { reference: "unquoted.bin", token: "unquoted.bin", quote: null },
    ]);
    let rewritten = contents;
    for (const reference of [...parsed].reverse()) rewritten = rewritten.slice(0, reference.start) + '"moved track.bin"' + rewritten.slice(reference.end);
    expect(rewritten).toContain('REM "Äudio track.bin" is only a comment\r\n');
    expect(parseScanDescriptor(rewritten, ".cue")?.map((reference) => reference.reference)).toEqual(["moved track.bin", "moved track.bin"]);
  });

  it("returns exact GDI tokens and M3U trimmed line spans", () => {
    const gdi = '1\r\n 1 0 4 2352 "tracks/Äudio.bin" 0\r\n';
    const gdiReference = parseScanDescriptor(gdi, ".gdi")![0];
    expect(gdiReference.reference).toBe("tracks/Äudio.bin");
    expect(gdi.slice(gdiReference.start, gdiReference.end)).toBe('"tracks/Äudio.bin"');
    const m3u = '\uFEFF# comment\r\n  ../psx-multidisc/Game (Disc 1).cue  \r\n/roms/psx/Game (Disc 2).chd\n';
    expect(parseScanDescriptor(m3u, ".m3u")?.map((reference) => m3u.slice(reference.start, reference.end))).toEqual([
      "../psx-multidisc/Game (Disc 1).cue", "/roms/psx/Game (Disc 2).chd",
    ]);
  });

  it.each([
    ["", ".gdi"], ["1\n", ".gdi"], ['FILE "track.bin" BINARY\n', ".cue"],
    ["# comments only\n", ".m3u"], ["track.bin\0\n", ".m3u"], ["unknown", ".other"],
    ['REM ' + "x".repeat(600) + '\nFILE "track.bin" BINARY\nTRACK 01 AUDIO\n', ".cue"],
    ["x".repeat(1024 * 1024 + 1), ".m3u"],
    [Array.from({ length: 1001 }, (_, index) => `disc${index}.chd`).join("\n"), ".m3u"],
  ])("rejects invalid or unsupported bounded descriptors", (contents, kind) => {
    expect(parseScanDescriptor(contents, kind)).toBeNull();
  });
});
