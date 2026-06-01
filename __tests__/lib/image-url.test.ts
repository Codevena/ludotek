import { describe, it, expect } from "vitest";
import { coverUrl, screenshotUrls, artworkUrls } from "@/lib/image-url";

describe("coverUrl", () => {
  it("prefers local path and appends ?v= cache-buster derived from coverUrl", () => {
    const url = coverUrl({
      localCoverPath: "covers/42.jpg",
      coverUrl: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1abc.jpg",
    });
    expect(url).toMatch(/^\/api\/cache\/covers\/42\.jpg\?v=[a-z0-9]+$/);
  });

  it("changes cache-buster when source coverUrl changes (different IGDB cover)", () => {
    const a = coverUrl({
      localCoverPath: "covers/42.jpg",
      coverUrl: "https://images.igdb.com/t_cover_big/co1abc.jpg",
    });
    const b = coverUrl({
      localCoverPath: "covers/42.jpg",
      coverUrl: "https://images.igdb.com/t_cover_big/co2xyz.jpg",
    });
    expect(a).not.toBe(b);
  });

  it("returns remote URL when no local path", () => {
    expect(
      coverUrl({ localCoverPath: null, coverUrl: "https://remote/cover.jpg" }),
    ).toBe("https://remote/cover.jpg");
  });

  it("returns local path without cache-buster when coverUrl missing", () => {
    expect(
      coverUrl({ localCoverPath: "covers/5.jpg", coverUrl: null }),
    ).toBe("/api/cache/covers/5.jpg");
  });

  it("returns undefined when nothing available", () => {
    expect(coverUrl({ localCoverPath: null, coverUrl: null })).toBeUndefined();
  });
});

describe("screenshotUrls", () => {
  it("cache-busts each local screenshot by its source URL", () => {
    const urls = screenshotUrls({
      localScreenshotPaths: JSON.stringify(["screenshots/1/0.jpg", "screenshots/1/1.jpg"]),
      screenshotUrls: JSON.stringify([
        "https://igdb/sc1.jpg",
        "https://igdb/sc2.jpg",
      ]),
    });
    expect(urls).toHaveLength(2);
    expect(urls[0]).toMatch(/^\/api\/cache\/screenshots\/1\/0\.jpg\?v=[a-z0-9]+$/);
    expect(urls[1]).toMatch(/^\/api\/cache\/screenshots\/1\/1\.jpg\?v=[a-z0-9]+$/);
    expect(urls[0]).not.toBe(urls[1]);
  });

  it("falls back to remote URL when local missing at index", () => {
    const urls = screenshotUrls({
      localScreenshotPaths: JSON.stringify(["screenshots/1/0.jpg"]),
      screenshotUrls: JSON.stringify(["https://igdb/sc1.jpg", "https://igdb/sc2.jpg"]),
    });
    expect(urls[1]).toBe("https://igdb/sc2.jpg");
  });
});

describe("artworkUrls", () => {
  it("cache-busts each local artwork by its source URL", () => {
    const urls = artworkUrls({
      localArtworkPaths: JSON.stringify(["artwork/1/0.jpg"]),
      artworkUrls: JSON.stringify(["https://igdb/art1.jpg"]),
    });
    expect(urls[0]).toMatch(/^\/api\/cache\/artwork\/1\/0\.jpg\?v=[a-z0-9]+$/);
  });
});
