import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { cleanFilename } from "@/lib/filename-cleaner";

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  // Remove .m3u and .cue entries
  const junkDeleted = await prisma.game.deleteMany({
    where: {
      OR: [
        { originalFile: { endsWith: ".m3u" } },
        { originalFile: { endsWith: ".cue" } },
      ],
    },
  });

  // Re-clean all titles from originalFile (fixes missing extensions like .sms)
  const allGames = await prisma.game.findMany({
    select: { id: true, title: true, originalFile: true, platform: true },
    orderBy: { id: "asc" },
  });

  let titlesCleaned = 0;
  for (const game of allGames) {
    const cleanedTitle = cleanFilename(game.originalFile);
    if (cleanedTitle && cleanedTitle !== game.title) {
      await prisma.game.update({
        where: { id: game.id },
        data: { title: cleanedTitle },
      });
      titlesCleaned++;
    }
  }

  // Re-fetch games after title cleanup for deduplication
  const updatedGames = await prisma.game.findMany({
    select: { id: true, title: true, platform: true },
    orderBy: { id: "asc" },
  });

  // Find and remove title+platform duplicates (keep lowest ID)
  const seen = new Map<string, number>();
  const dupeIds: number[] = [];

  for (const game of updatedGames) {
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
    junkRemoved: junkDeleted.count,
    titlesCleaned,
    duplicatesRemoved: dupesDeleted,
    totalGamesNow: await prisma.game.count(),
  });
}
