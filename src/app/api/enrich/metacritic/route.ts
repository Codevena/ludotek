import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDecryptedSettings } from "@/lib/encryption";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const settings = await getDecryptedSettings();
  if (!settings?.igdbClientId || !settings?.igdbClientSecret) {
    return NextResponse.json({ error: "IGDB credentials not configured" }, { status: 400 });
  }

  // Find games with IGDB ID but no metacritic score
  const games = await prisma.game.findMany({
    where: { igdbId: { not: null }, metacriticScore: null },
  });

  if (games.length === 0) {
    return NextResponse.json({ success: true, processed: 0, updated: 0, remaining: 0 });
  }

  // Get IGDB token
  const tokenRes = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${settings.igdbClientId}&client_secret=${settings.igdbClientSecret}&grant_type=client_credentials`,
    { method: "POST" }
  );
  if (!tokenRes.ok) {
    return NextResponse.json({ error: "IGDB auth failed" }, { status: 500 });
  }
  const { access_token } = await tokenRes.json();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* stream closed */ }
      };

      send({ type: "start", total: games.length });

      let updated = 0;
      let skipped = 0;

      // Batch fetch: IGDB allows up to 500 IDs per query
      for (let i = 0; i < games.length; i += 50) {
        if (request.signal.aborted) break;

        const batch = games.slice(i, i + 50);
        const igdbIds = batch.map((g) => g.igdbId).filter(Boolean);

        send({ type: "progress", current: i + 1, total: games.length, title: `Batch ${Math.floor(i / 50) + 1}` });

        try {
          const res = await fetch("https://api.igdb.com/v4/games", {
            method: "POST",
            headers: {
              "Client-ID": settings.igdbClientId,
              Authorization: `Bearer ${access_token}`,
              "Content-Type": "text/plain",
            },
            body: `fields id,aggregated_rating; where id = (${igdbIds.join(",")}); limit 500;`,
          });

          if (!res.ok) throw new Error(`IGDB failed: ${res.status}`);

          const results = (await res.json()) as Array<{ id: number; aggregated_rating?: number }>;
          const scoreMap = new Map(results.map((r) => [r.id, r.aggregated_rating]));

          for (const game of batch) {
            const score = scoreMap.get(game.igdbId!);
            if (score !== undefined && score !== null) {
              await prisma.game.update({
                where: { id: game.id },
                data: { metacriticScore: Math.round(score) },
              });
              updated++;
            } else {
              skipped++;
            }
          }

          // Rate limit
          await new Promise((r) => setTimeout(r, 300));
        } catch (err) {
          console.warn("Metacritic batch fetch failed:", err);
          skipped += batch.length;
        }
      }

      send({ type: "done", processed: games.length, updated, skipped, remaining: 0 });
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
