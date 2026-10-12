import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const deps = vi.hoisted(() => ({ withFiles: vi.fn(), device: vi.fn(), run: vi.fn(), report: vi.fn(), controller: new AbortController() }));
vi.mock("@/lib/prisma", () => ({ prisma: { doctorReport: { findFirst: deps.report } } }));
vi.mock("@/lib/encryption", () => ({ getDecryptedDevice: deps.device }));
vi.mock("@/lib/device-jobs", () => ({ withDeviceFiles: deps.withFiles }));
vi.mock("@/lib/sync-doctor", () => ({ runSyncDoctor: deps.run }));
import { AdmissionError } from "@/lib/job-admission";
import { GET, POST } from "@/app/api/devices/[id]/doctor/route";
import { createTestDatabase } from "../helpers/temp-database";
const id = "12345678-1234-1234-1234-123456789abc";
const params = (deviceId = "1") => ({ params: Promise.resolve({ id: deviceId }) });
const request = (method: string, query = "", headers: Record<string, string> = {}) => new NextRequest(`http://localhost:3000/api/devices/1/doctor${query}`, { method, headers: { authorization: "Bearer toy-test-token", ...headers } });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("ADMIN_TOKEN", "toy-test-token"); vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  deps.controller = new AbortController();
  deps.withFiles.mockImplementation(async (_ids, _request, work) => work({ signal: deps.controller.signal, assertActive: async () => {}, close: async () => {} }));
  deps.device.mockResolvedValue({ id: 1 });
  deps.run.mockResolvedValue({ reportId: id, complete: false, summary: { counts: {} }, findings: [], total: 0, nextOffset: null });
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("Sync Doctor admission and snapshot API", () => {
  it("rejects unauthorized, foreign origin and invalid devices before any inventory or credentials", async () => {
    expect((await POST(request("POST", "", { authorization: "" }), params())).status).toBe(401);
    expect((await POST(request("POST", "", { origin: "http://foreign.invalid" }), params())).status).toBe(403);
    for (const value of ["0", "-1", "2147483648", "01", "bad"]) expect((await POST(request("POST"), params(value))).status).toBe(400);
    expect(deps.withFiles).not.toHaveBeenCalled(); expect(deps.device).not.toHaveBeenCalled(); expect(deps.run).not.toHaveBeenCalled();
  });

  it.each([409, 503] as const)("performs no work when the shared files lease returns%s", async (status) => {
    deps.withFiles.mockRejectedValue(new AdmissionError(status, "Fixture unavailable", 9));
    const response = await POST(request("POST"), params());
    expect(response.status).toBe(status); expect(response.headers.get("Retry-After")).toBe("9");
    expect(deps.device).not.toHaveBeenCalled(); expect(deps.run).not.toHaveBeenCalled();
  });

  it("explicit diagnosis owns the shared files lease and preserves incomplete status", async () => {
    const response = await POST(request("POST"), params());
    expect(deps.withFiles.mock.calls[0][0]).toEqual([1]);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ complete: false, reportId: id });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("GET paginates one immutable device-scoped report without connection or lease", async () => {
    const findings = Array.from({ length: 250 }, (_, n) => ({ kind: "extra", path: `/fixture/${n}.sfc`, repair: "review" }));
    deps.report.mockResolvedValue({ id, deviceId: 1, complete: true, createdAt: new Date(0), findings: JSON.stringify(findings), summary: JSON.stringify({ observed: 250 }) });
    const response = await GET(request("GET", `?reportId=${id}&offset=200&take=50`), params());
    expect(await response.json()).toMatchObject({ findings: findings.slice(200), total: 250, nextOffset: null });
    expect(deps.report.mock.calls[0][0].where).toEqual({ id, deviceId: 1 });
    expect(deps.withFiles).not.toHaveBeenCalled(); expect(deps.device).not.toHaveBeenCalled(); expect(deps.run).not.toHaveBeenCalled();
  });

  it("validates report identity and page bounds before the store read", async () => {
    for (const query of ["?reportId=bad", "?offset=-1", "?offset=100001", "?take=201", "?take=0"]) expect((await GET(request("GET", query), params())).status).toBe(400);
    expect(deps.report).not.toHaveBeenCalled();
    expect((await GET(request("GET", "", { authorization: "" }), params())).status).toBe(401);
    expect(deps.report).not.toHaveBeenCalled();
  });

  it("suppresses raw connection/provider/credential details on runtime failure", async () => {
    deps.run.mockRejectedValue(new Error("private credential fixture must not be returned"));
    const response = await POST(request("POST"), params());
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("credential fixture");
  });

  it("reads real paginated stored bytes and excludes another device's report without any live inventory", async () => {
    const fixture = await createTestDatabase();
    try {
      const findings = Array.from({ length: 250 }, (_, n) => ({ kind: "extra", path: `/fixture/${n}.sfc`, repair: "review" }));
      const stored = await fixture.client.doctorReport.create({ data: { deviceId: 7, complete: true, findings: JSON.stringify(findings), summary: JSON.stringify({ observed: 250 }) } });
      deps.report.mockImplementation((query) => fixture.client.doctorReport.findFirst(query));
      const response = await GET(request("GET", `?reportId=${stored.id}&offset=200&take=50`), params("7"));
      expect(await response.json()).toMatchObject({ findings: findings.slice(200), total: 250, nextOffset: null });
      expect((await GET(request("GET", `?reportId=${stored.id}`), params("8"))).status).toBe(404);
      expect(deps.device).not.toHaveBeenCalled(); expect(deps.run).not.toHaveBeenCalled(); expect(deps.withFiles).not.toHaveBeenCalled();
    } finally { await fixture.cleanup(); }
  });
});
