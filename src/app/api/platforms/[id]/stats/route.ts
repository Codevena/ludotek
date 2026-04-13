import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const platform = await prisma.platform.findUnique({ where: { id } });
    if (!platform) {
      return NextResponse.json({ error: "Platform not found" }, { status: 404 });
    }

    const [gameCount, avgResult, coverCount, aiCount, games] =
      await Promise.all([
        prisma.game.count({ where: { platform: id } }),
        prisma.game.aggregate({
          where: { platform: id },
          _avg: { igdbScore: true },
        }),
        prisma.game.count({
          where: { platform: id, coverUrl: { not: null } },
        }),
        prisma.game.count({
          where: { platform: id, aiFunFacts: { not: null } },
        }),
        prisma.game.findMany({
          where: { platform: id },
          select: { genres: true },
        }),
      ]);

    const avgScore = avgResult._avg.igdbScore
      ? Math.round(avgResult._avg.igdbScore * 10) / 10
      : null;

    const coverPercent =
      gameCount > 0 ? Math.round((coverCount / gameCount) * 1000) / 10 : 0;

    const aiPercent =
      gameCount > 0 ? Math.round((aiCount / gameCount) * 1000) / 10 : 0;

    // Count genre occurrences across all games
    const genreMap = new Map<string, number>();
    for (const game of games) {
      if (!game.genres) continue;
      try {
        const parsed = JSON.parse(game.genres) as string[];
        for (const genre of parsed) {
          genreMap.set(genre, (genreMap.get(genre) ?? 0) + 1);
        }
      } catch {
        // skip unparseable genres
      }
    }

    const genreCounts = Array.from(genreMap.entries())
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return NextResponse.json({
      gameCount,
      avgScore,
      coverPercent,
      aiPercent,
      genreCounts,
    });
  } catch (error) {
    console.error("Platform stats API error:", error);
    return NextResponse.json(
      { error: "Failed to load platform stats" },
      { status: 500 }
    );
  }
}
