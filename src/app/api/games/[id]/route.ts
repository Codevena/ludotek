import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const gameId = parseInt(id, 10);

    if (isNaN(gameId)) {
      return NextResponse.json({ error: "Invalid game ID" }, { status: 400 });
    }

    const body = await request.json();

    if (typeof body.isFavorite !== "boolean") {
      return NextResponse.json(
        { error: "isFavorite must be a boolean" },
        { status: 400 }
      );
    }

    const game = await prisma.game.update({
      where: { id: gameId },
      data: { isFavorite: body.isFavorite },
      select: { id: true, isFavorite: true },
    });

    return NextResponse.json(game);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
    console.error("Failed to update favorite status:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
