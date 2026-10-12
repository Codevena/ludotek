import path from "path";
import fs from "fs";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { abortableDelay, isAdmissionError, providerFetch } from "@/lib/provider-budget";
import { getJobContext } from "@/lib/job-admission";

const DATA_DIR = path.join(process.cwd(), "data");
const COVERS_DIR = path.join(DATA_DIR, "covers");
const SCREENSHOTS_DIR = path.join(DATA_DIR, "screenshots");
const ARTWORK_DIR = path.join(DATA_DIR, "artwork");

const MAX_RETRIES = 1;
const DELAY_BETWEEN_GAMES_MS = 100;

async function downloadImage(
  url: string,
  destPath: string,
  retries = MAX_RETRIES
): Promise<Buffer | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await providerFetch("image", url);

      if (!response.ok) {
        throw new Error(`Image provider returned HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      await getJobContext()?.assertActive();
      const dir = path.dirname(destPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(destPath, buffer);

      return buffer;
    } catch (err) {
      if (isAdmissionError(err)) throw err;
      if (getJobContext()?.signal.aborted) throw getJobContext()!.signal.reason;
      if (attempt < retries) {
        console.warn(`Image download attempt ${attempt + 1} failed; retrying`);
      } else {
        console.warn(`Image download failed after ${retries + 1} attempts`);
      }
    }
  }
  return null;
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((url): url is string => typeof url === "string")
      : [];
  } catch {
    return [];
  }
}

function imagePath(
  directory: "covers" | "screenshots" | "artwork",
  gameId: number,
  sourceUrl: string,
): string {
  const sourceHash = createHash("sha256").update(sourceUrl).digest("hex");
  return `${directory}/${gameId}/${sourceHash}.jpg`;
}

/**
 * Upsert a per-game CacheEntry. Uses the (gameId, sourceUrl) compound unique
 * key so multiple games can safely share an IGDB URL without overwriting each
 * other's rows.
 */
async function upsertCacheEntry(
  type: "cover" | "screenshot" | "artwork",
  gameId: number,
  sourceUrl: string,
  localPath: string,
  fileSize: number,
): Promise<void> {
  await getJobContext()?.assertActive();
  await prisma.cacheEntry.upsert({
    where: { gameId_sourceUrl: { gameId, sourceUrl } },
    create: { type, sourceUrl, localPath, fileSize, gameId },
    update: { type, localPath, fileSize },
  });
}

async function findCacheEntry(
  gameId: number,
  sourceUrl: string,
): Promise<{ localPath: string } | null> {
  return prisma.cacheEntry.findUnique({
    where: { gameId_sourceUrl: { gameId, sourceUrl } },
    select: { localPath: true },
  });
}

export async function cacheGameImages(gameId: number): Promise<void> {
  await getJobContext()?.assertActive();
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) {
    console.warn(`cacheGameImages: game ${gameId} not found`);
    return;
  }

  let localCoverPath = game.localCoverPath;

  // --- Cover ---
  // Legacy id/index paths can contain another source's bytes. Only reuse the
  // exact URL-versioned path for this game and image type.
  if (game.coverUrl) {
    const relativePath = imagePath("covers", gameId, game.coverUrl);
    const destPath = path.join(DATA_DIR, relativePath);
    const existing = await findCacheEntry(gameId, game.coverUrl);
    const existingFileOk =
      existing?.localPath === relativePath && fs.existsSync(destPath);

    if (existingFileOk) {
      localCoverPath = relativePath;
    } else {
      const buffer = await downloadImage(game.coverUrl, destPath);
      if (buffer) {
        await upsertCacheEntry(
          "cover",
          gameId,
          game.coverUrl,
          relativePath,
          buffer.length,
        );
        localCoverPath = relativePath;
      } else {
        // Download failed — clear local path so the UI falls back to remote.
        localCoverPath = null;
      }
    }
  } else {
    // No source URL — nothing to cache; ensure UI doesn't point at stale file.
    localCoverPath = null;
  }

  // --- Screenshots ---
  const screenshotUrls = parseJsonArray(game.screenshotUrls);
  const newScreenshotPaths: (string | null)[] = [];
  for (let i = 0; i < screenshotUrls.length; i++) {
    const url = screenshotUrls[i];
    const relativePath = imagePath("screenshots", gameId, url);
    const destPath = path.join(DATA_DIR, relativePath);

    const existing = await findCacheEntry(gameId, url);
    if (existing?.localPath === relativePath && fs.existsSync(destPath)) {
      newScreenshotPaths.push(relativePath);
      continue;
    }

    const buffer = await downloadImage(url, destPath);
    if (buffer) {
      await upsertCacheEntry(
        "screenshot",
        gameId,
        url,
        relativePath,
        buffer.length,
      );
      newScreenshotPaths.push(relativePath);
    } else {
      newScreenshotPaths.push(null);
    }
  }

  // --- Artwork ---
  const artworkUrls = parseJsonArray(game.artworkUrls);
  const newArtworkPaths: (string | null)[] = [];
  for (let i = 0; i < artworkUrls.length; i++) {
    const url = artworkUrls[i];
    const relativePath = imagePath("artwork", gameId, url);
    const destPath = path.join(DATA_DIR, relativePath);

    const existing = await findCacheEntry(gameId, url);
    if (existing?.localPath === relativePath && fs.existsSync(destPath)) {
      newArtworkPaths.push(relativePath);
      continue;
    }

    const buffer = await downloadImage(url, destPath);
    if (buffer) {
      await upsertCacheEntry(
        "artwork",
        gameId,
        url,
        relativePath,
        buffer.length,
      );
      newArtworkPaths.push(relativePath);
    } else {
      newArtworkPaths.push(null);
    }
  }

  // --- Update Game record ---
  // Null slots preserve source indexes after partial failure. Never retain
  // paths from a previous source list; all failures stay eligible for retry.
  await getJobContext()?.assertActive();
  await prisma.game.update({
    where: { id: gameId },
    data: {
      localCoverPath,
      localScreenshotPaths:
        newScreenshotPaths.some((localPath) => localPath !== null)
          ? JSON.stringify(newScreenshotPaths)
          : null,
      localArtworkPaths:
        newArtworkPaths.some((localPath) => localPath !== null)
          ? JSON.stringify(newArtworkPaths)
          : null,
    },
  });
}

export async function cacheAllImages(
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const games = await prisma.game.findMany({
    where: {
      OR: [
        { localCoverPath: null, coverUrl: { not: null } },
        { localScreenshotPaths: null, screenshotUrls: { not: null } },
        { localArtworkPaths: null, artworkUrls: { not: null } },
      ],
    },
    select: { id: true },
  });

  const total = games.length;

  for (let i = 0; i < games.length; i++) {
    try {
      await cacheGameImages(games[i].id);
    } catch (err) {
      if (isAdmissionError(err)) throw err;
      if (getJobContext()?.signal.aborted) throw getJobContext()!.signal.reason;
      console.error(`cacheAllImages: failed for game ${games[i].id}`);
    }

    onProgress?.(i + 1, total);

    if (i < games.length - 1) {
      await abortableDelay(DELAY_BETWEEN_GAMES_MS, getJobContext()?.signal);
    }
  }
}

/**
 * Delete all cached image files (cover, screenshots, artwork) for the given
 * games and remove their CacheEntry rows. Call this BEFORE deleting the Game
 * rows so the on-disk files don't accumulate indefinitely (covers/{id}/,
 * legacy covers/{id}.jpg, screenshots/{id}/, artwork/{id}/).
 * Safe to call with ids that have no files.
 */
export async function deleteGameFiles(gameIds: number[]): Promise<void> {
  if (gameIds.length === 0) return;

  for (const gameId of gameIds) {
    // force:true never throws on a missing path; recursive handles the dirs.
    fs.rmSync(path.join(COVERS_DIR, `${gameId}.jpg`), { force: true });
    fs.rmSync(path.join(COVERS_DIR, `${gameId}`), {
      recursive: true,
      force: true,
    });
    fs.rmSync(path.join(SCREENSHOTS_DIR, `${gameId}`), {
      recursive: true,
      force: true,
    });
    fs.rmSync(path.join(ARTWORK_DIR, `${gameId}`), {
      recursive: true,
      force: true,
    });
  }

  await prisma.cacheEntry.deleteMany({ where: { gameId: { in: gameIds } } });
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
