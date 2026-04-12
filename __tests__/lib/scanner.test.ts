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
  it("deduplicates same game scanned from aliased directories", () => {
    // Both gc/ and gamecube/ map to platform "gc" via getPlatformByDir
    const games = [
      { originalFile: "Zelda.rvz", title: "Zelda", platform: "gc", platformLabel: "GameCube", source: "rom" as const },
      { originalFile: "Zelda.rvz", title: "Zelda", platform: "gc", platformLabel: "GameCube", source: "rom" as const },
    ];
    const deduped = deduplicateGames(games);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].platform).toBe("gc");
  });

  it("collapses multi-disc games into one entry", () => {
    const games = [
      { originalFile: "D2 (Disc 1).chd", title: "D2", platform: "dreamcast", platformLabel: "Dreamcast", source: "rom" as const },
      { originalFile: "D2 (Disc 2).chd", title: "D2", platform: "dreamcast", platformLabel: "Dreamcast", source: "rom" as const },
      { originalFile: "D2 (Disc 3).chd", title: "D2", platform: "dreamcast", platformLabel: "Dreamcast", source: "rom" as const },
      { originalFile: "D2 (Disc 4).chd", title: "D2", platform: "dreamcast", platformLabel: "Dreamcast", source: "rom" as const },
    ];
    const deduped = deduplicateGames(games);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].title).toBe("D2");
  });
});
