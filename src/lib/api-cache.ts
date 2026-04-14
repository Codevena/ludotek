import { prisma } from "@/lib/prisma";

const DEFAULT_TTL_HOURS = 24;
const CLEANUP_STALE_DAYS = 7;
const CLEANUP_LIMIT = 100;

/**
 * Check cache for a valid entry; on miss, call fetchFn, store result, and
 * lazily clean up stale rows.
 */
export async function getCachedOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlHours: number = DEFAULT_TTL_HOURS,
): Promise<T> {
  const now = new Date();

  // Check for a non-expired cached entry
  const cached = await prisma.apiCache.findFirst({
    where: { cacheKey: key, expiresAt: { gt: now } },
  });

  if (cached) {
    return JSON.parse(cached.response) as T;
  }

  // Cache miss — fetch fresh data
  const result = await fetchFn();

  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

  await prisma.apiCache.upsert({
    where: { cacheKey: key },
    update: { response: JSON.stringify(result), expiresAt },
    create: { cacheKey: key, response: JSON.stringify(result), expiresAt },
  });

  // Lazy cleanup: remove entries expired more than 7 days ago (fire-and-forget)
  const staleThreshold = new Date(
    now.getTime() - CLEANUP_STALE_DAYS * 24 * 60 * 60 * 1000,
  );

  const staleEntries = await prisma.apiCache.findMany({
    where: { expiresAt: { lt: staleThreshold } },
    select: { id: true },
    take: CLEANUP_LIMIT,
  });

  if (staleEntries.length > 0) {
    prisma.apiCache
      .deleteMany({
        where: { id: { in: staleEntries.map((e) => e.id) } },
      })
      .catch((err: unknown) => {
        console.warn("api-cache: lazy cleanup failed", err);
      });
  }

  return result;
}

/** Delete all ApiCache entries. Returns the number of rows deleted. */
export async function clearApiCache(): Promise<number> {
  const { count } = await prisma.apiCache.deleteMany();
  return count;
}

/** Aggregate stats from the ApiCache table. */
export async function getApiCacheStats(): Promise<{
  count: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
}> {
  const [countResult, oldest, newest] = await Promise.all([
    prisma.apiCache.count(),
    prisma.apiCache.findFirst({
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.apiCache.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  return {
    count: countResult,
    oldestEntry: oldest?.createdAt ?? null,
    newestEntry: newest?.createdAt ?? null,
  };
}
