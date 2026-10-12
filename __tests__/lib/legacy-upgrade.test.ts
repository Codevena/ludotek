import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { createTestDatabase } from "../helpers/temp-database";
import { AdmissionStore } from "@/lib/job-admission";

const run = promisify(execFile);
const cli = path.resolve("node_modules/prisma/build/index.js");
describe("existing db-push upgrade", () => {
  it("checks and baselines the legacy schema, then applies admission without changing library or credentials", async () => {
    const fixture = await createTestDatabase();
    const legacyUrl = `file:${path.join(fixture.directory, "legacy.db")}`;
    const legacy = new PrismaClient({ datasourceUrl: legacyUrl });
    let upgraded: PrismaClient | undefined;
    const command = (...args: string[]) => run(process.execPath, [cli, ...args], { env: { ...process.env, DATABASE_URL: legacyUrl, PRISMA_HIDE_UPDATE_MESSAGE: "1" }, maxBuffer: 1024 * 1024 });
    try {
      await command("db", "push", "--schema", "prisma/legacy-db-push.schema.prisma", "--skip-generate");
      await legacy.$queryRaw`PRAGMA journal_mode=WAL`;
      const game = await legacy.game.create({ data: { title: "Legacy toy", originalFile: "Toy.sfc", platform: "snes", platformLabel: "SNES" } });
      const device = await legacy.device.create({ data: { name: "Legacy device", host: "synthetic.invalid", user: "toy", password: "synthetic-preserved-ciphertext" } });
      await legacy.gameDevice.create({ data: { gameId: game.id, deviceId: device.id, originalFile: "Toy.sfc" } });
      const guide = await readFile("docs/upgrading-local.md", "utf8");
      const backupScript = guide.match(/python3 - <<'PY'\n([\s\S]*?)\nPY/)![1];
      await run("python3", ["-c", backupScript], { env: { ...process.env, LUDOTEK_DATABASE_FILE: path.join(fixture.directory, "legacy.db"), LUDOTEK_BACKUP_DIR: fixture.directory } });
      await legacy.$disconnect();
      await expect(command("migrate", "deploy")).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining("P3005") });
      await command("migrate", "diff", "--from-url", legacyUrl, "--to-schema-datamodel", "prisma/legacy-db-push.schema.prisma", "--exit-code");
      // Execute the documented, fixed legacy baseline. Newly added migrations
      // must actually run, never be guessed to be already present.
      const baseline = guide.match(/for migration in \\\n([\s\S]*?)\ndo/)![1];
      const migrations = baseline.match(/\d{14}_[a-z_]+/g)!;
      expect(migrations).toHaveLength(16);
      for (const migration of migrations) await command("migrate", "resolve", "--applied", migration);
      await command("migrate", "deploy");
      upgraded = new PrismaClient({ datasourceUrl: legacyUrl });
      expect(await upgraded.game.findUnique({ where: { id: game.id } })).toMatchObject({ title: "Legacy toy", originalFile: "Toy.sfc" });
      expect(await upgraded.device.findUnique({ where: { id: device.id } })).toMatchObject({ password: "synthetic-preserved-ciphertext" });
      expect(await upgraded.gameDevice.count()).toBe(1);
      expect(await upgraded.filePlan.count()).toBe(0);
      expect(await upgraded.saveVersion.count()).toBe(0);
      expect(await upgraded.uploadFileSource.count()).toBe(0);
      const newMigrations = await upgraded.$queryRaw<{ migration_name: string }[]>`SELECT migration_name FROM _prisma_migrations WHERE migration_name LIKE '20261012%' AND finished_at IS NOT NULL`;
      expect(newMigrations.map((row) => row.migration_name).sort()).toEqual(["20261012120000_local_admission", "20261012130000_device_file_journal"]);
      await expect(new AdmissionStore(upgraded).assertAvailable()).resolves.toBeUndefined();
      const backup = new PrismaClient({ datasourceUrl: `file:${path.join(fixture.directory, "before-upgrade.db")}` });
      try { expect(await backup.game.count()).toBe(1); expect(await backup.device.count()).toBe(1); }
      finally { await backup.$disconnect(); }
    } finally { await legacy.$disconnect(); await upgraded?.$disconnect(); await fixture.cleanup(); }
  }, 20000);

  it("detects a divergent legacy schema before a migration is marked applied", async () => {
    const fixture = await createTestDatabase();
    try {
      for (const table of ["JobLease", "ProviderWindow", "AdmissionClock", "_prisma_migrations"]) await fixture.client.$executeRawUnsafe(`DROP TABLE "${table}"`);
      await fixture.client.$executeRaw`ALTER TABLE "Game" ADD COLUMN "unexpected" TEXT`;
      await fixture.client.$disconnect();
      await expect(run(process.execPath, [cli, "migrate", "diff", "--from-url", fixture.url, "--to-schema-datamodel", "prisma/legacy-db-push.schema.prisma", "--exit-code"], {
        env: { ...process.env, DATABASE_URL: fixture.url }, maxBuffer: 1024 * 1024,
      })).rejects.toMatchObject({ code: 2 });
      const db = new PrismaClient({ datasourceUrl: fixture.url });
      try {
        const history = await db.$queryRaw`SELECT "name" FROM "sqlite_master" WHERE "name" = '_prisma_migrations'`;
        expect(history).toEqual([]);
      } finally { await db.$disconnect(); }
    } finally { await fixture.cleanup(); }
  });
});
