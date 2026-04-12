-- CreateTable
CREATE TABLE "Game" (
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
    "aiFunFacts" TEXT,
    "aiStory" TEXT,
    "aiEnrichedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Platform" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#f59e0b',
    "gameCount" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "deckHost" TEXT NOT NULL DEFAULT '192.168.178.131',
    "deckUser" TEXT NOT NULL DEFAULT 'deck',
    "deckPassword" TEXT NOT NULL DEFAULT '',
    "igdbClientId" TEXT NOT NULL DEFAULT '',
    "igdbClientSecret" TEXT NOT NULL DEFAULT '',
    "steamgriddbKey" TEXT NOT NULL DEFAULT '',
    "openrouterKey" TEXT NOT NULL DEFAULT '',
    "steamApiKey" TEXT NOT NULL DEFAULT ''
);

-- CreateIndex
CREATE INDEX "Game_platform_idx" ON "Game"("platform");

-- CreateIndex
CREATE INDEX "Game_title_idx" ON "Game"("title");

-- CreateIndex
CREATE UNIQUE INDEX "Game_originalFile_platform_key" ON "Game"("originalFile", "platform");
