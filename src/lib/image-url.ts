/**
 * Pure utility functions for resolving game image URLs.
 * Prefers local cached images served via /api/cache/{path},
 * falls back to remote URLs when no local copy exists.
 */

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

export function coverUrl(game: {
  localCoverPath?: string | null;
  coverUrl?: string | null;
}): string | undefined {
  if (game.localCoverPath) {
    return `/api/cache/${game.localCoverPath}`;
  }
  return game.coverUrl ?? undefined;
}

export function screenshotUrls(game: {
  localScreenshotPaths?: string | null;
  screenshotUrls?: string | null;
}): string[] {
  const localPaths = parseJsonArray(game.localScreenshotPaths);
  if (localPaths.length > 0) {
    return localPaths.map((p) => `/api/cache/${p}`);
  }
  return parseJsonArray(game.screenshotUrls);
}

export function artworkUrls(game: {
  localArtworkPaths?: string | null;
  artworkUrls?: string | null;
}): string[] {
  const localPaths = parseJsonArray(game.localArtworkPaths);
  if (localPaths.length > 0) {
    return localPaths.map((p) => `/api/cache/${p}`);
  }
  return parseJsonArray(game.artworkUrls);
}
