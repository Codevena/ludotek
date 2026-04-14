import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/* ── Era buckets ───────────────────────────────────── */
const ERA_BUCKETS = [
  { name: "Dawn of Gaming", range: "1977–1982", minYear: 0, maxYear: 1982 },
  { name: "8-Bit Era", range: "1983–1988", minYear: 1983, maxYear: 1988 },
  { name: "16-Bit Golden Age", range: "1989–1993", minYear: 1989, maxYear: 1993 },
  { name: "The 3D Revolution", range: "1994–1997", minYear: 1994, maxYear: 1997 },
  { name: "The Golden Era", range: "1998–2004", minYear: 1998, maxYear: 2004 },
  { name: "HD Generation", range: "2005–2011", minYear: 2005, maxYear: 2011 },
  { name: "Modern Era", range: "2012–today", minYear: 2012, maxYear: 9999 },
] as const;

/* ── Helpers ───────────────────────────────────────── */

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string" && s.length > 0) : [];
  } catch {
    return [];
  }
}

function countByField(values: string[], top: number): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([name, count]) => ({ name, count }));
}

/* ── Route handler ─────────────────────────────────── */

export async function GET() {
  try {
    const games = await prisma.game.findMany({
      select: {
        title: true,
        platform: true,
        genres: true,
        releaseDate: true,
        franchise: true,
        developer: true,
        publisher: true,
        igdbId: true,
      },
    });

    const totalGames = games.length;

    /* ── Genres ──────────────────────────────────── */
    const allGenres: string[] = [];
    let enrichedGames = 0;
    for (const g of games) {
      if (g.genres || g.igdbId) enrichedGames++;
      for (const genre of parseJsonArray(g.genres)) {
        allGenres.push(genre);
      }
    }
    const topGenres = countByField(allGenres, 10);
    const topGenreTotal = topGenres.reduce((s, g) => s + g.count, 0);
    const otherGenreCount = allGenres.length - topGenreTotal;
    const genres =
      otherGenreCount > 0
        ? [...topGenres, { name: "Other", count: otherGenreCount }]
        : topGenres;

    /* ── Eras ────────────────────────────────────── */
    const eraCounts = new Map<string, number>();
    for (const bucket of ERA_BUCKETS) eraCounts.set(bucket.name, 0);
    let unknownEra = 0;

    for (const g of games) {
      if (!g.releaseDate) {
        unknownEra++;
        continue;
      }
      const year = new Date(g.releaseDate).getFullYear();
      let matched = false;
      for (const bucket of ERA_BUCKETS) {
        if (year >= bucket.minYear && year <= bucket.maxYear) {
          eraCounts.set(bucket.name, (eraCounts.get(bucket.name) ?? 0) + 1);
          matched = true;
          break;
        }
      }
      if (!matched) unknownEra++;
    }

    const eras: { name: string; range: string | null; count: number }[] = ERA_BUCKETS.map((b) => ({
      name: b.name,
      range: b.range,
      count: eraCounts.get(b.name) ?? 0,
    }));
    if (unknownEra > 0) {
      eras.push({ name: "Unknown", range: null, count: unknownEra });
    }

    /* ── Franchises / Developers / Publishers ───── */
    const allFranchises: string[] = [];
    const allDevelopers: string[] = [];
    const allPublishers: string[] = [];
    for (const g of games) {
      if (g.franchise) allFranchises.push(g.franchise);
      if (g.developer) allDevelopers.push(g.developer);
      if (g.publisher) allPublishers.push(g.publisher);
    }
    const franchises = countByField(allFranchises, 10);
    const developers = countByField(allDevelopers, 10);
    const publishers = countByField(allPublishers, 10);

    /* ── Cross-Platform ─────────────────────────── */
    const titlePlatforms = new Map<string, Set<string>>();
    for (const g of games) {
      const existing = titlePlatforms.get(g.title);
      if (existing) {
        existing.add(g.platform);
      } else {
        titlePlatforms.set(g.title, new Set([g.platform]));
      }
    }
    const crossPlatform = Array.from(titlePlatforms.entries())
      .filter(([, platforms]) => platforms.size >= 2)
      .map(([title, platforms]) => ({
        title,
        platforms: Array.from(platforms).sort(),
        count: platforms.size,
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      genres,
      eras,
      franchises,
      developers,
      publishers,
      crossPlatform,
      totalGames,
      enrichedGames,
    });
  } catch (error) {
    console.error("Insights API error:", error);
    return NextResponse.json({ error: "Failed to load insights" }, { status: 500 });
  }
}
