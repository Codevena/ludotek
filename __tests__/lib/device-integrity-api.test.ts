import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({ sources: vi.fn(), sourceRoms: vi.fn(), importDat: vi.fn(), overview: vi.fn(), start: vi.fn(), snapshot: vi.fn(), cancel: vi.fn() }));
vi.mock("@/lib/device-integrity", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/device-integrity")>(), integrityService: service }));
import { POST as importDat, GET as sources } from "@/app/api/integrity/dats/route";
import { POST as start, GET as overview } from "@/app/api/devices/[id]/integrity/route";
import { GET as snapshot } from "@/app/api/integrity/jobs/[id]/route";
import { POST as cancel } from "@/app/api/integrity/jobs/[id]/cancel/route";
import { readIntegrityBody } from "@/lib/device-integrity";
import { AdmissionError } from "@/lib/job-admission";

const sourceId = "12345678-1234-1234-1234-123456789abc";
const context = { params: Promise.resolve({ id: "1" }) };
function request(path: string, method = "GET", body?: string, authorized = true) {
  return new NextRequest(`http://ludotek.lan${path}`, { method, ...(body === undefined ? {} : { body }),
    headers: { ...(authorized ? { authorization: "Bearer own-test-token" } : {}), ...(method === "GET" ? {} : { origin: "http://ludotek.lan" }) } });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_TOKEN", "own-test-token"); vi.stubEnv("APP_ORIGIN", "http://ludotek.lan"); vi.stubEnv("LUDOTEK_LOCAL_MODE", "");
  service.sources.mockResolvedValue({ sources: [], nextCursor: null });
  service.sourceRoms.mockResolvedValue({ roms: [], nextCursor: null });
  service.importDat.mockResolvedValue({ id: sourceId });
  service.overview.mockResolvedValue({ files: [], job: null });
  service.start.mockResolvedValue({ id: sourceId, status: "running" });
  service.snapshot.mockResolvedValue({ job: { status: "completed" }, results: [], nextCursor: null });
  service.cancel.mockResolvedValue({ job: { status: "cancelled" }, results: [], nextCursor: null });
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("authenticated integrity APIs", () => {
  it("authenticates every read/import/start/cancel before any store operation", async () => {
    const responses = await Promise.all([
      sources(request("/api/integrity/dats", "GET", undefined, false)),
      importDat(request("/api/integrity/dats", "POST", "raw DAT", false)),
      overview(request("/api/devices/1/integrity", "GET", undefined, false), context),
      start(request("/api/devices/1/integrity", "POST", "{}", false), context),
      snapshot(request(`/api/integrity/jobs/${sourceId}`, "GET", undefined, false), { params: Promise.resolve({ id: sourceId }) }),
      cancel(request(`/api/integrity/jobs/${sourceId}/cancel`, "POST", undefined, false), { params: Promise.resolve({ id: sourceId }) }),
    ]);
    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401, 401, 401]);
    for (const operation of Object.values(service)) expect(operation).not.toHaveBeenCalled();
  });

  it("rejects a foreign Origin before import and job side effects", async () => {
    const req = request("/api/integrity/dats", "POST", "raw DAT");
    req.headers.set("origin", "http://foreign.example");
    expect((await importDat(req)).status).toBe(403);
    expect(service.importDat).not.toHaveBeenCalled();
  });

  it("bounds actual DAT bytes even when Content-Length understates them", async () => {
    const req = request("/api/integrity/dats", "POST", "x".repeat(5 * 1024 * 1024 + 1));
    req.headers.set("content-length", "1");
    expect((await importDat(req)).status).toBe(413);
    expect(service.importDat).not.toHaveBeenCalled();
  });

  it("passes only a bounded raw DAT plus friendly name to the local parser", async () => {
    const response = await importDat(request("/api/integrity/dats?name=Own%20source", "POST", "own DAT"));
    expect(response.status).toBe(201);
    expect(service.importDat).toHaveBeenCalledWith(Buffer.from("own DAT"), "Own source");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects invalid job JSON/IDs/revision structure and bounds start requests", async () => {
    expect((await start(request("/api/devices/1/integrity", "POST", "not JSON"), context)).status).toBe(400);
    expect((await start(request("/api/devices/1/integrity", "POST", JSON.stringify({ expected: [{ deviceFileId: 1, romIndex: 0 }] })), context)).status).toBe(400);
    expect((await start(request("/api/devices/1/integrity", "POST", "{}"), { params: Promise.resolve({ id: "1abc" }) })).status).toBe(400);
    expect((await start(request("/api/devices/1/integrity", "POST", "x".repeat(65537)), context)).status).toBe(413);
    expect(service.start).not.toHaveBeenCalled();
  });

  it("keeps admission busy/store failure responses and does not report a started job", async () => {
    service.start.mockRejectedValueOnce(new AdmissionError(409, "Job already running", 7));
    const busy = await start(request("/api/devices/1/integrity", "POST", "{}"), context);
    expect(busy.status).toBe(409); expect(busy.headers.get("retry-after")).toBe("7");
    service.start.mockRejectedValueOnce(new Error("Own simulated DB failure"));
    const unavailable = await start(request("/api/devices/1/integrity", "POST", "{}"), context);
    expect(unavailable.status).toBe(503); expect(await unavailable.json()).toEqual({ error: "Integrity store unavailable" });
  });

  it("returns an accepted cancellation while another process still owns an undrained job", async () => {
    service.cancel.mockResolvedValueOnce({ job: { status: "running", cancelRequested: true }, results: [], nextCursor: null });
    const response = await cancel(request(`/api/integrity/jobs/${sourceId}/cancel`, "POST"), { params: Promise.resolve({ id: sourceId }) });
    expect(response.status).toBe(202);
    expect(service.cancel).toHaveBeenCalledWith(sourceId);
  });
});

describe("bounded upload body lifetime", () => {
  it("cancels an indefinitely waiting body at the actual 10-second deadline", async () => {
    vi.useFakeTimers();
    const cancelled = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel: cancelled });
    const req = new Request("http://ludotek.internal", { method: "POST", body, duplex: "half" } as RequestInit);
    const pending = readIntegrityBody(req, 1024);
    const rejection = expect(pending).rejects.toMatchObject({ status: 408 });
    await vi.advanceTimersByTimeAsync(10_000);
    await rejection;
    expect(cancelled).toHaveBeenCalledTimes(1);
  });
});
