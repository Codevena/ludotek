import { acquireScopedJob, type EnrichmentJob } from "@/lib/job-admission";
import { AdmissionError } from "@/lib/job-admission";
import type { Prisma } from "@prisma/client";

export interface DeviceJobs {
  readonly signal: AbortSignal;
  readonly resourceOwners?: ReadonlyMap<string, string>;
  assertActive(): Promise<void>;
  /** Fence database effects inside their first-write-serialized transaction.
   * Cancellation annotations may commit while ownership remains authoritative;
   * this does not permit new filesystem I/O after the signal is aborted.
   */
  assertOwned?(tx: Prisma.TransactionClient): Promise<void>;
  close(): Promise<void>;
}

/** Every device writer/reader whose snapshot matters uses the same lock keys.
 * Sorted acquisition prevents opposing transfers from holding an inverted pair.
 * Call close only after underlying I/O has drained, including cancellation.
 */
export async function acquireDeviceFiles(deviceIds: number[], request: Request, acquire = acquireScopedJob): Promise<DeviceJobs> {
  // Empty IDs are reserved for server-side global catalog/cache mutations;
  // they still hold device-files and cannot race an authoritative file job.
  if (deviceIds.length > 100 || deviceIds.some((id) => !Number.isSafeInteger(id) || id < 1 || id > 9999999999)) {
    throw new Error("Invalid device job IDs");
  }
  const jobs: EnrichmentJob[] = [];
  const controller = new AbortController();
  const abort = (event: Event) => controller.abort((event.target as AbortSignal).reason);
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    const failures: unknown[] = [];
    for (const job of [...jobs].reverse()) {
      job.signal.removeEventListener("abort", abort);
      try { await job.close(); } catch (error) { failures.push(error); }
    }
    if (failures.length) throw failures[0];
  };
  try {
    const resources = ["device-files", ...[...new Set(deviceIds)].sort((a, b) => a - b).map((id) => `files:${id}`)];
    for (const resource of resources) {
      const job = await acquire(resource, request);
      jobs.push(job);
      job.signal.addEventListener("abort", abort, { once: true });
      if (job.signal.aborted) controller.abort(job.signal.reason);
      if (controller.signal.aborted) throw controller.signal.reason;
    }
  } catch (error) {
    await close();
    throw error;
  }
  return {
    signal: controller.signal,
    resourceOwners: new Map(jobs.map((job) => [job.resource, job.owner])),
    async assertActive() {
      if (controller.signal.aborted) throw controller.signal.reason;
      for (const job of jobs) await job.assertActive();
      if (controller.signal.aborted) throw controller.signal.reason;
    },
    async assertOwned(tx) {
      const candidate = Date.now();
      if (!Number.isSafeInteger(candidate) || candidate < 0) throw new AdmissionError(503, "Invalid admission clock");
      await tx.$executeRaw`INSERT INTO "AdmissionClock" ("id", "value") VALUES (1, ${BigInt(candidate)})
        ON CONFLICT("id") DO UPDATE SET "value" = MAX("value", excluded."value")`;
      const clock = await tx.admissionClock.findUnique({ where: { id: 1 } });
      if (!clock) throw new AdmissionError(503, "Admission store unavailable");
      for (const job of jobs) {
        const lease = await tx.jobLease.findUnique({ where: { resource: job.resource } });
        if (!lease || lease.owner !== job.owner || lease.expiresAt <= clock.value) throw new AdmissionError(409, "Device job lease lost before database commit");
      }
    },
    close,
  };
}

export async function assertDeviceJobsOwned(jobs: DeviceJobs, tx: Prisma.TransactionClient) {
  if (!jobs.assertOwned) throw new AdmissionError(503, "Device job ownership fence is unavailable");
  await jobs.assertOwned(tx);
}

export async function withDeviceFiles<T>(deviceIds: number[], request: Request, work: (jobs: DeviceJobs) => Promise<T>): Promise<T> {
  const jobs = await acquireDeviceFiles(deviceIds, request);
  try { await jobs.assertActive(); return await work(jobs); }
  finally { await jobs.close(); }
}
