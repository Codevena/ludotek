import { describe, expect, it } from "vitest";
import { createServerConfig } from "../../scripts/local-server.mjs";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

describe("local startup contract", () => {
  it("forces tokenless dev to loopback and the explicitly selected port", () => {
    const config = createServerConfig("dev", ["--port", "4311"], {});
    expect(config.args).toEqual(["dev", "--hostname", "127.0.0.1", "--port", "4311"]);
    expect(config.env).toMatchObject({ APP_ORIGIN: "http://localhost:4311", LUDOTEK_LOCAL_MODE: "1", LUDOTEK_LOCAL_PORT: "4311", NODE_ENV: "development" });
  });

  it("uses a configured PORT with the same authority contract", () => {
    const config = createServerConfig("dev", [], { PORT: "3100" });
    expect(config.env.APP_ORIGIN).toBe("http://localhost:3100");
    expect(config.args).toContain("3100");
  });

  it.each(["0", "65536", "-1", "3000abc", "3.5"])("rejects invalid port %s before launching", (port) => {
    expect(() => createServerConfig("dev", ["--port", port], {})).toThrow();
  });

  it("refuses LAN without a token even with spoofed inherited local-mode variables", () => {
    expect(() => createServerConfig("dev", ["--hostname", "0.0.0.0"], { LUDOTEK_LOCAL_MODE: "1" })).toThrow("loopback");
  });

  it("requires a token for production and explicit Origin for token-enabled LAN", () => {
    expect(() => createServerConfig("start", [], {})).toThrow("ADMIN_TOKEN");
    expect(() => createServerConfig("start", ["--hostname", "0.0.0.0"], { ADMIN_TOKEN: "fixture" })).toThrow("APP_ORIGIN");
  });

  it("permits explicitly configured private LAN startup with token mode", () => {
    const config = createServerConfig("start", ["--hostname", "192.168.1.20"], { ADMIN_TOKEN: "fixture", APP_ORIGIN: "https://ludotek.lan" });
    expect(config.args).toEqual(["start", "--hostname", "192.168.1.20", "--port", "3000"]);
    expect(config.env).toMatchObject({ LUDOTEK_LOCAL_MODE: "0", APP_ORIGIN: "https://ludotek.lan", NODE_ENV: "production" });
  });

  it.each(["http://attacker.example:3000", "http://localhost:3100", "https://localhost:3000"])("rejects tokenless Origin %s outside its actual local contract", (origin) => {
    expect(() => createServerConfig("dev", [], { APP_ORIGIN: origin })).toThrow("loopback HTTP origin");
  });

  it("rejects arbitrary Next arguments instead of allowing bind-policy overrides", () => {
    expect(() => createServerConfig("dev", ["--hostname", "localhost", "--unknown", "0.0.0.0"], {})).toThrow();
  });

  it("loads the installed Next environment package under pnpm and refuses tokenless production", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "ludotek-auth-launch-"));
    try {
      const result = spawnSync(process.execPath, [path.resolve("scripts/local-server.mjs"), "start"], {
        cwd: directory, env: { PATH: process.env.PATH, ADMIN_TOKEN: "", NODE_ENV: "production" }, encoding: "utf8",
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Production requires ADMIN_TOKEN");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
