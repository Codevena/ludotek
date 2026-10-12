import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDecryptedSettings } from "@/lib/encryption";
import { getIgdbToken, IGDB_PLATFORM_MAP } from "@/lib/igdb";
import { requireAuth } from "@/lib/auth";
import { PLATFORM_CONFIG } from "@/lib/platforms";
import { providerFetch } from "@/lib/provider-budget";
import { acquireScopedJob, admissionResponse, AdmissionError, type EnrichmentJob } from "@/lib/job-admission";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = requireAuth(request);
  if (authError) return authError;
  const { id } = await params;
  if (!PLATFORM_CONFIG.some((platform) => platform.id === id)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }
  const igdbPlatformId = IGDB_PLATFORM_MAP[id];
  if (!igdbPlatformId) return NextResponse.json({ missing: [] }, { headers: { "Cache-Control": "no-store" } });
  let job: EnrichmentJob | undefined;
  let response: Response;
  try {
    const cacheKey = `missing:candidates:v1:${id}`;
    const readCandidates = async (): Promise<IgdbMissingGame[] | null> => {
      const cached = await prisma.apiCache.findFirst({ where: { cacheKey, expiresAt: { gt: new Date() } } });
      if (!cached) return null;
      try {
        const parsed: unknown = JSON.parse(cached.response);
        return Array.isArray(parsed) && parsed.every((game) => game && typeof game.name === "string") ? parsed : null;
      } catch { return null; }
    };
    let igdbGames = await readCandidates();
    if (!igdbGames) {
      job = await acquireScopedJob(`missing:${id}`, request);
      const activeJob = job;
      igdbGames = await activeJob.run(async () => {
        // Another process may have completed the cache between the first read and acquisition.
        const cached = await readCandidates();
        if (cached) return cached;
        const settings = await getDecryptedSettings();
        if (!settings?.igdbClientId || !settings?.igdbClientSecret) throw new AdmissionError(503, "IGDB not configured");
        const token = await getIgdbToken(settings.igdbClientId, settings.igdbClientSecret);
        const res = await providerFetch("igdb", "https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": settings.igdbClientId,
        Authorization: `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body: `fields name, total_rating, cover.image_id, first_release_date, genres.name, involved_companies.company.name, involved_companies.developer, summary, screenshots.image_id, videos.video_id;
where platforms = (${igdbPlatformId}) & total_rating > 75 & total_rating_count > 50;
sort total_rating desc;
limit 30;`,
        });
        if (!res.ok) throw new Error(`IGDB query failed: ${res.status}`);
        const candidates: unknown = await res.json();
        if (!Array.isArray(candidates) || candidates.length > 30 || candidates.some((game) => !game || typeof game.name !== "string")) {
          throw new Error("Invalid IGDB candidates");
        }
        await activeJob.assertActive();
        const response = JSON.stringify(candidates);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await prisma.apiCache.upsert({ where: { cacheKey }, update: { response, expiresAt }, create: { cacheKey, response, expiresAt } });
        return candidates as IgdbMissingGame[];
      });
    }

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
        (norm.length >= 5 && owned.length >= 5 && (owned.includes(norm) || norm.includes(owned)))
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

    response = NextResponse.json({ missing: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdmissionError) response = admissionResponse(error);
    else {
      console.warn("Missing games provider request failed");
      response = NextResponse.json({ error: "Failed to fetch missing games" }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }
  }
  try { await job?.close(); } catch (error) { return admissionResponse(error); }
  return response;
}
