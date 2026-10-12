import { setTimeout as ioPoll } from "node:timers/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createTestDatabase } from "../helpers/temp-database";

const testDatabase = vi.hoisted(() => ({ client: null as PrismaClient | null }));
vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy({}, {
    get(_target, property) {
      const client = testDatabase.client;
      if (!client) throw new Error("Own test database is not ready");
      const value = Reflect.get(client, property);
      return typeof value === "function" ? value.bind(client) : value;
    },
  }),
}));

import { admissionStore, AdmissionError, EnrichmentJob, PROVIDER_CAPS } from "@/lib/job-admission";
import { getIgdbToken, searchIgdb } from "@/lib/igdb";
import { generateGameAiContent } from "@/lib/openrouter";
import { searchSteamGridDb } from "@/lib/steamgriddb";

let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
let cacheGameImages: typeof import("@/lib/image-cache").cacheGameImages;
let credential = 0;
const baseline = Date.UTC(2026, 9, 12, 12);
beforeAll(async () => {
  fixture = await createTestDatabase();
  testDatabase.client = fixture.client;
  const cwd = vi.spyOn(process, "cwd").mockReturnValue(fixture.directory);
  try { ({ cacheGameImages } = await import("@/lib/image-cache")); }
  finally { cwd.mockRestore(); }
});
afterAll(async () => { await fixture.cleanup(); testDatabase.client = null; });
beforeEach(async () => {
  await fixture.client.$executeRaw`DELETE FROM "JobLease"`;
  await fixture.client.$executeRaw`DELETE FROM "ProviderWindow"`;
  await fixture.client.$executeRaw`DELETE FROM "AdmissionClock"`;
  await fixture.client.apiCache.deleteMany();
  await fixture.client.game.deleteMany();
  credential++;
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(baseline);
  vi.spyOn(admissionStore, "clock").mockImplementation(() => Date.now());
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function waitForIo(predicate: () => boolean | Promise<boolean>): Promise<void> {
  for (let i = 0; i < 1000; i++) {
    if (await predicate()) return;
    // Only lets actual fixture SQLite I/O finish; budget waits use the fake clock below.
    await ioPoll(1);
  }
  throw new Error("Fixture I/O did not reach the expected dispatch boundary");
}

async function providerCount(provider: string): Promise<number> {
  const rows = await fixture.client.$queryRaw<{ used: number }[]>`SELECT "used" FROM "ProviderWindow" WHERE "key" = ${`${provider}:hour:${baseline}`}`;
  return Number(rows[0]?.used ?? 0);
}

async function hasWaiter(provider: string): Promise<boolean> {
  const rows = await fixture.client.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) AS "count" FROM "JobLease" WHERE "resource" LIKE ${`provider:${provider}:wait:%`}`;
  return Number(rows[0]?.count ?? 0) > 0;
}

const richGame = {
  id: 42, name: "Rich Game", cover: 1, genres: [2], involved_companies: [3],
  screenshots: [4], videos: [5], artworks: [6], franchise: 7, themes: [8],
};
function richResponse(endpoint: string): Response {
  const responses: Record<string, unknown> = {
    games: [richGame], covers: [{ image_id: "cover" }], genres: [{ name: "Adventure" }],
    involved_companies: [{ company: 9, developer: true, publisher: true }], companies: [{ id: 9, name: "Studio" }],
    screenshots: [{ image_id: "screen" }], game_videos: [{ video_id: "video" }], artworks: [{ image_id: "art" }],
    franchises: [{ name: "Series" }], themes: [{ name: "Fantasy" }],
  };
  return Response.json(responses[endpoint]);
}

describe("actual provider libraries with persisted admission", () => {
  it("stops an AI dispatch when the persisted hourly budget is exhausted", async () => {
    await fixture.client.$executeRaw`INSERT INTO "ProviderWindow" ("key", "used", "expiresAt") VALUES
      (${`openrouter:hour:${baseline}`}, 500, ${BigInt(baseline + 3600000)})`;
    const network = vi.fn(async () => Response.json({ choices: [{ message: { content: "---FUN_FACTS---\nFacts\n---STORY---\nStory" } }] }));
    vi.stubGlobal("fetch", network);
    await expect(generateGameAiContent("Game", "snes", null, null, [], null, "synthetic-key"))
      .rejects.toMatchObject({ status: 429 });
    expect(network).not.toHaveBeenCalled();
    expect(await providerCount("openrouter")).toBe(500);
  });

  it("reserves all ten rich IGDB queries and waits across short rate windows", async () => {
    const endpoints: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "https://id.twitch.tv/oauth2/token" || url.startsWith("https://id.twitch.tv/oauth2/token?")) {
        return Response.json({ access_token: "synthetic-token", expires_in: 3600 });
      }
      const endpoint = url.slice("https://api.igdb.com/v4/".length);
      endpoints.push(endpoint);
      return richResponse(endpoint);
    }));
    const result = searchIgdb("Rich Game", "snes", `rich-${credential}`, "synthetic-secret", { bypassCache: true });
    // A removed boundary would send all ten immediately rather than reach a persisted waiter.
    await waitForIo(async () => endpoints.length >= 4 && (await hasWaiter("igdb") || endpoints.length > 4));
    expect(endpoints).toHaveLength(4);
    await vi.advanceTimersByTimeAsync(1000);
    await waitForIo(() => endpoints.length >= 8);
    await waitForIo(() => hasWaiter("igdb"));
    await vi.advanceTimersByTimeAsync(1000);
    expect(await result).toMatchObject({ developer: "Studio", genres: ["Adventure"], franchise: "Series" });
    expect(endpoints).toEqual(["games", "covers", "genres", "involved_companies", "companies", "screenshots", "game_videos", "artworks", "franchises", "themes"]);
    expect(await providerCount("igdb")).toBe(10);
    expect(await providerCount("twitch")).toBe(1);
    const rate = await fixture.client.$queryRaw<{ used: number }[]>`SELECT "used" FROM "ProviderWindow" WHERE "key" LIKE 'igdb:rate:%' ORDER BY "key"`;
    expect(rate.map((row) => row.used)).toEqual([4, 4, 2]);
  });

  it("reserves an IGDB HTTP retry as a second attempt without repeating the whole lookup", async () => {
    let queries = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "https://id.twitch.tv/oauth2/token") return Response.json({ access_token: "retry-token", expires_in: 3600 });
      queries++;
      return queries === 1 ? new Response(null, { status: 503 }) : Response.json([{ id: 42, name: "Game" }]);
    }));
    const result = searchIgdb("Retry Game", "snes", `retry-${credential}`, "synthetic-secret", { bypassCache: true });
    await waitForIo(async () => queries === 1 && await providerCount("igdb") === 1 && vi.getTimerCount() > 0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(await result).toMatchObject({ igdbId: 42 });
    expect(queries).toBe(2);
    expect(await providerCount("igdb")).toBe(2);
    expect(await providerCount("twitch")).toBe(1);
  });

  it("aborts an IGDB retry delay without a second HTTP attempt or cache write", async () => {
    const lease = await admissionStore.acquire("enrichment");
    const job = new EnrichmentJob(lease, new AbortController().signal);
    let queries = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "https://id.twitch.tv/oauth2/token") return Response.json({ access_token: "abort-token", expires_in: 3600 });
      queries++;
      return new Response(null, { status: 503 });
    }));
    const result = job.run(() => searchIgdb("Cancelled Game", "snes", `abort-${credential}`, "synthetic-secret", { bypassCache: true }));
    const rejected = expect(result).rejects.toMatchObject({ status: 409 });
    try {
      await waitForIo(async () => queries === 1 && await providerCount("igdb") === 1 && vi.getTimerCount() === 2);
      job.abort();
      await rejected;
      expect(queries).toBe(1);
      expect(await providerCount("igdb")).toBe(1);
      expect(await fixture.client.apiCache.count()).toBe(0);
    } finally { await job.close(); }
  });

  it("runs a 21-game AI batch through the next minute rather than exceeding 20/minute", async () => {
    let dispatches = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      dispatches++;
      return Response.json({ choices: [{ message: { content: "---FUN_FACTS---\nFacts\n---STORY---\nStory" } }] });
    }));
    const batch = (async () => {
      const results = [];
      for (let i = 0; i < 21; i++) results.push(await generateGameAiContent(`Game ${i}`, "snes", null, null, [], null, "synthetic-key"));
      return results;
    })();
    await waitForIo(async () => dispatches >= 20 && (await hasWaiter("openrouter") || dispatches > 20));
    expect(dispatches).toBe(20);
    await waitForIo(() => vi.getTimerCount() >= 2);
    // Move the admission clock before waking the next bounded retry. Advancing
    // every fake timer at once would outrun real SQLite's async transaction.
    vi.setSystemTime(baseline + 59000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await batch).toHaveLength(21);
    expect(dispatches).toBe(21);
    expect(await providerCount("openrouter")).toBe(21);
  });

  it("sends Twitch credentials in the body and isolates cached tokens by credentials", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      return Response.json({ access_token: `token-${requests.length}`, expires_in: 3600 });
    }));
    const first = await getIgdbToken(`first-${credential}`, "synthetic-secret-a");
    const second = await getIgdbToken(`second-${credential}`, "synthetic-secret-b");
    expect(first).toBe("token-1");
    expect(second).toBe("token-2");
    expect(await getIgdbToken(`first-${credential}`, "synthetic-secret-a")).toBe("token-1");
    expect(requests).toHaveLength(2);
    expect(requests[0].url).toBe("https://id.twitch.tv/oauth2/token");
    expect(new URLSearchParams(String(requests[0].init?.body)).get("client_secret")).toBe("synthetic-secret-a");
    expect(await providerCount("twitch")).toBe(2);
  });

  it("bounds AI context fields while preserving the output token limit", async () => {
    let payload: { messages: Array<{ content: string }>; max_tokens: number } | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      payload = JSON.parse(init.body);
      return Response.json({ choices: [{ message: { content: "Facts" } }] });
    }));
    await generateGameAiContent("x".repeat(100000), "y".repeat(100000), "z".repeat(100000), 1994,
      Array.from({ length: 1000 }, () => "g".repeat(1000)), "s".repeat(100000), "synthetic-key");
    expect(payload!.messages[0].content.length).toBeLessThan(12000);
    expect(payload!.max_tokens).toBe(1000);
    expect(payload!.messages[0].content).toContain("Release Year: 1994");
  });

  it("propagates a SteamGrid budget denial without hiding it as a missing cover", async () => {
    await fixture.client.$executeRaw`INSERT INTO "ProviderWindow" ("key", "used", "expiresAt") VALUES
      (${`steamgrid:day:${baseline}`}, ${PROVIDER_CAPS.steamgrid.daily}, ${BigInt(baseline + 86400000)})`;
    // The daily window begins at UTC midnight, not the hourly baseline.
    await fixture.client.$executeRaw`UPDATE "ProviderWindow" SET "key" = ${`steamgrid:day:${baseline - 12 * 3600000}`} WHERE "key" = ${`steamgrid:day:${baseline}`}`;
    const network = vi.fn(async () => Response.json({ data: [] }));
    vi.stubGlobal("fetch", network);
    await expect(searchSteamGridDb("Game", "synthetic-key")).rejects.toBeInstanceOf(AdmissionError);
    expect(network).not.toHaveBeenCalled();
  });

  it("propagates a cancelled SteamGrid job instead of returning a missing cover", async () => {
    const job = new EnrichmentJob(await admissionStore.acquire("enrichment"), new AbortController().signal);
    const cancellation = new Error("Synthetic job cancellation");
    vi.stubGlobal("fetch", vi.fn(async () => {
      job.abort(cancellation);
      throw new Error("Synthetic network failure");
    }));
    try { await expect(job.run(() => searchSteamGridDb("Game", "synthetic-key"))).rejects.toBe(cancellation); }
    finally { await job.close(); }
    expect(await providerCount("steamgrid")).toBe(1);
  });

  it("propagates an image budget denial before retrying or changing cached paths", async () => {
    const game = await fixture.client.game.create({ data: {
      title: "Image budget fixture", originalFile: "fixture.rom", platform: "snes", platformLabel: "SNES",
      coverUrl: "https://images.example/synthetic.jpg", localCoverPath: "covers/old.jpg",
    } });
    await fixture.client.$executeRaw`INSERT INTO "ProviderWindow" ("key", "used", "expiresAt") VALUES
      (${`image:hour:${baseline}`}, 30000, ${BigInt(baseline + 3600000)})`;
    const network = vi.fn(async () => new Response("synthetic image"));
    vi.stubGlobal("fetch", network);
    await expect(cacheGameImages(game.id)).rejects.toBeInstanceOf(AdmissionError);
    expect(network).not.toHaveBeenCalled();
    expect((await fixture.client.game.findUnique({ where: { id: game.id } }))?.localCoverPath).toBe("covers/old.jpg");
    expect(await fixture.client.cacheEntry.count()).toBe(0);
    expect(existsSync(path.join(fixture.directory, "data", "covers", String(game.id)))).toBe(false);
  });

  it("charges each image HTTP retry and persists only successful image bytes", async () => {
    const game = await fixture.client.game.create({ data: {
      title: "Image retry fixture", originalFile: "retry.rom", platform: "snes", platformLabel: "SNES",
      coverUrl: "https://images.example/retry.jpg",
    } });
    let attempts = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      attempts++;
      return attempts === 1 ? new Response(null, { status: 503 }) : new Response("synthetic image");
    }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await cacheGameImages(game.id);
    expect(attempts).toBe(2);
    expect(await providerCount("image")).toBe(2);
    const cached = await fixture.client.cacheEntry.findFirst({ where: { gameId: game.id } });
    expect(cached?.fileSize).toBe(15);
    expect(readFileSync(path.join(fixture.directory, "data", cached!.localPath), "utf8")).toBe("synthetic image");
    expect((await fixture.client.game.findUnique({ where: { id: game.id } }))?.localCoverPath).toBe(cached?.localPath);
  });

  it("rejects image bytes after lease loss without publishing cache files or paths", async () => {
    const game = await fixture.client.game.create({ data: {
      title: "Image lease fixture", originalFile: "lease.rom", platform: "snes", platformLabel: "SNES",
      coverUrl: "https://images.example/lease.jpg", localCoverPath: "covers/old.jpg",
    } });
    const lease = await admissionStore.acquire("enrichment");
    const job = new EnrichmentJob(lease, new AbortController().signal);
    vi.stubGlobal("fetch", vi.fn(async () => {
      await lease.release();
      return new Response("synthetic image");
    }));
    try { await expect(job.run(() => cacheGameImages(game.id))).rejects.toMatchObject({ status: 409 }); }
    finally { await job.close(); }
    expect(await providerCount("image")).toBe(1);
    expect(await fixture.client.cacheEntry.count()).toBe(0);
    expect((await fixture.client.game.findUnique({ where: { id: game.id } }))?.localCoverPath).toBe("covers/old.jpg");
    expect(existsSync(path.join(fixture.directory, "data", "covers", String(game.id)))).toBe(false);
  });

  it("keeps the image timeout active after headers and cancels a stalled response body", async () => {
    const game = await fixture.client.game.create({ data: {
      title: "Image body timeout fixture", originalFile: "timeout.rom", platform: "snes", platformLabel: "SNES",
      coverUrl: "https://images.example/body.jpg", localCoverPath: "covers/old.jpg",
    } });
    let cancelled = false;
    let dispatched = false;
    vi.stubGlobal("fetch", vi.fn(async () => {
      dispatched = true;
      return new Response(new ReadableStream({ cancel() { cancelled = true; } }));
    }));
    const result = cacheGameImages(game.id);
    const rejected = expect(result).rejects.toMatchObject({ status: 503 });
    await waitForIo(() => dispatched && vi.getTimerCount() === 1);
    await vi.advanceTimersByTimeAsync(60000);
    await rejected;
    expect(cancelled).toBe(true);
    expect(await providerCount("image")).toBe(1);
    expect(await fixture.client.cacheEntry.count()).toBe(0);
    expect((await fixture.client.game.findUnique({ where: { id: game.id } }))?.localCoverPath).toBe("covers/old.jpg");
    expect(existsSync(path.join(fixture.directory, "data", "covers", String(game.id)))).toBe(false);
  });
});
