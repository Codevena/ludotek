import { beforeEach, describe, expect, it, vi } from "vitest";
const connection = vi.hoisted(() => ({ created: vi.fn() }));
vi.mock("ssh2", () => ({ Client: class {
  constructor() { connection.created(); }
  on() { return this; }
  connect() { throw new Error("Unexpected connection attempt"); }
} }));
import { generateM3u, getTransferPath, transferFiles, transferM3u } from "@/lib/uploader";
beforeEach(() => vi.clearAllMocks());

describe("upload path validation", () => {
  it("rejects a zero-file transfer before opening a connection", async () => {
    await expect(transferFiles("test.invalid", "test", "toy", [])).rejects.toThrow();
    expect(connection.created).not.toHaveBeenCalled();
  });
  it.each(["../psx", "PSX", "unknown", "psx\n", "psx/../saturn"])("rejects unknown platform %j", async (platform) => {
    expect(() => getTransferPath(platform, false)).toThrow();
    expect(() => generateM3u("Game", platform, ["Game.chd"])).toThrow();
    await expect(transferM3u("test.invalid", "test", "toy", "Game.m3u", "", platform)).rejects.toThrow();
    expect(connection.created).not.toHaveBeenCalled();
  });
  it.each(["../Game.chd", "a/b.chd", "a\\b.chd", "Game\nother.chd", "Game\0.chd", "", ".", ".."])("rejects unsafe disc name %j", (filename) => {
    expect(() => generateM3u("Game", "psx", [filename])).toThrow();
  });
  it.each(["../Game.m3u", "a/b.m3u", "a\\b.m3u", "Game\nother.m3u", "Game\0.m3u", ""])("rejects unsafe playlist name %j before connection", async (filename) => {
    await expect(transferM3u("test.invalid", "test", "toy", filename, "", "psx")).rejects.toThrow();
    expect(connection.created).not.toHaveBeenCalled();
  });
});
