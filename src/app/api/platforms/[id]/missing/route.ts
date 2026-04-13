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
  summary?: string;
  screenshots?: { image_id?: string }[];
  videos?: { video_id?: string }[];
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
      body: `fields name, total_rating, cover.image_id, first_release_date, genres.name, involved_companies.company.name, involved_companies.developer, summary, screenshots.image_id, videos.video_id;
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
    // Normalize titles for fuzzy matching: lowercase, strip punctuation, articles, extra spaces
    const normalize = (title: string): string =>
      title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\b(the|a|an)\b/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const ownedNormalized = ownedGames.map((g) => normalize(g.title));

    // Filter out games already owned (fuzzy normalized match)
    const missingGames = igdbGames.filter((g) => {
      const norm = normalize(g.name);
      return !ownedNormalized.some((owned) =>
        owned === norm ||
        (norm.length >= 5 && (owned.includes(norm) || norm.includes(owned)))
      );
    });

    const result = missingGames.slice(0, 10).map((g) => {
      const coverUrl = g.cover?.image_id
        ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg`
        : null;

      const devCompany = g.involved_companies?.find((c) => c.developer);
      const developer = devCompany?.company?.name ?? null;

      const year = g.first_release_date
        ? new Date(g.first_release_date * 1000).getFullYear()
        : null;

      const genres = g.genres?.map((genre) => genre.name) ?? [];

      const screenshots = (g.screenshots ?? [])
        .filter((s) => s.image_id)
        .slice(0, 4)
        .map(
          (s) =>
            `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${s.image_id}.jpg`
        );

      const videoIds = (g.videos ?? [])
        .filter((v) => v.video_id)
        .slice(0, 2)
        .map((v) => v.video_id as string);

      return {
        title: g.name,
        score: g.total_rating ? Math.round(g.total_rating * 10) / 10 : null,
        coverUrl,
        year,
        developer,
        genres,
        summary: g.summary || null,
        screenshots,
        videoIds,
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
