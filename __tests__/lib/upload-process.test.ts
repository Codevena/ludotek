import { mkdtemp, mkdir, rm, writeFile, symlink } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectGames } from "@/lib/upload-detector";

const deps = vi.hoisted(() => ({
  settings: vi.fn(), device: vi.fn(), convert: vi.fn(), transfer: vi.fn(), playlist: vi.fn(),
  gameUpsert: vi.fn(), gameDeviceUpsert: vi.fn(), platformUpsert: vi.fn(), count: vi.fn(),
  readdir: vi.fn(), stat: vi.fn(), realpath: vi.fn(), open: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireAuth: () => null }));
vi.mock("@/lib/encryption", () => ({ getDecryptedSettings: deps.settings, getDecryptedDevice: deps.device }));
vi.mock("@/lib/converter", () => ({ convert: deps.convert }));
vi.mock("@/lib/uploader", async (original) => ({
  ...await original<typeof import("@/lib/uploader")>(), transferFiles: deps.transfer, transferM3u: deps.playlist,
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  game: { upsert: deps.gameUpsert, count: deps.count },
  gameDevice: { upsert: deps.gameDeviceUpsert }, platform: { upsert: deps.platformUpsert },
} }));
vi.mock("fs/promises", async (original) => {
  const actual = await original<typeof import("fs/promises")>();
  return { ...actual, readdir: deps.readdir, stat: deps.stat, realpath: deps.realpath, open: deps.open };
});

import { POST as processUpload } from "@/app/api/upload/process/route";
import { POST as detectUpload } from "@/app/api/upload/detect/route";

const roots: string[] = [];
let sessionDir: string;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  deps.readdir.mockImplementation(actual.readdir);
  deps.stat.mockImplementation(actual.stat);
  deps.realpath.mockImplementation(actual.realpath);
  deps.open.mockImplementation(actual.open);
  deps.settings.mockResolvedValue({ activeDeviceId: 1 });
  deps.device.mockResolvedValue({ id: 1, protocol: "ssh", host: "test.invalid", port: 22, user: "test", password: "toy" });
  deps.convert.mockImplementation(async ({ outputPath }: { outputPath: string }) => { await writeFile(outputPath, "converted toy"); });
  deps.transfer.mockImplementation(async (_host: string, _user: string, _password: string, jobs: { localPath: string }[]) => {
    for (const job of jobs) expect((await actual.stat(job.localPath)).isFile()).toBe(true);
  });
  deps.playlist.mockResolvedValue(undefined);
  deps.gameUpsert.mockResolvedValue({ id: 10 });
  deps.gameDeviceUpsert.mockResolvedValue({});
  deps.platformUpsert.mockResolvedValue({});
  deps.count.mockResolvedValue(1);
  await mkdir("/tmp/ludotek-uploads", { recursive: true });
  sessionDir = await mkdtemp("/tmp/ludotek-uploads/test-process-");
  roots.push(sessionDir);
});
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function request(body: unknown, url = "process") {
  return new NextRequest(`http://localhost/api/upload/${url}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}
function validBody(platform = "psx") {
  return { sessionId: path.basename(sessionDir), platform, gameIds: ["game-abc-def"], deviceId: 1 };
}
async function files(entries: Record<string, string>) {
  for (const [name, text] of Object.entries(entries)) {
    await mkdir(path.dirname(path.join(sessionDir, name)), { recursive: true });
    await writeFile(path.join(sessionDir, name), text);
  }
}
async function run(platform = "psx", selected?: string[]) {
  const preview = await detectUpload(request(validBody(platform), "detect"));
  expect(preview.status).toBe(200);
  const { games } = await preview.json();
  const response = await processUpload(request({ ...validBody(platform), gameIds: selected ?? games.map((g: { id: string }) => g.id) }));
  const events = (await response.text()).split("\n\n").filter((line) => line.startsWith("data: ")).map((line) => JSON.parse(line.slice(6)));
  return { games, response, events };
}
function transferredNames() {
  return deps.transfer.mock.calls.flatMap((call) => call[3].map((job: { remotePath: string }) => path.basename(job.remotePath)));
}
function expectNoWork() {
  for (const fn of [deps.settings, deps.device, deps.readdir, deps.stat, deps.realpath, deps.open, deps.convert, deps.transfer, deps.gameUpsert, deps.gameDeviceUpsert]) expect(fn).not.toHaveBeenCalled();
}

describe("upload request validation", () => {
  const invalid = [null, [], 1, "body", { platform: "psx" },
    { sessionId: 1 }, { sessionId: [] }, { sessionId: "" }, { sessionId: "../outside" }, { sessionId: "bad\0name" },
    { platform: "../psx" }, { platform: "PSX" }, { platform: "unknown" }, { platform: 1 },
    { gameIds: "game-abc-def" }, { gameIds: [] }, { gameIds: [1] }, { gameIds: [""] },
    { deviceId: "1" }, { deviceId: "1junk" }, { deviceId: 1.5 }, { deviceId: 0 }, { deviceId: null },
  ];
  it.each(invalid.map((patch, index) => ({ patch, index })))("Process rejects invalid body $index before work", async ({ patch }) => {
    const body = patch !== null && typeof patch === "object" && !Array.isArray(patch) ? { ...validBody(), ...patch } : patch;
    // Missing required field is a whole body, not a patch.
    const response = await processUpload(request(patch && typeof patch === "object" && "platform" in patch && Object.keys(patch).length === 1 && patch.platform === "psx" ? patch : body));
    expect(response.status).toBe(400);
    expectNoWork();
  });
  it.each([null, [], 1, { sessionId: 1 }, { platform: "../psx" }, { platform: "unknown" }, { sessionId: "../outside" }])("Detect rejects invalid body before reading files: %j", async (patch) => {
    const body = patch !== null && typeof patch === "object" && !Array.isArray(patch) ? { ...validBody(), ...patch } : patch;
    expect((await detectUpload(request(body, "detect"))).status).toBe(400);
    expectNoWork();
  });
  it("both routes reject malformed JSON", async () => {
    for (const route of [processUpload, detectUpload]) {
      expect((await route(new NextRequest("http://localhost/api/upload", { method: "POST", body: "{" }))).status).toBe(400);
    }
    expectNoWork();
  });
});

describe("upload conversion and transfer", () => {
  it("transfers a standalone BIN and tracks the file actually sent", async () => {
    await files({ "Alone.bin": "toy" });
    const { events } = await run();
    expect(transferredNames()).toEqual(["Alone.bin"]);
    expect(deps.convert).not.toHaveBeenCalled();
    expect(deps.gameUpsert.mock.calls[0][0].create.originalFile).toBe("Alone.bin");
    expect(events).toContainEqual(expect.objectContaining({ type: "game-done" }));
  });
  it("rejects a metadata-only session without an empty transfer or original-file fallback", async () => {
    await files({ "readme.txt": "toy" });
    const response = await processUpload(request(validBody()));
    expect(response.status).toBe(400);
    expect(deps.convert).not.toHaveBeenCalled();
    expect(deps.transfer).not.toHaveBeenCalled();
    expect(deps.gameUpsert).not.toHaveBeenCalled();
  });
  it("Detect and Process group a GDI with differently named BIN/RAW tracks as one game", async () => {
    await files({ "Game.gdi": "2\n1 0 4 2352 track01.bin 0\n2 450 0 2352 track02.raw 0\n", "track01.bin": "toy", "track02.raw": "toy" });
    const { games, events } = await run("dreamcast");
    expect(games).toHaveLength(1);
    expect(games[0].files.map((f: { name: string }) => f.name).sort()).toEqual(["Game.gdi", "track01.bin", "track02.raw"]);
    expect(transferredNames()).toEqual(["Game.chd"]);
    expect(deps.gameUpsert).toHaveBeenCalledTimes(1);
    expect(events.find((event) => event.type === "game-done").gameId).toBe(games[0].id);
  });
  it("does not separately convert an ISO track referenced by a GDI", async () => {
    await files({ "Game.gdi": "1\n1 0 4 2048 data.iso 0\n", "data.iso": "toy" });
    await run("dreamcast");
    expect(transferredNames()).toEqual(["Game.chd"]);
    expect(deps.convert).toHaveBeenCalledTimes(1);
  });
  it("only consumes CUE references and preserves an unreferenced BIN in that game", async () => {
    await files({ "Game.cue": 'FILE "data.bin" BINARY\n TRACK 01 MODE1/2352\n INDEX 01 00:00:00\n', "data.bin": "toy", "Game.bin": "unreferenced" });
    const { games } = await run();
    expect(games).toHaveLength(1);
    expect(transferredNames()).toEqual(["Game.chd", "Game.bin"]);
  });
  it("consumes multiple CUE inputs including audio but sends an independent BIN", async () => {
    await files({ "Game.cue": 'FILE "data.bin" BINARY\n TRACK 01 MODE1/2352\n INDEX 01 00:00:00\nFILE "audio.wav" WAVE\n TRACK 02 AUDIO\n INDEX 01 00:00:00\n', "data.bin": "toy", "audio.wav": "toy", "Independent.bin": "toy" });
    const { games } = await run();
    expect(games).toHaveLength(2);
    expect(transferredNames().sort()).toEqual(["Game.chd", "Independent.bin"]);
  });
  it("passes already converted files through and uses DVD for PS2 ISO", async () => {
    await files({ "Converted.chd": "toy", "DVD.iso": "toy" });
    await run("ps2");
    expect(transferredNames().sort()).toEqual(["Converted.chd", "DVD.chd"]);
    expect(deps.convert).toHaveBeenCalledWith(expect.objectContaining({ chdType: "dvd", format: "chd" }));
  });
  it("rejects selection of a consumed track's former independent group", async () => {
    await files({ "Game.cue": 'FILE "Track.bin" BINARY\n TRACK 01 MODE1/2352\n INDEX 01 00:00:00\n', "Track.bin": "toy" });
    const oldTrackId = detectGames([{ name: "Track.bin", size: 3, path: path.join(sessionDir, "Track.bin") }], "psx")[0].id;
    const response = await processUpload(request({ ...validBody(), gameIds: [oldTrackId] }));
    expect(response.status).toBe(400);
    expect(deps.transfer).not.toHaveBeenCalled();
    expect(deps.gameUpsert).not.toHaveBeenCalled();
  });
  it.each(["convert", "transfer", "playlist"])("a %s failure never reports or stores a successful game", async (failure) => {
    await files({ "Game (Disc 1).iso": "toy", "Game (Disc 2).iso": "toy" });
    ({ convert: deps.convert, transfer: deps.transfer, playlist: deps.playlist })[failure as "convert" | "transfer" | "playlist"].mockRejectedValue(new Error("controlled failure"));
    const { events } = await run();
    expect(events).toContainEqual(expect.objectContaining({ type: "game-error" }));
    expect(events.some((event) => event.type === "game-done")).toBe(false);
    expect(deps.gameUpsert).not.toHaveBeenCalled();
    expect(deps.gameDeviceUpsert).not.toHaveBeenCalled();
    if (failure === "convert") expect(deps.transfer).not.toHaveBeenCalled();
  });
  it("rejects duplicate transfer basenames before conversion or transfer", async () => {
    await files({ "one/Game.iso": "toy", "two/Game.iso": "toy" });
    const { events } = await run();
    expect(events).toContainEqual(expect.objectContaining({ type: "game-error" }));
    expect(deps.convert).not.toHaveBeenCalled();
    expect(deps.transfer).not.toHaveBeenCalled();
    expect(deps.gameUpsert).not.toHaveBeenCalled();
  });
  it("rejects remote filename collisions across games and generated playlists", async () => {
    await files({ "Game (Disc 1).iso": "toy", "Game (Disc 2).iso": "toy", "Game.m3u": "toy" });
    const { events } = await run();
    expect(events.some((event) => event.type === "game-done")).toBe(false);
    expect(deps.convert).not.toHaveBeenCalled();
    expect(deps.transfer).not.toHaveBeenCalled();
    expect(deps.playlist).not.toHaveBeenCalled();
    expect(deps.gameUpsert).not.toHaveBeenCalled();
  });
  it("stores multi-disc games only after the playlist transfer succeeds", async () => {
    await files({ "Game (Disc 1).iso": "toy", "Game (Disc 2).iso": "toy" });
    deps.playlist.mockImplementation(async () => { expect(deps.gameUpsert).not.toHaveBeenCalled(); });
    const { events } = await run();
    expect(transferredNames()).toEqual(["Game (Disc 1).chd", "Game (Disc 2).chd"]);
    expect(deps.playlist.mock.calls[0][3]).toBe("Game.m3u");
    expect(deps.playlist.mock.calls[0][4]).toBe("/home/deck/EmuVirtual/Emulation/roms/psx-multidisc/Game (Disc 1).chd\n/home/deck/EmuVirtual/Emulation/roms/psx-multidisc/Game (Disc 2).chd\n");
    expect(deps.gameUpsert.mock.calls[0][0].create.originalFile).toBe("Game.m3u");
    expect(events).toContainEqual(expect.objectContaining({ type: "done", succeeded: 1, failed: 0 }));
  });
  it("rejects a descriptor reference escaping through a symlink", async () => {
    const outside = await mkdtemp("/tmp/ludotek-disc-outside-"); roots.push(outside);
    await writeFile(path.join(outside, "track.bin"), "toy");
    await files({ "Game.cue": 'FILE "track.bin" BINARY\n TRACK 01 MODE1/2352\n INDEX 01 00:00:00\n' });
    await symlink(path.join(outside, "track.bin"), path.join(sessionDir, "track.bin"));
    expect((await processUpload(request(validBody()))).status).toBe(400);
    expect(deps.convert).not.toHaveBeenCalled();
    expect(deps.transfer).not.toHaveBeenCalled();
    expect(deps.gameUpsert).not.toHaveBeenCalled();
  });
});
