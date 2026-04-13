import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getIgdbToken, IGDB_PLATFORM_MAP } from "@/lib/igdb";

interface IgdbMissingGame {
  name: string;
  total_rating?: number;
  cover?: { image_id?: string };
  first_release_date?: number;
  genres?: { name: string }[];
  involved_companies?: {
    developer: boolean;
    company: { name: string };
  }[];
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    if (!settings?.igdbClientId || !settings?.igdbClientSecret) {
      return NextResponse.json(
        { error: "IGDB not configured" },
        { status: 400 }
      );
    }

    const igdbPlatformId = IGDB_PLATFORM_MAP[id];
    if (!igdbPlatformId) {
      return NextResponse.json({ missing: [] });
    }

    const token = await getIgdbToken(
      settings.igdbClientId,
      settings.igdbClientSecret
    );

    const res = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": settings.igdbClientId,
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body: `fields name, total_rating, cover.image_id, first_release_date, genres.name, involved_companies.company.name, involved_companies.developer;
where platforms = (${igdbPlatformId}) & total_rating > 75 & total_rating_count > 10;
sort total_rating desc;
limit 30;`,
    });

    if (!res.ok) {
      console.error("IGDB query failed:", res.status);
      return NextResponse.json(
        { error: "IGDB query failed" },
        { status: 502 }
      );
    }

    const igdbGames = (await res.json()) as IgdbMissingGame[];

    // Get owned game titles for this platform
    const ownedGames = await prisma.game.findMany({
      where: { platform: id },
      select: { title: true },
    });
    const ownedTitles = new Set(
      ownedGames.map((g) => g.title.toLowerCase().trim())
    );

    // Filter out games already owned (fuzzy case-insensitive match)
    const missingGames = igdbGames.filter(
      (g) => !ownedTitles.has(g.name.toLowerCase().trim())
    );

    const result = missingGames.slice(0, 10).map((g) => {
      const coverUrl = g.cover?.image_id
        ? `https://images.igdb.com/igdb/image/upload/t_cover_small/${g.cover.image_id}.jpg`
        : null;

      const devCompany = g.involved_companies?.find((c) => c.developer);
      const developer = devCompany?.company?.name ?? null;

      const year = g.first_release_date
        ? new Date(g.first_release_date * 1000).getFullYear()
        : null;

      const genres = g.genres?.map((genre) => genre.name) ?? [];

      return {
        title: g.name,
        score: g.total_rating ? Math.round(g.total_rating * 10) / 10 : null,
        coverUrl,
        year,
        developer,
        genres,
      };
    });

    return NextResponse.json({ missing: result });
  } catch (error) {
    console.error("Missing games API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch missing games" },
      { status: 500 }
    );
  }
}
