import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { expect, it, vi } from "vitest";
import { createConnection } from "@/lib/connection";

it("uses identical LOCAL mtime precision for scanner stat and journal lstat", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ludotek-mtime-"));
  vi.stubEnv("LOCAL_FILES_ROOT", root); vi.stubEnv("LOCAL_FILES_ROOTS", "");
  const filename = path.join(root, "fixture.rom");
  const connection = await createConnection({ protocol: "local", host: "", port: 0, user: "", password: "" });
  try {
    await writeFile(filename, "small fixture");
    // Dates near millisecond boundaries expose number/bigint Stats rounding.
    for (let index = 0; index < 25; index++) {
      const time = 1700000000 + (index + 0.99999) / 1000;
      await utimes(filename, time, time);
      const scanner = await connection.stat(filename);
      const journal = await connection.lstat!(filename);
      expect(scanner).toMatchObject({ size: journal.size, modifiedAt: journal.modifiedAt, isDirectory: false });
    }
  } finally { connection.disconnect(); await rm(root, { recursive: true }); vi.unstubAllEnvs(); }
});
