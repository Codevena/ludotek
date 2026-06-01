-- Fix for CacheEntry corruption caused by sourceUrl @unique across games.
--
-- Previous bug: when two games shared a coverUrl (common when one game is
-- mis-matched to another's IGDB record during initial enrichment), the
-- upsert keyed by sourceUrl would update localPath but leave gameId pointing
-- to the first game that wrote the row. Subsequent refreshes of the second
-- game's metadata couldn't detect staleness and skipped re-downloads,
-- leaving the wrong cover on disk.
--
-- This migration:
--   1. Deletes CacheEntry rows whose localPath doesn't correspond to gameId
--      (the corrupt chimeras left by the upsert bug).
--   2. Replaces the global sourceUrl unique constraint with a per-game one.
--   3. Nulls out Game.localCoverPath / localScreenshotPaths / localArtworkPaths
--      for games whose current URLs no longer have a matching cache entry,
--      so the UI falls back to the remote IGDB URL (correct) instead of a
--      stale local file.

-- 1. Purge corrupt entries where localPath doesn't match the game's own folder.
DELETE FROM "CacheEntry"
WHERE (type = 'cover' AND localPath != ('covers/' || gameId || '.jpg'))
   OR (type = 'screenshot' AND localPath NOT LIKE ('screenshots/' || gameId || '/%'))
   OR (type = 'artwork' AND localPath NOT LIKE ('artwork/' || gameId || '/%'));

-- 2. Swap the unique index from global sourceUrl to (gameId, sourceUrl).
DROP INDEX "CacheEntry_sourceUrl_key";
CREATE UNIQUE INDEX "CacheEntry_gameId_sourceUrl_key" ON "CacheEntry"("gameId", "sourceUrl");
CREATE INDEX "CacheEntry_sourceUrl_idx" ON "CacheEntry"("sourceUrl");

-- 3. Null Game.localCoverPath when the current coverUrl has no matching entry.
--    The file on disk may still exist but we can't trust its content, so fall
--    back to the remote URL (which is authoritative).
UPDATE "Game" SET "localCoverPath" = NULL
WHERE "localCoverPath" IS NOT NULL
  AND (
    "coverUrl" IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM "CacheEntry" ce
      WHERE ce."gameId" = "Game"."id"
        AND ce."type" = 'cover'
        AND ce."sourceUrl" = "Game"."coverUrl"
    )
  );

-- 4. Null screenshots/artwork arrays when the cover was untrustworthy — if the
--    game was mis-matched, its screenshots and artwork are likely stale too.
UPDATE "Game" SET "localScreenshotPaths" = NULL
WHERE "localScreenshotPaths" IS NOT NULL
  AND "localCoverPath" IS NULL
  AND "coverUrl" IS NOT NULL;

UPDATE "Game" SET "localArtworkPaths" = NULL
WHERE "localArtworkPaths" IS NOT NULL
  AND "localCoverPath" IS NULL
  AND "coverUrl" IS NOT NULL;
