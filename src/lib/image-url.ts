/**
 * Pure utility functions for resolving game image URLs.
 * Prefers local cached images served via /api/cache/{path},
 * falls back to remote URLs when no local copy exists.
 *
 * Cached paths are reused across metadata refreshes (same gameId → same
 * local path), so we append a ?v= cache-buster derived from the source
 * URL. When the source URL changes, the buster changes, and the browser
 * re-fetches instead of serving the old file from its immutable cache.
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

function shortHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

function cachedUrl(localPath: string, sourceUrl?: string | null): string {
  const base = `/api/cache/${localPath}`;
  return sourceUrl ? `${base}?v=${shortHash(sourceUrl)}` : base;
}

export function coverUrl(game: {
  localCoverPath?: string | null;
  coverUrl?: string | null;
}): string | undefined {
  if (game.localCoverPath) {
    return cachedUrl(game.localCoverPath, game.coverUrl);
  }
  return game.coverUrl ?? undefined;
}

export function screenshotUrls(game: {
  localScreenshotPaths?: string | null;
  screenshotUrls?: string | null;
}): string[] {
  const localPaths = parseJsonArray(game.localScreenshotPaths);
  const remotePaths = parseJsonArray(game.screenshotUrls);

  if (localPaths.length > 0 || remotePaths.length > 0) {
    const maxLen = Math.max(localPaths.length, remotePaths.length);
    const result: string[] = [];
    for (let i = 0; i < maxLen; i++) {
      if (localPaths[i]) {
        result.push(cachedUrl(localPaths[i], remotePaths[i]));
      } else if (remotePaths[i]) {
        result.push(remotePaths[i]);
      }
    }
    return result;
  }
  return [];
}

export function artworkUrls(game: {
  localArtworkPaths?: string | null;
  artworkUrls?: string | null;
}): string[] {
  const localPaths = parseJsonArray(game.localArtworkPaths);
  const remotePaths = parseJsonArray(game.artworkUrls);

  if (localPaths.length > 0 || remotePaths.length > 0) {
    const maxLen = Math.max(localPaths.length, remotePaths.length);
    const result: string[] = [];
    for (let i = 0; i < maxLen; i++) {
      if (localPaths[i]) {
        result.push(cachedUrl(localPaths[i], remotePaths[i]));
      } else if (remotePaths[i]) {
        result.push(remotePaths[i]);
      }
    }
    return result;
  }
  return [];
}
