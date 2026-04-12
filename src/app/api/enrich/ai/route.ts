import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateGameAiContent } from "@/lib/openrouter";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const settings = await prisma.settings.findFirst({ where: { id: 1 } });
    if (!settings?.openrouterKey) {
      return NextResponse.json({ error: "OpenRouter API key not configured" }, { status: 400 });
    }

    const games = await prisma.game.findMany({
      where: { igdbId: { not: null }, aiFunFacts: null },
      take: 10,
    });

    let enriched = 0;
    let failed = 0;

    for (const game of games) {
      try {
        const genres: string[] = game.genres ? JSON.parse(game.genres) : [];
        const releaseYear = game.releaseDate ? new Date(game.releaseDate).getFullYear() : null;

        const aiContent = await generateGameAiContent(
          game.title, game.platformLabel, game.developer,
          releaseYear, genres, game.summary, settings.openrouterKey
        );

        await prisma.game.update({
          where: { id: game.id },
          data: {
            aiFunFacts: aiContent.funFacts,
            aiStory: aiContent.story,
            aiEnrichedAt: new Date(),
          },
        });

        enriched++;
        await new Promise((r) => setTimeout(r, 1000));
      } catch (err) {
        console.warn(`AI enrichment failed for "${game.title}":`, err);
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      processed: games.length,
      enriched,
      failed,
      remaining: await prisma.game.count({ where: { igdbId: { not: null }, aiFunFacts: null } }),
    });
  } catch (err) {
    console.error("AI enrichment failed:", err);
    return NextResponse.json(
      { error: `AI enrichment failed: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}
