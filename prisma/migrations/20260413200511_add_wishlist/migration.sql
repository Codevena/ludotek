-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "platformLabel" TEXT NOT NULL,
    "coverUrl" TEXT,
    "igdbScore" REAL,
    "summary" TEXT,
    "genres" TEXT,
    "screenshots" TEXT,
    "videoIds" TEXT,
    "developer" TEXT,
    "year" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_title_platform_key" ON "WishlistItem"("title", "platform");
