import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function safeJsonParse(str: string | null): string[] {
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const platformsParam = request.nextUrl.searchParams.get("platforms");
  if (!platformsParam) {
    return NextResponse.json(
      { error: "Missing required query parameter: platforms" },
      { status: 400 },
    );
  }

  const platforms = platformsParam.split(",").map((p) => p.trim()).filter(Boolean);
  if (platforms.length === 0) {
    return NextResponse.json(
      { error: "No valid platforms provided" },
      { status: 400 },
    );
  }

  const games = await prisma.game.findMany({
    where: {
      platform: { in: platforms },
      OR: [
        { genres: { not: null } },
        { themes: { not: null } },
      ],
    },
    select: {
      genres: true,
      themes: true,
    },
  });

  const genreSet = new Set<string>();
  const themeSet = new Set<string>();

  for (const game of games) {
    for (const g of safeJsonParse(game.genres)) genreSet.add(g);
    for (const t of safeJsonParse(game.themes)) themeSet.add(t);
  }

  return NextResponse.json({
    genres: Array.from(genreSet).sort(),
    themes: Array.from(themeSet).sort(),
  });
}
