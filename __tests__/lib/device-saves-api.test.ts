import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const deps = vi.hoisted(() => ({ acquire: vi.fn(), inventory: vi.fn(), backup: vi.fn(), versions: vi.fn(), restore: vi.fn(), preview: vi.fn(), apply: vi.fn(), get: vi.fn(), close: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/device-saves", async (original) => ({ ...await original<typeof import("@/lib/device-saves")>(), acquireSaveContext: deps.acquire, readSaveInventory: deps.inventory, streamSaveBackup: deps.backup, getSaveVersions: deps.versions, prepareSaveRestore: deps.restore }));
vi.mock("@/lib/save-sync", () => ({ createSaveSyncPlan: deps.preview, applySaveSyncPlan: deps.apply, getSaveSyncPlan: deps.get }));
import { AdmissionError } from "@/lib/job-admission";
import { GET as inventory, POST as backup } from "@/app/api/devices/[id]/saves/route";
import { GET as history } from "@/app/api/saves/versions/route";
import { POST as restore } from "@/app/api/saves/versions/[id]/restore/route";
import { POST as sync } from "@/app/api/devices/[id]/saves/sync/route";
const uuid = "12345678-1234-4234-9234-123456789abc";
const params = (id = "1") => ({ params: Promise.resolve({ id }) });
const request = (method: string, body?: unknown, headers: Record<string, string> = {}, query = "") => new NextRequest(`http://localhost:3000/api/saves/versions${query}`, { method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), headers: { authorization: "Bearer toy-test-token", ...headers } });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("ADMIN_TOKEN", "toy-test-token"); vi.stubEnv("APP_ORIGIN", "http://localhost:3000");
  deps.acquire.mockResolvedValue({ close: deps.close }); deps.close.mockResolvedValue(undefined); deps.inventory.mockResolvedValue({ files: [], complete: false });
  deps.backup.mockResolvedValue(new Response('data: {"type":"done"}\n\n', { headers: { "Content-Type": "text/event-stream" } }));
  deps.versions.mockResolvedValue({ versions: [], total: 0 }); deps.restore.mockResolvedValue({ plan: { id: uuid, status: "ready" }, targetBackupVersionId: uuid });
  deps.preview.mockResolvedValue({ status: "conflict" }); deps.get.mockResolvedValue({ deviceId: 1 }); deps.apply.mockResolvedValue({ status: "applied" });
});
afterEach(() => { vi.unstubAllEnvs(); });
describe("authenticated explicit save endpoints", () => {
  it("rejects unauthorized and foreign-origin requests before inventory, credentials, store or mutations", async () => {
    expect((await inventory(request("GET", undefined, { authorization: "" }), params())).status).toBe(401);
    expect((await history(request("GET", undefined, { authorization: "" }))).status).toBe(401);
    for (const route of [backup, restore, sync]) expect((await route(request("POST", {}, { origin: "http://foreign.invalid" }), params(uuid))).status).toBe(403);
    for (const fn of Object.values(deps)) expect(fn).not.toHaveBeenCalled();
  });
  it.each([409, 503] as const)("no inventory is read when the shared lease returns%s", async (status) => {
    deps.acquire.mockRejectedValue(new AdmissionError(status, "Synthetic store failure"));
    expect((await inventory(request("GET"), params())).status).toBe(status); expect(deps.inventory).not.toHaveBeenCalled();
  });
  it("rejects client storage paths, raw backup keys and unconfirmed game IDs before backup starts", async () => {
    for (const input of [{ filePath: "../outside" }, { filePath: "/fixture/save.srm", storageDirectory: "/outside" }, { filePath: "/fixture/save.srm", gameId: -1 }]) expect((await backup(request("POST", input), params())).status).toBe(400);
    expect(deps.backup).not.toHaveBeenCalled();
    expect((await restore(request("POST", { targetDeviceId: 1, targetPath: "/fixture/save.srm", storageKey: "a".repeat(64) }), params(uuid))).status).toBe(400);
    expect(deps.restore).not.toHaveBeenCalled();
  });
  it("backup streams progress and restore returns a separate reviewable journal without applying it", async () => {
    expect((await backup(request("POST", { filePath: "/fixture/save.srm", gameId: 7 }), params())).headers.get("Content-Type")).toBe("text/event-stream");
    const response = await restore(request("POST", { targetDeviceId: 1, targetPath: "/fixture/save.srm" }), params(uuid));
    expect(await response.json()).toMatchObject({ plan: { status: "ready" } }); expect(deps.apply).not.toHaveBeenCalled();
  });
  it("reads only paginated history and scopes save-sync apply to the addressed device", async () => {
    await history(request("GET", undefined, {}, "?deviceId=1&offset=20&take=10")); expect(deps.versions).toHaveBeenCalledWith(expect.objectContaining({ deviceId: 1, offset: 20, take: 10 }));
    expect(deps.acquire).not.toHaveBeenCalled();
    deps.get.mockResolvedValue({ deviceId: 2 }); expect((await sync(request("POST", { action: "apply", planId: uuid }), params())).status).toBe(404); expect(deps.apply).not.toHaveBeenCalled();
  });
});
