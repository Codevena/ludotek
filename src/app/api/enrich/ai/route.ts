import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateGameAiContent } from "@/lib/openrouter";
import { requireAuth } from "@/lib/auth";

const CONCURRENCY = parseInt(process.env.AI_CONCURRENCY || "3", 10) || 3;
const DELAY_MS = Math.max(100, parseInt(process.env.AI_DELAY_MS || "500", 10) || 500);

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const settings = await prisma.settings.findFirst({ where: { id: 1 } });
  if (!settings?.openrouterKey) {
    return NextResponse.json({ error: "OpenRouter API key not configured" }, { status: 400 });
  }

  // Fetch ALL games that need AI content
  const games = await prisma.game.findMany({
    where: { igdbId: { not: null }, aiFunFacts: null },
  });

  if (games.length === 0) {
    return NextResponse.json({ success: true, processed: 0, enriched: 0, failed: 0, remaining: 0 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Stream closed
        }
      };

      send({ type: "start", total: games.length, totalRemaining: games.length });

      let enriched = 0;
      let failed = 0;
      let completed = 0;

      // Process in parallel batches
      for (let i = 0; i < games.length; i += CONCURRENCY) {
        if (request.signal.aborted) break;

        const batch = games.slice(i, i + CONCURRENCY);

        send({
          type: "progress",
          current: completed + 1,
          total: games.length,
          title: batch.map((g) => g.title).join(", "),
          platform: batch[0].platformLabel,
          batchSize: batch.length,
        });

        const results = await Promise.allSettled(
          batch.map(async (game) => {
            try {
              const genres: string[] = (() => { try { return JSON.parse(game.genres || "[]"); } catch { return []; } })();
              const releaseYear = game.releaseDate ? new Date(game.releaseDate).getFullYear() : null;

              const aiContent = await generateGameAiContent(
                game.title, game.platformLabel, game.developer,
                releaseYear, genres, game.summary, settings.openrouterKey,
                undefined, settings.aiLanguage || "en"
              );

              await prisma.game.update({
                where: { id: game.id },
                data: {
                  aiFunFacts: aiContent.funFacts,
                  aiStory: aiContent.story,
                  aiEnrichedAt: new Date(),
                },
              });

              return { status: "enriched" as const, title: game.title };
            } catch (err) {
              console.warn(`AI enrichment failed for "${game.title}":`, err);
              return { status: "error" as const, title: game.title, error: err instanceof Error ? err.message : "Unknown" };
            }
          })
        );

        for (const result of results) {
          completed++;
          if (result.status === "fulfilled") {
            if (result.value.status === "enriched") {
              enriched++;
              send({ type: "enriched", title: result.value.title, current: completed });
            } else {
              failed++;
              send({ type: "error", title: result.value.title, error: result.value.error, current: completed });
            }
          } else {
            failed++;
            send({ type: "error", title: "Unknown", error: String(result.reason), current: completed });
          }
        }

        // Delay between batches to respect API rate limits
        if (i + CONCURRENCY < games.length) {
          await new Promise((r) => setTimeout(r, DELAY_MS));
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
