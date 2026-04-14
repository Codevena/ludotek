import path from "path";
import fs from "fs";
import { prisma } from "@/lib/prisma";

const DATA_DIR = path.join(process.cwd(), "data");
const COVERS_DIR = path.join(DATA_DIR, "covers");
const SCREENSHOTS_DIR = path.join(DATA_DIR, "screenshots");
const ARTWORK_DIR = path.join(DATA_DIR, "artwork");

const DOWNLOAD_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 1;
const DELAY_BETWEEN_GAMES_MS = 100;

async function downloadImage(
  url: string,
  destPath: string,
  retries = MAX_RETRIES
): Promise<Buffer | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const dir = path.dirname(destPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(destPath, buffer);

      return buffer;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (attempt < retries) {
        console.warn(
          `Download attempt ${attempt + 1} failed for ${url}: ${message}. Retrying...`
        );
      } else {
        console.warn(
          `Download failed for ${url} after ${retries + 1} attempts: ${message}`
        );
      }
    }
  }
  return null;
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function cacheGameImages(gameId: number): Promise<void> {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) {
    console.warn(`cacheGameImages: game ${gameId} not found`);
    return;
  }

  let localCoverPath = game.localCoverPath;
  const localScreenshotPaths: string[] = parseJsonArray(
    game.localScreenshotPaths
  );
  const localArtworkPaths: string[] = parseJsonArray(game.localArtworkPaths);

  // --- Cover ---
  const coverSkip =
    localCoverPath &&
    fs.existsSync(path.join(DATA_DIR, localCoverPath));

  if (!coverSkip && game.coverUrl) {
    const relativePath = `covers/${gameId}.jpg`;
    const destPath = path.join(COVERS_DIR, `${gameId}.jpg`);

    const buffer = await downloadImage(game.coverUrl, destPath);
    if (buffer) {
      await prisma.cacheEntry.upsert({
        where: { sourceUrl: game.coverUrl },
        create: {
          type: "cover",
          sourceUrl: game.coverUrl,
          localPath: relativePath,
          fileSize: buffer.length,
          gameId,
        },
        update: {
          localPath: relativePath,
          fileSize: buffer.length,
        },
      });
      localCoverPath = relativePath;
    }
  }

  // --- Screenshots ---
  const screenshotUrls = parseJsonArray(game.screenshotUrls);
  for (let i = 0; i < screenshotUrls.length; i++) {
    const url = screenshotUrls[i];
    const relativePath = `screenshots/${gameId}/${i}.jpg`;
    const destPath = path.join(SCREENSHOTS_DIR, `${gameId}`, `${i}.jpg`);

    const buffer = await downloadImage(url, destPath);
    if (buffer) {
      await prisma.cacheEntry.upsert({
        where: { sourceUrl: url },
        create: {
          type: "screenshot",
          sourceUrl: url,
          localPath: relativePath,
          fileSize: buffer.length,
          gameId,
        },
        update: {
          localPath: relativePath,
          fileSize: buffer.length,
        },
      });
      if (!localScreenshotPaths.includes(relativePath)) {
        localScreenshotPaths[i] = relativePath;
      }
    }
  }

  // --- Artwork ---
  const artworkUrls = parseJsonArray(game.artworkUrls);
  for (let i = 0; i < artworkUrls.length; i++) {
    const url = artworkUrls[i];
    const relativePath = `artwork/${gameId}/${i}.jpg`;
    const destPath = path.join(ARTWORK_DIR, `${gameId}`, `${i}.jpg`);

    const buffer = await downloadImage(url, destPath);
    if (buffer) {
      await prisma.cacheEntry.upsert({
        where: { sourceUrl: url },
        create: {
          type: "artwork",
          sourceUrl: url,
          localPath: relativePath,
          fileSize: buffer.length,
          gameId,
        },
        update: {
          localPath: relativePath,
          fileSize: buffer.length,
        },
      });
      if (!localArtworkPaths.includes(relativePath)) {
        localArtworkPaths[i] = relativePath;
      }
    }
  }

  // --- Update Game record ---
  await prisma.game.update({
    where: { id: gameId },
    data: {
      localCoverPath: localCoverPath ?? game.localCoverPath,
      localScreenshotPaths: localScreenshotPaths.length
        ? JSON.stringify(localScreenshotPaths)
        : game.localScreenshotPaths,
      localArtworkPaths: localArtworkPaths.length
        ? JSON.stringify(localArtworkPaths)
        : game.localArtworkPaths,
    },
  });
}

export async function cacheAllImages(
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const games = await prisma.game.findMany({
    where: {
      localCoverPath: null,
      coverUrl: { not: null },
    },
    select: { id: true },
  });

  const total = games.length;

  for (let i = 0; i < games.length; i++) {
    try {
      await cacheGameImages(games[i].id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`cacheAllImages: failed for game ${games[i].id}: ${message}`);
    }

    onProgress?.(i + 1, total);

    if (i < games.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_GAMES_MS));
    }
  }
}

export async function clearCache(): Promise<void> {
  // Remove files
  for (const dir of [COVERS_DIR, SCREENSHOTS_DIR, ARTWORK_DIR]) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // Delete all CacheEntry rows
  await prisma.cacheEntry.deleteMany();

  // Reset local paths on all games
  await prisma.game.updateMany({
    data: {
      localCoverPath: null,
      localScreenshotPaths: null,
      localArtworkPaths: null,
    },
  });
}

interface CacheTypeStats {
  count: number;
  size: number;
}

interface CacheStats {
  covers: CacheTypeStats;
  screenshots: CacheTypeStats;
  artwork: CacheTypeStats;
  total: CacheTypeStats;
}

export async function getCacheStats(): Promise<CacheStats> {
  const groups = await prisma.cacheEntry.groupBy({
    by: ["type"],
    _count: { id: true },
    _sum: { fileSize: true },
  });

  const stats: CacheStats = {
    covers: { count: 0, size: 0 },
    screenshots: { count: 0, size: 0 },
    artwork: { count: 0, size: 0 },
    total: { count: 0, size: 0 },
  };

  for (const group of groups) {
    const count = group._count.id;
    const size = group._sum.fileSize ?? 0;

    if (group.type === "cover") {
      stats.covers = { count, size };
    } else if (group.type === "screenshot") {
      stats.screenshots = { count, size };
    } else if (group.type === "artwork") {
      stats.artwork = { count, size };
    }

    stats.total.count += count;
    stats.total.size += size;
  }

  return stats;
}
