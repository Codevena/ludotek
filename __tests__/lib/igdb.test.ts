import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cache = vi.hoisted(() => ({
  rows: new Map<string, { response: string; expiresAt: Date }>(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiCache: {
      findFirst: vi.fn(async ({ where }) => {
        const row = cache.rows.get(where.cacheKey);
        return row && row.expiresAt > where.expiresAt.gt ? row : null;
      }),
      upsert: vi.fn(async ({ where, update }) => {
        cache.rows.set(where.cacheKey, update);
        return update;
      }),
      findMany: vi.fn(async () => []),
    },
  },
}));
// Cache behavior is independent of persisted admission, exercised by provider-dispatch.test.ts.
vi.mock("@/lib/provider-budget", () => ({
  providerFetch: (_provider: string, url: string, init?: RequestInit) => fetch(url, init),
  abortableDelay: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
}));
vi.mock("@/lib/job-admission", () => ({ getJobContext: () => undefined }));

import { fetchIgdbById, searchIgdb, type IgdbGameData } from "@/lib/igdb";

const oldData: IgdbGameData = {
  igdbId: 42,
  coverUrl: null,
  igdbScore: null,
  metacriticScore: null,
  genres: [],
  developer: null,
  publisher: null,
  releaseDate: new Date("2000-01-01T00:00:00Z"),
  summary: "Old summary",
  screenshotUrls: [],
  videoIds: [],
  artworkUrls: [],
  franchise: null,
  themes: [],
};

describe("IGDB metadata cache", () => {
  const provider = vi.fn(async (url: string) => {
    if (url.startsWith("https://id.twitch.tv/")) {
      return Response.json({ access_token: "test-token", expires_in: 3600 });
    }
    if (url === "https://api.igdb.com/v4/games") {
      return Response.json([{ id: 42, name: "Game", first_release_date: 978307200, summary: "Fresh summary" }]);
    }
    throw new Error(`Unexpected test request: ${url}`);
  });

  beforeEach(() => {
    cache.rows.clear();
    provider.mockClear();
    vi.stubGlobal("fetch", provider);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each([
    { key: "igdb:game:42", load: (force: boolean) => fetchIgdbById(42, "test-id", "test-secret", { bypassCache: force }), hours: 168 },
    { key: "igdb:search:game:psx", load: (force: boolean) => searchIgdb("Game", "psx", "test-id", "test-secret", { bypassCache: force }), hours: 24 },
  ])("refreshes $key from the provider and lets ordinary calls reuse it", async ({ key, load, hours }) => {
    cache.rows.set(key, {
      response: JSON.stringify(oldData),
      expiresAt: new Date("2026-10-19T12:00:00Z"),
    });

    const refreshed = await load(true);
    const requestCount = provider.mock.calls.length;
    const reused = await load(false);

    expect(refreshed?.summary).toBe("Fresh summary");
    expect(refreshed?.releaseDate).toEqual(new Date("2001-01-01T00:00:00Z"));
    expect(reused?.summary).toBe("Fresh summary");
    expect(reused?.releaseDate).toBeInstanceOf(Date);
    expect(provider.mock.calls.length).toBe(requestCount);
    expect(JSON.parse(cache.rows.get(key)!.response).summary).toBe("Fresh summary");
    expect(cache.rows.get(key)?.expiresAt.getTime()).toBe(Date.now() + hours * 60 * 60 * 1000);
  });

  it.each([
    { key: "igdb:game:42", load: () => fetchIgdbById(42, "test-id", "test-secret") },
    { key: "igdb:search:game:psx", load: () => searchIgdb("Game", "psx", "test-id", "test-secret") },
  ])("hydrates cached dates without a provider request for $key", async ({ key, load }) => {
    cache.rows.set(key, {
      response: JSON.stringify(oldData),
      expiresAt: new Date("2026-10-19T12:00:00Z"),
    });

    const cached = await load();

    expect(cached?.releaseDate).toBeInstanceOf(Date);
    expect(cached?.releaseDate).toEqual(new Date("2000-01-01T00:00:00Z"));
    expect(cached?.summary).toBe("Old summary");
    expect(provider).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])("rejects invalid IGDB ID %s without cache or provider work", async (id) => {
    expect(await fetchIgdbById(id, "test-id", "test-secret")).toBeNull();
    expect(provider).not.toHaveBeenCalled();
    expect(cache.rows.size).toBe(0);
  });
});
