import { PrismaClient } from "@prisma/client";
import { expect, it, vi } from "vitest";
import { createTestDatabase } from "../helpers/temp-database";

it("keeps production reloads and an independent client within the same durable provider budget", async () => {
  const fixture = await createTestDatabase();
  const globals = globalThis as unknown as { prisma?: PrismaClient };
  const original = globals.prisma;
  let application: PrismaClient | undefined;
  const second = new PrismaClient({ datasourceUrl: fixture.url });
  try {
    delete globals.prisma;
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", `${fixture.url}&connection_limit=99&connection_limit=8`);
    vi.resetModules();
    application = (await import("@/lib/prisma")).prisma;
    vi.resetModules();
    expect((await import("@/lib/prisma")).prisma).toBe(application);
    const { AdmissionStore } = await import("@/lib/job-admission");
    const stores = [new AdmissionStore(application, () => 0), new AdmissionStore(second, () => 0)];
    const claims = await Promise.allSettled(Array.from({ length: 5 }, (_, i) => stores[i % 2].reserveProvider("igdb")));
    expect(claims.filter((claim) => claim.status === "fulfilled")).toHaveLength(4);
    expect(claims.filter((claim) => claim.status === "rejected")).toMatchObject([
      { reason: { status: 429, reason: "Provider short-term rate exhausted" } },
    ]);
    const windows = await fixture.client.$queryRaw<{ used: number }[]>`SELECT "used" FROM "ProviderWindow"`;
    expect(windows.map((window) => Number(window.used))).toEqual([4, 4, 4]);
    for (const claim of claims) if (claim.status === "fulfilled") await claim.value.release();
  } finally {
    await application?.$disconnect();
    await second.$disconnect();
    globals.prisma = original;
    vi.unstubAllEnvs();
    vi.resetModules();
    await fixture.cleanup();
  }
});
