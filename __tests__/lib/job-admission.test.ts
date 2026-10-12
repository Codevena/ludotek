import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTestDatabase } from "../helpers/temp-database";
import { AdmissionStore, AdmissionError } from "@/lib/job-admission";

let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
let second: PrismaClient;
beforeAll(async () => { fixture = await createTestDatabase(); second = new PrismaClient({ datasourceUrl: fixture.url }); });
afterAll(async () => { await second.$disconnect(); await fixture.cleanup(); });

describe("atomic SQLite admission", () => {
  it("coordinates the bounded LAN discovery job through the same durable store", async () => {
    const a = new AdmissionStore(fixture.client, () => 5000);
    const b = new AdmissionStore(second, () => 5000);
    const lease = await a.acquire("lan-discovery");
    await expect(b.acquire("lan-discovery")).rejects.toMatchObject({ status: 409 });
    await lease.release();
    await (await b.acquire("lan-discovery")).release();
  });
  it("has one winner across actual clients and preserves owner checks", async () => {
    const a = new AdmissionStore(fixture.client, () => 10000);
    const b = new AdmissionStore(second, () => 10000);
    const claims = await Promise.allSettled([a.acquire("enrichment"), b.acquire("enrichment")]);
    const winners = claims.filter((r) => r.status === "fulfilled");
    expect(winners).toHaveLength(1);
    const loser = claims.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(loser.reason).toMatchObject({ status: 409 });
    const winner = (winners[0] as PromiseFulfilledResult<Awaited<ReturnType<AdmissionStore["acquire"]>>>).value;
    expect(await b.renew("enrichment", "wrong-owner", 90000)).toBe(false);
    await b.release("enrichment", "wrong-owner");
    await expect(b.acquire("enrichment")).rejects.toMatchObject({ status: 409 });
    expect(await winner.renew()).toBe(true);
    await winner.release();
    await (await b.acquire("enrichment")).release();
  });

  it("survives restart, expiry and a backwards clock without freeing live work", async () => {
    let now = 20000;
    const a = new AdmissionStore(fixture.client, () => now);
    const old = await a.acquire("missing:snes", { ttlMs: 1000 });
    now = 19000;
    const restart = new AdmissionStore(second, () => now);
    await expect(restart.acquire("missing:snes")).rejects.toMatchObject({ status: 409 });
    now = 21000;
    const current = await restart.acquire("missing:snes");
    expect(await old.renew()).toBe(false);
    await old.release();
    await expect(a.acquire("missing:snes")).rejects.toMatchObject({ status: 409 });
    await current.release();
  });

  it("does not fall back to memory when its real store is unavailable", async () => {
    const broken = new PrismaClient({ datasourceUrl: "file:/does-not-exist/ludotek.db" });
    try { await expect(new AdmissionStore(broken).acquire("enrichment")).rejects.toBeInstanceOf(AdmissionError); }
    finally { await broken.$disconnect(); }
  });

  it("validates resource and lifetime before store mutation", async () => {
    const store = new AdmissionStore(fixture.client);
    await expect(store.acquire("arbitrary/client/value")).rejects.toThrow("resource");
    await expect(store.acquire("enrichment", { ttlMs: 0 })).rejects.toThrow("lifetime");
  });
});
