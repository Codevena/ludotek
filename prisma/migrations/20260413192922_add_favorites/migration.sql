-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Game" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "originalFile" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "platformLabel" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'rom',
    "coverUrl" TEXT,
    "screenshotUrls" TEXT,
    "igdbId" INTEGER,
    "igdbScore" REAL,
    "metacriticScore" INTEGER,
    "releaseDate" DATETIME,
    "genres" TEXT,
    "developer" TEXT,
    "publisher" TEXT,
    "summary" TEXT,
    "videoIds" TEXT,
    "artworkUrls" TEXT,
    "franchise" TEXT,
    "themes" TEXT,
    "aiFunFacts" TEXT,
    "aiStory" TEXT,
    "aiEnrichedAt" DATETIME,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Game" ("aiEnrichedAt", "aiFunFacts", "aiStory", "artworkUrls", "coverUrl", "createdAt", "developer", "franchise", "genres", "id", "igdbId", "igdbScore", "metacriticScore", "originalFile", "platform", "platformLabel", "publisher", "releaseDate", "screenshotUrls", "source", "summary", "themes", "title", "updatedAt", "videoIds") SELECT "aiEnrichedAt", "aiFunFacts", "aiStory", "artworkUrls", "coverUrl", "createdAt", "developer", "franchise", "genres", "id", "igdbId", "igdbScore", "metacriticScore", "originalFile", "platform", "platformLabel", "publisher", "releaseDate", "screenshotUrls", "source", "summary", "themes", "title", "updatedAt", "videoIds" FROM "Game";
DROP TABLE "Game";
ALTER TABLE "new_Game" RENAME TO "Game";
CREATE INDEX "Game_platform_idx" ON "Game"("platform");
CREATE INDEX "Game_title_idx" ON "Game"("title");
CREATE UNIQUE INDEX "Game_originalFile_platform_key" ON "Game"("originalFile", "platform");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
