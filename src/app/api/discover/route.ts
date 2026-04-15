import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDecryptedSettings } from "@/lib/encryption";
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
  const authError = requireAuth(request);
  if (authError) return authError;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const platforms = body.platforms as string[] | undefined;
  const genres = body.genres as string[] | undefined;
  const themes = body.themes as string[] | undefined;
  const tab = body.tab as "library" | "wishlist" | undefined;

  // Load settings
  const settings = await getDecryptedSettings();
  if (!settings?.openrouterKey) {
    return NextResponse.json(
      { error: "OpenRouter API key not configured" },
      { status: 400 }
    );
  }

  const safePlatforms = platforms || [];
  const safeGenres = genres || [];
  const safeThemes = themes || [];

  if (!safePlatforms.length || (!safeGenres.length && !safeThemes.length)) {
    return NextResponse.json(
      { error: "Platforms and at least one genre or theme are required" },
      { status: 400 }
    );
  }

  const model =
    process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";
  const language = settings.aiLanguage || "en";

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
          where: { platform: { in: safePlatforms } },
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

        const libraryPrompt = buildLibraryPrompt(gameData, safeGenres, safeThemes, language);
        const aiResponse = await callOpenRouter(
          libraryPrompt,
          settings.openrouterKey,
          model
        );
        const recommendations = parseRecommendations(aiResponse);

        // Enrich library recommendations with DB data (fuzzy matching)
        const enrichedLibrary = [];
        for (const rec of recommendations) {
          const recTitle = rec.title.toLowerCase();
          // Try exact match first, then fuzzy (title contains or starts with)
          const dbGame = games.find(
            (g) => g.title.toLowerCase() === recTitle && g.platform === rec.platform
          ) || games.find(
            (g) => g.title.toLowerCase() === recTitle
          ) || (recTitle.length >= 5 ? games.find(
            (g) => {
              const dbTitle = g.title.toLowerCase();
              return dbTitle.includes(recTitle) || recTitle.includes(dbTitle);
            }
          ) : undefined);
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
            safePlatforms,
            safeGenres,
            safeThemes,
            language
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
