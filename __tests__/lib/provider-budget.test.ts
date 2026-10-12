import { setImmediate } from "node:timers/promises";
import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDatabase } from "../helpers/temp-database";
import { AdmissionStore, PROVIDER_CAPS, EnrichmentJob } from "@/lib/job-admission";
import { providerFetch } from "@/lib/provider-budget";

let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
let second: PrismaClient;
let now = 0;
let store: AdmissionStore;
beforeAll(async () => { fixture = await createTestDatabase(); second = new PrismaClient({ datasourceUrl: fixture.url }); });
beforeEach(async () => {
  await fixture.client.$executeRaw`DELETE FROM "JobLease"`;
  await fixture.client.$executeRaw`DELETE FROM "ProviderWindow"`;
  await fixture.client.$executeRaw`DELETE FROM "AdmissionClock"`;
  now = 0;
  store = new AdmissionStore(fixture.client, () => now);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
afterAll(async () => { await second.$disconnect(); await fixture.cleanup(); });

async function flushUntil(predicate: () => boolean) {
  for (let i = 0; i < 10000; i++) { if (predicate()) return; await setImmediate(); }
  throw new Error("SQLite work did not settle");
}

describe("persistent provider budgets", () => {
  it("reserves exact rate across clients and restart, and rolls back denied reservations", async () => {
    const restarted = new AdmissionStore(second, () => now);
    const claims = await Promise.allSettled(Array.from({ length: 5 }, (_, i) => (i % 2 ? store : restarted).reserveProvider("igdb")));
    expect(claims.filter((r) => r.status === "fulfilled")).toHaveLength(4);
    expect(claims.filter((r) => r.status === "rejected")).toHaveLength(1);
    const counts = await fixture.client.$queryRaw<{ used: number }[]>`SELECT "used" FROM "ProviderWindow"`;
    expect(counts.map((r) => Number(r.used))).toEqual([4, 4, 4]);
    for (const result of claims) if (result.status === "fulfilled") await result.value.release();
    now = -1;
    await expect(restarted.reserveProvider("igdb")).rejects.toMatchObject({ status: 503 });
    now = 1000;
    await (await restarted.reserveProvider("igdb")).release();
    now = 500; // Clock rollback must not reopen the previous rate window.
    for (let i = 0; i < 3; i++) await (await store.reserveProvider("igdb")).release();
    await expect(restarted.reserveProvider("igdb")).rejects.toMatchObject({ status: 429, reason: "Provider short-term rate exhausted" });
  });

  it("concurrency rejection consumes no request and owner release cannot remove another slot", async () => {
    const first = await store.reserveProvider("openrouter");
    const other = await store.reserveProvider("openrouter");
    await expect(store.reserveProvider("openrouter")).rejects.toMatchObject({ reason: "Provider concurrency exhausted" });
    await store.release(first.resource, other.owner);
    await expect(store.reserveProvider("openrouter")).rejects.toMatchObject({ reason: "Provider concurrency exhausted" });
    await first.release();
    const next = await store.reserveProvider("openrouter");
    await other.release(); await next.release();
    const hour = await fixture.client.$queryRaw<{ used: number }[]>`SELECT "used" FROM "ProviderWindow" WHERE "key" = 'openrouter:hour:0'`;
    expect(Number(hour[0].used)).toBe(3);
  });

  it("checks hourly and daily caps before short pressure and keeps them through restart", async () => {
    const caps = { ...PROVIDER_CAPS.igdb, hourly: 2, daily: 3 };
    for (let i = 0; i < 2; i++) await (await store.reserveProvider("igdb", caps)).release();
    await expect(store.reserveProvider("igdb", caps)).rejects.toMatchObject({ reason: "Provider long-term budget exhausted", retryAfter: 3600 });
    now = 3600000;
    await (await new AdmissionStore(second, () => now).reserveProvider("igdb", caps)).release();
    await expect(store.reserveProvider("igdb", caps)).rejects.toMatchObject({ reason: "Provider long-term budget exhausted" });
    now = 86400000;
    await (await store.reserveProvider("igdb", caps)).release();
  });

  it("bounds login failures without locking out store checks for correct credentials", async () => {
    for (let i = 0; i < 60; i++) await store.loginFailure();
    await expect(new AdmissionStore(second, () => now).loginFailure()).rejects.toMatchObject({ status: 429, retryAfter: 60 });
    await expect(store.assertAvailable()).resolves.toBeUndefined();
    now = 60000;
    await store.loginFailure();
  });

  it("limits the shared waiting queue to eight and safely reclaims only expired owners", async () => {
    const waiting = await Promise.all(Array.from({ length: 8 }, () => store.acquireWaiter("igdb")));
    await expect(new AdmissionStore(second, () => now).acquireWaiter("igdb")).rejects.toMatchObject({ reason: "Provider waiting queue full" });
    now = 65000;
    const replacement = await store.acquireWaiter("igdb");
    await waiting[0].release();
    const rows = await fixture.client.$queryRaw<{ owner: string }[]>`SELECT "owner" FROM "JobLease" WHERE "resource" = ${replacement.resource}`;
    expect(rows[0].owner).toBe(replacement.owner);
    for (const lease of waiting.slice(1)) await lease.release();
    await replacement.release();
  });

  it("rejects unbounded, zero and accelerated configuration", async () => {
    await expect(store.reserveProvider("igdb", { ...PROVIDER_CAPS.igdb, daily: Infinity })).rejects.toThrow("cap");
    await expect(store.reserveProvider("igdb", { ...PROVIDER_CAPS.igdb, rate: 0 })).rejects.toThrow("cap");
    await expect(store.reserveProvider("igdb", { ...PROVIDER_CAPS.igdb, periodMs: 1 })).rejects.toThrow("period");
  });

  it("does not double its rate at a wall-clock second boundary", async () => {
    now = 999;
    for (let i = 0; i < 4; i++) await (await store.reserveProvider("igdb")).release();
    now = 1000;
    await expect(store.reserveProvider("igdb")).rejects.toMatchObject({ reason: "Provider short-term rate exhausted" });
    now = 1999;
    await (await store.reserveProvider("igdb")).release();
  });
});

describe("bounded actual HTTP dispatch", () => {
  it("makes zero external calls for hard exhaustion or store failure", async () => {
    const fetch = vi.fn(async () => Response.json({ ok: true })); vi.stubGlobal("fetch", fetch);
    const caps = { ...PROVIDER_CAPS.igdb, hourly: 1 };
    await providerFetch("igdb", "https://synthetic.invalid", {}, { store, caps });
    await expect(providerFetch("igdb", "https://synthetic.invalid", {}, { store, caps })).rejects.toMatchObject({ reason: "Provider long-term budget exhausted" });
    const bad = new PrismaClient({ datasourceUrl: "file:/does-not-exist/ludotek.db" });
    try { await expect(providerFetch("igdb", "https://synthetic.invalid", {}, { store: new AdmissionStore(bad) })).rejects.toMatchObject({ status: 503 }); }
    finally { await bad.$disconnect(); }
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("waits outside transactions for a short rate window and aborts without dispatch", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const fetch = vi.fn(async () => Response.json({ ok: true })); vi.stubGlobal("fetch", fetch);
    const caps = { ...PROVIDER_CAPS.igdb, rate: 1 };
    await providerFetch("igdb", "https://synthetic.invalid", {}, { store, caps });
    let done = false;
    const waiting = providerFetch("igdb", "https://synthetic.invalid", {}, { store, caps }).finally(() => { done = true; });
    await flushUntil(() => vi.getTimerCount() >= 2);
    expect(fetch).toHaveBeenCalledTimes(1);
    now = 1000;
    await vi.advanceTimersByTimeAsync(1000);
    await flushUntil(() => done);
    await waiting;
    expect(fetch).toHaveBeenCalledTimes(2);
    const abort = new AbortController();
    const rejected = providerFetch("igdb", "https://synthetic.invalid", {}, { store, caps, signal: abort.signal });
    const assertion = expect(rejected).rejects.toThrow("Stop fixture");
    await flushUntil(() => vi.getTimerCount() >= 2);
    abort.abort(new Error("Stop fixture"));
    await assertion;
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(await fixture.client.$queryRaw`SELECT * FROM "JobLease"`).toEqual([]);
  });

  it("ends a short-pressure wait at 65 seconds with no extra dispatch", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const fetch = vi.fn(async () => Response.json({ ok: true })); vi.stubGlobal("fetch", fetch);
    const caps = { ...PROVIDER_CAPS.twitch, rate: 1 };
    await providerFetch("twitch", "https://synthetic.invalid", {}, { store, caps });
    const pending = providerFetch("twitch", "https://synthetic.invalid", {}, { store, caps });
    const assertion = expect(pending).rejects.toMatchObject({ reason: "Provider wait deadline exceeded" });
    await flushUntil(() => vi.getTimerCount() >= 2);
    // Keep the authoritative clock fixed to maintain pressure; only elapsed wait time advances.
    await vi.advanceTimersByTimeAsync(65000);
    await assertion;
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await fixture.client.$queryRaw`SELECT * FROM "JobLease"`).toEqual([]);
  });

  it("holds concurrency until a slow body finishes and bounds body bytes", async () => {
    let finish!: () => void;
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array([1])); finish = () => controller.close(); } });
    const fetch = vi.fn(async () => new Response(body)); vi.stubGlobal("fetch", fetch);
    const caps = { ...PROVIDER_CAPS.igdb, concurrency: 1 };
    const first = providerFetch("igdb", "https://synthetic.invalid", {}, { store, caps });
    await flushUntil(() => fetch.mock.calls.length === 1);
    await expect(providerFetch("igdb", "https://synthetic.invalid", {}, { store, caps, wait: false })).rejects.toMatchObject({ reason: "Provider concurrency exhausted" });
    finish(); await first;
    fetch.mockImplementation(async () => new Response(new Uint8Array(5)));
    await expect(providerFetch("igdb", "https://synthetic.invalid", {}, { store, caps, maxBytes: 4 })).rejects.toMatchObject({ reason: "Provider response exceeds byte limit" });
    expect(await fixture.client.$queryRaw`SELECT * FROM "JobLease"`).toEqual([]);
  });

  it("times out during body read, cancels it and releases its slot", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const cancel = vi.fn();
    const fetch = vi.fn(async () => new Response(new ReadableStream<Uint8Array>({ cancel }))); vi.stubGlobal("fetch", fetch);
    const pending = providerFetch("igdb", "https://synthetic.invalid", {}, { store, timeoutMs: 1000 });
    const assertion = expect(pending).rejects.toMatchObject({ reason: "Provider request timed out" });
    await flushUntil(() => fetch.mock.calls.length === 1);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(await fixture.client.$queryRaw`SELECT * FROM "JobLease"`).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not silently follow redirects outside the budget", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(null, { status: 302, headers: { Location: "https://other.invalid" } })); vi.stubGlobal("fetch", fetch);
    const response = await providerFetch("image", "https://synthetic.invalid", {}, { store });
    expect(response.status).toBe(302);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });

  it("stops subsequent dispatch after losing the shared job lease", async () => {
    const fetch = vi.fn(async () => Response.json({})); vi.stubGlobal("fetch", fetch);
    const lease = await store.acquire("enrichment", { ttlMs: 1000 });
    const job = new EnrichmentJob(lease, new AbortController().signal);
    try {
      now = 1000;
      const replacement = await store.acquire("enrichment");
      await expect(job.run(() => providerFetch("igdb", "https://synthetic.invalid", {}, { store }))).rejects.toMatchObject({ reason: "Job lease lost" });
      expect(fetch).not.toHaveBeenCalled();
      await replacement.release();
    } finally { await job.close(); }
  });
});
