import { describe, it, expect } from "vitest";
import { detectGames, UploadedFile } from "@/lib/upload-detector";

describe("detectGames", () => {
  it("returns empty array for no files", () => {
    expect(detectGames([], "SNES")).toEqual([]);
  });

  it("returns empty array when all files are metadata", () => {
    const files: UploadedFile[] = [
      { name: "readme.txt", size: 100, path: "/tmp/readme.txt" },
      { name: "cover.png", size: 5000, path: "/tmp/cover.png" },
      { name: "info.xml", size: 200, path: "/tmp/info.xml" },
      { name: "data.json", size: 300, path: "/tmp/data.json" },
      { name: "art.jpg", size: 4000, path: "/tmp/art.jpg" },
      { name: "build.log", size: 150, path: "/tmp/build.log" },
      { name: "track.sub", size: 600, path: "/tmp/track.sub" },
      { name: "track.idx", size: 100, path: "/tmp/track.idx" },
      { name: "patch.sbi", size: 50, path: "/tmp/patch.sbi" },
    ];
    expect(detectGames(files, "PSX")).toEqual([]);
  });

  it("detects a single SNES ROM with no conversion", () => {
    const files: UploadedFile[] = [
      { name: "Super Mario World (USA).sfc", size: 1048576, path: "/tmp/smw.sfc" },
    ];
    const result = detectGames(files, "SNES");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      title: "Super Mario World",
      type: "single",
      discCount: 1,
      conversion: "none",
      totalSize: 1048576,
    });
    expect(result[0].files).toHaveLength(1);
    expect(result[0].id).toBeTruthy();
  });

  it("detects a single PSX ISO with CHD conversion", () => {
    const files: UploadedFile[] = [
      { name: "Crash Bandicoot (USA).iso", size: 524288000, path: "/tmp/crash.iso" },
    ];
    const result = detectGames(files, "PSX");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      title: "Crash Bandicoot",
      type: "single",
      discCount: 1,
      conversion: "chd",
      totalSize: 524288000,
    });
  });

  it("detects a single GC ISO with RVZ conversion", () => {
    const files: UploadedFile[] = [
      { name: "Super Smash Bros Melee (USA).iso", size: 1459978240, path: "/tmp/ssbm.iso" },
    ];
    const result = detectGames(files, "GC");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      title: "Super Smash Bros Melee",
      type: "single",
      discCount: 1,
      conversion: "rvz",
      totalSize: 1459978240,
    });
  });

  it("groups multi-disc PSX bin+cue into a single game with CHD conversion", () => {
    const files: UploadedFile[] = [
      { name: "Final Fantasy VII (USA) (Disc 1).bin", size: 700000000, path: "/tmp/ff7d1.bin" },
      { name: "Final Fantasy VII (USA) (Disc 1).cue", size: 200, path: "/tmp/ff7d1.cue" },
      { name: "Final Fantasy VII (USA) (Disc 2).bin", size: 680000000, path: "/tmp/ff7d2.bin" },
      { name: "Final Fantasy VII (USA) (Disc 2).cue", size: 200, path: "/tmp/ff7d2.cue" },
      { name: "Final Fantasy VII (USA) (Disc 3).bin", size: 650000000, path: "/tmp/ff7d3.bin" },
      { name: "Final Fantasy VII (USA) (Disc 3).cue", size: 200, path: "/tmp/ff7d3.cue" },
      { name: "Final Fantasy VII (USA) (Disc 4).bin", size: 620000000, path: "/tmp/ff7d4.bin" },
      { name: "Final Fantasy VII (USA) (Disc 4).cue", size: 200, path: "/tmp/ff7d4.cue" },
    ];
    const result = detectGames(files, "PSX");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      title: "Final Fantasy VII",
      type: "multi-disc",
      discCount: 4,
      conversion: "chd",
    });
    expect(result[0].files).toHaveLength(8);
    expect(result[0].totalSize).toBe(700000000 + 200 + 680000000 + 200 + 650000000 + 200 + 620000000 + 200);
    // Verify disc numbers are assigned
    const binsWithDisc = result[0].files.filter((f) => f.name.endsWith(".bin") && f.disc);
    expect(binsWithDisc).toHaveLength(4);
    expect(binsWithDisc.map((f) => f.disc).sort()).toEqual([1, 2, 3, 4]);
  });

  it("recognizes (Disk N) pattern", () => {
    const files: UploadedFile[] = [
      { name: "Resident Evil 2 (USA) (Disk 1).iso", size: 600000000, path: "/tmp/re2d1.iso" },
      { name: "Resident Evil 2 (USA) (Disk 2).iso", size: 590000000, path: "/tmp/re2d2.iso" },
    ];
    const result = detectGames(files, "PSX");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("multi-disc");
    expect(result[0].discCount).toBe(2);
  });

  it("recognizes (CD N) pattern", () => {
    const files: UploadedFile[] = [
      { name: "Phantasmagoria (USA) (CD 1).bin", size: 500000000, path: "/tmp/p1.bin" },
      { name: "Phantasmagoria (USA) (CD 1).cue", size: 200, path: "/tmp/p1.cue" },
      { name: "Phantasmagoria (USA) (CD 2).bin", size: 480000000, path: "/tmp/p2.bin" },
      { name: "Phantasmagoria (USA) (CD 2).cue", size: 200, path: "/tmp/p2.cue" },
    ];
    const result = detectGames(files, "PSX");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("multi-disc");
    expect(result[0].discCount).toBe(2);
  });

  it("separates different games into different groups", () => {
    const files: UploadedFile[] = [
      { name: "Crash Bandicoot (USA).bin", size: 500000000, path: "/tmp/crash.bin" },
      { name: "Crash Bandicoot (USA).cue", size: 200, path: "/tmp/crash.cue" },
      { name: "Spyro the Dragon (USA).bin", size: 450000000, path: "/tmp/spyro.bin" },
      { name: "Spyro the Dragon (USA).cue", size: 200, path: "/tmp/spyro.cue" },
    ];
    const result = detectGames(files, "PSX");
    expect(result).toHaveLength(2);
    const titles = result.map((g) => g.title).sort();
    expect(titles).toEqual(["Crash Bandicoot", "Spyro the Dragon"]);
    result.forEach((game) => {
      expect(game.type).toBe("single");
      expect(game.discCount).toBe(1);
      expect(game.conversion).toBe("chd");
    });
  });

  it("skips metadata files mixed with valid game files", () => {
    const files: UploadedFile[] = [
      { name: "Zelda.sfc", size: 1048576, path: "/tmp/zelda.sfc" },
      { name: "Zelda.txt", size: 500, path: "/tmp/zelda.txt" },
      { name: "cover.png", size: 100000, path: "/tmp/cover.png" },
    ];
    const result = detectGames(files, "SNES");
    expect(result).toHaveLength(1);
    expect(result[0].files).toHaveLength(1);
    expect(result[0].files[0].name).toBe("Zelda.sfc");
  });

  it("assigns CHD conversion for PS2 platform", () => {
    const files: UploadedFile[] = [
      { name: "Shadow of the Colossus (USA).iso", size: 3000000000, path: "/tmp/sotc.iso" },
    ];
    const result = detectGames(files, "PS2");
    expect(result).toHaveLength(1);
    expect(result[0].conversion).toBe("chd");
  });

  it("assigns CHD conversion for Dreamcast GDI files", () => {
    const files: UploadedFile[] = [
      { name: "Sonic Adventure (USA).gdi", size: 1200000000, path: "/tmp/sa.gdi" },
    ];
    const result = detectGames(files, "Dreamcast");
    expect(result).toHaveLength(1);
    expect(result[0].conversion).toBe("chd");
  });

  it("assigns CHD conversion for Saturn", () => {
    const files: UploadedFile[] = [
      { name: "Nights Into Dreams (USA).iso", size: 500000000, path: "/tmp/nights.iso" },
    ];
    const result = detectGames(files, "Saturn");
    expect(result[0].conversion).toBe("chd");
  });

  it("assigns CHD conversion for SegaCD", () => {
    const files: UploadedFile[] = [
      { name: "Sonic CD (USA).iso", size: 400000000, path: "/tmp/soniccd.iso" },
    ];
    const result = detectGames(files, "SegaCD");
    expect(result[0].conversion).toBe("chd");
  });

  it("groups .bin and .cue with same base name for single-disc game", () => {
    const files: UploadedFile[] = [
      { name: "Tekken 3 (USA).bin", size: 600000000, path: "/tmp/tekken3.bin" },
      { name: "Tekken 3 (USA).cue", size: 200, path: "/tmp/tekken3.cue" },
    ];
    const result = detectGames(files, "PSX");
    expect(result).toHaveLength(1);
    expect(result[0].files).toHaveLength(2);
    expect(result[0].type).toBe("single");
    expect(result[0].discCount).toBe(1);
  });
});
