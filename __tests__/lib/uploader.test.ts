import { describe, it, expect } from "vitest";
import { generateM3u, getTransferPath } from "@/lib/uploader";

describe("generateM3u", () => {
  it("generates EmuVirtual paths for PSX", () => {
    const result = generateM3u("Final Fantasy VII", "psx", [
      "Final Fantasy VII (Disc 1).chd",
      "Final Fantasy VII (Disc 2).chd",
      "Final Fantasy VII (Disc 3).chd",
    ]);
    expect(result).toBe(
      "/home/deck/EmuVirtual/Emulation/roms/psx-multidisc/Final Fantasy VII (Disc 1).chd\n" +
        "/home/deck/EmuVirtual/Emulation/roms/psx-multidisc/Final Fantasy VII (Disc 2).chd\n" +
        "/home/deck/EmuVirtual/Emulation/roms/psx-multidisc/Final Fantasy VII (Disc 3).chd\n"
    );
  });

  it("generates direct SD path for Saturn", () => {
    const result = generateM3u("Panzer Dragoon Saga", "saturn", [
      "Panzer Dragoon Saga (Disc 1).chd",
      "Panzer Dragoon Saga (Disc 2).chd",
    ]);
    expect(result).toBe(
      "/run/media/deck/SD/Emulation/roms/saturn-multidisc/Panzer Dragoon Saga (Disc 1).chd\n" +
        "/run/media/deck/SD/Emulation/roms/saturn-multidisc/Panzer Dragoon Saga (Disc 2).chd\n"
    );
  });
});

describe("getTransferPath", () => {
  it("returns multidisc path for multi-disc games", () => {
    const result = getTransferPath("psx", true);
    expect(result).toBe("/run/media/deck/SD/Emulation/roms/psx-multidisc/");
  });

  it("returns standard path for single ROM", () => {
    const result = getTransferPath("ps2", false);
    expect(result).toBe("/run/media/deck/SD/Emulation/roms/ps2/");
  });

  it("returns platform base path for M3U (single, not multidisc)", () => {
    const result = getTransferPath("psx", false);
    expect(result).toBe("/run/media/deck/SD/Emulation/roms/psx/");
  });
});
