import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { searchIgdb } from "@/lib/igdb";
import { searchSteamGridDb } from "@/lib/steamgriddb";
import { requireAuth } from "@/lib/auth";

const CONCURRENCY = parseInt(process.env.ENRICH_CONCURRENCY || "4", 10) || 4;

async function enrichGame(
  game: { id: number; title: string; platform: string; platformLabel: string },
  igdbClientId: string,
  igdbClientSecret: string,
  steamgriddbKey: string
): Promise<{ status: "enriched" | "missed" | "error"; title: string; error?: string }> {
  try {
    const igdbData = await searchIgdb(game.title, game.platform, igdbClientId, igdbClientSecret);

    if (igdbData) {
      let coverUrl = igdbData.coverUrl;
      if (!coverUrl && steamgriddbKey) {
        coverUrl = await searchSteamGridDb(game.title, steamgriddbKey);
      }

      await prisma.game.update({
        where: { id: game.id },
        data: {
          igdbId: igdbData.igdbId,
          coverUrl,
          igdbScore: igdbData.igdbScore,
          genres: JSON.stringify(igdbData.genres),
          developer: igdbData.developer,
          publisher: igdbData.publisher,
          releaseDate: igdbData.releaseDate,
          summary: igdbData.summary,
          screenshotUrls: JSON.stringify(igdbData.screenshotUrls),
        },
      });
      return { status: "enriched", title: game.title };
    }
    return { status: "missed", title: game.title };
  } catch (err) {
    console.warn(`Failed to enrich "${game.title}":`, err);
    return { status: "error", title: game.title, error: err instanceof Error ? err.message : "Unknown" };
  }
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const settings = await prisma.settings.findFirst({ where: { id: 1 } });
  if (!settings?.igdbClientId || !settings?.igdbClientSecret) {
    return NextResponse.json({ error: "IGDB credentials not configured" }, { status: 400 });
  }

  // Fetch ALL unenriched games, not just a small batch
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
      let completed = 0;

      // Process in parallel with concurrency pool
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
          batch.map((game) =>
            enrichGame(game, settings.igdbClientId, settings.igdbClientSecret, settings.steamgriddbKey)
          )
        );

        for (const result of results) {
          completed++;
          if (result.status === "fulfilled") {
            const r = result.value;
            if (r.status === "enriched") {
              enriched++;
              send({ type: "enriched", title: r.title, current: completed });
            } else if (r.status === "missed") {
              failed++;
              send({ type: "missed", title: r.title, current: completed });
            } else {
              failed++;
              send({ type: "error", title: r.title, error: r.error, current: completed });
            }
          } else {
            failed++;
            send({ type: "error", title: "Unknown", error: String(result.reason), current: completed });
          }
        }

        // Small delay between batches to respect IGDB rate limits
        if (i + CONCURRENCY < games.length) {
          await new Promise((r) => setTimeout(r, 300));
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
