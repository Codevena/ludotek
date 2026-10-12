import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Game } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { artworkUrls, screenshotUrls } from "@/lib/image-url";

const prismaMock = vi.hoisted(() => ({
  game: { findUnique: vi.fn(), update: vi.fn() },
  cacheEntry: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
// Preserve byte/source-identity assertions; actual admission uses isolated SQLite elsewhere.
vi.mock("@/lib/provider-budget", () => ({
  providerFetch: (_provider: string, url: string, init?: RequestInit) => fetch(url, init),
  isAdmissionError: () => false,
  abortableDelay: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
}));
vi.mock("@/lib/job-admission", () => ({ getJobContext: () => undefined }));

interface CacheRow {
  gameId: number;
  sourceUrl: string;
  type: string;
  localPath: string;
  fileSize: number;
}

const SOURCE_A = "https://images.example/a.jpg";
const SOURCE_B = "https://images.example/b.jpg";
const SOURCE_C = "https://images.example/c.jpg";
const BUFFER_A = Buffer.from("actual image A bytes");
const BUFFER_B = Buffer.from("actual image B bytes");
const BUFFER_C = Buffer.from("actual image C bytes");

let tempDir: string;
let game: Game;
let rows: Map<string, CacheRow>;
let downloadedUrls: string[];
let imageBytes: Map<string, Buffer>;
let cacheGameImages: typeof import("@/lib/image-cache").cacheGameImages;
let deleteGameFiles: typeof import("@/lib/image-cache").deleteGameFiles;

function rowKey(gameId: number, sourceUrl: string): string {
  return JSON.stringify([gameId, sourceUrl]);
}

function writeCachedFile(relativePath: string, bytes: Buffer): void {
  const fullPath = path.join(tempDir, "data", relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, bytes);
}

function readCachedFile(relativePath: string | null): Buffer {
  expect(relativePath).not.toBeNull();
  return fs.readFileSync(path.join(tempDir, "data", relativePath!));
}

function readDisplayedImage(url: string): Buffer {
  expect(url).toMatch(/^\/api\/cache\//);
  return readCachedFile(url.slice("/api/cache/".length).split("?")[0]);
}

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ludotek-image-cache-"));
  rows = new Map();
  downloadedUrls = [];
  imageBytes = new Map([
    [SOURCE_A, BUFFER_A],
    [SOURCE_B, BUFFER_B],
    [SOURCE_C, BUFFER_C],
  ]);
  game = {
    id: 42,
    title: "Image cache fixture",
    originalFile: "fixture.rom",
    platform: "snes",
    platformLabel: "SNES",
    source: "rom",
    coverUrl: null,
    screenshotUrls: null,
    artworkUrls: null,
    igdbId: null,
    igdbScore: null,
    metacriticScore: null,
    releaseDate: null,
    genres: null,
    developer: null,
    publisher: null,
    summary: null,
    videoIds: null,
    franchise: null,
    themes: null,
    aiFunFacts: null,
    aiStory: null,
    aiEnrichedAt: null,
    isFavorite: false,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    localCoverPath: null,
    localScreenshotPaths: null,
    localArtworkPaths: null,
  };
  prismaMock.game.findUnique.mockImplementation(async () => ({ ...game }));
  prismaMock.game.update.mockImplementation(async ({ data }) => {
    Object.assign(game, data);
    return { ...game };
  });
  prismaMock.cacheEntry.findUnique.mockImplementation(async ({ where }) => {
    const { gameId, sourceUrl } = where.gameId_sourceUrl;
    const row = rows.get(rowKey(gameId, sourceUrl));
    return row ? { localPath: row.localPath } : null;
  });
  prismaMock.cacheEntry.upsert.mockImplementation(async ({ create, update }) => {
    const key = rowKey(create.gameId, create.sourceUrl);
    const row = rows.has(key) ? { ...rows.get(key)!, ...update } : create;
    rows.set(key, row);
    return row;
  });
  prismaMock.cacheEntry.deleteMany.mockImplementation(async ({ where }) => {
    for (const [key, row] of Array.from(rows.entries())) {
      if (where.gameId.in.includes(row.gameId)) rows.delete(key);
    }
    return { count: 0 };
  });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    downloadedUrls.push(url);
    const bytes = imageBytes.get(url);
    return bytes
      ? new Response(Uint8Array.from(bytes))
      : new Response(null, { status: 503 });
  }));
  vi.spyOn(console, "warn").mockImplementation(() => {});

  // The module captures its data root at import time. No real project data is used.
  const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  try {
    ({ cacheGameImages, deleteGameFiles } = await import("@/lib/image-cache"));
  } finally {
    cwdSpy.mockRestore();
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("image cache source identity", () => {
  it("preserves the actual cover bytes when its source changes A → B → A", async () => {
    game.coverUrl = SOURCE_A;
    await cacheGameImages(game.id);
    const pathA = game.localCoverPath;
    expect(readCachedFile(pathA)).toEqual(BUFFER_A);

    game.coverUrl = SOURCE_B;
    await cacheGameImages(game.id);
    expect(readCachedFile(game.localCoverPath)).toEqual(BUFFER_B);

    game.coverUrl = SOURCE_A;
    await cacheGameImages(game.id);
    expect(readCachedFile(game.localCoverPath)).toEqual(BUFFER_A);
    expect(game.localCoverPath).toBe(pathA);
    expect(downloadedUrls).toEqual([SOURCE_A, SOURCE_B]);
  });

  it("keeps screenshot bytes correct after replacement, reordering and source removal", async () => {
    game.screenshotUrls = JSON.stringify([SOURCE_A, SOURCE_B]);
    await cacheGameImages(game.id);

    game.screenshotUrls = JSON.stringify([SOURCE_C, SOURCE_A]);
    await cacheGameImages(game.id);
    expect(screenshotUrls(game).map(readDisplayedImage)).toEqual([BUFFER_C, BUFFER_A]);

    game.screenshotUrls = JSON.stringify([SOURCE_A, SOURCE_C]);
    await cacheGameImages(game.id);
    expect(screenshotUrls(game).map(readDisplayedImage)).toEqual([BUFFER_A, BUFFER_C]);

    game.screenshotUrls = JSON.stringify([SOURCE_C]);
    await cacheGameImages(game.id);
    expect(screenshotUrls(game).map(readDisplayedImage)).toEqual([BUFFER_C]);
    expect(downloadedUrls).toEqual([SOURCE_A, SOURCE_B, SOURCE_C]);
  });

  it.each([
    ["screenshots", "screenshotUrls", "localScreenshotPaths", screenshotUrls],
    ["artwork", "artworkUrls", "localArtworkPaths", artworkUrls],
  ] as const)("keeps %s download failures in their source slot", async (_, sourceField, localField, displayedUrls) => {
    game[sourceField] = JSON.stringify([SOURCE_A, SOURCE_B]);
    await cacheGameImages(game.id);

    imageBytes.delete(SOURCE_C);
    game[sourceField] = JSON.stringify([SOURCE_C, SOURCE_B]);
    await cacheGameImages(game.id);

    const urls = displayedUrls(game);
    expect(urls[0]).toBe(SOURCE_C);
    expect(readDisplayedImage(urls[1])).toEqual(BUFFER_B);
    expect(JSON.parse(game[localField]!)[0]).toBeNull();

    game[sourceField] = JSON.stringify([SOURCE_B, SOURCE_C]);
    await cacheGameImages(game.id);
    const reordered = displayedUrls(game);
    expect(readDisplayedImage(reordered[0])).toEqual(BUFFER_B);
    expect(reordered[1]).toBe(SOURCE_C);

    game[sourceField] = JSON.stringify([SOURCE_C]);
    await cacheGameImages(game.id);
    expect(displayedUrls(game)).toEqual([SOURCE_C]);

    game[sourceField] = null;
    await cacheGameImages(game.id);
    expect(displayedUrls(game)).toEqual([]);
    expect(game[localField]).toBeNull();
  });

  it.each([
    ["cover", "coverUrl", "localCoverPath", "covers/42.jpg"],
    ["screenshot", "screenshotUrls", "localScreenshotPaths", "screenshots/42/0.jpg"],
    ["artwork", "artworkUrls", "localArtworkPaths", "artwork/42/0.jpg"],
  ] as const)("redownloads ambiguous legacy %s paths even when the file exists", async (type, sourceField, localField, legacyPath) => {
    rows.set(rowKey(game.id, SOURCE_A), {
      gameId: game.id,
      sourceUrl: SOURCE_A,
      type,
      localPath: legacyPath,
      fileSize: BUFFER_B.length,
    });
    writeCachedFile(legacyPath, BUFFER_B);
    game[sourceField] = type === "cover" ? SOURCE_A : JSON.stringify([SOURCE_A]);

    await cacheGameImages(game.id);
    const relativePath = type === "cover" ? game[localField] : JSON.parse(game[localField]!)[0];
    expect(readCachedFile(relativePath)).toEqual(BUFFER_A);
    expect(relativePath).not.toBe(legacyPath);
  });

  it("keeps the same source URL separate for each game and image type", async () => {
    game.coverUrl = SOURCE_A;
    game.screenshotUrls = JSON.stringify([SOURCE_A]);
    game.artworkUrls = JSON.stringify([SOURCE_A]);
    await cacheGameImages(game.id);

    const coverPath = game.localCoverPath!;
    const screenshotPath = JSON.parse(game.localScreenshotPaths!)[0];
    const artworkPath = JSON.parse(game.localArtworkPaths!)[0];
    expect(coverPath).toMatch(/^covers\/42\//);
    expect(screenshotPath).toMatch(/^screenshots\/42\//);
    expect(artworkPath).toMatch(/^artwork\/42\//);
    for (const relativePath of [coverPath, screenshotPath, artworkPath]) {
      expect(readCachedFile(relativePath)).toEqual(BUFFER_A);
    }

    game.id = 43;
    game.screenshotUrls = null;
    game.artworkUrls = null;
    await cacheGameImages(game.id);
    expect(game.localCoverPath).toMatch(/^covers\/43\//);
    expect(game.localCoverPath).not.toBe(coverPath);
    expect(readCachedFile(game.localCoverPath)).toEqual(BUFFER_A);
    expect(readCachedFile(coverPath)).toEqual(BUFFER_A);
  });

  it("redownloads a cache row pointing at another source's versioned path", async () => {
    game.coverUrl = SOURCE_B;
    await cacheGameImages(game.id);
    const pathB = game.localCoverPath!;
    rows.set(rowKey(game.id, SOURCE_A), {
      gameId: game.id, sourceUrl: SOURCE_A, type: "cover", localPath: pathB, fileSize: BUFFER_B.length,
    });

    game.coverUrl = SOURCE_A;
    await cacheGameImages(game.id);
    expect(readCachedFile(game.localCoverPath)).toEqual(BUFFER_A);
    expect(game.localCoverPath).not.toBe(pathB);
    expect(readCachedFile(pathB)).toEqual(BUFFER_B);
  });

  it("deletes new and legacy game files while preserving another game's cache", async () => {
    game.coverUrl = SOURCE_A;
    game.screenshotUrls = JSON.stringify([SOURCE_B]);
    game.artworkUrls = JSON.stringify([SOURCE_C]);
    await cacheGameImages(game.id);
    for (const relativePath of ["covers/42.jpg", "covers/42/versioned.jpg", "screenshots/42/0.jpg", "artwork/42/0.jpg", "covers/43/other.jpg"]) {
      writeCachedFile(relativePath, BUFFER_B);
    }
    rows.set(rowKey(43, SOURCE_B), {
      gameId: 43, sourceUrl: SOURCE_B, type: "cover", localPath: "covers/43/other.jpg", fileSize: BUFFER_B.length,
    });

    await deleteGameFiles([42]);
    for (const relativePath of ["covers/42", "covers/42.jpg", "screenshots/42", "artwork/42"]) {
      expect(fs.existsSync(path.join(tempDir, "data", relativePath))).toBe(false);
    }
    expect(readCachedFile("covers/43/other.jpg")).toEqual(BUFFER_B);
    expect(Array.from(rows.values()).map((row) => row.gameId)).toEqual([43]);
  });
});
