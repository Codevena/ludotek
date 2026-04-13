-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "deckHost" TEXT NOT NULL DEFAULT '192.168.178.131',
    "deckUser" TEXT NOT NULL DEFAULT 'deck',
    "deckPassword" TEXT NOT NULL DEFAULT '',
    "igdbClientId" TEXT NOT NULL DEFAULT '',
    "igdbClientSecret" TEXT NOT NULL DEFAULT '',
    "steamgriddbKey" TEXT NOT NULL DEFAULT '',
    "openrouterKey" TEXT NOT NULL DEFAULT '',
    "steamApiKey" TEXT NOT NULL DEFAULT '',
    "aiLanguage" TEXT NOT NULL DEFAULT 'en',
    "romSearchUrl" TEXT NOT NULL DEFAULT 'https://romsfun.com/roms/{platformLabel}/?q={title}'
);
INSERT INTO "new_Settings" ("aiLanguage", "deckHost", "deckPassword", "deckUser", "id", "igdbClientId", "igdbClientSecret", "openrouterKey", "romSearchUrl", "steamApiKey", "steamgriddbKey") SELECT "aiLanguage", "deckHost", "deckPassword", "deckUser", "id", "igdbClientId", "igdbClientSecret", "openrouterKey", "romSearchUrl", "steamApiKey", "steamgriddbKey" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
