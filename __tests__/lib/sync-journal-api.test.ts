import { NextRequest } from "next/server";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const service = vi.hoisted(() => ({ stage: vi.fn(), list: vi.fn(), apply: vi.fn(), clear: vi.fn() }));
vi.mock("@/lib/sync-journal", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/sync-journal")>(), syncJournal: service }));
import { POST as stage, GET as list, DELETE as clear } from "@/app/api/sync/queue/route";
import { POST as apply } from "@/app/api/sync/apply/route";
import { DELETE as remove } from "@/app/api/sync/queue/[id]/route";
import { AdmissionError } from "@/lib/job-admission";

function request(path: string, method: string, body?: string, authenticated = true) {
  return new NextRequest(`http://localhost:3000${path}`, { method, ...(body === undefined ? {} : { body }), headers: {
    ...(authenticated ? { authorization: "Bearer own-token" } : {}), ...(method === "GET" ? {} : { origin: "http://localhost:3000" }),
  } });
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("ADMIN_TOKEN", "own-token"); vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  service.stage.mockResolvedValue({ item: { id: 1 }, plan: { status: "ready" } }); service.list.mockResolvedValue({ items: [], count: 0 });
  service.apply.mockResolvedValue({ applied: 0, failed: 0, ignored: 0, results: [] }); service.clear.mockResolvedValue({ cleared: 1 });
});
afterEach(() => vi.unstubAllEnvs());

describe("bounded authorized sync consumers", () => {
  it("authorizes every route before any queue or journal call", async () => {
    const responses = await Promise.all([
      stage(request("/api/sync/queue", "POST", "{}", false)), list(request("/api/sync/queue", "GET", undefined, false)),
      clear(request("/api/sync/queue", "DELETE", undefined, false)), apply(request("/api/sync/apply", "POST", '{"ids":[1]}', false)),
      remove(request("/api/sync/queue/1", "DELETE", undefined, false), { params: Promise.resolve({ id: "1" }) }),
    ]);
    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401, 401]);
    for (const action of Object.values(service)) expect(action).not.toHaveBeenCalled();
  });
  it("rejects cross-Origin writes before any metadata side effect", async () => {
    const req = request("/api/sync/queue", "POST", "{}"); req.headers.set("origin", "http://foreign.example");
    expect((await stage(req)).status).toBe(403); expect(service.stage).not.toHaveBeenCalled();
  });
  it("requires explicit finite IDs rather than applying every pending or in-progress row", async () => {
    expect((await apply(request("/api/sync/apply", "POST"))).status).toBe(400);
    expect((await apply(request("/api/sync/apply", "POST", '{"ids":[1,1]}'))).status).toBe(400);
    expect((await apply(request("/api/sync/apply", "POST", JSON.stringify({ ids: Array.from({ length: 101 }, (_, index) => index + 1) })))).status).toBe(400);
    expect(service.apply).not.toHaveBeenCalled();
    expect((await apply(request("/api/sync/apply", "POST", '{"ids":[7,8]}'))).status).toBe(200);
    expect(service.apply.mock.calls[0][0]).toEqual([7, 8]);
  });
  it("bounds the actual stage body and preserves busy responses", async () => {
    expect((await stage(request("/api/sync/queue", "POST", "x".repeat(16385)))).status).toBe(413);
    expect(service.stage).not.toHaveBeenCalled();
    service.stage.mockRejectedValueOnce(new AdmissionError(409, "Device busy", 7));
    const response = await stage(request("/api/sync/queue", "POST", "{}"));
    expect(response.status).toBe(409); expect(response.headers.get("retry-after")).toBe("7");
  });
  it("acknowledges staging only with 201 and removes only the explicit metadata IDs", async () => {
    expect((await stage(request("/api/sync/queue", "POST", "{}"))).status).toBe(201);
    expect((await clear(request("/api/sync/queue", "DELETE", '{"ids":[7]}'))).status).toBe(200);
    expect(service.clear.mock.calls[0][0]).toEqual([7]);
    expect((await remove(request("/api/sync/queue/9", "DELETE"), { params: Promise.resolve({ id: "9" }) })).status).toBe(200);
    expect(service.clear.mock.calls[1][0]).toEqual([9]);
  });
});
