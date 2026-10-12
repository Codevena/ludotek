import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("installed FTP listing parser", () => {
  it("handles a malformed 64-KiB Unix row without blocking its worker", () => {
    // A real CPU-bound parser must be timed in a killable child, not with fake timers.
    const result = spawnSync(process.execPath, ["-e", `
      const { parseList } = require('basic-ftp');
      const malformed = '-rw-r--r-- 1 ' + 'a '.repeat(32768) + '!';
      const normal = '-rw-r--r-- 1 owner group 1 Jan 01 2026 ok.bin';
      const parsed = parseList(malformed + '\\r\\n' + normal + '\\r\\n');
      if (!parsed.some(entry => entry.name === 'ok.bin')) process.exit(2);
    `], { cwd: process.cwd(), timeout: 1000, encoding: "utf8", maxBuffer: 4096 });
    expect((result.error as NodeJS.ErrnoException | undefined)?.code, "parser exceeded its isolated CPU deadline").toBeUndefined();
    expect(result.status).toBe(0);
  });
});
