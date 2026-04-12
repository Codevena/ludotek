import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { searchIgdb } from "@/lib/igdb";
import { searchSteamGridDb } from "@/lib/steamgriddb";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const settings = await prisma.settings.findFirst({ where: { id: 1 } });
  if (!settings?.igdbClientId || !settings?.igdbClientSecret) {
    return NextResponse.json({ error: "IGDB credentials not configured" }, { status: 400 });
  }

  const games = await prisma.game.findMany({
    where: { igdbId: null },
    take: 50,
  });

  if (games.length === 0) {
    return NextResponse.json({ success: true, processed: 0, enriched: 0, failed: 0, remaining: 0 });
  }

  const totalRemaining = await prisma.game.count({ where: { igdbId: null } });

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
          const igdbData = await searchIgdb(
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
                genres: JSON.stringify(igdbData.genres),
                developer: igdbData.developer,
                publisher: igdbData.publisher,
                releaseDate: igdbData.releaseDate,
                summary: igdbData.summary,
                screenshotUrls: JSON.stringify(igdbData.screenshotUrls),
              },
            });
            enriched++;
            send({ type: "enriched", title: game.title, current: i + 1 });
          } else {
            failed++;
            send({ type: "missed", title: game.title, current: i + 1 });
          }

          await new Promise((r) => setTimeout(r, 250));
        } catch (err) {
          console.warn(`Failed to enrich "${game.title}":`, err);
          failed++;
          send({ type: "error", title: game.title, error: err instanceof Error ? err.message : "Unknown", current: i + 1 });
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
