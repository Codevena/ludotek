import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/auth/route";

const store = vi.hoisted(() => ({ reserveLoginFailure: vi.fn(), assertAdmissionStore: vi.fn() }));
vi.mock("@/lib/job-admission", () => ({
  ...store,
  admissionResponse: (error: { status: number; message: string; retryAfter: number }) =>
    Response.json({ error: error.message }, { status: error.status || 503, headers: { "Retry-After": String(error.retryAfter || 1), "Cache-Control": "no-store" } }),
}));

function request(token?: unknown, origin: string | null = "http://localhost:3000") {
  const headers: Record<string, string> = { host: "localhost:3000", "content-type": "application/json" };
  if (origin !== null) headers.origin = origin;
  return new NextRequest("http://localhost:3000/api/auth", {
    method: token === undefined ? "GET" : "POST", headers,
    ...(token === undefined ? {} : { body: JSON.stringify({ token }) }),
  });
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("ADMIN_TOKEN", "fixture-admin-token");
  vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  vi.stubEnv("LUDOTEK_LOCAL_MODE", "");
  store.reserveLoginFailure.mockReset().mockResolvedValue(undefined);
  store.assertAdmissionStore.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("login and auth status", () => {
  it("sets a usable non-Secure cookie on explicitly HTTP production LAN", async () => {
    const response = await POST(request("fixture-admin-token"));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).not.toMatch(/; Secure/i);
    expect(response.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect(response.headers.get("set-cookie")).toMatch(/SameSite=strict/i);
  });

  it("does not issue a cookie when the authoritative admission store fails", async () => {
    store.assertAdmissionStore.mockRejectedValue({ status: 503, message: "Admission store unavailable", retryAfter: 1 });
    const response = await POST(request("fixture-admin-token"));
    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rejects foreign login Origins before any store write", async () => {
    const response = await POST(request("fixture-admin-token", "http://attacker.example"));
    expect(response.status).toBe(403);
    expect(store.assertAdmissionStore).not.toHaveBeenCalled();
    expect(store.reserveLoginFailure).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("keeps authRequired and reports authenticated status without caching", async () => {
    const response = await GET(request());
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ authRequired: true, mode: "token", configured: true, authenticated: false });
  });

  it("sets Secure for an explicitly configured HTTPS origin", async () => {
    vi.stubEnv("APP_ORIGIN", "https://ludotek.lan:8443");
    const response = await POST(request("fixture-admin-token", "https://ludotek.lan:8443"));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(/; Secure/i);
  });

  it("reports an existing cookie session without returning the token", async () => {
    const req = request();
    req.cookies.set("admin_token", "fixture-admin-token");
    const response = await GET(req);
    const body = await response.json();
    expect(body.authenticated).toBe(true);
    expect(JSON.stringify(body)).not.toContain("fixture-admin-token");
  });

  it("keeps correct credentials usable after the global failure budget is exhausted", async () => {
    store.reserveLoginFailure.mockRejectedValue({ status: 429, message: "Login failure budget exhausted", retryAfter: 60 });
    const bad = await POST(request("wrong"));
    expect(bad.status).toBe(429);
    expect(bad.headers.get("retry-after")).toBe("60");
    expect(bad.headers.get("set-cookie")).toBeNull();
    const good = await POST(request("fixture-admin-token"));
    expect(good.status).toBe(200);
    expect(store.assertAdmissionStore).toHaveBeenCalledOnce();
  });

  it("fails closed for wrong credentials when the store is unavailable", async () => {
    store.reserveLoginFailure.mockRejectedValue({ status: 503, message: "Admission store unavailable", retryAfter: 1 });
    const response = await POST(request("wrong"));
    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rejects missing Origin on login without reserving failures or issuing cookies", async () => {
    const response = await POST(request("fixture-admin-token", null));
    expect(response.status).toBe(403);
    expect(store.assertAdmissionStore).not.toHaveBeenCalled();
    expect(store.reserveLoginFailure).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("caps the streamed login body even without a Content-Length", async () => {
    let cancelled = false;
    const stream = new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode("x".repeat(4097))); },
      cancel() { cancelled = true; },
    });
    const req = new NextRequest("http://localhost:3000/api/auth", {
      method: "POST", headers: { host: "localhost:3000", origin: "http://localhost:3000" }, body: stream, duplex: "half",
    } as ConstructorParameters<typeof NextRequest>[1]);
    const response = await POST(req);
    expect(response.status).toBe(400);
    expect(cancelled).toBe(true);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(store.reserveLoginFailure).not.toHaveBeenCalled();
  });

  it("does not grant authDisabled in production with no token", async () => {
    vi.stubEnv("ADMIN_TOKEN", "");
    const response = await POST(request("unused"));
    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(store.assertAdmissionStore).not.toHaveBeenCalled();
    const status = await GET(request());
    expect(status.status).toBe(503);
    expect(await status.json()).toMatchObject({ authRequired: true, configured: false, authenticated: false, mode: "unconfigured" });
  });

  it("reports explicit tokenless local mode as authenticated without a cookie", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ADMIN_TOKEN", "");
    vi.stubEnv("LUDOTEK_LOCAL_MODE", "1");
    const response = await GET(request());
    expect(await response.json()).toMatchObject({ authRequired: false, configured: true, authenticated: true, mode: "local" });
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("times out a held login body before any admission write", async () => {
    vi.useFakeTimers();
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    let response: Response | undefined;
    const stream = new ReadableStream<Uint8Array>({ start(value) { controller = value; } });
    const req = new NextRequest("http://localhost:3000/api/auth", {
      method: "POST", headers: { host: "localhost:3000", origin: "http://localhost:3000" }, body: stream, duplex: "half",
    } as ConstructorParameters<typeof NextRequest>[1]);
    const pending = POST(req).then((value) => { response = value; });
    try {
      await vi.advanceTimersByTimeAsync(10_001);
      expect(response?.status).toBe(408);
      expect(store.assertAdmissionStore).not.toHaveBeenCalled();
      expect(store.reserveLoginFailure).not.toHaveBeenCalled();
    } finally {
      try { controller.close(); } catch { /* Timeout may already have cancelled the stream. */ }
      await pending;
      vi.useRealTimers();
    }
  });

  it("cancels an aborted login body without a cookie, counter write or retained timer", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    let cancelled = false;
    const stream = new ReadableStream({ cancel() { cancelled = true; } });
    const req = new NextRequest("http://localhost:3000/api/auth", {
      method: "POST", headers: { host: "localhost:3000", origin: "http://localhost:3000" }, body: stream, signal: controller.signal, duplex: "half",
    } as ConstructorParameters<typeof NextRequest>[1]);
    try {
      const pending = POST(req);
      controller.abort();
      const response = await pending;
      expect(response.status).toBe(408);
      expect(cancelled).toBe(true);
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(store.reserveLoginFailure).not.toHaveBeenCalled();
      expect(store.assertAdmissionStore).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
