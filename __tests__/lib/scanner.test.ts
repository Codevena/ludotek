import { describe, it, expect } from "vitest";
import { parseRomListing, deduplicateGames } from "@/lib/scanner";

describe("parseRomListing", () => {
  it("extracts game files from ls output", () => {
    const lsOutput = "Silent Hill 2.chd\nmetadata.txt\nSonic.rvz\nmedia\n.sbi";
    const games = parseRomListing(lsOutput, "ps2");
    expect(games).toEqual([
      { originalFile: "Silent Hill 2.chd", title: "Silent Hill 2", platform: "ps2", platformLabel: "PlayStation 2", source: "rom" },
      { originalFile: "Sonic.rvz", title: "Sonic", platform: "ps2", platformLabel: "PlayStation 2", source: "rom" },
    ]);
  });

  it("skips metadata and system files", () => {
    const lsOutput = "metadata.txt\nsysteminfo.txt\nmedia\n.sbi";
    const games = parseRomListing(lsOutput, "snes");
    expect(games).toEqual([]);
  });
});

describe("deduplicateGames", () => {
  it("prefers canonical platform key for duplicates", () => {
    const games = [
      { originalFile: "Zelda.rvz", title: "Zelda", platform: "gc", platformLabel: "GameCube", source: "rom" as const },
      { originalFile: "Zelda.rvz", title: "Zelda", platform: "gamecube", platformLabel: "GameCube", source: "rom" as const },
    ];
    const deduped = deduplicateGames(games);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].platform).toBe("gc");
  });
});
