import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const deps = vi.hoisted(() => ({ acquire: vi.fn(), search: vi.fn(), update: vi.fn(), upsert: vi.fn(), transfer: vi.fn(), close: vi.fn(), assert: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuth: () => null }));
vi.mock("@/lib/encryption", () => ({
  getDecryptedSettings: async () => ({ igdbClientId: "test", igdbClientSecret: "toy", activeDeviceId: 1 }),
  getDecryptedDevice: async () => ({ id: 1, protocol: "ssh", host: "test.invalid", port: 22, user: "test", password: "toy" }),
}));
vi.mock("@/lib/disc-inputs", async (original) => ({
  ...await original<typeof import("@/lib/disc-inputs")>(),
  loadUploadSession: async () => ({ sessionDir: "/tmp/ludotek-uploads/test-admission-only", descriptorInputs: new Map(), games: [
    { id: "game-toy-file", title: "Toy", type: "single", conversion: "none", files: [{ name: "Toy.bin", path: "/tmp/ludotek-uploads/test-admission-only/Toy.bin" }] },
  ] }),
}));
vi.mock("@/lib/uploader", () => ({ transferFiles: deps.transfer, transferM3u: vi.fn(), generateM3u: vi.fn(), getTransferPath: () => "/toy/" }));
vi.mock("@/lib/converter", () => ({ convert: vi.fn() }));
vi.mock("@/lib/igdb", () => ({ searchIgdb: deps.search }));
vi.mock("@/lib/steamgriddb", () => ({ searchSteamGridDb: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  game: { upsert: deps.upsert, count: async () => 1, update: deps.update },
  gameDevice: { upsert: async () => ({}) }, platform: { upsert: async () => ({}) },
} }));
vi.mock("fs/promises", () => ({ rm: vi.fn() }));
vi.mock("@/lib/job-admission", async (original) => ({ ...await original<typeof import("@/lib/job-admission")>(), acquireEnrichment: deps.acquire }));

import { AdmissionError } from "@/lib/job-admission";
import { POST } from "@/app/api/upload/process/route";

beforeEach(() => {
  vi.clearAllMocks();
  deps.search.mockResolvedValue(null);
  deps.transfer.mockResolvedValue(undefined);
  deps.close.mockResolvedValue(undefined);
  deps.assert.mockResolvedValue(undefined);
  deps.upsert.mockResolvedValue({ id: 1 });
});

describe("optional upload enrichment shares admission", () => {
  it.each([409, 503] as const)("keeps a completed transfer successful when metadata admission returns %i", async (status) => {
    deps.acquire.mockRejectedValue(new AdmissionError(status, "Metadata unavailable"));
    const response = await POST(new NextRequest("http://localhost:3000/api/upload/process", {
      method: "POST", body: JSON.stringify({ sessionId: "test-admission-only", platform: "psx", gameIds: ["game-toy-file"], deviceId: 1 }),
    }));
    const events = (await response.text()).split("\n\n").filter((line) => line.startsWith("data: ")).map((line) => JSON.parse(line.slice(6)));
    expect(deps.transfer).toHaveBeenCalledOnce();
    expect(deps.search).not.toHaveBeenCalled();
    expect(deps.update).not.toHaveBeenCalled();
    expect(events).toContainEqual(expect.objectContaining({ type: "enrich-skipped", reason: "Metadata unavailable", status }));
    expect(events).toContainEqual(expect.objectContaining({ type: "game-done" }));
    expect(events).toContainEqual(expect.objectContaining({ type: "done", succeeded: 1, failed: 0 }));
  });

  it("aborts optional metadata on stream cancel and drains it before releasing the lease", async () => {
    let finish!: () => void;
    let resolveClosed!: () => void;
    const closed = new Promise<void>((resolve) => { resolveClosed = resolve; });
    deps.close.mockImplementation(async () => { resolveClosed(); });
    deps.acquire.mockImplementation(async (request: Request) => ({ signal: request.signal,
      assertActive: async () => { if (request.signal.aborted) throw new AdmissionError(409, "Job cancelled"); },
      close: deps.close, run: (work: () => Promise<unknown>) => work(),
    }));
    deps.search.mockImplementation(async () => {
      await new Promise<void>((resolve) => { finish = resolve; });
      return { igdbId: 1, coverUrl: null, genres: [], screenshotUrls: [], videoIds: [], artworkUrls: [], themes: [] };
    });
    const response = await POST(new NextRequest("http://localhost:3000/api/upload/process", {
      method: "POST", body: JSON.stringify({ sessionId: "test-admission-only", platform: "psx", gameIds: ["game-toy-file"], deviceId: 1 }),
    }));
    await vi.waitFor(() => expect(deps.search).toHaveBeenCalledOnce());
    let cancelled = false;
    const cancellation = response.body!.cancel().then(() => { cancelled = true; });
    try {
      await Promise.resolve();
      await Promise.resolve();
      expect(cancelled).toBe(false);
      expect(deps.close).not.toHaveBeenCalled();
    } finally {
      finish();
      await cancellation;
      await closed;
    }
    expect(deps.update).not.toHaveBeenCalled();
    expect(deps.close).toHaveBeenCalledOnce();
    expect(cancelled).toBe(true);
  });

  it("drains an already-started transfer after cancel without starting DB or metadata steps", async () => {
    let finish!: () => void;
    deps.transfer.mockImplementation(async () => { await new Promise<void>((resolve) => { finish = resolve; }); });
    const response = await POST(new NextRequest("http://localhost:3000/api/upload/process", {
      method: "POST", body: JSON.stringify({ sessionId: "test-admission-only", platform: "psx", gameIds: ["game-toy-file"], deviceId: 1 }),
    }));
    await vi.waitFor(() => expect(deps.transfer).toHaveBeenCalledOnce());
    let cancelled = false;
    const cancellation = response.body!.cancel().then(() => { cancelled = true; });
    try {
      await Promise.resolve();
      expect(cancelled).toBe(false);
    } finally { finish(); await cancellation; }
    expect(deps.upsert).not.toHaveBeenCalled();
    expect(deps.acquire).not.toHaveBeenCalled();
    expect(deps.search).not.toHaveBeenCalled();
  });
});
