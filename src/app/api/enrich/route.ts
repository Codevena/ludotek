import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDecryptedSettings } from "@/lib/encryption";
import { searchIgdb } from "@/lib/igdb";
import { searchSteamGridDb } from "@/lib/steamgriddb";
import { requireAuth } from "@/lib/auth";
import { cacheGameImages } from "@/lib/image-cache";
import { acquireEnrichment, admissionResponse, createEnrichmentStream, AdmissionError, type EnrichmentJob } from "@/lib/job-admission";
import { PLATFORM_CONFIG } from "@/lib/platforms";
import { parseEnrichmentCursor, enrichmentBatchWhere, enrichmentNextCursor } from "@/lib/enrichment-batches";

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const afterId = parseEnrichmentCursor(request);
  if (afterId === null) return NextResponse.json({ error: "Invalid afterId cursor" }, { status: 400 });

  let platforms: string[] | null = null;
  let force = false;
  const text = await request.text();
  if (text) {
    let body: unknown;
    try { body = JSON.parse(text); } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const input = body as { platforms?: unknown; force?: unknown };
    if (input.platforms !== undefined) {
      if (!Array.isArray(input.platforms) || input.platforms.length > PLATFORM_CONFIG.length ||
          input.platforms.some((p) => typeof p !== "string" || !PLATFORM_CONFIG.some((known) => known.id === p))) {
        return NextResponse.json({ error: "Invalid platforms" }, { status: 400 });
      }
      platforms = input.platforms.length ? Array.from(new Set(input.platforms as string[])) : null;
    }
    if (input.force !== undefined && typeof input.force !== "boolean") {
      return NextResponse.json({ error: "Invalid force" }, { status: 400 });
    }
    force = input.force === true;
  }

  let job: EnrichmentJob | undefined;
  try {
    job = await acquireEnrichment(request);
    const settings = await getDecryptedSettings();
    if (!settings?.igdbClientId || !settings?.igdbClientSecret) {
      await job.close();
      return NextResponse.json({ error: "IGDB credentials not configured" }, { status: 400 });
    }
    const where = { ...(force ? {} : { igdbId: null }), ...(platforms ? { platform: { in: platforms } } : {}) };
    const unfinishedWhere = { igdbId: null, ...(platforms ? { platform: { in: platforms } } : {}) };
    const batchWhere = enrichmentBatchWhere(where, afterId);
    const [games, totalRemaining] = await Promise.all([
      prisma.game.findMany({ where: batchWhere, orderBy: { id: "asc" }, take: 500 }),
      prisma.game.count({ where: batchWhere }),
    ]);
    const nextCursor = enrichmentNextCursor(games, afterId);
    if (!games.length) {
      const remaining = await prisma.game.count({ where: unfinishedWhere });
      await job.close();
      return NextResponse.json({ success: true, processed: 0, enriched: 0, failed: 0, remaining, pending: 0, nextCursor, hasMore: false });
    }
    const activeJob = job;
    return createEnrichmentStream(activeJob, async (send) => {
      send({ type: "start", total: games.length, totalRemaining });
      let enriched = 0;
      let failed = 0;
      let processed = 0;
      let stopped = false;
      for (const game of games) {
        if (activeJob.signal.aborted) { stopped = true; break; }
        send({ type: "progress", current: processed + 1, total: games.length, title: game.title, platform: game.platformLabel });
        try {
          await activeJob.assertActive();
          // Each provider owns retries for individual HTTP attempts.
          const data = await searchIgdb(game.title, game.platform, settings.igdbClientId, settings.igdbClientSecret, { bypassCache: force });
          if (data) {
            let coverUrl = data.coverUrl;
            if (!coverUrl && settings.steamgriddbKey) coverUrl = await searchSteamGridDb(game.title, settings.steamgriddbKey);
            await activeJob.assertActive();
            await prisma.game.update({ where: { id: game.id }, data: {
              igdbId: data.igdbId, coverUrl, igdbScore: data.igdbScore, metacriticScore: data.metacriticScore,
              genres: JSON.stringify(data.genres), developer: data.developer, publisher: data.publisher,
              releaseDate: data.releaseDate, summary: data.summary, screenshotUrls: JSON.stringify(data.screenshotUrls),
              videoIds: JSON.stringify(data.videoIds), artworkUrls: JSON.stringify(data.artworkUrls),
              franchise: data.franchise, themes: JSON.stringify(data.themes),
            } });
            enriched++;
            try { await cacheGameImages(game.id); } catch (error) {
              if (error instanceof AdmissionError || activeJob.signal.aborted) throw error;
              console.warn(`Image caching failed for game ${game.id}`);
            }
            send({ type: "enriched", title: game.title, current: processed + 1 });
          } else {
            failed++;
            send({ type: "missed", title: game.title, current: processed + 1 });
          }
          processed++;
        } catch (error) {
          processed++;
          if (error instanceof AdmissionError || activeJob.signal.aborted) {
            stopped = true;
            send({ type: "stopped", reason: error instanceof Error ? error.message : "Job cancelled", processed });
            break;
          }
          failed++;
          console.warn(`Failed to enrich game ${game.id}`);
          send({ type: "error", title: game.title, error: error instanceof Error ? error.message : "Unknown", current: processed });
        }
      }
      const [remaining, pending] = await Promise.all([
        prisma.game.count({ where: unfinishedWhere }),
        prisma.game.count({ where: enrichmentBatchWhere(where, nextCursor) }),
      ]);
      send({ type: "done", processed, enriched, failed, remaining, pending, nextCursor, hasMore: !stopped && pending > 0, stopped });
    });
  } catch (error) {
    try { await job?.close(); } catch (closeError) { return admissionResponse(closeError); }
    if (error instanceof AdmissionError) return admissionResponse(error);
    console.warn("Could not start enrichment");
    return NextResponse.json({ error: "Could not start enrichment" }, { status: 503 });
  }
}
