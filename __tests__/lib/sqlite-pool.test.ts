import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@prisma/client", () => ({
  PrismaClient: class { constructor(readonly options?: { datasourceUrl?: string }) {} },
}));

const globals = globalThis as unknown as { prisma?: unknown };
const original = globals.prisma;
beforeEach(() => { delete globals.prisma; vi.resetModules(); vi.stubEnv("NODE_ENV", "production"); });
afterEach(() => { globals.prisma = original; vi.unstubAllEnvs(); vi.resetModules(); });

describe("SQLite client scheduling", () => {
  it.each([
    ["file:./library.db", "file:./library.db?connection_limit=1"],
    ["file:/tmp/a%20b/library.db?socket_timeout=9&connection_limit=99&db_name=own", "file:/tmp/a%20b/library.db?socket_timeout=9&db_name=own&connection_limit=1"],
    ["file:../space name.db?connection_limit=9&socket_timeout=4&connection_limit=7", "file:../space name.db?socket_timeout=4&connection_limit=1"],
    ["sqlite:/tmp/library.db?socket_timeout=0", "sqlite:/tmp/library.db?socket_timeout=0&connection_limit=1"],
  ])("keeps the database and other parameters while bounding %s", async (url, expected) => {
    vi.stubEnv("DATABASE_URL", url);
    const { prisma } = await import("@/lib/prisma");
    expect(prisma).toMatchObject({ options: { datasourceUrl: expected } });
  });

  it.each([undefined, "postgresql://fixture.invalid/library?connection_limit=9"])("does not override the default constructor for %s", async (url) => {
    vi.stubEnv("DATABASE_URL", url);
    const { prisma } = await import("@/lib/prisma");
    expect(prisma).toHaveProperty("options", undefined);
  });

  it("reuses the same process client after production modules reload", async () => {
    vi.stubEnv("DATABASE_URL", "file:./fixture.db");
    const first = (await import("@/lib/prisma")).prisma;
    vi.resetModules();
    const second = (await import("@/lib/prisma")).prisma;
    expect(second).toBe(first);
  });
});
