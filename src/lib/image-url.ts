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
  const remotePaths = parseJsonArray(game.screenshotUrls);

  // Per-index fallback: use local path if available, otherwise remote
  if (localPaths.length > 0 || remotePaths.length > 0) {
    const maxLen = Math.max(localPaths.length, remotePaths.length);
    const result: string[] = [];
    for (let i = 0; i < maxLen; i++) {
      if (localPaths[i]) {
        result.push(`/api/cache/${localPaths[i]}`);
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

  // Per-index fallback: use local path if available, otherwise remote
  if (localPaths.length > 0 || remotePaths.length > 0) {
    const maxLen = Math.max(localPaths.length, remotePaths.length);
    const result: string[] = [];
    for (let i = 0; i < maxLen; i++) {
      if (localPaths[i]) {
        result.push(`/api/cache/${localPaths[i]}`);
      } else if (remotePaths[i]) {
        result.push(remotePaths[i]);
      }
    }
    return result;
  }
  return [];
}
