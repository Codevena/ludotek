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

import { getCachedOrFetch } from "@/lib/api-cache";

describe("persistent API cache", () => {
  beforeEach(() => {
    cache.rows.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T12:00:00Z"));
  });

  afterEach(() => vi.useRealTimers());

  it("replaces a valid cached response when bypassCache is requested", async () => {
    cache.rows.set("igdb:game:42", {
      response: JSON.stringify({ summary: "Old summary" }),
      expiresAt: new Date("2026-10-19T12:00:00Z"),
    });
    const fetchFresh = vi.fn(async () => ({ summary: "Fresh summary" }));

    const refreshed = await getCachedOrFetch("igdb:game:42", fetchFresh, 168, { bypassCache: true });
    const normal = await getCachedOrFetch("igdb:game:42", async () => {
      throw new Error("A refreshed entry should be reusable");
    }, 168);

    expect(refreshed).toEqual({ summary: "Fresh summary" });
    expect(normal).toEqual({ summary: "Fresh summary" });
    expect(fetchFresh).toHaveBeenCalledTimes(1);
    expect(cache.rows.get("igdb:game:42")?.expiresAt).toEqual(new Date("2026-10-19T12:00:00Z"));
  });

  it("keeps the existing expiry and skips fetching for an ordinary cache hit", async () => {
    const expiresAt = new Date("2026-10-13T10:00:00Z");
    cache.rows.set("cached", { response: JSON.stringify({ value: "cached" }), expiresAt });

    const result = await getCachedOrFetch("cached", async () => {
      throw new Error("An ordinary cache hit must not call the provider");
    }, 168);

    expect(result).toEqual({ value: "cached" });
    expect(cache.rows.get("cached")?.expiresAt).toEqual(expiresAt);
  });

  it("fetches expired entries with the caller's original TTL", async () => {
    cache.rows.set("expired", {
      response: JSON.stringify({ value: "stale" }),
      expiresAt: new Date("2026-10-12T11:00:00Z"),
    });

    expect(await getCachedOrFetch("expired", async () => ({ value: "fresh" }), 3)).toEqual({ value: "fresh" });
    expect(cache.rows.get("expired")?.expiresAt).toEqual(new Date("2026-10-12T15:00:00Z"));
  });

  it("keeps the existing cached response if a forced provider fetch fails", async () => {
    cache.rows.set("cached", {
      response: JSON.stringify({ value: "previous" }),
      expiresAt: new Date("2026-10-13T12:00:00Z"),
    });

    await expect(getCachedOrFetch("cached", async () => {
      throw new Error("Provider unavailable");
    }, 24, { bypassCache: true })).rejects.toThrow("Provider unavailable");
    expect(JSON.parse(cache.rows.get("cached")!.response)).toEqual({ value: "previous" });
  });
});
