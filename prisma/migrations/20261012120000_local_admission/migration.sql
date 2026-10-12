CREATE TABLE "JobLease" (
  "resource" TEXT NOT NULL PRIMARY KEY,
  "owner" TEXT NOT NULL,
  "expiresAt" BIGINT NOT NULL
);
CREATE INDEX "JobLease_expiresAt_idx" ON "JobLease"("expiresAt");
CREATE TABLE "ProviderWindow" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "used" INTEGER NOT NULL,
  "expiresAt" BIGINT NOT NULL
);
CREATE INDEX "ProviderWindow_expiresAt_idx" ON "ProviderWindow"("expiresAt");
CREATE TABLE "AdmissionClock" (
  "id" INTEGER NOT NULL PRIMARY KEY,
  "value" BIGINT NOT NULL
);
