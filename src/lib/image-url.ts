/**
 * Pure utility functions for resolving game image URLs.
 * Prefers local cached images served via /api/cache/{path},
 * falls back to remote URLs when no local copy exists.
 *
 * New cache paths include source identity. Legacy paths still receive a
 * ?v= cache-buster derived from the source URL for browser compatibility.
 */

function parseArray(raw: string | null | undefined): unknown[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function parseJsonArray(raw: string | null | undefined): string[] {
  return parseArray(raw).filter((v): v is string => typeof v === "string");
}

function parseLocalPaths(raw: string | null | undefined): (string | null)[] {
  return parseArray(raw).map((v) => typeof v === "string" ? v : null);
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
  const localPaths = parseLocalPaths(game.localScreenshotPaths);
  const remotePaths = parseJsonArray(game.screenshotUrls);

  if (localPaths.length > 0 || remotePaths.length > 0) {
    const maxLen = Math.max(localPaths.length, remotePaths.length);
    const result: string[] = [];
    for (let i = 0; i < maxLen; i++) {
      const localPath = localPaths[i];
      if (localPath) {
        result.push(cachedUrl(localPath, remotePaths[i]));
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
  const localPaths = parseLocalPaths(game.localArtworkPaths);
  const remotePaths = parseJsonArray(game.artworkUrls);

  if (localPaths.length > 0 || remotePaths.length > 0) {
    const maxLen = Math.max(localPaths.length, remotePaths.length);
    const result: string[] = [];
    for (let i = 0; i < maxLen; i++) {
      const localPath = localPaths[i];
      if (localPath) {
        result.push(cachedUrl(localPath, remotePaths[i]));
      } else if (remotePaths[i]) {
        result.push(remotePaths[i]);
      }
    }
    return result;
  }
  return [];
}
