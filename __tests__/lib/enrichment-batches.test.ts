import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { PrismaClient } from "@prisma/client";
import { createTestDatabase } from "../helpers/temp-database";

const fixture = vi.hoisted(() => ({
  db: undefined as PrismaClient | undefined, calls: [] as number[], unavailable: false,
  auth: vi.fn(), settings: vi.fn(), acquire: vi.fn(), query: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: new Proxy({}, {
  get(_target, property) {
    const value = Reflect.get(fixture.db!, property);
    return typeof value === "function" ? value.bind(fixture.db) : value;
  },
}) }));
vi.mock("@/lib/auth", () => ({ requireAuth: fixture.auth }));
vi.mock("@/lib/encryption", () => ({ getDecryptedSettings: fixture.settings }));
vi.mock("@/lib/job-admission", async (original) => {
  const actual = await original<typeof import("@/lib/job-admission")>();
  return { ...actual, acquireEnrichment: (request: Request) => { fixture.acquire(); return actual.acquireEnrichment(request); } };
});
vi.mock("@/lib/igdb", () => ({
  searchIgdb: async (title: string) => resolveMetadata(Number(title.split(" ")[1])),
  fetchIgdbById: async (id: number) => resolveMetadata(id), getIgdbToken: async () => "toy",
}));
vi.mock("@/lib/openrouter", () => ({ generateGameAiContent: async (title: string) => {
  const id = Number(title.split(" ")[1]); fixture.calls.push(id);
  if (fixture.unavailable && id <= 500) throw new Error("Synthetic unavailable metadata");
  return { funFacts: "Toy facts", story: "Toy story" };
} }));
vi.mock("@/lib/steamgriddb", () => ({ searchSteamGridDb: vi.fn() }));
vi.mock("@/lib/image-cache", () => ({ cacheGameImages: vi.fn() }));
vi.mock("@/lib/provider-budget", () => ({ providerFetch: async (_provider: string, _url: string, init: RequestInit) => {
  const match = String(init.body).match(/where id = \(([^)]+)\)/);
  const ids = match![1].split(",").map(Number); fixture.calls.push(...ids);
  return Response.json(ids.map((id) => ({ id, ...(fixture.unavailable && id <= 500 ? {} : { aggregated_rating: 90 }) })));
} }));

function resolveMetadata(id: number) {
  fixture.calls.push(id);
  if (fixture.unavailable && id <= 500) return null;
  return { igdbId: id, coverUrl: null, igdbScore: 90, metacriticScore: 90, genres: [], developer: null,
    publisher: null, releaseDate: null, summary: "Toy", screenshotUrls: ["https://example.test/toy.jpg"],
    videoIds: ["toy"], artworkUrls: ["https://example.test/toy.jpg"], franchise: "Toy", themes: ["Toy"] };
}

import { POST as bulk } from "@/app/api/enrich/route";
import { POST as ai } from "@/app/api/enrich/ai/route";
import { POST as refresh } from "@/app/api/enrich/refresh/route";
import { POST as scores } from "@/app/api/enrich/metacritic/route";
import { parseEnrichmentCursor } from "@/lib/enrichment-batches";

let database: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => { database = await createTestDatabase(); fixture.db = database.client; });
afterAll(async () => { await database.cleanup(); });
beforeEach(async () => {
  vi.clearAllMocks(); fixture.calls = []; fixture.unavailable = false;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  fixture.auth.mockReturnValue(null);
  fixture.settings.mockResolvedValue({ igdbClientId: "synthetic", igdbClientSecret: "synthetic", openrouterKey: "synthetic" });
  await database.client.game.deleteMany();
});
afterEach(() => { vi.restoreAllMocks(); });

async function seed(hasMetadata: boolean) {
  await database.client.game.createMany({ data: Array.from({ length: 501 }, (_, index) => ({
    title: `Toy ${index + 1}`, originalFile: `Toy ${index + 1}.sfc`, platform: "snes", platformLabel: "SNES",
    ...(hasMetadata ? { igdbId: index + 1 } : {}),
  })) });
  return database.client.game.findMany({ select: { id: true }, orderBy: { id: "asc" } });
}

function request(cursor = "0", force = false) {
  return new NextRequest(`http://localhost:3000/api/enrich?afterId=${encodeURIComponent(cursor)}`, { method: "POST", body: JSON.stringify({ force }) });
}
async function done(response: Response): Promise<Record<string, unknown>> {
  const records = (await response.text()).split("\n\n").filter((line) => line.startsWith("data: ")).map((line) => JSON.parse(line.slice(6)));
  return records.find((record) => record.type === "done");
}

describe("bounded enrichment continuation with a real 501-row SQLite library", () => {
  it("force refresh reaches row 501 without dispatching the first 500 again", async () => {
    const ids = await seed(false);
    const first = await done(await bulk(request("0", true)));
    fixture.calls = [];
    const second = await done(await bulk(request(String(ids[499].id), true)));
    expect(second.processed).toBe(1);
    expect(fixture.calls).toEqual([501]);
    expect(first).toMatchObject({ nextCursor: ids[499].id, hasMore: true, pending: 1 });
    expect(second).toMatchObject({ nextCursor: ids[500].id, hasMore: false, pending: 0, remaining: 0 });
    expect((await database.client.game.findUnique({ where: { id: ids[500].id } }))!.igdbId).toBe(501);
  }, 30000);

  it.each([{ name: "bulk", route: bulk, metadata: false }, { name: "AI", route: ai, metadata: true }, { name: "refresh", route: refresh, metadata: true }, { name: "scores", route: scores, metadata: true }])("advances $name past unavailable first 500 rows in one pass", async ({ route, metadata }) => {
    fixture.unavailable = true;
    const ids = await seed(metadata);
    const first = await done(await route(request()));
    fixture.calls = [];
    const second = await done(await route(request(String(ids[499].id))));
    expect(second.processed).toBe(1);
    expect(fixture.calls).toEqual([501]);
    expect(first).toMatchObject({ nextCursor: ids[499].id, hasMore: true, pending: 1, remaining: 501 });
    expect(second).toMatchObject({ nextCursor: ids[500].id, hasMore: false, pending: 0, remaining: 500 });
  }, 30000);

  it.each(["-1", "1.5", "Infinity", "9007199254740992", "1junk", "", " 1", "+1"])("rejects invalid cursor %j before settings, acquisition or business queries", async (cursor) => {
    const find = vi.spyOn(database.client.game, "findMany");
    const count = vi.spyOn(database.client.game, "count");
    try {
      for (const route of [bulk, ai, refresh, scores]) expect((await route(request(cursor))).status).toBe(400);
      expect(fixture.settings).not.toHaveBeenCalled();
      expect(fixture.acquire).not.toHaveBeenCalled();
      expect(find).not.toHaveBeenCalled(); expect(count).not.toHaveBeenCalled();
      expect(await database.client.$queryRaw`SELECT * FROM "JobLease"`).toEqual([]);
    } finally { find.mockRestore(); count.mockRestore(); }
  });

  it("returns the cursor and global unfinished count when the tail is empty", async () => {
    await database.client.game.create({ data: { title: "Toy", originalFile: "Toy.sfc", platform: "snes", platformLabel: "SNES" } });
    for (const route of [bulk, ai, refresh, scores]) {
      const response = await route(request(String(Number.MAX_SAFE_INTEGER)));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ nextCursor: Number.MAX_SAFE_INTEGER, hasMore: false, pending: 0, remaining: route === bulk ? 1 : 0 });
    }
    expect(fixture.calls).toEqual([]);
  });

  it("defaults an omitted cursor to zero and rejects duplicate cursor keys", () => {
    expect(parseEnrichmentCursor(new Request("http://localhost:3000/api/enrich"))).toBe(0);
    expect(parseEnrichmentCursor(new Request("http://localhost:3000/api/enrich?afterId=1&afterId=2"))).toBeNull();
  });
});
