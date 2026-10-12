import { setImmediate } from "node:timers/promises";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDatabase } from "../helpers/temp-database";
import { AdmissionStore, EnrichmentJob } from "@/lib/job-admission";

let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => { fixture = await createTestDatabase(); });
afterAll(async () => { await fixture.cleanup(); });
afterEach(() => { vi.useRealTimers(); });

describe("enrichment heartbeat lifecycle", () => {
  it("renews during a bounded provider wait and releases with no timer left", async () => {
    let now = 0;
    const store = new AdmissionStore(fixture.client, () => now);
    const lease = await store.acquire("enrichment", { ttlMs: 30000 });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const job = new EnrichmentJob(lease, new AbortController().signal);
    now = 15000;
    await vi.advanceTimersByTimeAsync(15000);
    for (let i = 0; i < 1000; i++) {
      const rows = await fixture.client.$queryRaw<{ expiresAt: bigint }[]>`SELECT "expiresAt" FROM "JobLease" WHERE "resource" = 'enrichment'`;
      if (Number(rows[0].expiresAt) === 45000) break;
      await setImmediate();
    }
    now = 30000;
    await expect(store.acquire("enrichment")).rejects.toMatchObject({ status: 409 });
    await job.close();
    expect(vi.getTimerCount()).toBe(0);
    await (await store.acquire("enrichment")).release();
  });

  it("aborts its scope on heartbeat failure without pretending a release succeeded", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const release = vi.fn(async () => undefined);
    const job = new EnrichmentJob({ resource: "enrichment", owner: "synthetic-owner", renew: async () => false, release }, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(15000);
    expect(job.signal.aborted).toBe(true);
    await expect(job.assertActive()).rejects.toMatchObject({ reason: "Job lease lost" });
    expect(release).not.toHaveBeenCalled();
    await job.close();
    expect(release).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
