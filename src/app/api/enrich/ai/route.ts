import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDecryptedSettings } from "@/lib/encryption";
import { generateGameAiContent } from "@/lib/openrouter";
import { requireAuth } from "@/lib/auth";
import { acquireEnrichment, admissionResponse, createEnrichmentStream, AdmissionError, type EnrichmentJob } from "@/lib/job-admission";
import { parseEnrichmentCursor, enrichmentBatchWhere, enrichmentNextCursor } from "@/lib/enrichment-batches";

function aiConcurrency(): number | null {
  const configured = process.env.AI_CONCURRENCY ?? "2";
  if (!/^[1-4]$/.test(configured)) return null;
  return Math.min(Number(configured), 2);
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const afterId = parseEnrichmentCursor(request);
  if (afterId === null) return NextResponse.json({ error: "Invalid afterId cursor" }, { status: 400 });
  const concurrency = aiConcurrency();
  if (!concurrency) return NextResponse.json({ error: "AI_CONCURRENCY must be an integer from 1 to 4" }, { status: 503 });

  let job: EnrichmentJob | undefined;
  try {
    job = await acquireEnrichment(request);
    const settings = await getDecryptedSettings();
    if (!settings?.openrouterKey) {
      await job.close();
      return NextResponse.json({ error: "OpenRouter API key not configured" }, { status: 400 });
    }
    const where = { igdbId: { not: null }, aiFunFacts: null };
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
      for (let i = 0; i < games.length; i += concurrency) {
        if (activeJob.signal.aborted) { stopped = true; break; }
        const batch = games.slice(i, i + concurrency);
        send({ type: "progress", current: processed + 1, total: games.length, title: batch.map((g) => g.title).join(", "), platform: batch[0].platformLabel, batchSize: batch.length });
        // Drain every already-started member before releasing the shared lease.
        const results = await Promise.allSettled(batch.map(async (game) => {
          try {
          await activeJob.assertActive();
          let genres: string[] = [];
          try { const parsed = JSON.parse(game.genres || "[]"); if (Array.isArray(parsed)) genres = parsed.filter((g) => typeof g === "string"); } catch { /* Empty input */ }
          const data = await generateGameAiContent(game.title, game.platformLabel, game.developer,
            game.releaseDate ? new Date(game.releaseDate).getFullYear() : null, genres, game.summary,
            settings.openrouterKey, undefined, settings.aiLanguage || "en");
          await activeJob.assertActive();
          await prisma.game.update({ where: { id: game.id }, data: { aiFunFacts: data.funFacts, aiStory: data.story, aiEnrichedAt: new Date() } });
          return game.title;
          } catch (error) {
            if (error instanceof AdmissionError || activeJob.signal.aborted) activeJob.abort(error);
            throw error;
          }
        }));
        for (let j = 0; j < results.length; j++) {
          processed++;
          const result = results[j];
          if (result.status === "fulfilled") {
            enriched++;
            send({ type: "enriched", title: result.value, current: processed });
          } else if (result.reason instanceof AdmissionError || activeJob.signal.aborted) {
            stopped = true;
            send({ type: "stopped", title: batch[j].title, reason: result.reason instanceof Error ? result.reason.message : "Job cancelled", processed });
          } else {
            failed++;
            console.warn(`AI enrichment failed for game ${batch[j].id}`);
            send({ type: "error", title: batch[j].title, error: result.reason instanceof Error ? result.reason.message : "Unknown", current: processed });
          }
        }
        if (stopped) break;
      }
      const [remaining, pending] = await Promise.all([
        prisma.game.count({ where }), prisma.game.count({ where: enrichmentBatchWhere(where, nextCursor) }),
      ]);
      send({ type: "done", processed, enriched, failed, remaining, pending, nextCursor, hasMore: !stopped && pending > 0, stopped });
    });
  } catch (error) {
    try { await job?.close(); } catch (closeError) { return admissionResponse(closeError); }
    if (error instanceof AdmissionError) return admissionResponse(error);
    console.warn("Could not start AI enrichment");
    return NextResponse.json({ error: "Could not start AI enrichment" }, { status: 503 });
  }
}
