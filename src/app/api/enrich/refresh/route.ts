import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchIgdbById } from "@/lib/igdb";
import { requireAuth } from "@/lib/auth";

const DELAY_MS = parseInt(process.env.ENRICH_DELAY_MS || "500", 10) || 500;

function safeJsonParse(str: string | null): unknown[] {
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const settings = await prisma.settings.findFirst({ where: { id: 1 } });
  if (!settings?.igdbClientId || !settings?.igdbClientSecret) {
    return NextResponse.json({ error: "IGDB credentials not configured" }, { status: 400 });
  }

  // Find all games that have an igdbId
  const allGamesWithIgdb = await prisma.game.findMany({
    where: { igdbId: { not: null } },
  });

  // Filter to games with at least one missing field
  const games = allGamesWithIgdb.filter((game) => {
    if (game.metacriticScore == null) return true;
    if (!game.franchise) return true;
    if (safeJsonParse(game.videoIds).length === 0) return true;
    if (safeJsonParse(game.artworkUrls).length === 0) return true;
    if (safeJsonParse(game.themes).length === 0) return true;
    if (safeJsonParse(game.screenshotUrls).length === 0) return true;
    return false;
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
          const igdbData = await fetchIgdbById(
            game.igdbId!,
            settings.igdbClientId,
            settings.igdbClientSecret
          );

          if (igdbData) {
            // Only update fields that are currently NULL or empty
            const fieldsUpdated: string[] = [];
            const updateData: Record<string, unknown> = {};

            if (game.metacriticScore == null && igdbData.metacriticScore != null) {
              updateData.metacriticScore = igdbData.metacriticScore;
              fieldsUpdated.push("metacriticScore");
            }
            if (!game.franchise && igdbData.franchise) {
              updateData.franchise = igdbData.franchise;
              fieldsUpdated.push("franchise");
            }
            if (safeJsonParse(game.videoIds).length === 0 && igdbData.videoIds.length > 0) {
              updateData.videoIds = JSON.stringify(igdbData.videoIds);
              fieldsUpdated.push("videoIds");
            }
            if (safeJsonParse(game.artworkUrls).length === 0 && igdbData.artworkUrls.length > 0) {
              updateData.artworkUrls = JSON.stringify(igdbData.artworkUrls);
              fieldsUpdated.push("artworkUrls");
            }
            if (safeJsonParse(game.themes).length === 0 && igdbData.themes.length > 0) {
              updateData.themes = JSON.stringify(igdbData.themes);
              fieldsUpdated.push("themes");
            }
            if (safeJsonParse(game.screenshotUrls).length === 0 && igdbData.screenshotUrls.length > 0) {
              updateData.screenshotUrls = JSON.stringify(igdbData.screenshotUrls);
              fieldsUpdated.push("screenshotUrls");
            }

            if (fieldsUpdated.length > 0) {
              await prisma.game.update({
                where: { id: game.id },
                data: updateData,
              });
              enriched++;
              send({ type: "enriched", title: game.title, current: i + 1, fieldsUpdated });
            } else {
              send({ type: "skipped", title: game.title, current: i + 1 });
            }
          } else {
            failed++;
            send({ type: "missed", title: game.title, current: i + 1 });
          }

          await new Promise((r) => setTimeout(r, DELAY_MS));
        } catch (err) {
          console.warn(`Failed to re-enrich "${game.title}":`, err);
          failed++;
          send({ type: "error", title: game.title, error: err instanceof Error ? err.message : "Unknown", current: i + 1 });
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      const remaining = await prisma.game.count({
        where: {
          igdbId: { not: null },
          OR: [
            { metacriticScore: null },
            { videoIds: null },
            { videoIds: "[]" },
            { artworkUrls: null },
            { artworkUrls: "[]" },
            { themes: null },
            { themes: "[]" },
            { screenshotUrls: null },
            { screenshotUrls: "[]" },
          ],
        },
      });

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
