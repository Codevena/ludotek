import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";
import { sqliteUrlWithSingleConnection } from "@/lib/sqlite-url";

const run = promisify(execFile);

/** Each fixture migrates its own empty database; the user's DATABASE_URL is never used. */
export async function createTestDatabase() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ludotek-test-db-"));
  const url = sqliteUrlWithSingleConnection(`file:${path.join(directory, "fixture.db")}`);
  try {
    await run(process.execPath, [path.resolve("node_modules/prisma/build/index.js"), "migrate", "deploy", "--schema", path.resolve("prisma/schema.prisma")], {
      env: { ...process.env, DATABASE_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
      maxBuffer: 1024 * 1024,
    });
    const client = new PrismaClient({ datasourceUrl: url });
    return { client, url, directory, async cleanup() { await client.$disconnect(); await rm(directory, { recursive: true }); } };
  } catch (error) {
    await rm(directory, { recursive: true });
    throw error;
  }
}
