import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { middleware } from "@/middleware";

function request(method = "GET", headers: Record<string, string> = {}, url = "http://localhost:3000/api/settings") {
  return new NextRequest(url, { method, headers: { host: new URL(url).host, ...headers } });
}

beforeEach(() => {
  vi.stubEnv("ADMIN_TOKEN", "");
  vi.stubEnv("APP_ORIGIN", "");
  vi.stubEnv("LUDOTEK_LOCAL_MODE", "");
  vi.stubEnv("LUDOTEK_LOCAL_PORT", "");
  vi.stubEnv("NODE_ENV", "development");
});
afterEach(() => vi.unstubAllEnvs());

describe("protected access", () => {
  it("rejects production without a configured token before protected work", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(requireAuth(request())?.status).toBe(503);
  });

  it("rejects a direct tokenless development start", () => {
    expect(requireAuth(request())?.status).toBe(503);
  });

  it("rejects DNS-rebinding GETs despite an explicit local marker", () => {
    vi.stubEnv("LUDOTEK_LOCAL_MODE", "1");
    vi.stubEnv("LUDOTEK_LOCAL_PORT", "3000");
    expect(requireAuth(request("GET", {}, "http://attacker.example:3000/api/settings"))?.status).toBe(403);
  });

  it("rejects a cookie mutation lacking an Origin", () => {
    vi.stubEnv("ADMIN_TOKEN", "fixture-admin-token");
    expect(requireAuth(request("PUT", { cookie: "admin_token=fixture-admin-token" }))?.status).toBe(403);
  });

  it.each(["localhost", "127.0.0.1", "[::1]"])("allows the launcher's actual port via %s", (host) => {
    vi.stubEnv("LUDOTEK_LOCAL_MODE", "1");
    vi.stubEnv("LUDOTEK_LOCAL_PORT", "4311");
    vi.stubEnv("APP_ORIGIN", "http://localhost:4311");
    const req = request("GET", {}, `http://${host}:4311/api/settings`);
    expect(requireAuth(req)).toBeNull();
    expect(middleware(req).headers.get("x-middleware-next")).toBe("1");
  });

  it.each(["localhost:3001", "attacker.example:3000", "127.1:3000", "localhost:3000,attacker.example", "localhost:3000/", "", "localhost.:3000"])("rejects the raw Host %s on a local GET", (host) => {
    vi.stubEnv("LUDOTEK_LOCAL_MODE", "1");
    const req = request("GET", { host, "x-forwarded-host": "localhost:3000", "x-forwarded-for": "127.0.0.1" });
    expect(requireAuth(req)?.status).toBe(403);
    expect(middleware(req).status).toBe(403);
  });

  it("rejects a missing Host even with an allowed URL and forwarded Host", () => {
    vi.stubEnv("LUDOTEK_LOCAL_MODE", "1");
    const req = new NextRequest("http://localhost:3000/api/settings", { headers: { "x-forwarded-host": "localhost:3000" } });
    expect(requireAuth(req)?.status).toBe(403);
  });

  it.each(["http://attacker.example:3000/setup", "http://localhost:3001/setup"])("rejects URL authority %s despite an allowed Host", (url) => {
    vi.stubEnv("LUDOTEK_LOCAL_MODE", "1");
    const req = request("GET", { host: "localhost:3000", rsc: "1" }, url);
    expect(requireAuth(req)?.status).toBe(403);
    expect(middleware(req).status).toBe(403);
  });

  it("protects HTML and RSC before any tokenless direct-dev output", () => {
    const req = request("GET", { rsc: "1" }, "http://localhost:3000/setup");
    expect(middleware(req).status).toBe(503);
  });

  it.each(["", "null", "http://attacker.example:3000", "http://localhost:3001", "http://localhost:3000/evil"])("rejects cookie write Origin %s", (origin) => {
    vi.stubEnv("ADMIN_TOKEN", "fixture-admin-token");
    expect(requireAuth(request("POST", { cookie: "admin_token=fixture-admin-token", origin }))?.status).toBe(403);
  });

  it.each(["http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000"])("allows cookie writes from the configured loopback alias %s", (origin) => {
    vi.stubEnv("ADMIN_TOKEN", "fixture-admin-token");
    expect(requireAuth(request("POST", { cookie: "admin_token=fixture-admin-token", origin }))).toBeNull();
  });

  it("requires an Origin even on tokenless local writes", () => {
    vi.stubEnv("LUDOTEK_LOCAL_MODE", "1");
    expect(requireAuth(request("POST"))?.status).toBe(403);
    expect(requireAuth(request("POST", { origin: "http://localhost:3000" }))).toBeNull();
  });

  it("allows authenticated Bearer CLI writes without an Origin but rejects a foreign browser Origin", () => {
    vi.stubEnv("ADMIN_TOKEN", "fixture-admin-token");
    expect(requireAuth(request("PUT", { authorization: "Bearer fixture-admin-token" }))).toBeNull();
    expect(requireAuth(request("PUT", { authorization: "Bearer fixture-admin-token", origin: "http://attacker.example" }))?.status).toBe(403);
  });

  it("allows correct token reads and rejects all incorrect credentials", () => {
    vi.stubEnv("ADMIN_TOKEN", "fixture-admin-token");
    expect(requireAuth(request("GET", { cookie: "admin_token=fixture-admin-token" }))).toBeNull();
    expect(requireAuth(request("GET", { authorization: "Bearer fixture-admin-token" }))).toBeNull();
    expect(requireAuth(request("GET", { cookie: "admin_token=wrong", authorization: "Bearer wrong" }))?.status).toBe(401);
  });

  it("trusts only the explicitly configured LAN origin rather than forwarded headers", () => {
    vi.stubEnv("ADMIN_TOKEN", "fixture-admin-token");
    vi.stubEnv("APP_ORIGIN", "https://ludotek.lan:8443");
    const headers = { cookie: "admin_token=fixture-admin-token", "x-forwarded-proto": "https", "x-forwarded-host": "ludotek.lan:8443" };
    expect(requireAuth(request("POST", headers))?.status).toBe(403);
    expect(requireAuth(request("POST", { ...headers, origin: "https://ludotek.lan:8443" }))).toBeNull();
    expect(requireAuth(request("POST", { ...headers, origin: "http://ludotek.lan:8443" }))?.status).toBe(403);
  });

  it.each(["ftp://localhost:3000", "http://user:pass@localhost:3000", "http://localhost:3000/path"])("fails closed for malformed configured Origin %s", (origin) => {
    vi.stubEnv("ADMIN_TOKEN", "fixture-admin-token");
    vi.stubEnv("APP_ORIGIN", origin);
    expect(requireAuth(request())?.status).toBe(503);
  });
});
