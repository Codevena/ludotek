import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const deps = vi.hoisted(() => ({
  auth: vi.fn(), settings: vi.fn(), token: vi.fn(), owned: vi.fn(),
  cacheRead: vi.fn(), cacheWrite: vi.fn(), release: vi.fn(), renew: vi.fn(),
  acquire: vi.fn(), dispatch: vi.fn(), active: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireAuth: deps.auth }));
vi.mock("@/lib/encryption", () => ({ getDecryptedSettings: deps.settings }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  game: { findMany: deps.owned },
  apiCache: { findFirst: deps.cacheRead, upsert: deps.cacheWrite },
} }));
vi.mock("@/lib/igdb", () => ({ getIgdbToken: deps.token, IGDB_PLATFORM_MAP: { snes: 19 } }));
vi.mock("@/lib/job-admission", async (original) => ({ ...await original<typeof import("@/lib/job-admission")>(), acquireScopedJob: deps.acquire }));
vi.mock("@/lib/provider-budget", () => ({ providerFetch: deps.dispatch }));

import { GET } from "@/app/api/platforms/[id]/missing/route";
import { AdmissionError } from "@/lib/job-admission";

const candidates = [{ name: "Chrono Trigger", total_rating: 90 }, { name: "Super Mario World", total_rating: 91 }];
const request = () => new NextRequest("http://localhost:3000/api/platforms/snes/missing");

beforeEach(() => {
  vi.clearAllMocks();
  deps.auth.mockReturnValue(null);
  deps.settings.mockResolvedValue({ igdbClientId: "test", igdbClientSecret: "test" });
  deps.token.mockResolvedValue("test-token");
  deps.owned.mockResolvedValue([]);
  deps.cacheRead.mockResolvedValue(null);
  deps.cacheWrite.mockResolvedValue({});
  deps.release.mockResolvedValue(undefined);
  deps.renew.mockResolvedValue(undefined);
  deps.active.mockResolvedValue(undefined);
  deps.acquire.mockResolvedValue({ close: deps.release, assertActive: deps.active, run: (work: () => Promise<unknown>) => work() });
  deps.dispatch.mockImplementation(async () => Response.json(candidates));
  vi.stubGlobal("fetch", deps.dispatch);
});

describe("missing games admission", () => {
  it("rejects unauthorized requests before settings, DB or provider access", async () => {
    deps.auth.mockReturnValue(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    const response = await GET(request(), { params: Promise.resolve({ id: "snes" }) });
    expect(response.status).toBe(401);
    expect(deps.settings).not.toHaveBeenCalled();
    expect(deps.owned).not.toHaveBeenCalled();
    expect(deps.dispatch).not.toHaveBeenCalled();
  });

  it("rejects unknown platforms before settings or provider work", async () => {
    const response = await GET(request(), { params: Promise.resolve({ id: "not-a-platform" }) });
    expect(response.status).toBe(400);
    expect(deps.settings).not.toHaveBeenCalled();
    expect(deps.dispatch).not.toHaveBeenCalled();
  });

  it("filters current ownership from cached raw candidates without provider calls", async () => {
    deps.cacheRead.mockResolvedValue({ response: JSON.stringify(candidates) });
    deps.owned.mockResolvedValue([{ title: "Chrono Trigger" }]);
    const first = await GET(request(), { params: Promise.resolve({ id: "snes" }) });
    expect((await first.json()).missing.map((g: { title: string }) => g.title)).toEqual(["Super Mario World"]);
    deps.owned.mockResolvedValue([{ title: "Chrono Trigger" }, { title: "Super Mario World" }]);
    const second = await GET(request(), { params: Promise.resolve({ id: "snes" }) });
    expect((await second.json()).missing).toEqual([]);
    expect(deps.token).not.toHaveBeenCalled();
    expect(deps.dispatch).not.toHaveBeenCalled();
  });

  it("stores raw candidates under the single-flight lease, then filters ownership", async () => {
    deps.owned.mockResolvedValue([{ title: "Chrono Trigger" }]);
    const response = await GET(request(), { params: Promise.resolve({ id: "snes" }) });
    expect(response.status).toBe(200);
    expect(deps.acquire).toHaveBeenCalledWith("missing:snes", expect.any(Request));
    expect(deps.dispatch).toHaveBeenCalledOnce();
    expect(JSON.parse(deps.cacheWrite.mock.calls[0][0].create.response)).toEqual(candidates);
    expect((await response.json()).missing).toHaveLength(1);
    expect(deps.active).toHaveBeenCalledBefore(deps.cacheWrite);
    expect(deps.release).toHaveBeenCalledOnce();
  });

  it("does not cache provider failures as successful empty candidates", async () => {
    deps.dispatch.mockResolvedValue(Response.json({ error: "no" }, { status: 502 }));
    const response = await GET(request(), { params: Promise.resolve({ id: "snes" }) });
    expect(response.status).toBe(502);
    expect(deps.cacheWrite).not.toHaveBeenCalled();
    expect(deps.release).toHaveBeenCalledOnce();
  });

  it("dispatches once for overlapping cache misses and serves the later cache hit", async () => {
    let finish!: () => void;
    deps.dispatch.mockImplementation(async () => {
      await new Promise<void>((resolve) => { finish = resolve; });
      return Response.json(candidates);
    });
    deps.acquire.mockResolvedValueOnce({ close: deps.release, assertActive: deps.active, run: (work: () => Promise<unknown>) => work() })
      .mockRejectedValueOnce(new AdmissionError(409, "Job already running"));
    deps.cacheWrite.mockImplementation(async ({ create }) => { deps.cacheRead.mockResolvedValue({ response: create.response }); return {}; });
    const first = GET(request(), { params: Promise.resolve({ id: "snes" }) });
    await vi.waitFor(() => expect(deps.dispatch).toHaveBeenCalledOnce());
    const collision = await GET(request(), { params: Promise.resolve({ id: "snes" }) });
    expect(collision.status).toBe(409);
    expect(deps.dispatch).toHaveBeenCalledOnce();
    finish();
    expect((await first).status).toBe(200);
    const third = await GET(request(), { params: Promise.resolve({ id: "snes" }) });
    expect(third.status).toBe(200);
    expect(deps.dispatch).toHaveBeenCalledOnce();
    expect(deps.acquire).toHaveBeenCalledTimes(2);
  });
});
