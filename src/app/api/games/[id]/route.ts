import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    screenshotUrls: game.screenshotUrls ? JSON.parse(game.screenshotUrls) : [],
    genres: game.genres ? JSON.parse(game.genres) : [],
  };

  return NextResponse.json(parsed);
}
