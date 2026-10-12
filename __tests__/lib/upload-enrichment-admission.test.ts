import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, realpath, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";

const deps = vi.hoisted(() => ({ acquire: vi.fn(), search: vi.fn(), update: vi.fn(), upsert: vi.fn(), transfer: vi.fn(), close: vi.fn(), assert: vi.fn(), fileClose: vi.fn(), sessionDir: "", planId: "12345678-1234-4234-9234-123456789abc" }));
vi.mock("@/lib/auth", () => ({ requireAuth: () => null }));
vi.mock("@/lib/encryption", () => ({ decrypt: (value: string) => value }));
vi.mock("@/lib/disc-inputs", async (original) => ({ ...await original<typeof import("@/lib/disc-inputs")>(),
  loadUploadSession: async () => ({ sessionDir: deps.sessionDir, descriptorInputs: new Map(), games: [{ id: "game-toy-file", title: "Toy", type: "single", conversion: "none", totalSize: 3, files: [{ name: "Toy.bin", size: 3, path: path.join(deps.sessionDir, "Toy.bin") }] }] }),
}));
vi.mock("@/lib/device-jobs", () => ({ acquireDeviceFiles: async (_ids: number[], request: Request) => ({ signal: request.signal, assertActive: async () => request.signal.throwIfAborted(), assertOwned: async () => {}, close: deps.fileClose }), assertDeviceJobsOwned: async () => {} }));
vi.mock("@/lib/connection", () => ({ createConnection: async () => ({ fileIo: { capabilities: async () => Object.fromEntries(["readStream", "exclusiveTemp", "publishNoReplace", "renameNoReplace", "fileFlush", "directoryFlush", "freeBytes"].map((key) => [key, { state: "supported" }])), lstat: async (filename: string) => { if (filename === "/fixture/roms/psx") return { type: "directory" }; throw Object.assign(new Error("absent"), { code: "ENOENT" }); }, flushFile: async () => {}, freeBytes: async () => ({ state: "known", bytes: BigInt(100000) }) }, disconnect: () => {} }), requireFileIo: (connection: { fileIo: unknown }) => connection.fileIo }));
vi.mock("@/lib/converter", () => ({ convert: vi.fn() }));
vi.mock("@/lib/igdb", () => ({ searchIgdb: deps.search }));
vi.mock("@/lib/steamgriddb", () => ({ searchSteamGridDb: vi.fn() }));
const fakeDb = vi.hoisted(() => ({
  settings: { findUnique: async () => ({ igdbClientId: "test", igdbClientSecret: "toy", activeDeviceId: 1 }) },
  device: { findUnique: async () => ({ id: 1, protocol: "ssh", host: "test.invalid", port: 22, user: "test", password: "toy", scanPaths: JSON.stringify([{ path: "/fixture/roms", type: "rom" }]) }) },
  deviceProfile: { findUnique: async () => ({ template: "custom", romRoots: JSON.stringify([{ path: "/fixture/roms" }]), saveRoots: "[]", formats: "[]", reserveBytes: BigInt(0), updatedAt: new Date(0) }) },
  uploadFileSource: { create: async ({ data }: { data: unknown }) => ({ ...(data as object), id: crypto.randomUUID() }), updateMany: async () => ({ count: 1 }), count: async () => 0 },
  filePlan: { findUnique: async () => ({ status: "applied" }) },
  deviceFile: { findMany: async () => [{ deviceId: 1, path: "/fixture/roms/psx/Toy.bin", kind: "file", platform: "psx" }], updateMany: async () => ({ count: 1 }) },
  game: { upsert: deps.upsert, count: async () => 1, update: deps.update }, gameDevice: { upsert: async () => ({}) }, platform: { upsert: async () => ({}) },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { ...fakeDb, $transaction: async (work: (db: typeof fakeDb) => Promise<unknown>) => work(fakeDb) } }));
const plan = () => ({ id: deps.planId, status: "applied", kind: "upload", totalBytes: "3", operations: [{ targetPath: "/fixture/roms/psx/Toy.bin", targetDeviceId: 1 }] });
vi.mock("@/lib/file-plans", async (original) => ({ ...await original<typeof import("@/lib/file-plans")>(), createUploadFilePlan: async () => ({ ...plan(), status: "ready" }), applyFilePlan: deps.transfer, getFilePlanFingerprints: async () => [], getUploadSourceReleaseProof: async () => ({ releasable: true, sourceIds: [] }) }));
vi.mock("@/lib/job-admission", async (original) => ({ ...await original<typeof import("@/lib/job-admission")>(), acquireEnrichment: deps.acquire }));

import { AdmissionError } from "@/lib/job-admission";
import { POST } from "@/app/api/upload/process/route";

beforeEach(async () => {
  await mkdir("/tmp/ludotek-uploads", { recursive: true }); deps.sessionDir = await realpath(await mkdtemp("/tmp/ludotek-uploads/test-enrichment-")); await writeFile(path.join(deps.sessionDir, "Toy.bin"), "toy");
  vi.clearAllMocks();
  deps.search.mockResolvedValue(null);
  deps.transfer.mockResolvedValue(plan());
  deps.fileClose.mockResolvedValue(undefined);
  deps.close.mockResolvedValue(undefined);
  deps.assert.mockResolvedValue(undefined);
  deps.upsert.mockResolvedValue({ id: 1 });
});

afterEach(async () => { await rm(deps.sessionDir, { recursive: true }); });

describe("optional upload enrichment shares admission", () => {
  it.each([409, 503] as const)("keeps a completed transfer successful when metadata admission returns %i", async (status) => {
    deps.acquire.mockRejectedValue(new AdmissionError(status, "Metadata unavailable"));
    const response = await POST(new NextRequest("http://localhost:3000/api/upload/process", {
      method: "POST", body: JSON.stringify({ sessionId: path.basename(deps.sessionDir), platform: "psx", gameIds: ["game-toy-file"], deviceId: 1 }),
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
      method: "POST", body: JSON.stringify({ sessionId: path.basename(deps.sessionDir), platform: "psx", gameIds: ["game-toy-file"], deviceId: 1 }),
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
    deps.transfer.mockImplementation(async () => { await new Promise<void>((resolve) => { finish = resolve; }); return plan(); });
    const response = await POST(new NextRequest("http://localhost:3000/api/upload/process", {
      method: "POST", body: JSON.stringify({ sessionId: path.basename(deps.sessionDir), platform: "psx", gameIds: ["game-toy-file"], deviceId: 1 }),
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
  it("reports optional provider failure without changing the verified upload success", async () => {
    deps.acquire.mockImplementation(async (request: Request) => ({ signal: request.signal, assertActive: deps.assert, close: deps.close, run: (work: () => Promise<unknown>) => work() }));
    deps.search.mockRejectedValue(new Error("Own synthetic provider failure"));
    const response = await POST(new NextRequest("http://localhost:3000/api/upload/process", { method: "POST", body: JSON.stringify({ sessionId: path.basename(deps.sessionDir), platform: "psx", gameIds: ["game-toy-file"], deviceId: 1 }) }));
    const events = (await response.text()).split("\n\n").filter(Boolean).map((line) => JSON.parse(line.slice(6)));
    expect(events).toContainEqual(expect.objectContaining({ type: "enrich-error", reason: "Optional enrichment failed" }));
    expect(events).toContainEqual(expect.objectContaining({ type: "game-done", planId: deps.planId }));
    expect(events).toContainEqual(expect.objectContaining({ type: "done", succeeded: 1, failed: 0 })); expect(deps.update).not.toHaveBeenCalled(); expect(deps.close).toHaveBeenCalledOnce();
  });
});
