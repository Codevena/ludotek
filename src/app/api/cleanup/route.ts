import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  // Remove .m3u entries
  const m3uDeleted = await prisma.game.deleteMany({
    where: { originalFile: { endsWith: ".m3u" } },
  });

  // Find and remove title+platform duplicates (keep lowest ID)
  const allGames = await prisma.game.findMany({
    select: { id: true, title: true, platform: true },
    orderBy: { id: "asc" },
  });

  const seen = new Map<string, number>();
  const dupeIds: number[] = [];

  for (const game of allGames) {
    const key = `${game.title}|${game.platform}`;
    if (seen.has(key)) {
      dupeIds.push(game.id);
    } else {
      seen.set(key, game.id);
    }
  }

  let dupesDeleted = 0;
  if (dupeIds.length > 0) {
    const result = await prisma.game.deleteMany({
      where: { id: { in: dupeIds } },
    });
    dupesDeleted = result.count;
  }

  // Update platform counts
  const platformCounts = await prisma.game.groupBy({
    by: ["platform"],
    _count: true,
  });
  await prisma.platform.updateMany({ data: { gameCount: 0 } });
  for (const pc of platformCounts) {
    await prisma.platform.updateMany({
      where: { id: pc.platform },
      data: { gameCount: pc._count },
    });
  }

  return NextResponse.json({
    success: true,
    m3uRemoved: m3uDeleted.count,
    duplicatesRemoved: dupesDeleted,
    totalGamesNow: await prisma.game.count(),
  });
}
