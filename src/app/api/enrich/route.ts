import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { searchIgdb } from "@/lib/igdb";
import { searchSteamGridDb } from "@/lib/steamgriddb";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const settings = await prisma.settings.findFirst({ where: { id: 1 } });
    if (!settings?.igdbClientId || !settings?.igdbClientSecret) {
      return NextResponse.json({ error: "IGDB credentials not configured" }, { status: 400 });
    }

    const games = await prisma.game.findMany({
      where: { igdbId: null },
      take: 50,
    });

    let enriched = 0;
    let failed = 0;

    for (const game of games) {
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
        } else {
          failed++;
        }

        await new Promise((r) => setTimeout(r, 250));
      } catch (err) {
        console.warn(`Failed to enrich "${game.title}":`, err);
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      processed: games.length,
      enriched,
      failed,
      remaining: await prisma.game.count({ where: { igdbId: null } }),
    });
  } catch (err) {
    console.error("Enrichment failed:", err);
    return NextResponse.json(
      { error: `Enrichment failed: ${err instanceof Error ? err.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}
