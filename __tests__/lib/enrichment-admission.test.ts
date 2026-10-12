import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { PrismaClient } from "@prisma/client";
import { setImmediate } from "node:timers/promises";
import { createTestDatabase } from "../helpers/temp-database";

const fixture = vi.hoisted(() => ({
  db: undefined as PrismaClient | undefined,
  calls: 0,
  pending: [] as (() => void)[],
  game: { findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: new Proxy({}, {
  get(_target, property) {
    if (property === "game") return fixture.game;
    const value = Reflect.get(fixture.db!, property);
    return typeof value === "function" ? value.bind(fixture.db) : value;
  },
}) }));
vi.mock("@/lib/auth", () => ({ requireAuth: () => null }));
vi.mock("@/lib/encryption", () => ({ getDecryptedSettings: async () => ({ openrouterKey: "synthetic-provider", igdbClientId: "synthetic-id", igdbClientSecret: "synthetic-secret" }) }));
vi.mock("@/lib/openrouter", () => ({ generateGameAiContent: () => {
  fixture.calls++;
  return new Promise((resolve) => fixture.pending.push(() => resolve({ funFacts: "Toy facts", story: "Toy story" })));
} }));

import { POST } from "@/app/api/enrich/ai/route";
import { POST as bulk } from "@/app/api/enrich/route";
import { POST as refresh } from "@/app/api/enrich/refresh/route";
import { POST as metacritic } from "@/app/api/enrich/metacritic/route";
import { POST as single } from "@/app/api/games/[id]/enrich/route";

let database: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => { database = await createTestDatabase(); fixture.db = database.client; });
afterAll(async () => { await database.cleanup(); });
afterEach(() => { vi.useRealTimers(); });

async function flushUntil(predicate: () => boolean) {
  const deadline = performance.now() + 2000;
  while (performance.now() < deadline) { if (predicate()) return; await setImmediate(); }
  throw new Error("SQLite work did not settle");
}

function prepare() {
  fixture.calls = 0; fixture.pending = [];
  fixture.game.findMany.mockResolvedValue([{ id: 1, title: "Toy", platformLabel: "SNES", developer: null, releaseDate: null, genres: "[]", summary: null }]);
  fixture.game.update.mockReset().mockResolvedValue({ id: 1 });
  fixture.game.count.mockResolvedValue(0);
}

describe("shared enrichment admission", () => {
  it("admits one AI writer and rejects a second before duplicated provider work", async () => {
    prepare();
    const request = () => new NextRequest("http://localhost:3000/api/enrich/ai", { method: "POST" });
    const first = await POST(request());
    await flushUntil(() => fixture.calls === 1);
    const second = await POST(request());
    const firstBody = first.text();
    const secondBody = second.text();
    try {
      expect(fixture.calls).toBe(1);
      expect(second.status).toBe(409);
    } finally {
      for (const complete of fixture.pending) complete();
      await Promise.all([firstBody, secondBody]);
    }
  });

  it("shares one real lease across bulk, AI, refresh, metacritic and individual writers", async () => {
    prepare();
    const first = await POST(new NextRequest("http://localhost:3000/api/enrich/ai", { method: "POST" }));
    await flushUntil(() => fixture.calls === 1);
    const queriesBefore = fixture.game.findMany.mock.calls.length;
    const request = (name: string) => new NextRequest(`http://localhost:3000/api/${name}`, { method: "POST", body: "{}" });
    try {
      for (const route of [bulk, refresh, metacritic]) {
        const response = await route(request("enrich"));
        expect(response.status).toBe(409);
        expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
      }
      expect((await single(request("games/1/enrich"), { params: Promise.resolve({ id: "1" }) })).status).toBe(409);
      expect(fixture.game.findMany.mock.calls).toHaveLength(queriesBefore);
      expect(fixture.calls).toBe(1);
    } finally {
      fixture.pending.forEach((complete) => complete());
      await first.text();
    }
  });

  it("keeps a cancelled lease until started work drains and skips its business write", async () => {
    prepare();
    const first = await POST(new NextRequest("http://localhost:3000/api/enrich/ai", { method: "POST" }));
    await flushUntil(() => fixture.calls === 1);
    let cancelled = false;
    const cancellation = first.body!.cancel().then(() => { cancelled = true; });
    const second = await POST(new NextRequest("http://localhost:3000/api/enrich/ai", { method: "POST" }));
    expect(second.status).toBe(409);
    expect(cancelled).toBe(false);
    fixture.pending.forEach((complete) => complete());
    await cancellation;
    expect(fixture.game.update).not.toHaveBeenCalled();
    expect(await database.client.$queryRaw`SELECT * FROM "JobLease"`).toEqual([]);
  });

  it("does not persist provider results after real store loss", async () => {
    prepare();
    const first = await POST(new NextRequest("http://localhost:3000/api/enrich/ai", { method: "POST" }));
    await flushUntil(() => fixture.calls === 1);
    // Remove only this test's lease record to reproduce loss to a replacement owner.
    await database.client.$executeRaw`UPDATE "JobLease" SET "owner" = 'replacement-owner' WHERE "resource" = 'enrichment'`;
    fixture.pending.forEach((complete) => complete());
    const output = await first.text();
    expect(output).toContain("Job lease lost");
    expect(fixture.game.update).not.toHaveBeenCalled();
    const owners = await database.client.$queryRaw<{ owner: string }[]>`SELECT "owner" FROM "JobLease"`;
    expect(owners[0].owner).toBe("replacement-owner");
    await database.client.$executeRaw`DELETE FROM "JobLease"`;
  });
});
