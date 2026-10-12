import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDecryptedSettings } from "@/lib/encryption";
import { fetchIgdbById, searchIgdb, type IgdbGameData } from "@/lib/igdb";
import { searchSteamGridDb } from "@/lib/steamgriddb";
import { generateGameAiContent } from "@/lib/openrouter";
import { cacheGameImages } from "@/lib/image-cache";
import { acquireEnrichment, admissionResponse, AdmissionError, type EnrichmentJob } from "@/lib/job-admission";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const gameId = Number(id);
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(gameId) || gameId <= 0) {
    return NextResponse.json({ error: "Invalid game ID" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { igdbId, generateAi } = body as { igdbId?: unknown; generateAi?: unknown };
  const force = request.nextUrl.searchParams.get("force") === "true";

  if (igdbId !== undefined && (typeof igdbId !== "number" || !Number.isSafeInteger(igdbId) || igdbId <= 0)) {
    return NextResponse.json({ error: "Invalid igdbId" }, { status: 400 });
  }
  if (generateAi !== undefined && typeof generateAi !== "boolean") {
    return NextResponse.json({ error: "Invalid generateAi" }, { status: 400 });
  }

  let job: EnrichmentJob | undefined;
  let response: Response;
  try {
    job = await acquireEnrichment(request);
    const activeJob = job;
    response = await activeJob.run(async () => {
      const game = await prisma.game.findUnique({ where: { id: gameId } });
      if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

      const settings = await getDecryptedSettings();
      const metadataRequested = force || igdbId !== undefined || generateAi !== true;

      if (generateAi && !settings?.openrouterKey) {
        return NextResponse.json({ error: "AI provider is not configured" }, { status: 503 });
      }

      // Determine which igdbId to use: explicit from body, or stored game's igdbId when force=true
      const resolvedIgdbId = igdbId ?? (force && game.igdbId ? game.igdbId : null);

      // Fetch IGDB data: by ID if available, otherwise search by title (same as bulk enricher)
      if (metadataRequested) {
        if (!settings?.igdbClientId || !settings?.igdbClientSecret) {
          return NextResponse.json({ error: "IGDB is not configured" }, { status: 503 });
        }

        let igdbData: IgdbGameData | null;
        let coverUrl: string | null;
        try {
          const options = { bypassCache: force };
          igdbData = resolvedIgdbId
            ? await fetchIgdbById(resolvedIgdbId, settings.igdbClientId, settings.igdbClientSecret, options)
            : await searchIgdb(game.title, game.platform, settings.igdbClientId, settings.igdbClientSecret, options);

          if (!igdbData) {
            return NextResponse.json({ error: "No IGDB metadata found" }, { status: 404 });
          }

          coverUrl = igdbData.coverUrl;
          if (!coverUrl && settings.steamgriddbKey) {
            coverUrl = await searchSteamGridDb(game.title, settings.steamgriddbKey);
          }
        } catch (error) {
          if (error instanceof AdmissionError || activeJob.signal.aborted) throw error;
          console.warn(`Metadata provider failed for game ${gameId}`);
          return NextResponse.json({ error: "Failed to fetch metadata" }, { status: 502 });
        }

        await activeJob.assertActive();
        await prisma.game.update({
          where: { id: gameId },
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

        // Cache images locally after enrichment
        try {
          await cacheGameImages(gameId);
        } catch (cacheErr) {
          if (cacheErr instanceof AdmissionError || activeJob.signal.aborted) throw cacheErr;
          console.warn(`Image caching failed for game ${gameId}:`, cacheErr);
        }
      }

      // Generate AI content if requested
      if (generateAi && settings?.openrouterKey) {
        const updatedGame = await prisma.game.findUnique({ where: { id: gameId } });
        if (updatedGame) {
          const genres: string[] = (() => { try { return JSON.parse(updatedGame.genres || "[]"); } catch { return []; } })();
          const releaseYear = updatedGame.releaseDate ? new Date(updatedGame.releaseDate).getFullYear() : null;

          const aiContent = await generateGameAiContent(
            updatedGame.title, updatedGame.platformLabel, updatedGame.developer,
            releaseYear, genres, updatedGame.summary, settings.openrouterKey,
            undefined, settings.aiLanguage || "en"
          );

          await activeJob.assertActive();
          await prisma.game.update({
            where: { id: gameId },
            data: {
              aiFunFacts: aiContent.funFacts,
              aiStory: aiContent.story,
              aiEnrichedAt: new Date(),
            },
          });
        }
      }

      const finalGame = await prisma.game.findUnique({ where: { id: gameId } });
      return NextResponse.json({ success: true, game: finalGame });
    });
  } catch (error) {
    if (error instanceof AdmissionError) response = admissionResponse(error);
    else {
      console.warn(`Enrichment failed for game ${gameId}`);
      response = NextResponse.json({ error: "Enrichment failed" }, { status: 502 });
    }
  }
  try { await job?.close(); } catch (error) { return admissionResponse(error); }
  return response;
}
