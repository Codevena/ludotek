import { describe, it, expect } from "vitest";
import { buildRomSearchUrl } from "@/lib/rom-search";

const ROMSFUN = "https://romsfun.com/roms/{platformLabel}/?q={title}";

describe("buildRomSearchUrl", () => {
  it("slugifies platformLabel when caller passes a human label (e.g. 'PlayStation 2')", () => {
    // Regression: previously "PlayStation 2" was inserted raw and URL-encoded to "PlayStation%202"
    expect(buildRomSearchUrl(ROMSFUN, "Siren", "ps2", "PlayStation 2")).toBe(
      "https://romsfun.com/roms/playstation-2/?q=siren",
    );
  });

  it("preserves already-slugified platformSlug", () => {
    expect(buildRomSearchUrl(ROMSFUN, "Sonic", "megadrive", "sega-genesis")).toBe(
      "https://romsfun.com/roms/sega-genesis/?q=sonic",
    );
  });

  it("falls back to slugified platform id when platformSlug is omitted", () => {
    expect(buildRomSearchUrl(ROMSFUN, "Mario", "snes")).toBe(
      "https://romsfun.com/roms/snes/?q=mario",
    );
  });

  it("lowercases {title} and uses + for spaces", () => {
    expect(buildRomSearchUrl(ROMSFUN, "Resident Evil 4", "ps2", "playstation-2")).toBe(
      "https://romsfun.com/roms/playstation-2/?q=resident+evil+4",
    );
  });

  it("supports {titleSlug} and {platform} variables", () => {
    const template = "https://example.com/{platform}/{titleSlug}";
    expect(buildRomSearchUrl(template, "Resident Evil 4", "ps2")).toBe(
      "https://example.com/ps2/resident-evil-4",
    );
  });

  it("supports {titleEncoded} for raw URL-encoded titles", () => {
    const template = "https://example.com/?q={titleEncoded}";
    expect(buildRomSearchUrl(template, "Resident Evil 4", "ps2")).toBe(
      "https://example.com/?q=Resident%20Evil%204",
    );
  });
});
