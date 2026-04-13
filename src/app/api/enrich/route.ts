import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { searchIgdb } from "@/lib/igdb";
import { searchSteamGridDb } from "@/lib/steamgriddb";
import { requireAuth } from "@/lib/auth";

const DELAY_MS = parseInt(process.env.ENRICH_DELAY_MS || "500", 10) || 500;
const MAX_RETRIES = 2;

async function enrichWithRetry(
  title: string,
  platform: string,
  igdbClientId: string,
  igdbClientSecret: string,
  retries = 0
) {
  try {
    return await searchIgdb(title, platform, igdbClientId, igdbClientSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    // Retry on rate limit (429) or server errors (5xx)
    if (retries < MAX_RETRIES && (msg.includes("429") || msg.includes("500") || msg.includes("503"))) {
      const backoff = (retries + 1) * 2000; // 2s, 4s
      await new Promise((r) => setTimeout(r, backoff));
      return enrichWithRetry(title, platform, igdbClientId, igdbClientSecret, retries + 1);
    }
    throw err;
  }
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const settings = await prisma.settings.findFirst({ where: { id: 1 } });
  if (!settings?.igdbClientId || !settings?.igdbClientSecret) {
    return NextResponse.json({ error: "IGDB credentials not configured" }, { status: 400 });
  }

  const games = await prisma.game.findMany({
    where: { igdbId: null },
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

      // Sequential processing — IGDB rate limit (4 req/sec) is the bottleneck
      for (let i = 0; i < games.length; i++) {
        if (request.signal.aborted) break;

        const game = games[i];
        send({
          type: "progress",
          current: i + 1,
          total: games.length,
          title: game.title,
          platform: game.platformLabel,
        });

        try {
          const igdbData = await enrichWithRetry(
            game.title, game.platform,
            settings.igdbClientId, settings.igdbClientSecret
          );

          if (igdbData) {
            let coverUrl = igdbData.coverUrl;
            if (!coverUrl && settings.steamgriddbKey) {
              coverUrl = await searchSteamGridDb(game.title, settings.steamgriddbKey);
            }

            await prisma.game.update({
              where: { id: game.id },
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
            enriched++;
            send({ type: "enriched", title: game.title, current: i + 1 });
          } else {
            failed++;
            send({ type: "missed", title: game.title, current: i + 1 });
          }

          // Respect IGDB rate limit: ~2 games/sec with 5 API calls each
          await new Promise((r) => setTimeout(r, DELAY_MS));
        } catch (err) {
          console.warn(`Failed to enrich "${game.title}":`, err);
          failed++;
          send({ type: "error", title: game.title, error: err instanceof Error ? err.message : "Unknown", current: i + 1 });
          // Extra delay after errors (likely rate-limited)
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      const remaining = await prisma.game.count({ where: { igdbId: null } });
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
