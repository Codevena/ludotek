-- CreateTable
CREATE TABLE "SyncQueue" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "gameId" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "newPath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncQueue_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SyncQueue_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "igdbClientId" TEXT NOT NULL DEFAULT '',
    "igdbClientSecret" TEXT NOT NULL DEFAULT '',
    "steamgriddbKey" TEXT NOT NULL DEFAULT '',
    "openrouterKey" TEXT NOT NULL DEFAULT '',
    "steamApiKey" TEXT NOT NULL DEFAULT '',
    "aiLanguage" TEXT NOT NULL DEFAULT 'en',
    "romSearchUrl" TEXT NOT NULL DEFAULT 'https://romsfun.com/roms/{platformLabel}/?q={title}',
    "activeDeviceId" INTEGER
);
INSERT INTO "new_Settings" ("activeDeviceId", "aiLanguage", "id", "igdbClientId", "igdbClientSecret", "openrouterKey", "romSearchUrl", "steamApiKey", "steamgriddbKey") SELECT "activeDeviceId", "aiLanguage", "id", "igdbClientId", "igdbClientSecret", "openrouterKey", "romSearchUrl", "steamApiKey", "steamgriddbKey" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
