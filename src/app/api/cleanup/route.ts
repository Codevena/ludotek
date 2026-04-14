import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { cleanFilename } from "@/lib/filename-cleaner";

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  // Re-clean all titles from originalFile (fixes missing extensions like .sms)
  const allGames = await prisma.game.findMany({
    select: { id: true, title: true, originalFile: true, platform: true },
    orderBy: { id: "asc" },
  });

  let titlesCleaned = 0;
  for (const game of allGames) {
    // Extract basename for subdir-backed platforms (e.g. "roms/Halo.iso" → "Halo.iso")
    const rawName = game.originalFile.includes("/")
      ? game.originalFile.split("/").pop()!
      : game.originalFile;
    const cleanedTitle = cleanFilename(rawName);
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
    select: { id: true, title: true, platform: true, originalFile: true },
    orderBy: { id: "asc" },
  });

  // Find and remove title+platform duplicates
  // Prefer .m3u entries (canonical multi-disc representation) over per-disc entries
  const seen = new Map<string, { id: number; isM3u: boolean }>();
  const dupeIds: number[] = [];

  for (const game of updatedGames) {
    const key = `${game.title}|${game.platform}`;
    const isM3u = game.originalFile.endsWith(".m3u");
    const existing = seen.get(key);
    if (existing) {
      if (isM3u && !existing.isM3u) {
        // New entry is .m3u, old is not — replace, mark old as dupe
        dupeIds.push(existing.id);
        seen.set(key, { id: game.id, isM3u });
      } else {
        dupeIds.push(game.id);
      }
    } else {
      seen.set(key, { id: game.id, isM3u });
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
    titlesCleaned,
    duplicatesRemoved: dupesDeleted,
    totalGamesNow: await prisma.game.count(),
  });
}
