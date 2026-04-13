import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

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
        platformLabel: true,
        platform: true,
      },
    });

    return NextResponse.json({ results: games });
  } catch (err) {
    console.error("Search API error:", err);
    return NextResponse.json({ results: [] }, { status: 500 });
  }
}
