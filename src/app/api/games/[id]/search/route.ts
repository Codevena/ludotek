import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDecryptedSettings } from "@/lib/encryption";
import { IGDB_PLATFORM_MAP } from "@/lib/igdb";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const gameId = parseInt(id, 10);
  if (isNaN(gameId)) return NextResponse.json({ error: "Invalid game ID" }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const settings = await getDecryptedSettings();
  if (!settings?.igdbClientId || !settings?.igdbClientSecret) {
    return NextResponse.json({ error: "IGDB not configured" }, { status: 400 });
  }

  const searchTitle = query || game.title;

  // Get IGDB token
  const tokenRes = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${settings.igdbClientId}&client_secret=${settings.igdbClientSecret}&grant_type=client_credentials`,
    { method: "POST" }
  );
  if (!tokenRes.ok) return NextResponse.json({ error: "IGDB auth failed" }, { status: 500 });
  const { access_token } = await tokenRes.json();

  // Search IGDB
  const platformId = IGDB_PLATFORM_MAP[game.platform];
  const body = platformId
    ? `search "${searchTitle.replace(/"/g, '\\"')}"; fields name,rating,cover,first_release_date,summary; where platforms = (${platformId}); limit 10;`
    : `search "${searchTitle.replace(/"/g, '\\"')}"; fields name,rating,cover,first_release_date,summary; limit 10;`;

  const gamesRes = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": settings.igdbClientId,
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "text/plain",
    },
    body,
  });

  if (!gamesRes.ok) return NextResponse.json({ error: "IGDB search failed" }, { status: 500 });
  const results = await gamesRes.json();

  // Fetch covers for each result
  const coverIds = results.filter((r: { cover?: number }) => r.cover).map((r: { cover: number }) => r.cover);
  let coverMap = new Map<number, string>();

  if (coverIds.length > 0) {
    const coversRes = await fetch("https://api.igdb.com/v4/covers", {
      method: "POST",
      headers: {
        "Client-ID": settings.igdbClientId,
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "text/plain",
      },
      body: `fields id,image_id; where id = (${coverIds.join(",")}); limit 20;`,
    });
    if (!coversRes.ok) return NextResponse.json({ error: "IGDB covers fetch failed" }, { status: 500 });
    const covers = await coversRes.json();
    coverMap = new Map(covers.map((c: { id: number; image_id: string }) => [
      c.id,
      `https://images.igdb.com/igdb/image/upload/t_cover_big/${c.image_id}.jpg`,
    ]));
  }

  const enrichedResults = results.map((r: { id: number; name: string; rating?: number; cover?: number; first_release_date?: number; summary?: string }) => ({
    igdbId: r.id,
    name: r.name,
    rating: r.rating || null,
    coverUrl: r.cover ? coverMap.get(r.cover) || null : null,
    releaseDate: r.first_release_date ? new Date(r.first_release_date * 1000).toISOString() : null,
    summary: r.summary || null,
  }));

  return NextResponse.json({ results: enrichedResults, searchQuery: searchTitle });
}
