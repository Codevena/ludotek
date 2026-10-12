import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { access, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";
import { createTestDatabase } from "../helpers/temp-database";

const require = createRequire(import.meta.url);
const run = promisify(execFile);
it("loads an actual classic Prisma config through the patched merger and uses its isolated datasource", async () => {
  const fixture = await createTestDatabase();
  try {
    const game = await fixture.client.game.create({ data: { title: "Config toy", originalFile: "Config.sfc", platform: "snes", platformLabel: "SNES" } });
    const configPath = path.join(fixture.directory, "prisma.config.ts");
    const ignoredPath = path.join(fixture.directory, "nonexistent", "ignored.db");
    await writeFile(configPath, `import { defineConfig } from ${JSON.stringify(require.resolve("prisma/config"))};\nexport default defineConfig(${JSON.stringify({
      schema: path.resolve("prisma/schema.prisma"), migrations: { path: path.resolve("prisma/migrations") },
      engine: "classic", datasource: { url: fixture.url },
    })});\n`);
    const result = await run(process.execPath, [path.resolve("node_modules/prisma/build/index.js"), "migrate", "status", "--config", configPath], {
      env: { ...process.env, DATABASE_URL: `file:${ignoredPath}`, PRISMA_HIDE_UPDATE_MESSAGE: "1" }, maxBuffer: 1024 * 1024,
    });
    expect(result.stdout).toContain("Database schema is up to date");
    expect(await fixture.client.game.findUnique({ where: { id: game.id } })).toMatchObject({ title: "Config toy" });
    await expect(access(ignoredPath)).rejects.toMatchObject({ code: "ENOENT" });
  } finally { await fixture.cleanup(); }
});
