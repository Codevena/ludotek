import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateGameAiContent } from "@/lib/openrouter";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const settings = await prisma.settings.findFirst({ where: { id: 1 } });
  if (!settings?.openrouterKey) {
    return NextResponse.json({ error: "OpenRouter API key not configured" }, { status: 400 });
  }

  const games = await prisma.game.findMany({
    where: { igdbId: { not: null }, aiFunFacts: null },
    take: 10,
  });

  if (games.length === 0) {
    return NextResponse.json({ success: true, processed: 0, enriched: 0, failed: 0, remaining: 0 });
  }

  const totalRemaining = await prisma.game.count({ where: { igdbId: { not: null }, aiFunFacts: null } });

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ type: "start", total: games.length, totalRemaining });

      let enriched = 0;
      let failed = 0;

      for (let i = 0; i < games.length; i++) {
        const game = games[i];
        send({ type: "progress", current: i + 1, total: games.length, title: game.title, platform: game.platformLabel });

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
          send({ type: "enriched", title: game.title, current: i + 1 });

          await new Promise((r) => setTimeout(r, 1000));
        } catch (err) {
          console.warn(`AI enrichment failed for "${game.title}":`, err);
          failed++;
          send({ type: "error", title: game.title, error: err instanceof Error ? err.message : "Unknown", current: i + 1 });
        }
      }

      const remaining = await prisma.game.count({ where: { igdbId: { not: null }, aiFunFacts: null } });
      send({ type: "done", processed: games.length, enriched, failed, remaining });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
