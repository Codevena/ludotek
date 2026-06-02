-- AlterTable
ALTER TABLE "GameDevice" ADD COLUMN "originalFile" TEXT;

-- Backfill the per-device filename from the linked game's representative
-- originalFile. Correct for single-device games; the best available value for
-- pre-existing multi-device games until their next scan rewrites it.
UPDATE "GameDevice" SET "originalFile" = (
  SELECT "originalFile" FROM "Game" WHERE "Game"."id" = "GameDevice"."gameId"
);
