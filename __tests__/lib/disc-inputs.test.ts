import { mkdtemp, mkdir, rm, writeFile, symlink } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reads = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuth: () => null }));
vi.mock("fs/promises", async (original) => ({
  ...await original<typeof import("fs/promises")>(), open: reads.open,
}));
import { POST } from "@/app/api/upload/detect/route";

const roots: string[] = [];
let sessionDir: string;
let bytesRead: number;
beforeEach(async () => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  bytesRead = 0;
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises");
  reads.open.mockImplementation(async (filename: string, flags: string) => {
    const handle = await actual.open(filename, flags);
    const read = handle.read.bind(handle);
    return {
      close: handle.close.bind(handle),
      read: async (buffer: Buffer, offset: number, length: number, position: number) => {
        const result = await read(buffer, offset, length, position);
        bytesRead += result.bytesRead;
        return result;
      },
    };
  });
  await mkdir("/tmp/ludotek-uploads", { recursive: true });
  sessionDir = await mkdtemp("/tmp/ludotek-uploads/test-disc-"); roots.push(sessionDir);
});
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});
async function detect(platform = "psx") {
  return POST(new NextRequest("http://localhost/api/upload/detect", {
    method: "POST", body: JSON.stringify({ sessionId: path.basename(sessionDir), platform }),
  }));
}
const cue = (name: string) => `FILE "${name}" BINARY\n TRACK 01 MODE1/2352\n INDEX 01 00:00:00\n`;

describe("session disc descriptors", () => {
  it.each(["missing.bin", "../outside.bin", "/tmp/absolute.bin", "C:\\absolute.bin"])("rejects missing or outside CUE reference %j", async (reference) => {
    await writeFile(path.join(sessionDir, "Game.cue"), cue(reference));
    expect((await detect()).status).toBe(400);
  });
  it.each(['FILE "missing.bin BINARY\n', 'FILE "a.bin" MP3\n', "REM no file reference\n", 'TRACK 01 MODE1/2352\nFILE "a.bin" BINARY\n'])("rejects malformed CUE %j", async (text) => {
    await writeFile(path.join(sessionDir, "Game.cue"), text);
    await writeFile(path.join(sessionDir, "a.bin"), "toy");
    expect((await detect()).status).toBe(400);
  });
  it.each(["0\n", "2\n1 0 4 2352 a.bin 0\n", '1\n1 0 4 2352 "a.bin 0\n', "1\n1 0 7 2352 a.bin 0\n", "1\n1 0 4 2352 a.bin -1\n"])("rejects malformed GDI %j", async (text) => {
    await writeFile(path.join(sessionDir, "Game.gdi"), text);
    await writeFile(path.join(sessionDir, "a.bin"), "toy");
    expect((await detect("dreamcast")).status).toBe(400);
  });
  it("resolves quoted and unquoted GDI names relative to their descriptor", async () => {
    await mkdir(path.join(sessionDir, "disc"));
    await writeFile(path.join(sessionDir, "disc/Game.gdi"), '2\n1 0 4 2352 "data track.bin" 0\n2 450 0 2352 audio.raw 0\n');
    await writeFile(path.join(sessionDir, "disc/data track.bin"), "toy");
    await writeFile(path.join(sessionDir, "disc/audio.raw"), "toy");
    const response = await detect("dreamcast");
    expect(response.status).toBe(200);
    expect((await response.json()).games).toHaveLength(1);
  });
  it.each(["cue", "gdi"])("accepts MAME single-quoted names in %s", async (extension) => {
    await writeFile(path.join(sessionDir, `Game.${extension}`), extension === "cue" ?
      "FILE 'data track.bin' BINARY\n TRACK 01 MODE1/2352\n INDEX 01 00:00:00\n" : "1\n1 0 4 2352 'data track.bin' 0\n");
    await writeFile(path.join(sessionDir, "data track.bin"), "toy");
    const response = await detect(extension === "gdi" ? "dreamcast" : "psx");
    expect(response.status).toBe(200);
    expect((await response.json()).games).toHaveLength(1);
  });
  it.each(["'FILE'", "F'IL'E"])("validates quoted FILE commands exactly as the converter: %s", async (command) => {
    await writeFile(path.join(sessionDir, "a.bin"), "toy");
    await writeFile(path.join(sessionDir, "Game.cue"), cue("a.bin") + `${command} '/tmp/absolute.bin' BINARY\n TRACK 02 AUDIO\n`);
    expect((await detect()).status).toBe(400);
  });
  it("validates commands after MAME's 510-byte line-buffer boundary", async () => {
    await writeFile(path.join(sessionDir, "a.bin"), "toy");
    await writeFile(path.join(sessionDir, "Game.cue"), cue("a.bin") + "REM ".padEnd(510, " ") + 'FILE "/tmp/absolute.bin" BINARY\n TRACK 02 AUDIO\n');
    expect((await detect()).status).toBe(400);
  });
  it("keeps equally named tracks in another directory independent", async () => {
    await mkdir(path.join(sessionDir, "disc"));
    await mkdir(path.join(sessionDir, "other"));
    await writeFile(path.join(sessionDir, "disc/Game.cue"), cue("track.bin"));
    await writeFile(path.join(sessionDir, "disc/track.bin"), "toy");
    await writeFile(path.join(sessionDir, "other/track.bin"), "independent");
    const { games } = await (await detect()).json();
    expect(games).toHaveLength(2);
    expect(games.find((g: { title: string }) => g.title === "Game").files).toHaveLength(2);
    expect(games.find((g: { title: string }) => g.title === "track").files).toHaveLength(1);
  });
  it("rejects session and descriptor symlink escapes", async () => {
    const outside = await mkdtemp("/tmp/ludotek-disc-escape-"); roots.push(outside);
    await writeFile(path.join(outside, "Game.cue"), cue("track.bin"));
    await symlink(path.join(outside, "Game.cue"), path.join(sessionDir, "Game.cue"));
    expect((await detect()).status).toBe(400);
    const alias = sessionDir + "-alias"; roots.push(alias);
    await symlink(outside, alias);
    sessionDir = alias;
    expect((await detect()).status).toBe(400);
  });
  it("uses the canonical descriptor extension when a session contains an internal alias", async () => {
    await writeFile(path.join(sessionDir, "Zulu.gdi"), "1\n1 0 4 2352 track.bin 0\n");
    await writeFile(path.join(sessionDir, "track.bin"), "toy");
    await symlink(path.join(sessionDir, "Zulu.gdi"), path.join(sessionDir, "AAAA.cue"));
    const response = await detect("dreamcast");
    expect(response.status).toBe(200);
    const { games } = await response.json();
    expect(games).toHaveLength(1);
    expect(games[0].files.map((file: { name: string }) => file.name).sort()).toEqual(["Zulu.gdi", "track.bin"]);
  });
  it.each([0, 1])("allows 1 MiB but rejects an extra byte (extra=%i)", async (extra) => {
    const header = cue("a.bin");
    const contents = header + "REM " + " ".repeat(1024 * 1024 - Buffer.byteLength(header) - 4 + extra);
    await writeFile(path.join(sessionDir, "Game.cue"), contents);
    await writeFile(path.join(sessionDir, "a.bin"), "toy");
    expect((await detect()).status).toBe(extra === 0 ? 200 : 400);
    expect(bytesRead).toBe(1024 * 1024 + extra);
  });
  it("never reads more than 1 MiB and a probe byte even if a descriptor is larger", async () => {
    await writeFile(path.join(sessionDir, "Game.cue"), cue("a.bin") + "REM " + " ".repeat(2 * 1024 * 1024));
    await writeFile(path.join(sessionDir, "a.bin"), "toy");
    expect((await detect()).status).toBe(400);
    expect(bytesRead).toBe(1024 * 1024 + 1);
  });
  it.each([1000, 1001])("enforces the actual FILE reference count (%i)", async (count) => {
    await writeFile(path.join(sessionDir, "Game.cue"), cue("a.bin").repeat(count));
    await writeFile(path.join(sessionDir, "a.bin"), "toy");
    const response = await detect();
    expect(response.status).toBe(count === 1000 ? 200 : 400);
    if (count === 1000) expect((await response.json()).games[0].files).toHaveLength(2);
  });
});
