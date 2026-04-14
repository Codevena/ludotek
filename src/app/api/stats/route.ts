import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PLATFORM_CONFIG } from "@/lib/platforms";

export const dynamic = "force-dynamic";

const platformMap = new Map(
  PLATFORM_CONFIG.map((p) => [p.id, { label: p.label, color: p.color }])
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceIdParam = searchParams.get("deviceId");

    // Build device filter
    const deviceFilter: Record<string, unknown> = {};
    if (deviceIdParam && deviceIdParam !== "all") {
      if (!/^\d+$/.test(deviceIdParam)) {
        return NextResponse.json({ error: "Invalid deviceId" }, { status: 400 });
      }
      deviceFilter.devices = { some: { deviceId: parseInt(deviceIdParam, 10) } };
    }

    const [
      totalGames,
      totalPlatforms,
      avgResult,
      coverCount,
      aiCount,
      platformGroups,
      scoreGte75,
      score50to74,
      scoreLt50,
      scoreNull,
    ] = await Promise.all([
      prisma.game.count({ where: deviceFilter }),
      prisma.game.groupBy({ by: ["platform"], where: deviceFilter }).then((g) => g.length),
      prisma.game.aggregate({ where: deviceFilter, _avg: { igdbScore: true } }),
      prisma.game.count({ where: { ...deviceFilter, coverUrl: { not: null } } }),
      prisma.game.count({ where: { ...deviceFilter, aiFunFacts: { not: null } } }),
      prisma.game.groupBy({
        by: ["platform"],
        where: deviceFilter,
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      prisma.game.count({ where: { ...deviceFilter, igdbScore: { gte: 75 } } }),
      prisma.game.count({
        where: { ...deviceFilter, igdbScore: { gte: 50, lt: 75 } },
      }),
      prisma.game.count({
        where: { ...deviceFilter, igdbScore: { not: null, lt: 50 } },
      }),
      prisma.game.count({ where: { ...deviceFilter, igdbScore: null } }),
    ]);

    const avgScore = avgResult._avg.igdbScore
      ? Math.round(avgResult._avg.igdbScore * 10) / 10
      : null;

    const coverPercent =
      totalGames > 0 ? Math.round((coverCount / totalGames) * 1000) / 10 : 0;

    const aiPercent =
      totalGames > 0 ? Math.round((aiCount / totalGames) * 1000) / 10 : 0;

    const platformCounts = platformGroups.map((g) => {
      const config = platformMap.get(g.platform);
      return {
        platform: g.platform,
        label: config?.label ?? g.platform,
        color: config?.color ?? "#71717a",
        count: g._count.id,
      };
    });

    const scoreBuckets = [
      { name: "75+", count: scoreGte75, color: "#22c55e" },
      { name: "50-74", count: score50to74, color: "#f59e0b" },
      { name: "<50", count: scoreLt50, color: "#ef4444" },
      { name: "Unrated", count: scoreNull, color: "#3f3f46" },
    ];

    return NextResponse.json({
      totalGames,
      totalPlatforms,
      avgScore,
      coverPercent,
      aiPercent,
      platformCounts,
      scoreBuckets,
    });
  } catch (error) {
    console.error("Stats API error:", error);
    return NextResponse.json(
      { error: "Failed to load stats" },
      { status: 500 }
    );
  }
}
