import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateGameAiContent } from "@/lib/openrouter";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const gameId = parseInt(id, 10);
  if (isNaN(gameId)) return NextResponse.json({ error: "Invalid game ID" }, { status: 400 });

  const body = await request.json();
  const { igdbId, generateAi } = body;

  if (igdbId && typeof igdbId !== "number") return NextResponse.json({ error: "Invalid igdbId" }, { status: 400 });

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const settings = await prisma.settings.findFirst({ where: { id: 1 } });

  // If igdbId provided, fetch full data from IGDB for that specific game
  if (igdbId && settings?.igdbClientId && settings?.igdbClientSecret) {
    const tokenRes = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${settings.igdbClientId}&client_secret=${settings.igdbClientSecret}&grant_type=client_credentials`,
      { method: "POST" }
    );
    if (!tokenRes.ok) return NextResponse.json({ error: "IGDB auth failed" }, { status: 500 });
    const { access_token } = await tokenRes.json();

    const query = `fields name,rating,genres,first_release_date,summary,cover,involved_companies,screenshots; where id = ${igdbId}; limit 1;`;
    const gamesRes = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": settings.igdbClientId,
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "text/plain",
      },
      body: query,
    });
    if (!gamesRes.ok) return NextResponse.json({ error: "IGDB games fetch failed" }, { status: 500 });
    const results = await gamesRes.json();

    if (results.length > 0) {
      const igdbGame = results[0];

      // Fetch cover
      let coverUrl: string | null = null;
      if (igdbGame.cover) {
        const coversRes = await fetch("https://api.igdb.com/v4/covers", {
          method: "POST",
          headers: { "Client-ID": settings.igdbClientId, Authorization: `Bearer ${access_token}`, "Content-Type": "text/plain" },
          body: `fields image_id; where id = ${igdbGame.cover};`,
        });
        if (!coversRes.ok) return NextResponse.json({ error: "IGDB covers fetch failed" }, { status: 500 });
        const covers = await coversRes.json();
        if (covers.length > 0) {
          coverUrl = `https://images.igdb.com/igdb/image/upload/t_cover_big/${covers[0].image_id}.jpg`;
        }
      }

      // Fetch genres
      let genreNames: string[] = [];
      if (igdbGame.genres?.length) {
        const genresRes = await fetch("https://api.igdb.com/v4/genres", {
          method: "POST",
          headers: { "Client-ID": settings.igdbClientId, Authorization: `Bearer ${access_token}`, "Content-Type": "text/plain" },
          body: `fields name; where id = (${igdbGame.genres.join(",")}); limit 10;`,
        });
        if (!genresRes.ok) return NextResponse.json({ error: "IGDB genres fetch failed" }, { status: 500 });
        const genres = await genresRes.json();
        genreNames = genres.map((g: { name: string }) => g.name);
      }

      // Fetch companies
      let developer: string | null = null;
      let publisher: string | null = null;
      if (igdbGame.involved_companies?.length) {
        const companiesRes = await fetch("https://api.igdb.com/v4/involved_companies", {
          method: "POST",
          headers: { "Client-ID": settings.igdbClientId, Authorization: `Bearer ${access_token}`, "Content-Type": "text/plain" },
          body: `fields company,developer,publisher; where id = (${igdbGame.involved_companies.join(",")}); limit 10;`,
        });
        if (!companiesRes.ok) return NextResponse.json({ error: "IGDB companies fetch failed" }, { status: 500 });
        const companies = await companiesRes.json();
        const companyIds = companies.map((c: { company: number }) => c.company);
        if (companyIds.length > 0) {
          const detailsRes = await fetch("https://api.igdb.com/v4/companies", {
            method: "POST",
            headers: { "Client-ID": settings.igdbClientId, Authorization: `Bearer ${access_token}`, "Content-Type": "text/plain" },
            body: `fields name; where id = (${companyIds.join(",")}); limit 10;`,
          });
          if (!detailsRes.ok) return NextResponse.json({ error: "IGDB company details fetch failed" }, { status: 500 });
          const details = await detailsRes.json();
          const companyMap = new Map(details.map((c: { id: number; name: string }) => [c.id, c.name]));
          const dev = companies.find((c: { developer: boolean }) => c.developer);
          const pub = companies.find((c: { publisher: boolean }) => c.publisher);
          if (dev) developer = (companyMap.get(dev.company) as string) || null;
          if (pub) publisher = (companyMap.get(pub.company) as string) || null;
        }
      }

      // Fetch screenshots
      let screenshotUrls: string[] = [];
      if (igdbGame.screenshots?.length) {
        const screenshotsRes = await fetch("https://api.igdb.com/v4/screenshots", {
          method: "POST",
          headers: { "Client-ID": settings.igdbClientId, Authorization: `Bearer ${access_token}`, "Content-Type": "text/plain" },
          body: `fields image_id; where id = (${igdbGame.screenshots.slice(0, 4).join(",")}); limit 4;`,
        });
        if (!screenshotsRes.ok) return NextResponse.json({ error: "IGDB screenshots fetch failed" }, { status: 500 });
        const screenshots = await screenshotsRes.json();
        screenshotUrls = screenshots.map((s: { image_id: string }) =>
          `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${s.image_id}.jpg`
        );
      }

      await prisma.game.update({
        where: { id: gameId },
        data: {
          igdbId: igdbGame.id,
          coverUrl,
          igdbScore: igdbGame.rating ?? null,
          genres: JSON.stringify(genreNames),
          developer,
          publisher,
          releaseDate: igdbGame.first_release_date ? new Date(igdbGame.first_release_date * 1000) : null,
          summary: igdbGame.summary ?? null,
          screenshotUrls: JSON.stringify(screenshotUrls),
        },
      });
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
        releaseYear, genres, updatedGame.summary, settings.openrouterKey
      );

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
}
