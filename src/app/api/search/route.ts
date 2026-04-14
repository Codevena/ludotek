import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { coverUrl } from "@/lib/image-url";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const games = await prisma.game.findMany({
      where: { title: { contains: q } },
      take: 8,
      select: {
        id: true,
        title: true,
        coverUrl: true,
        localCoverPath: true,
        platformLabel: true,
        platform: true,
      },
    });

    const results = games.map((game) => ({
      id: game.id,
      title: game.title,
      coverUrl: coverUrl(game) ?? null,
      platformLabel: game.platformLabel,
      platform: game.platform,
    }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error("Search API error:", err);
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}
