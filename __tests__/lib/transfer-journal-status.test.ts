import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const deps = vi.hoisted(() => ({ latest: vi.fn(), plan: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { filePlan: { findFirst: deps.latest } } }));
vi.mock("@/lib/file-plans", () => ({ getFilePlan: deps.plan }));
import { GET } from "@/app/api/devices/transfer/status/route";
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("ADMIN_TOKEN", "own-test-token"); vi.stubEnv("APP_ORIGIN", "http://ludotek.lan"); vi.stubEnv("LUDOTEK_LOCAL_MODE", "");
  deps.latest.mockResolvedValue({ id: "12345678-1234-4234-9234-123456789abc" });
});
afterEach(() => vi.unstubAllEnvs());
it.each([
  ["applied", ["complete", "complete"], "complete", 100],
  ["applied", ["complete", "planned"], "error", 50],
  ["recovery_needed", ["complete", "failed"], "error", 50],
  ["applying", ["complete", "planned"], "in_progress", 50],
  ["undone", ["undone", "undone"], "undone", 0],
])("derives %s transfer status from every durable operation", async (status, phases, expected, progress) => {
  deps.plan.mockResolvedValue({ id: "12345678-1234-4234-9234-123456789abc", kind: "copy", status, operations: (phases as string[]).map((phase) => ({ phase, sourcePath: "/own/Toy.nes" })) });
  const response = await GET(new NextRequest("http://ludotek.lan/api/devices/transfer/status", { headers: { authorization: "Bearer own-test-token" } }));
  expect(await response.json()).toMatchObject({ status: expected, progress, total: 2, planId: "12345678-1234-4234-9234-123456789abc" });
});
it("authenticates before reading any journal and never uses process-local transfer state", async () => {
  expect((await GET(new NextRequest("http://ludotek.lan/api/devices/transfer/status"))).status).toBe(401);
  expect(deps.latest).not.toHaveBeenCalled(); expect(deps.plan).not.toHaveBeenCalled();
});
