import { describe, it, expect } from "vitest";
import { cleanFilename } from "@/lib/filename-cleaner";

describe("cleanFilename", () => {
  it("strips file extension", () => {
    expect(cleanFilename("Silent Hill 2.chd")).toBe("Silent Hill 2");
  });

  it("strips region tags", () => {
    expect(cleanFilename("Zelda (Europe).rvz")).toBe("Zelda");
  });

  it("strips multiple tags", () => {
    expect(cleanFilename("Sonic (USA) (v2.00).7z")).toBe("Sonic");
  });

  it("strips disc info", () => {
    expect(cleanFilename("Final Fantasy VII (Disc 1).chd")).toBe("Final Fantasy VII");
  });

  it("strips revision tags", () => {
    expect(cleanFilename("Pokemon Red (USA, Europe) (Rev 1).gb")).toBe("Pokemon Red");
  });

  it("handles names with dots in title", () => {
    expect(cleanFilename("Dr. Mario.nes")).toBe("Dr. Mario");
  });

  it("trims whitespace", () => {
    expect(cleanFilename("  Game Title  .sfc")).toBe("Game Title");
  });

  it("handles complex real-world filenames", () => {
    expect(cleanFilename("Legend of Zelda, The - A Link to the Past (USA).sfc")).toBe("Legend of Zelda, The - A Link to the Past");
  });

  it("handles .sbi files as non-game", () => {
    expect(cleanFilename("game.sbi")).toBe("");
  });
});
