import { describe, it, expect } from "vitest";
import { generateM3u, getTransferPath, transferFiles, transferM3u } from "@/lib/uploader";
describe("profile-derived upload paths and relative playlists", () => {
  it("never encodes a Deck/SD mount into playlists", () => {
    expect(generateM3u("Game", "psx", ["Game (Disc 1).chd", "Game (Disc 2).chd"])).toBe("Game (Disc 1).chd\nGame (Disc 2).chd\n");
    expect(generateM3u("Game", "saturn", ["Game.chd"])).toBe("Game.chd\n");
  });
  it("requires the actual profile directory for both single and multi-disc groups", () => {
    expect(getTransferPath("psx", true, "/fixture/roms/PSX")).toBe("/fixture/roms/PSX/");
    expect(getTransferPath("psx", false, "/fixture/roms/PSX")).toBe("/fixture/roms/PSX/");
    expect(() => getTransferPath("psx", false)).toThrow();
  });
  it("retired transport entry points cannot perform direct writes", async () => {
    await expect(transferFiles("test.invalid", "test", "toy", [{}])).rejects.toThrow("retired");
    await expect(transferM3u("test.invalid", "test", "toy", "Game.m3u", "Game.chd\n", "psx")).rejects.toThrow("retired");
  });
});
