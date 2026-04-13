import { describe, it, expect } from "vitest";
import { parseChdmanProgress } from "@/lib/converter";

describe("parseChdmanProgress", () => {
  it("extracts percentage from normal progress output", () => {
    expect(parseChdmanProgress("Compressing, 45.2% complete...")).toBe(45.2);
  });

  it("extracts 100% from done output", () => {
    expect(
      parseChdmanProgress(
        "Compressing, 100.0% complete... (ratio=55.2%)"
      )
    ).toBe(100.0);
  });

  it("returns null for non-progress output", () => {
    expect(parseChdmanProgress("chdman - MAME Compressed Hunks of Data")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseChdmanProgress("")).toBeNull();
  });
});
