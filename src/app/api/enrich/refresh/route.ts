import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDecryptedSettings } from "@/lib/encryption";
import { fetchIgdbById } from "@/lib/igdb";
import { requireAuth } from "@/lib/auth";
import { cacheGameImages } from "@/lib/image-cache";
import { acquireEnrichment, admissionResponse, createEnrichmentStream, AdmissionError, type EnrichmentJob } from "@/lib/job-admission";
import { parseEnrichmentCursor, enrichmentBatchWhere, enrichmentNextCursor } from "@/lib/enrichment-batches";

function safeJsonParse(value: string | null): unknown[] {
  try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const afterId = parseEnrichmentCursor(request);
  if (afterId === null) return NextResponse.json({ error: "Invalid afterId cursor" }, { status: 400 });
  let job: EnrichmentJob | undefined;
  try {
    job = await acquireEnrichment(request);
    const settings = await getDecryptedSettings();
    if (!settings?.igdbClientId || !settings?.igdbClientSecret) {
      await job.close();
      return NextResponse.json({ error: "IGDB credentials not configured" }, { status: 400 });
    }
    const where = { igdbId: { not: null }, OR: [
      { metacriticScore: null }, { franchise: null }, { franchise: "" },
      { videoIds: null }, { videoIds: "[]" }, { videoIds: "" },
      { artworkUrls: null }, { artworkUrls: "[]" }, { artworkUrls: "" },
      { themes: null }, { themes: "[]" }, { themes: "" },
      { screenshotUrls: null }, { screenshotUrls: "[]" }, { screenshotUrls: "" },
    ] };
    const batchWhere = enrichmentBatchWhere(where, afterId);
    const [games, totalRemaining] = await Promise.all([
      prisma.game.findMany({ where: batchWhere, orderBy: { id: "asc" }, take: 500 }),
      prisma.game.count({ where: batchWhere }),
    ]);
    const nextCursor = enrichmentNextCursor(games, afterId);
    if (!games.length) {
      const remaining = await prisma.game.count({ where });
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
          const data = await fetchIgdbById(game.igdbId!, settings.igdbClientId, settings.igdbClientSecret);
          if (data) {
            const update: Record<string, unknown> = {};
            if (game.metacriticScore == null && data.metacriticScore != null) update.metacriticScore = data.metacriticScore;
            if (!game.franchise && data.franchise) update.franchise = data.franchise;
            for (const field of ["videoIds", "artworkUrls", "themes", "screenshotUrls"] as const) {
              if (!safeJsonParse(game[field]).length && data[field].length) update[field] = JSON.stringify(data[field]);
            }
            if (Object.keys(update).length) {
              await activeJob.assertActive();
              await prisma.game.update({ where: { id: game.id }, data: update });
              enriched++;
              try { await cacheGameImages(game.id); } catch (error) {
                if (error instanceof AdmissionError || activeJob.signal.aborted) throw error;
                console.warn(`Image caching failed for game ${game.id}`);
              }
              send({ type: "enriched", title: game.title, current: processed + 1, fieldsUpdated: Object.keys(update) });
            } else send({ type: "skipped", title: game.title, current: processed + 1 });
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
          console.warn(`Failed to refresh game ${game.id}`);
          send({ type: "error", title: game.title, error: error instanceof Error ? error.message : "Unknown", current: processed });
        }
      }
      const [remaining, pending] = await Promise.all([
        prisma.game.count({ where }), prisma.game.count({ where: enrichmentBatchWhere(where, nextCursor) }),
      ]);
      send({ type: "done", processed, enriched, failed, remaining, pending, nextCursor, hasMore: !stopped && pending > 0, stopped });
    });
  } catch (error) {
    try { await job?.close(); } catch (closeError) { return admissionResponse(closeError); }
    if (error instanceof AdmissionError) return admissionResponse(error);
    console.warn("Could not start metadata refresh");
    return NextResponse.json({ error: "Could not start metadata refresh" }, { status: 503 });
  }
}
