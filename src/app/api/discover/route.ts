import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildLibraryPrompt,
  buildWishlistPrompt,
  parseRecommendations,
} from "@/lib/recommender";
import { searchIgdb } from "@/lib/igdb";
import { PLATFORM_CONFIG } from "@/lib/platforms";

function safeJsonParse(str: string | null): unknown[] {
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function callOpenRouter(
  prompt: string,
  apiKey: string,
  model: string
): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
      temperature: 0.8,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter API failed: ${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

export async function POST(request: NextRequest) {
  // No auth required — discovery is a public feature (uses server-side API keys)
  const body = await request.json();
  const {
    platforms,
    genres,
    themes,
    tab,
  }: {
    platforms: string[];
    genres: string[];
    themes: string[];
    tab: "library" | "wishlist";
  } = body;

  // Load settings
  const settings = await prisma.settings.findFirst({ where: { id: 1 } });
  if (!settings?.openrouterKey) {
    return NextResponse.json(
      { error: "OpenRouter API key not configured" },
      { status: 400 }
    );
  }

  if (!platforms?.length || (!genres?.length && !themes?.length)) {
    return NextResponse.json(
      { error: "Platforms and at least one genre or theme are required" },
      { status: 400 }
    );
  }

  const model =
    process.env.OPENROUTER_MODEL || "google/gemini-3.1-flash-lite-preview";

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // controller may already be closed
        }
      };

      try {
        // Step 1: Load games from DB for selected platforms
        const games = await prisma.game.findMany({
          where: { platform: { in: platforms } },
        });

        // --- LIBRARY TAB ---
        send({
          type: "generating",
          tab: "library",
          message: "Analysiere deine Library...",
        });

        const gameData = games.map((g) => ({
          title: g.title,
          platform: g.platform,
          platformLabel: g.platformLabel,
          genres: safeJsonParse(g.genres) as string[],
          themes: safeJsonParse(g.themes) as string[],
          igdbScore: g.igdbScore,
        }));

        const libraryPrompt = buildLibraryPrompt(gameData, genres, themes);
        const aiResponse = await callOpenRouter(
          libraryPrompt,
          settings.openrouterKey,
          model
        );
        const recommendations = parseRecommendations(aiResponse);

        // Enrich library recommendations with DB data
        const enrichedLibrary = [];
        for (const rec of recommendations) {
          const dbGame = games.find(
            (g) =>
              g.title.toLowerCase() === rec.title.toLowerCase() &&
              g.platform === rec.platform
          );
          if (dbGame) {
            enrichedLibrary.push({
              ...rec,
              platformLabel: dbGame.platformLabel,
              coverUrl: dbGame.coverUrl,
              igdbScore: dbGame.igdbScore,
              metacriticScore: dbGame.metacriticScore,
              genres: safeJsonParse(dbGame.genres),
              artworkUrl:
                (safeJsonParse(dbGame.artworkUrls) as string[])[0] || null,
              videoId:
                (safeJsonParse(dbGame.videoIds) as string[])[0] || null,
              summary: dbGame.summary,
              dbId: dbGame.id,
            });
          }
        }

        send({
          type: "recommendations",
          tab: "library",
          games: enrichedLibrary,
        });

        // --- WISHLIST TAB ---
        if (tab === "wishlist") {
          send({
            type: "generating",
            tab: "wishlist",
            message: "Suche fehlende Perlen via IGDB...",
          });

          const existingTitles = games.map((g) => g.title);
          const wishlistPrompt = buildWishlistPrompt(
            existingTitles,
            platforms,
            genres,
            themes
          );
          const wishlistAiResponse = await callOpenRouter(
            wishlistPrompt,
            settings.openrouterKey,
            model
          );
          const wishlistRecs = parseRecommendations(wishlistAiResponse);

          const enrichedWishlist = [];
          for (const rec of wishlistRecs) {
            // Skip if user already has this game
            if (
              games.some(
                (g) => g.title.toLowerCase() === rec.title.toLowerCase()
              )
            )
              continue;

            try {
              if (settings.igdbClientId && settings.igdbClientSecret) {
                const igdbData = await searchIgdb(
                  rec.title,
                  rec.platform,
                  settings.igdbClientId,
                  settings.igdbClientSecret
                );
                enrichedWishlist.push({
                  ...rec,
                  platformLabel:
                    PLATFORM_CONFIG.find((p) => p.id === rec.platform)?.label ||
                    rec.platform,
                  coverUrl: igdbData?.coverUrl || null,
                  igdbScore: igdbData?.igdbScore || null,
                  metacriticScore: igdbData?.metacriticScore || null,
                  genres: igdbData?.genres || [],
                  summary: igdbData?.summary || null,
                  artworkUrl: igdbData?.artworkUrls?.[0] || null,
                  videoId: igdbData?.videoIds?.[0] || null,
                  dbId: null,
                });
              } else {
                enrichedWishlist.push({
                  ...rec,
                  platformLabel:
                    PLATFORM_CONFIG.find((p) => p.id === rec.platform)?.label ||
                    rec.platform,
                  dbId: null,
                });
              }
              // IGDB rate limit
              await new Promise((r) => setTimeout(r, 500));
            } catch (err) {
              console.warn(`IGDB lookup failed for "${rec.title}":`, err);
              enrichedWishlist.push({
                ...rec,
                platformLabel:
                  PLATFORM_CONFIG.find((p) => p.id === rec.platform)?.label ||
                  rec.platform,
                dbId: null,
              });
            }
          }

          send({
            type: "recommendations",
            tab: "wishlist",
            games: enrichedWishlist,
          });
        }

        send({ type: "done" });
      } catch (err) {
        console.error("Discover stream error:", err);
        send({
          type: "error",
          message:
            err instanceof Error ? err.message : "Unknown error occurred",
        });
      } finally {
        controller.close();
      }
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
