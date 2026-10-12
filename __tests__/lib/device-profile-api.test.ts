import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const deps = vi.hoisted(() => ({ getProfile: vi.fn(), save: vi.fn(), create: vi.fn(), get: vi.fn(), apply: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/device-profiles", async (original) => ({ ...await original<typeof import("@/lib/device-profiles")>(), getDeviceProfile: deps.getProfile, saveDeviceProfile: deps.save }));
vi.mock("@/lib/device-profile-sync", () => ({ createDeviceSyncPlan: deps.create, getDeviceSyncPlan: deps.get, applyDeviceSyncPlan: deps.apply }));
import { AdmissionError } from "@/lib/job-admission";
import { GET as profileGet, PUT as profilePut } from "@/app/api/devices/[id]/profile/route";
import { POST as preview } from "@/app/api/device-sync/route";
import { GET as planGet } from "@/app/api/device-sync/[id]/route";
import { POST as apply } from "@/app/api/device-sync/[id]/apply/route";
const params = { params: Promise.resolve({ id: "1" }) };
const request = (method: string, body?: string, headers: Record<string, string> = {}) => new NextRequest("http://localhost:3000/api/device-sync", { method, body, headers: { authorization: "Bearer toy-test-token", ...headers } });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("ADMIN_TOKEN", "toy-test-token"); vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  deps.getProfile.mockResolvedValue({ deviceId: 1, profile: { template: "custom", romRoots: [], saveRoots: [], formats: [], reserveBytes: "0" } });
  deps.save.mockResolvedValue({ saved: true }); deps.create.mockResolvedValue({ status: "conflict", conflicts: [{ fileKey: "snes|Toy.sfc" }] }); deps.get.mockResolvedValue({ status: "ready" }); deps.apply.mockResolvedValue({ status: "applied" });
});
afterEach(() => { vi.unstubAllEnvs(); });
describe("authenticated profile and sync API", () => {
  it("rejects unauthorized and foreign-origin actions before service or IO", async () => {
    expect((await profileGet(request("GET", undefined, { authorization: "" }), params)).status).toBe(401);
    expect((await planGet(request("GET", undefined, { authorization: "" }), params)).status).toBe(401);
    for (const route of [profilePut, apply]) expect((await route(request("PUT", "{}", { origin: "http://foreign.invalid" }), params)).status).toBe(403);
    expect((await preview(request("POST", "{}", { origin: "http://foreign.invalid" }))).status).toBe(403);
    for (const fn of Object.values(deps)) expect(fn).not.toHaveBeenCalled();
  });
  it("GET returns editable templates without credential fields, mutations are explicit and no-store", async () => {
    const response = await profileGet(request("GET"), params);
    const data = await response.json(); expect(data.templates).toHaveLength(4); expect(JSON.stringify(data)).not.toContain("password");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await (await profilePut(request("PUT", '{"template":"custom"}'), params)).json()).toEqual({ saved: true });
    expect(deps.save.mock.calls[0][0]).toBe(1);
    expect(deps.save.mock.calls[0][1]).toEqual({ template: "custom" });
  });
  it("returns persisted conflict preview and only calls apply on its separate explicit endpoint", async () => {
    expect(await (await preview(request("POST", '{"masterDeviceId":1,"deviceId":2,"direction":"two-way"}'))).json()).toMatchObject({ status: "conflict" });
    expect(deps.apply).not.toHaveBeenCalled();
    expect(await (await apply(request("POST"), params)).json()).toEqual({ status: "applied" });
    expect(deps.apply.mock.calls[0][0]).toBe("1");
  });
  it.each([409, 503] as const)("returns shared-store/busy%s before any child mutation", async (status) => {
    deps.create.mockRejectedValue(new AdmissionError(status, "Synthetic lease rejection", 7));
    const response = await preview(request("POST", "{}"));
    expect(response.status).toBe(status); expect(response.headers.get("Retry-After")).toBe("7"); expect(deps.apply).not.toHaveBeenCalled();
  });
  it("bounds inputs and suppresses unexpected raw device details", async () => {
    expect((await preview(request("POST", " ".repeat(128 * 1024 + 1)))).status).toBe(413);
    expect(deps.create).not.toHaveBeenCalled();
    deps.apply.mockRejectedValue(new Error("private credential fixture"));
    const response = await apply(request("POST"), params); expect(response.status).toBe(503); expect(await response.text()).not.toContain("credential fixture");
  });
});
