CREATE TABLE "DeviceFile" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "deviceId" INTEGER NOT NULL,
  "gameId" INTEGER,
  "path" TEXT NOT NULL,
  "scanRoot" TEXT NOT NULL,
  "platformAlias" TEXT NOT NULL,
  "relativePath" TEXT NOT NULL,
  "platform" TEXT,
  "source" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "size" BIGINT NOT NULL,
  "modifiedAt" TEXT,
  "sha256" TEXT,
  "generation" TEXT NOT NULL,
  "seenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceFile_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DeviceFile_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DeviceFile_deviceId_path_key" ON "DeviceFile"("deviceId", "path");
CREATE INDEX "DeviceFile_gameId_deviceId_idx" ON "DeviceFile"("gameId", "deviceId");
CREATE INDEX "DeviceFile_deviceId_generation_idx" ON "DeviceFile"("deviceId", "generation");

CREATE TABLE "DeviceInventory" (
  "deviceId" INTEGER NOT NULL PRIMARY KEY,
  "generation" TEXT NOT NULL,
  "complete" BOOLEAN NOT NULL,
  "scannedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceInventory_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "FilePlan" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ready',
  "deviceState" TEXT NOT NULL,
  "totalBytes" BIGINT NOT NULL,
  "owner" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "appliedAt" DATETIME
);
CREATE INDEX "FilePlan_status_createdAt_idx" ON "FilePlan"("status", "createdAt");

CREATE TABLE "FilePlanOperation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "planId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "specification" TEXT NOT NULL,
  "phase" TEXT NOT NULL DEFAULT 'planned',
  "error" TEXT,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "FilePlanOperation_planId_fkey" FOREIGN KEY ("planId") REFERENCES "FilePlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FilePlanOperation_planId_ordinal_key" ON "FilePlanOperation"("planId", "ordinal");

CREATE TABLE "DoctorReport" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "deviceId" INTEGER NOT NULL,
  "complete" BOOLEAN NOT NULL,
  "findings" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "DoctorReport_deviceId_createdAt_idx" ON "DoctorReport"("deviceId", "createdAt");

CREATE TABLE "DatSource" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "roms" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "DatSource_contentHash_key" ON "DatSource"("contentHash");
CREATE TABLE "IntegrityJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "deviceId" INTEGER NOT NULL,
  "datSourceId" TEXT,
  "status" TEXT NOT NULL,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "total" INTEGER NOT NULL DEFAULT 0,
  "checked" INTEGER NOT NULL DEFAULT 0,
  "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
  "owner" TEXT,
  "globalOwner" TEXT,
  "error" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "completedAt" DATETIME
);
CREATE INDEX "IntegrityJob_deviceId_createdAt_idx" ON "IntegrityJob"("deviceId", "createdAt");
CREATE TABLE "IntegrityResult" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "jobId" TEXT NOT NULL,
  "deviceFileId" INTEGER,
  "deviceId" INTEGER NOT NULL,
  "path" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "observedModifiedAt" TEXT,
  "datSourceId" TEXT,
  "expectedRom" TEXT,
  "status" TEXT NOT NULL,
  "matches" TEXT NOT NULL,
  "matchCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrityResult_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "IntegrityJob" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "IntegrityResult_deviceFileId_fkey" FOREIGN KEY ("deviceFileId") REFERENCES "DeviceFile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "IntegrityResult_jobId_id_idx" ON "IntegrityResult"("jobId", "id");
CREATE INDEX "IntegrityResult_deviceFileId_createdAt_idx" ON "IntegrityResult"("deviceFileId", "createdAt");

CREATE TABLE "DeviceProfile" (
  "deviceId" INTEGER NOT NULL PRIMARY KEY,
  "template" TEXT NOT NULL,
  "romRoots" TEXT NOT NULL,
  "saveRoots" TEXT NOT NULL,
  "formats" TEXT NOT NULL,
  "reserveBytes" BIGINT NOT NULL,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "DeviceProfile_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "DeviceSyncBaseline" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "masterDeviceId" INTEGER NOT NULL,
  "deviceId" INTEGER NOT NULL,
  "fileKey" TEXT NOT NULL,
  "masterPath" TEXT NOT NULL,
  "devicePath" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "DeviceSyncBaseline_masterDeviceId_deviceId_fileKey_key" ON "DeviceSyncBaseline"("masterDeviceId", "deviceId", "fileKey");
CREATE TABLE "DeviceSyncPlan" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "masterDeviceId" INTEGER NOT NULL,
  "deviceId" INTEGER NOT NULL,
  "direction" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "plans" TEXT NOT NULL,
  "conflicts" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "DeviceSyncPlan_deviceId_createdAt_idx" ON "DeviceSyncPlan"("deviceId", "createdAt");

CREATE TABLE "SaveVersion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "deviceId" INTEGER,
  "gameId" INTEGER,
  "deviceName" TEXT NOT NULL,
  "gameTitle" TEXT,
  "platform" TEXT,
  "fileKey" TEXT NOT NULL,
  "sourcePath" TEXT NOT NULL,
  "sha256" TEXT NOT NULL,
  "size" BIGINT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SaveVersion_gameId_createdAt_idx" ON "SaveVersion"("gameId", "createdAt");
CREATE INDEX "SaveVersion_deviceId_fileKey_createdAt_idx" ON "SaveVersion"("deviceId", "fileKey", "createdAt");
CREATE TABLE "SaveSyncBaseline" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "masterDeviceId" INTEGER NOT NULL,
  "deviceId" INTEGER NOT NULL,
  "fileKey" TEXT NOT NULL,
  "masterPath" TEXT NOT NULL,
  "devicePath" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "SaveSyncBaseline_masterDeviceId_deviceId_fileKey_key" ON "SaveSyncBaseline"("masterDeviceId", "deviceId", "fileKey");
CREATE TABLE "SaveSyncPlan" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "masterDeviceId" INTEGER NOT NULL,
  "deviceId" INTEGER NOT NULL,
  "direction" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "plans" TEXT NOT NULL,
  "conflicts" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "SaveSyncPlan_deviceId_createdAt_idx" ON "SaveSyncPlan"("deviceId", "createdAt");

ALTER TABLE "SyncQueue" ADD COLUMN "planId" TEXT;
ALTER TABLE "SyncQueue" ADD COLUMN "claimOwner" TEXT;

CREATE TABLE "UploadFileSource" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "sha256" TEXT NOT NULL,
  "size" BIGINT NOT NULL,
  "identity" TEXT NOT NULL,
  "modifiedAt" TEXT,
  "released" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "UploadFileSource_sessionId_createdAt_idx" ON "UploadFileSource"("sessionId", "createdAt");
