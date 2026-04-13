import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function safeJsonParse(str: string | null): unknown[] {
  if (!str) return [];
  try { const parsed = JSON.parse(str); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const gameId = parseInt(id, 10);

  if (isNaN(gameId)) {
    return NextResponse.json({ error: "Invalid game ID" }, { status: 400 });
  }

  const game = await prisma.game.findUnique({ where: { id: gameId } });

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const parsed = {
    ...game,
    screenshotUrls: safeJsonParse(game.screenshotUrls),
    genres: safeJsonParse(game.genres),
    videoIds: safeJsonParse(game.videoIds),
    artworkUrls: safeJsonParse(game.artworkUrls),
    themes: safeJsonParse(game.themes),
  };

  return NextResponse.json(parsed);
}
