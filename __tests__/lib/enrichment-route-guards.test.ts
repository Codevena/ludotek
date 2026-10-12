import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const deps = vi.hoisted(() => ({
  acquire: vi.fn(), settings: vi.fn(), find: vi.fn(), unique: vi.fn(), count: vi.fn(), update: vi.fn(),
  igdb: vi.fn(), byId: vi.fn(), ai: vi.fn(), token: vi.fn(), dispatch: vi.fn(), images: vi.fn(),
  assert: vi.fn(), close: vi.fn(), controller: new AbortController(),
}));
vi.mock("@/lib/auth", () => ({ requireAuth: () => null }));
vi.mock("@/lib/prisma", () => ({ prisma: { game: { findMany: deps.find, findUnique: deps.unique, count: deps.count, update: deps.update } } }));
vi.mock("@/lib/encryption", () => ({ getDecryptedSettings: deps.settings }));
vi.mock("@/lib/igdb", () => ({ searchIgdb: deps.igdb, fetchIgdbById: deps.byId, getIgdbToken: deps.token }));
vi.mock("@/lib/openrouter", () => ({ generateGameAiContent: deps.ai }));
vi.mock("@/lib/steamgriddb", () => ({ searchSteamGridDb: vi.fn() }));
vi.mock("@/lib/image-cache", () => ({ cacheGameImages: deps.images }));
vi.mock("@/lib/provider-budget", () => ({ providerFetch: deps.dispatch }));
vi.mock("@/lib/job-admission", async (original) => ({ ...await original<typeof import("@/lib/job-admission")>(), acquireEnrichment: deps.acquire }));

import { AdmissionError } from "@/lib/job-admission";
import { POST as bulk } from "@/app/api/enrich/route";
import { POST as ai } from "@/app/api/enrich/ai/route";
import { POST as refresh } from "@/app/api/enrich/refresh/route";
import { POST as scores } from "@/app/api/enrich/metacritic/route";
import { POST as single } from "@/app/api/games/[id]/enrich/route";

const game = (id: number) => ({ id, title: `Toy ${id}`, platform: "snes", platformLabel: "SNES", igdbId: id, genres: "[]", releaseDate: null, developer: null, summary: null, themes: null, artworkUrls: null, videoIds: null, screenshotUrls: null, metacriticScore: null, franchise: null });
const metadata = { igdbId: 1, coverUrl: null, igdbScore: 90, metacriticScore: 90, genres: [], developer: null, publisher: null, releaseDate: null, summary: null, screenshotUrls: [], videoIds: [], artworkUrls: [], franchise: null, themes: [] };
const request = () => new NextRequest("http://localhost:3000/api/enrich", { method: "POST" });
async function events(response: Response) {
  return (await response.text()).split("\n\n").filter((line) => line.startsWith("data: ")).map((line) => JSON.parse(line.slice(6)));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  deps.controller = new AbortController();
  deps.acquire.mockResolvedValue({ signal: deps.controller.signal, assertActive: deps.assert,
    abort: (reason?: unknown) => deps.controller.abort(reason), close: deps.close,
    run: (work: () => Promise<unknown>) => work() });
  deps.assert.mockImplementation(async () => { if (deps.controller.signal.aborted) throw new AdmissionError(409, "Job cancelled"); });
  deps.close.mockResolvedValue(undefined);
  deps.settings.mockResolvedValue({ igdbClientId: "toy", igdbClientSecret: "toy", openrouterKey: "toy" });
  deps.find.mockResolvedValue([game(1), game(2), game(3)]);
  deps.unique.mockResolvedValue(game(1));
  deps.count.mockResolvedValue(3);
  deps.igdb.mockResolvedValue(metadata);
  deps.byId.mockResolvedValue(metadata);
  deps.ai.mockResolvedValue({ funFacts: "Toy facts", story: "Toy story" });
  deps.token.mockResolvedValue("toy");
  deps.dispatch.mockResolvedValue(Response.json([{ id: 1, aggregated_rating: 90 }, { id: 2, aggregated_rating: 90 }, { id: 3, aggregated_rating: 90 }]));
  deps.update.mockResolvedValue({});
  deps.images.mockResolvedValue(undefined);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("enrichment writer guards", () => {
  it.each([bulk, ai, refresh, scores])("acquires the shared lease before selecting work or reading credentials", async (route) => {
    deps.acquire.mockRejectedValue(new AdmissionError(409, "Job already running", 90));
    const response = await route(request());
    expect(response.status).toBe(409);
    expect(response.headers.get("Retry-After")).toBe("90");
    expect(deps.find).not.toHaveBeenCalled();
    expect(deps.settings).not.toHaveBeenCalled();
    expect(deps.igdb).not.toHaveBeenCalled();
    expect(deps.ai).not.toHaveBeenCalled();
  });

  it.each([bulk, ai, refresh, scores])("bounds the selected working set to 500", async (route) => {
    deps.find.mockResolvedValue([]);
    const response = await route(request());
    expect(response.status).toBe(200);
    expect(deps.find.mock.calls[0][0].take).toBe(500);
    expect(deps.close).toHaveBeenCalledOnce();
  });

  it.each([bulk, refresh])("stops remaining games when a provider's long budget is exhausted", async (route) => {
    deps.igdb.mockRejectedValue(new AdmissionError(429, "Provider long-term budget exhausted", 3600));
    deps.byId.mockRejectedValue(new AdmissionError(429, "Provider long-term budget exhausted", 3600));
    const records = await events(await route(request()));
    expect(deps.igdb.mock.calls.length + deps.byId.mock.calls.length).toBe(1);
    expect(deps.update).not.toHaveBeenCalled();
    expect(records).toContainEqual(expect.objectContaining({ type: "stopped", processed: 1 }));
    expect(records).toContainEqual(expect.objectContaining({ type: "done", processed: 1, stopped: true, remaining: 3 }));
    expect(deps.close).toHaveBeenCalledOnce();
  });

  it("checks ownership again after metadata fetch and before the business write", async () => {
    deps.assert.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new AdmissionError(409, "Job lease lost"));
    const records = await events(await bulk(request()));
    expect(deps.igdb).toHaveBeenCalledOnce();
    expect(deps.update).not.toHaveBeenCalled();
    expect(records).toContainEqual(expect.objectContaining({ type: "done", stopped: true, processed: 1 }));
  });

  it("distinguishes global missing metadata from queued force-refresh work", async () => {
    deps.count.mockImplementation(async ({ where }) => where.id ? where.id.gt === 0 ? 1000 : 997 : 25);
    const records = await events(await bulk(new NextRequest("http://localhost:3000/api/enrich", { method: "POST", body: JSON.stringify({ force: true }) })));
    expect(records).toContainEqual(expect.objectContaining({ type: "done", processed: 3, enriched: 3, remaining: 25, pending: 997, nextCursor: 3, hasMore: true }));
  });

  it("rejects single-game work on shared-lease contention before DB or credentials", async () => {
    deps.acquire.mockRejectedValue(new AdmissionError(409, "Job already running"));
    const response = await single(new NextRequest("http://localhost:3000/api/games/1/enrich", { method: "POST", body: "{}" }), { params: Promise.resolve({ id: "1" }) });
    expect(response.status).toBe(409);
    expect(deps.unique).not.toHaveBeenCalled();
    expect(deps.settings).not.toHaveBeenCalled();
    expect(deps.igdb).not.toHaveBeenCalled();
  });

  it("reports release-store failure as 503 for single-game responses", async () => {
    deps.close.mockRejectedValue(new AdmissionError(503, "Admission store unavailable"));
    const response = await single(new NextRequest("http://localhost:3000/api/games/1/enrich", { method: "POST", body: "{}" }), { params: Promise.resolve({ id: "1" }) });
    expect(response.status).toBe(503);
  });

  it("stops a score batch on lease loss without claiming all 51 games processed", async () => {
    deps.find.mockResolvedValue(Array.from({ length: 51 }, (_, index) => game(index + 1)));
    deps.assert.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new AdmissionError(409, "Job lease lost"));
    const records = await events(await scores(request()));
    expect(deps.dispatch).toHaveBeenCalledOnce();
    expect(deps.update).not.toHaveBeenCalled();
    expect(records).toContainEqual(expect.objectContaining({ type: "done", stopped: true, processed: 0 }));
  });

  it.each(["0", "5", "-1", "Infinity", "2.5", "", "3junk"])("rejects invalid AI concurrency %s before work", async (configured) => {
    vi.stubEnv("AI_CONCURRENCY", configured);
    expect((await ai(request())).status).toBe(503);
    expect(deps.acquire).not.toHaveBeenCalled();
    expect(deps.ai).not.toHaveBeenCalled();
  });

  it("caps AI concurrency at two and drains started work before release", async () => {
    vi.stubEnv("AI_CONCURRENCY", "4");
    let active = 0;
    let maximum = 0;
    const finish: (() => void)[] = [];
    deps.ai.mockImplementation(async () => {
      active++;
      maximum = Math.max(maximum, active);
      await new Promise<void>((resolve) => finish.push(resolve));
      active--;
      return { funFacts: "Toy facts", story: "Toy story" };
    });
    const response = await ai(request());
    await vi.waitFor(() => expect(finish).toHaveLength(2));
    expect(maximum).toBe(2);
    expect(deps.close).not.toHaveBeenCalled();
    const cancel = response.body!.cancel();
    finish.splice(0).forEach((resolve) => resolve());
    await cancel;
    expect(deps.ai).toHaveBeenCalledTimes(2);
    expect(deps.update).not.toHaveBeenCalled();
    expect(active).toBe(0);
    expect(deps.close).toHaveBeenCalledOnce();
  });
});
