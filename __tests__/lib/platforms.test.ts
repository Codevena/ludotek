import { describe, it, expect } from "vitest";
import { PLATFORM_CONFIG, getPlatformByDir, getAllPlatforms } from "@/lib/platforms";

describe("Platform Config", () => {
  it("maps snes directory to Super Nintendo", () => {
    const p = getPlatformByDir("snes");
    expect(p).toBeDefined();
    expect(p!.label).toBe("Super Nintendo");
    expect(p!.id).toBe("snes");
  });

  it("maps psx-multidisc to PlayStation with canonical key psx", () => {
    const p = getPlatformByDir("psx-multidisc");
    expect(p).toBeDefined();
    expect(p!.id).toBe("psx");
    expect(p!.label).toBe("PlayStation");
  });

  it("maps gamecube alias to gc canonical key", () => {
    const p = getPlatformByDir("gamecube");
    expect(p).toBeDefined();
    expect(p!.id).toBe("gc");
  });

  it("maps dreamcast-multidisc to dreamcast", () => {
    const p = getPlatformByDir("dreamcast-multidisc");
    expect(p).toBeDefined();
    expect(p!.id).toBe("dreamcast");
  });

  it("returns undefined for unknown directory", () => {
    expect(getPlatformByDir("unknown")).toBeUndefined();
  });

  it("has all platforms defined", () => {
    expect(getAllPlatforms().length).toBeGreaterThanOrEqual(50);
  });
});
