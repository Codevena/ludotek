/** Lightweight policy shared with Edge middleware. Never trust forwarded headers. */
export interface AuthPolicy {
  mode: "local" | "token" | "unconfigured";
  configured: boolean;
  origin: URL | null;
  localPort: string;
}

const LOOPBACK_NAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

function parseOrigin(value: string): URL | null {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password ||
        url.pathname !== "/" || url.search || url.hash || url.origin === "null") return null;
    return url;
  } catch {
    return null;
  }
}

export function getAuthPolicy(): AuthPolicy {
  const localPort = process.env.LUDOTEK_LOCAL_PORT || "3000";
  const validPort = /^\d+$/.test(localPort) && Number(localPort) >= 1 && Number(localPort) <= 65535;
  const origin = parseOrigin(process.env.APP_ORIGIN || "http://localhost:3000");
  const hasToken = Boolean(process.env.ADMIN_TOKEN);
  const local = !hasToken && process.env.NODE_ENV === "development" &&
    process.env.LUDOTEK_LOCAL_MODE === "1" && validPort && origin?.protocol === "http:" &&
    LOOPBACK_NAMES.has(origin.hostname) && effectivePort(origin) === String(Number(localPort));
  const mode = origin && (hasToken || local) ? (hasToken ? "token" : "local") : "unconfigured";
  return { mode, configured: mode !== "unconfigured", origin, localPort: String(Number(localPort)) };
}

function effectivePort(url: URL): string {
  return url.port || (url.protocol === "https:" ? "443" : "80");
}

function isLocalAuthority(value: string, port: string): boolean {
  // Exact raw syntax prevents URL normalization from granting aliases such as 127.1.
  const expected = port === "80" ? ["localhost", "127.0.0.1", "[::1]"] : [];
  expected.push(`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`);
  return expected.includes(value.toLowerCase());
}

export function allowsLocalAuthority(request: { url: string; headers: Headers }, policy = getAuthPolicy()): boolean {
  if (policy.mode !== "local") return false;
  const host = request.headers.get("host");
  if (!host || !isLocalAuthority(host, policy.localPort)) return false;
  try {
    const url = new URL(request.url);
    return url.protocol === "http:" && !url.username && !url.password && isLocalAuthority(url.host, policy.localPort);
  } catch {
    return false;
  }
}

export function allowsOrigin(value: string | null, policy = getAuthPolicy()): boolean {
  if (!value || !policy.origin) return false;
  const origin = parseOrigin(value);
  if (!origin) return false;
  if (origin.origin === policy.origin.origin) return true;
  // Only explicitly configured loopback origins permit the three local aliases.
  return LOOPBACK_NAMES.has(policy.origin.hostname) && LOOPBACK_NAMES.has(origin.hostname) &&
    origin.protocol === policy.origin.protocol && effectivePort(origin) === effectivePort(policy.origin);
}

export function isMutation(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}
