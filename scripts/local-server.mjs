import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const require = createRequire(import.meta.url);
const loopback = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** Parse the same finite launcher contract used by dev and production starts. */
export function createServerConfig(mode, args, env) {
  if (!["dev", "start"].includes(mode)) throw new Error("Choose dev or start");
  const { values } = parseArgs({ args, strict: true, options: {
    port: { type: "string", short: "p" },
    hostname: { type: "string", short: "H" },
    turbo: { type: "boolean" },
  } });
  const rawPort = values.port || env.PORT || "3000";
  if (!/^\d+$/.test(rawPort) || Number(rawPort) < 1 || Number(rawPort) > 65535) throw new Error("PORT must be an integer from 1 to 65535");
  const port = String(Number(rawPort));
  const hasToken = Boolean(env.ADMIN_TOKEN);
  if (mode === "start" && !hasToken) throw new Error("Production requires ADMIN_TOKEN");
  const requestedHost = values.hostname || env.LUDOTEK_HOST || "127.0.0.1";
  if (!hasToken && !loopback.has(requestedHost)) throw new Error("Tokenless development must bind to loopback");
  if (hasToken && !loopback.has(requestedHost) && !env.APP_ORIGIN) throw new Error("LAN access requires an explicit APP_ORIGIN");
  const originValue = env.APP_ORIGIN || `http://localhost:${port}`;
  let origin;
  try { origin = new URL(originValue); } catch { throw new Error("APP_ORIGIN must be a complete HTTP or HTTPS origin"); }
  if (!/^https?:$/.test(origin.protocol) || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("APP_ORIGIN must be a complete HTTP or HTTPS origin");
  }
  const originPort = origin.port || (origin.protocol === "https:" ? "443" : "80");
  if (!hasToken && (origin.protocol !== "http:" || !loopback.has(origin.hostname) || originPort !== port)) {
    throw new Error("Tokenless development requires the loopback HTTP origin at its actual port");
  }
  if (values.turbo && mode !== "dev") throw new Error("--turbo is only available in development");
  const hostname = hasToken ? requestedHost : "127.0.0.1";
  return {
    args: [mode, "--hostname", hostname, "--port", port, ...(values.turbo ? ["--turbo"] : [])],
    env: { ...env, NODE_ENV: mode === "dev" ? "development" : "production", APP_ORIGIN: origin.origin, LUDOTEK_LOCAL_PORT: port, LUDOTEK_LOCAL_MODE: !hasToken && mode === "dev" ? "1" : "0" },
  };
}

export function launch() {
  const mode = process.argv[2];
  // Load Next's versioned env implementation before evaluating token/bind settings.
  const nextRequire = createRequire(require.resolve("next/package.json"));
  nextRequire("@next/env").loadEnvConfig(process.cwd(), mode === "dev");
  const config = createServerConfig(mode, process.argv.slice(3), process.env);
  const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), ...config.args], { env: config.env, stdio: "inherit" });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
  child.on("error", () => { console.error("Unable to launch Next.js"); process.exitCode = 1; });
  child.on("exit", (code) => { process.exitCode = code ?? 1; });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try { launch(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
