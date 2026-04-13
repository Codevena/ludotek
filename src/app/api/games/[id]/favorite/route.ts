import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    console.error("Failed to update favorite status:", error);
    return NextResponse.json(
      { error: "Game not found or update failed" },
      { status: 404 }
    );
  }
}
