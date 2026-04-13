import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchIgdbById } from "@/lib/igdb";
import { searchSteamGridDb } from "@/lib/steamgriddb";
import { generateGameAiContent } from "@/lib/openrouter";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const gameId = parseInt(id, 10);
  if (isNaN(gameId)) return NextResponse.json({ error: "Invalid game ID" }, { status: 400 });

  const body = await request.json();
  const { igdbId, generateAi } = body;

  if (igdbId && typeof igdbId !== "number") return NextResponse.json({ error: "Invalid igdbId" }, { status: 400 });

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const settings = await prisma.settings.findFirst({ where: { id: 1 } });

  // If igdbId provided, fetch full data from IGDB using shared resolver
  if (igdbId && settings?.igdbClientId && settings?.igdbClientSecret) {
    const igdbData = await fetchIgdbById(igdbId, settings.igdbClientId, settings.igdbClientSecret);

    if (igdbData) {
      let coverUrl = igdbData.coverUrl;
      if (!coverUrl && settings.steamgriddbKey) {
        coverUrl = await searchSteamGridDb(game.title, settings.steamgriddbKey);
      }

      await prisma.game.update({
        where: { id: gameId },
        data: {
          igdbId: igdbData.igdbId,
          coverUrl,
          igdbScore: igdbData.igdbScore,
          metacriticScore: igdbData.metacriticScore,
          genres: JSON.stringify(igdbData.genres),
          developer: igdbData.developer,
          publisher: igdbData.publisher,
          releaseDate: igdbData.releaseDate,
          summary: igdbData.summary,
          screenshotUrls: JSON.stringify(igdbData.screenshotUrls),
          videoIds: JSON.stringify(igdbData.videoIds),
          artworkUrls: JSON.stringify(igdbData.artworkUrls),
          franchise: igdbData.franchise,
          themes: JSON.stringify(igdbData.themes),
        },
      });
    }
  }

  // Generate AI content if requested
  if (generateAi && settings?.openrouterKey) {
    const updatedGame = await prisma.game.findUnique({ where: { id: gameId } });
    if (updatedGame) {
      const genres: string[] = (() => { try { return JSON.parse(updatedGame.genres || "[]"); } catch { return []; } })();
      const releaseYear = updatedGame.releaseDate ? new Date(updatedGame.releaseDate).getFullYear() : null;

      const aiContent = await generateGameAiContent(
        updatedGame.title, updatedGame.platformLabel, updatedGame.developer,
        releaseYear, genres, updatedGame.summary, settings.openrouterKey,
        undefined, settings.aiLanguage || "en"
      );

      await prisma.game.update({
        where: { id: gameId },
        data: {
          aiFunFacts: aiContent.funFacts,
          aiStory: aiContent.story,
          aiEnrichedAt: new Date(),
        },
      });
    }
  }

  const finalGame = await prisma.game.findUnique({ where: { id: gameId } });
  return NextResponse.json({ success: true, game: finalGame });
}
