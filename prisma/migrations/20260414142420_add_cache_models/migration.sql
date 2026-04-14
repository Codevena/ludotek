-- AlterTable
ALTER TABLE "Game" ADD COLUMN "localArtworkPaths" TEXT;
ALTER TABLE "Game" ADD COLUMN "localCoverPath" TEXT;
ALTER TABLE "Game" ADD COLUMN "localScreenshotPaths" TEXT;

-- CreateTable
CREATE TABLE "CacheEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "localPath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "gameId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CacheEntry_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApiCache" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cacheKey" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "CacheEntry_sourceUrl_key" ON "CacheEntry"("sourceUrl");

-- CreateIndex
CREATE UNIQUE INDEX "ApiCache_cacheKey_key" ON "ApiCache"("cacheKey");

-- CreateIndex
CREATE INDEX "ApiCache_expiresAt_idx" ON "ApiCache"("expiresAt");
