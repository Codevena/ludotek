import { afterAll, beforeAll, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTestDatabase } from "../helpers/temp-database";
import { AdmissionStore, EnrichmentJob } from "@/lib/job-admission";
import { acquireDeviceFiles, assertDeviceJobsOwned } from "@/lib/device-jobs";
let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
let second: PrismaClient;
beforeAll(async () => { fixture = await createTestDatabase(); second = new PrismaClient({ datasourceUrl: fixture.url }); });
afterAll(async () => { await second.$disconnect(); await fixture.cleanup(); });
const acquire = async (resource: string, request: Request) => new EnrichmentJob(await new AdmissionStore(fixture.client).acquire(resource), request.signal);

it("fences a paused old owner inside the same transaction after another client takes its expired lease", async () => {
  const jobs = await acquireDeviceFiles([12], new Request("http://fixture"), acquire);
  await fixture.client.$transaction((tx) => assertDeviceJobsOwned(jobs, tx));
  await second.jobLease.update({ where: { resource: "files:12" }, data: { expiresAt: BigInt(0) } });
  const successor = await new AdmissionStore(second).acquire("files:12");
  try {
    await expect(fixture.client.$transaction(async (tx) => {
      await assertDeviceJobsOwned(jobs, tx);
      await tx.device.create({ data: { name: "must not be committed", host: "", user: "", password: "" } });
    })).rejects.toMatchObject({ status: 409 });
    expect(await fixture.client.device.count()).toBe(0);
    await jobs.close();
    expect(await second.jobLease.findUnique({ where: { resource: "files:12" } })).toMatchObject({ owner: successor.owner });
  } finally { await jobs.close(); await successor.release(); }
});

it("permits a cancelled-owner recovery annotation while rejecting new active I/O", async () => {
  const controller = new AbortController();
  const jobs = await acquireDeviceFiles([13], new Request("http://fixture", { signal: controller.signal }), acquire);
  try {
    controller.abort();
    await expect(jobs.assertActive()).rejects.toBeDefined();
    await fixture.client.$transaction((tx) => assertDeviceJobsOwned(jobs, tx));
  } finally { await jobs.close(); }
});

it("serializes authoritative file jobs even when different LOCAL IDs share the same path", async () => {
  const a = await fixture.client.device.create({ data: { name: "Alias A", protocol: "local", host: "", user: "", password: "", scanPaths: JSON.stringify([{ path: fixture.directory, type: "rom" }]) } });
  const b = await fixture.client.device.create({ data: { name: "Alias B", protocol: "local", host: "", user: "", password: "", scanPaths: a.scanPaths } });
  const first = await acquireDeviceFiles([a.id], new Request("http://fixture"), acquire);
  const acquireSecond = async (resource: string, request: Request) => new EnrichmentJob(await new AdmissionStore(second).acquire(resource), request.signal);
  let conflicting: Awaited<ReturnType<typeof acquireDeviceFiles>> | undefined;
  try {
    const outcome = await acquireDeviceFiles([b.id], new Request("http://fixture"), acquireSecond).then((jobs) => { conflicting = jobs; return { accepted: true }; }, (error) => ({ accepted: false, status: error.status }));
    expect(outcome).toEqual({ accepted: false, status: 409 });
  } finally { await conflicting?.close(); await first.close(); }
  const next = await acquireDeviceFiles([b.id], new Request("http://fixture"), acquireSecond);
  await next.close();
});
