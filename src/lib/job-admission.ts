import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class AdmissionError extends Error {
  constructor(public readonly status: 409 | 429 | 503, public readonly reason: string, public readonly retryAfter = 1) {
    super(reason);
    this.name = "AdmissionError";
  }
}

export interface Lease {
  resource: string;
  owner: string;
  renew(): Promise<boolean>;
  release(): Promise<void>;
}
export type Provider = "igdb" | "twitch" | "steamgrid" | "openrouter" | "image";
export interface ProviderCaps { rate: number; periodMs: number; hourly: number; daily: number; concurrency: number }
export const PROVIDER_CAPS: Record<Provider, ProviderCaps> = {
  igdb: { rate: 4, periodMs: 1000, hourly: 5000, daily: 30000, concurrency: 4 },
  twitch: { rate: 10, periodMs: 60000, hourly: 100, daily: 500, concurrency: 4 },
  steamgrid: { rate: 4, periodMs: 1000, hourly: 2000, daily: 10000, concurrency: 4 },
  openrouter: { rate: 20, periodMs: 60000, hourly: 500, daily: 2000, concurrency: 2 },
  image: { rate: 20, periodMs: 1000, hourly: 30000, daily: 100000, concurrency: 4 },
};

type Tx = Prisma.TransactionClient;
type Bucket = { key: string; limit: number; periodMs: number; kind: "short" | "long" };
const TTL_MS = 90000;

function validateLifetime(ttlMs: number) {
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1000 || ttlMs > 300000) throw new Error("Invalid lease lifetime");
}
function validateResource(resource: string) {
  if (!/^(enrichment|discover|lan-discovery|device-files|missing:[a-z0-9-]{1,40}|(?:scan|files|integrity|saves):[1-9]\d{0,9})$/.test(resource)) {
    throw new Error("Invalid job resource");
  }
}

/** All coordination lives in one SQLite file; no process-local lock fallback. */
export class AdmissionStore {
  constructor(readonly db: PrismaClient, readonly clock: () => number = Date.now) {}

  private async transaction<T>(work: (tx: Tx, now: number) => Promise<T>): Promise<T> {
    try {
      const candidate = this.clock();
      if (!Number.isSafeInteger(candidate) || candidate < 0) throw new Error("Invalid admission clock");
      return await this.db.$transaction(async (tx) => {
        // This first write obtains SQLite's writer lock before reading counters.
        await tx.$executeRaw`INSERT INTO "AdmissionClock" ("id", "value") VALUES (1, ${BigInt(candidate)})
          ON CONFLICT("id") DO UPDATE SET "value" = MAX("value", excluded."value")`;
        const rows = await tx.$queryRaw<{ value: bigint }[]>`SELECT "value" FROM "AdmissionClock" WHERE "id" = 1`;
        return work(tx, Number(rows[0].value));
      }, { maxWait: 5000, timeout: 10000 });
    } catch (error) {
      if (error instanceof AdmissionError) throw error;
      throw new AdmissionError(503, "Admission store unavailable");
    }
  }

  private handle(resource: string, owner: string, ttlMs: number): Lease {
    return { resource, owner, renew: () => this.renew(resource, owner, ttlMs), release: () => this.release(resource, owner) };
  }

  private async claim(tx: Tx, now: number, resource: string, owner: string, ttlMs: number): Promise<boolean> {
    const changes = await tx.$executeRaw`INSERT INTO "JobLease" ("resource", "owner", "expiresAt")
      VALUES (${resource}, ${owner}, ${BigInt(now + ttlMs)})
      ON CONFLICT("resource") DO UPDATE SET "owner" = excluded."owner", "expiresAt" = excluded."expiresAt"
      WHERE "JobLease"."expiresAt" <= ${BigInt(now)}`;
    return changes === 1;
  }

  async acquire(resource: string, options: { ttlMs?: number } = {}): Promise<Lease> {
    validateResource(resource);
    const ttlMs = options.ttlMs ?? TTL_MS;
    validateLifetime(ttlMs);
    const owner = randomUUID();
    const result = await this.transaction(async (tx, now) => {
      if (await this.claim(tx, now, resource, owner, ttlMs)) return null;
      const rows = await tx.$queryRaw<{ expiresAt: bigint }[]>`SELECT "expiresAt" FROM "JobLease" WHERE "resource" = ${resource}`;
      return Math.max(1, Math.ceil((Number(rows[0].expiresAt) - now) / 1000));
    });
    if (result !== null) throw new AdmissionError(409, "Job already running", result);
    return this.handle(resource, owner, ttlMs);
  }

  async renew(resource: string, owner: string, ttlMs: number): Promise<boolean> {
    validateLifetime(ttlMs);
    return this.transaction(async (tx, now) => (await tx.$executeRaw`UPDATE "JobLease" SET "expiresAt" = ${BigInt(now + ttlMs)}
      WHERE "resource" = ${resource} AND "owner" = ${owner} AND "expiresAt" > ${BigInt(now)}`) === 1);
  }

  async release(resource: string, owner: string): Promise<void> {
    await this.transaction(async (tx) => { await tx.$executeRaw`DELETE FROM "JobLease" WHERE "resource" = ${resource} AND "owner" = ${owner}`; });
  }

  async assertAvailable(): Promise<void> { await this.transaction(async () => undefined); }

  private async checkBuckets(tx: Tx, now: number, buckets: Bucket[]): Promise<{ status: 429; reason: string; retryAfter: number } | null> {
    // Check all limits before changing any. Returning a denial still persists the monotone clock.
    for (const bucket of [...buckets].sort((a, b) => a.kind === b.kind ? 0 : a.kind === "long" ? -1 : 1)) {
      const start = Math.floor(now / bucket.periodMs) * bucket.periodMs;
      const key = `${bucket.key}:${start}`;
      const rows = bucket.kind === "short"
        ? await tx.$queryRaw<{ used: number; nextExpiry: bigint }[]>`SELECT COALESCE(SUM("used"), 0) AS "used", MIN("expiresAt") AS "nextExpiry"
            FROM "ProviderWindow" WHERE "key" LIKE ${`${bucket.key}:%`} AND "expiresAt" > ${BigInt(now)}`
        : await tx.$queryRaw<{ used: number; nextExpiry?: bigint }[]>`SELECT "used" FROM "ProviderWindow" WHERE "key" = ${key}`;
      if (Number(rows[0]?.used ?? 0) >= bucket.limit) return {
        status: 429, reason: bucket.kind === "long" ? "Provider long-term budget exhausted" : "Provider short-term rate exhausted",
        retryAfter: Math.max(1, Math.ceil(((bucket.kind === "short" ? Number(rows[0].nextExpiry) : start + bucket.periodMs) - now) / 1000)),
      };
    }
    return null;
  }

  private async useBuckets(tx: Tx, now: number, buckets: Bucket[]): Promise<void> {
    for (const bucket of buckets) {
      // Short rates are rolling windows, so a second boundary cannot double a burst.
      const start = bucket.kind === "short" ? now : Math.floor(now / bucket.periodMs) * bucket.periodMs;
      const key = `${bucket.key}:${start}`;
      await tx.$executeRaw`INSERT INTO "ProviderWindow" ("key", "used", "expiresAt")
        VALUES (${key}, 1, ${BigInt(start + bucket.periodMs)}) ON CONFLICT("key") DO UPDATE SET "used" = "used" + 1`;
    }
    await tx.$executeRaw`DELETE FROM "ProviderWindow" WHERE "expiresAt" < ${BigInt(now - 86400000)}`;
  }

  async loginFailure(): Promise<void> {
    const buckets: Bucket[] = [
      { key: "login:minute", limit: 60, periodMs: 60000, kind: "short" },
      { key: "login:hour", limit: 1000, periodMs: 3600000, kind: "long" },
    ];
    const denied = await this.transaction(async (tx, now) => {
      const error = await this.checkBuckets(tx, now, buckets);
      if (!error) await this.useBuckets(tx, now, buckets);
      return error;
    });
    if (denied) throw new AdmissionError(429, "Login attempt budget exhausted", denied.retryAfter);
  }

  async reserveProvider(provider: Provider, caps: ProviderCaps = PROVIDER_CAPS[provider]): Promise<Lease> {
    if (!(provider in PROVIDER_CAPS)) throw new Error("Invalid provider");
    for (const key of ["rate", "periodMs", "hourly", "daily", "concurrency"] as const) {
      if (!Number.isSafeInteger(caps[key]) || caps[key] < 1 || caps[key] > PROVIDER_CAPS[provider][key]) throw new Error("Invalid provider cap");
    }
    if (caps.periodMs !== PROVIDER_CAPS[provider].periodMs) throw new Error("Invalid provider period");
    const buckets: Bucket[] = [
      { key: `${provider}:rate`, limit: caps.rate, periodMs: caps.periodMs, kind: "short" },
      { key: `${provider}:hour`, limit: caps.hourly, periodMs: 3600000, kind: "long" },
      { key: `${provider}:day`, limit: caps.daily, periodMs: 86400000, kind: "long" },
    ];
    const owner = randomUUID();
    const result = await this.transaction(async (tx, now) => {
      const denied = await this.checkBuckets(tx, now, buckets);
      if (denied) return { denied };
      for (let i = 0; i < caps.concurrency; i++) {
        const resource = `provider:${provider}:slot:${i}`;
        if (await this.claim(tx, now, resource, owner, TTL_MS)) {
          await this.useBuckets(tx, now, buckets);
          return { resource };
        }
      }
      return { denied: { status: 429 as const, reason: "Provider concurrency exhausted", retryAfter: 1 } };
    });
    if (result.denied) throw new AdmissionError(result.denied.status, result.denied.reason, result.denied.retryAfter);
    return this.handle(result.resource!, owner, TTL_MS);
  }

  async acquireWaiter(provider: Provider): Promise<Lease> {
    if (!(provider in PROVIDER_CAPS)) throw new Error("Invalid provider");
    const owner = randomUUID();
    const resource = await this.transaction(async (tx, now) => {
      for (let i = 0; i < 8; i++) {
        const candidate = `provider:${provider}:wait:${i}`;
        if (await this.claim(tx, now, candidate, owner, 65000)) return candidate;
      }
      return null;
    });
    if (!resource) throw new AdmissionError(429, "Provider waiting queue full");
    return this.handle(resource, owner, 65000);
  }
}

export const admissionStore = new AdmissionStore(prisma);
export const acquireJob = (resource: string, options?: { ttlMs?: number }) => admissionStore.acquire(resource, options);
export const reserveLoginFailure = () => admissionStore.loginFailure();
export const assertAdmissionStore = () => admissionStore.assertAvailable();

type JobContext = { signal: AbortSignal; assertActive(): Promise<void> };
const context = new AsyncLocalStorage<JobContext>();
export const getJobContext = () => context.getStore();

export class EnrichmentJob {
  get resource(): string { return this.lease.resource; }
  get owner(): string { return this.lease.owner; }
  private readonly controller = new AbortController();
  private timer?: ReturnType<typeof setTimeout>;
  private closing = false;
  private heartbeat?: Promise<void>;
  readonly signal = this.controller.signal;
  private readonly requestAbort = () => this.abort();
  constructor(private readonly lease: Lease, private readonly requestSignal: AbortSignal) {
    requestSignal.addEventListener("abort", this.requestAbort, { once: true });
    if (requestSignal.aborted) this.abort();
    this.schedule();
  }
  abort(reason: unknown = new AdmissionError(409, "Job cancelled")) { this.controller.abort(reason); }
  private schedule() {
    this.timer = setTimeout(() => {
      this.heartbeat = this.assertActive().catch((error) => { this.abort(error); }).finally(() => {
        if (!this.closing && !this.signal.aborted) this.schedule();
      });
    }, 15000);
    this.timer.unref?.();
  }
  async assertActive(): Promise<void> {
    if (this.signal.aborted) throw this.signal.reason;
    try {
      if (!await this.lease.renew()) throw new AdmissionError(409, "Job lease lost");
      if (this.signal.aborted) throw this.signal.reason;
    } catch (error) { this.abort(error); throw error; }
  }
  run<T>(work: () => Promise<T>): Promise<T> { return context.run(this, work); }
  async close(): Promise<void> {
    if (this.closing) return;
    this.closing = true;
    if (this.timer) clearTimeout(this.timer);
    this.requestSignal.removeEventListener("abort", this.requestAbort);
    await this.heartbeat;
    await this.lease.release();
  }
}

export async function acquireEnrichment(request: Request): Promise<EnrichmentJob> {
  return acquireScopedJob("enrichment", request);
}

export async function acquireScopedJob(resource: string, request: Request): Promise<EnrichmentJob> {
  return new EnrichmentJob(await acquireJob(resource), request.signal);
}

export function admissionResponse(error: unknown): Response {
  const failure = error instanceof AdmissionError ? error : new AdmissionError(503, "Admission store unavailable");
  return Response.json({ error: failure.reason }, { status: failure.status, headers: { "Retry-After": String(failure.retryAfter), "Cache-Control": "no-store" } });
}

/** Owns the lease until the stream's underlying work has actually drained. */
export function createEnrichmentStream(job: EnrichmentJob, work: (send: (data: Record<string, unknown>) => void) => Promise<void>): Response {
  let completion: Promise<void>;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (data: Record<string, unknown>) => {
        if (cancelled) return;
        try { controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)); } catch { job.abort(); }
      };
      completion = job.run(async () => {
        try { await work(send); }
        catch (error) { send({ type: "error", stopped: true, error: error instanceof Error ? error.message : "Job failed" }); }
        finally {
          try { await job.close(); }
          catch { send({ type: "error", stopped: true, error: "Admission store unavailable" }); }
          if (!cancelled) controller.close();
        }
      });
    },
    async cancel() { cancelled = true; job.abort(); await completion; },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" } });
}
