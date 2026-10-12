import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDecryptedSettings } from "@/lib/encryption";
import { requireAuth } from "@/lib/auth";
import { getIgdbToken } from "@/lib/igdb";
import { providerFetch } from "@/lib/provider-budget";
import { acquireEnrichment, admissionResponse, createEnrichmentStream, AdmissionError, type EnrichmentJob } from "@/lib/job-admission";
import { parseEnrichmentCursor, enrichmentBatchWhere, enrichmentNextCursor } from "@/lib/enrichment-batches";

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
    const where = { igdbId: { not: null }, metacriticScore: null };
    const batchWhere = enrichmentBatchWhere(where, afterId);
    const [games, totalRemaining] = await Promise.all([
      prisma.game.findMany({ where: batchWhere, orderBy: { id: "asc" }, take: 500 }),
      prisma.game.count({ where: batchWhere }),
    ]);
    const nextCursor = enrichmentNextCursor(games, afterId);
    if (!games.length) {
      const remaining = await prisma.game.count({ where });
      await job.close();
      return NextResponse.json({ success: true, processed: 0, updated: 0, skipped: 0, remaining, pending: 0, nextCursor, hasMore: false });
    }
    const activeJob = job;
    return createEnrichmentStream(activeJob, async (send) => {
      send({ type: "start", total: games.length, totalRemaining });
      let updated = 0;
      let skipped = 0;
      let failed = 0;
      let processed = 0;
      let stopped = false;
      try {
        const token = await getIgdbToken(settings.igdbClientId, settings.igdbClientSecret);
        for (let i = 0; i < games.length; i += 50) {
          if (activeJob.signal.aborted) { stopped = true; break; }
          const batch = games.slice(i, i + 50);
          send({ type: "progress", current: processed + 1, total: games.length, title: `Batch ${Math.floor(i / 50) + 1}` });
          try {
            await activeJob.assertActive();
            const response = await providerFetch("igdb", "https://api.igdb.com/v4/games", {
              method: "POST", headers: { "Client-ID": settings.igdbClientId, Authorization: `Bearer ${token}`, "Content-Type": "text/plain" },
              body: `fields id,aggregated_rating; where id = (${batch.map((game) => game.igdbId).join(",")}); limit 500;`,
            });
            if (!response.ok) throw new Error(`IGDB failed: ${response.status}`);
            const results = await response.json() as Array<{ id: number; aggregated_rating?: number }>;
            const scores = new Map(results.map((result) => [result.id, result.aggregated_rating]));
            for (const game of batch) {
              const score = scores.get(game.igdbId!);
              if (score !== undefined && Number.isFinite(score)) {
                await activeJob.assertActive();
                await prisma.game.update({ where: { id: game.id }, data: { metacriticScore: Math.round(score) } });
                updated++;
              } else skipped++;
              processed++;
            }
          } catch (error) {
            if (error instanceof AdmissionError || activeJob.signal.aborted) throw error;
            // Only members not already completed are reported as failed.
            const unprocessed = i + batch.length - processed;
            failed += unprocessed;
            processed += unprocessed;
            console.warn("Metacritic batch fetch failed");
            send({ type: "error", error: error instanceof Error ? error.message : "Unknown", current: processed });
          }
        }
      } catch (error) {
        stopped = true;
        send({ type: "stopped", reason: error instanceof Error ? error.message : "Job cancelled", processed });
      }
      const [remaining, pending] = await Promise.all([
        prisma.game.count({ where }), prisma.game.count({ where: enrichmentBatchWhere(where, nextCursor) }),
      ]);
      send({ type: "done", processed, updated, skipped, failed, remaining, pending, nextCursor, hasMore: !stopped && pending > 0, stopped });
    });
  } catch (error) {
    try { await job?.close(); } catch (closeError) { return admissionResponse(closeError); }
    if (error instanceof AdmissionError) return admissionResponse(error);
    console.warn("Could not start score refresh");
    return NextResponse.json({ error: "Could not start score refresh" }, { status: 503 });
  }
}
