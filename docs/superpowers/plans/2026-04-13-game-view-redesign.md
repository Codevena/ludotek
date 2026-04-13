# Game View Redesign + Re-Enrich Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Game Detail Page with a cinematic hero layout, improve score display on Game Cards, and add a Re-Enrich feature for filling missing IGDB fields.

**Architecture:** Three independent changes: (1) Game Detail Page layout rewrite with hero banner + score bar, (2) Game Card component update with dual score display, (3) New API route + admin button for re-enriching existing games with missing fields.

**Tech Stack:** Next.js 14, TailwindCSS, Prisma 6, IGDB API

**Spec:** `docs/superpowers/specs/2026-04-13-game-view-redesign.md`

---

## File Structure

### Modified Files
| File | Change |
|------|--------|
| `src/app/game/[id]/page.tsx` | Complete layout rewrite — cinematic hero |
| `src/components/game-card.tsx` | Add metacriticScore prop, dual score bar |
| `src/components/game-grid.tsx` | Pass metacriticScore through |
| `src/app/page.tsx` | Pass metacriticScore to GameCard |
| `src/app/platform/[id]/page.tsx` | Pass metacriticScore to GameCard |
| `src/lib/igdb.ts` | Add `fetchIgdbById()` function |
| `src/app/admin/page.tsx` | Add Re-Enrich button |

### New Files
| File | Responsibility |
|------|---------------|
| `src/app/api/enrich/refresh/route.ts` | Re-enrich API with SSE streaming |

---

### Task 1: Game Card — Dual Score Display

**Files:**
- Modify: `src/components/game-card.tsx`
- Modify: `src/components/game-grid.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/platform/[id]/page.tsx`

- [ ] **Step 1: Update GameCard component**

Replace the entire content of `src/components/game-card.tsx`:

```tsx
import Link from "next/link";
import { PlatformTag } from "./platform-tag";

interface GameCardProps {
  id: number;
  title: string;
  coverUrl: string | null;
  platformLabel: string;
  platformColor?: string;
  igdbScore: number | null;
  metacriticScore: number | null;
}

function scoreColor(score: number): string {
  if (score >= 75) return "bg-green-500/15 text-green-400";
  if (score >= 50) return "bg-yellow-500/15 text-yellow-400";
  return "bg-red-500/15 text-red-400";
}

export function GameCard({ id, title, coverUrl, platformLabel, platformColor, igdbScore, metacriticScore }: GameCardProps) {
  return (
    <Link href={`/game/${id}`} className="card group block">
      <div className="aspect-[3/4] bg-vault-bg rounded-lg overflow-hidden mb-3">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-vault-muted text-sm">
            No Cover
          </div>
        )}
      </div>
      <div className="space-y-2">
        <h3 className="font-heading font-semibold text-sm leading-tight line-clamp-2">{title}</h3>
        <PlatformTag label={platformLabel} color={platformColor} />
        {(igdbScore !== null || metacriticScore !== null) && (
          <div className="flex gap-2 pt-1">
            {igdbScore !== null && (
              <div className="flex items-center gap-1.5">
                <div className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs ${scoreColor(Math.round(igdbScore))}`}>
                  {Math.round(igdbScore)}
                </div>
                <span className="text-[8px] text-vault-muted">IGDB</span>
              </div>
            )}
            {metacriticScore !== null && (
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs bg-blue-500/15 text-blue-400">
                  {metacriticScore}
                </div>
                <span className="text-[8px] text-vault-muted">MC</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Update GameGrid to pass metacriticScore**

Replace the entire content of `src/components/game-grid.tsx`:

```tsx
import { GameCard } from "./game-card";

interface Game {
  id: number;
  title: string;
  coverUrl: string | null;
  platformLabel: string;
  igdbScore: number | null;
  metacriticScore: number | null;
}

export function GameGrid({ games }: { games: Game[] }) {
  if (games.length === 0) {
    return (
      <div className="text-center text-vault-muted py-20">
        <p className="text-lg">No games found</p>
        <p className="text-sm mt-2">Try scanning your Steam Deck in the Admin panel</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {games.map((game) => (
        <GameCard
          key={game.id}
          id={game.id}
          title={game.title}
          coverUrl={game.coverUrl}
          platformLabel={game.platformLabel}
          igdbScore={game.igdbScore}
          metacriticScore={game.metacriticScore}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Update page.tsx — pass metacriticScore in RecentlyAdded and TopRated**

In `src/app/page.tsx`, update the `GameCard` usages in `RecentlyAdded` (around line 58) and `TopRated` (around line 78) to include `metacriticScore`:

```tsx
// In both RecentlyAdded and TopRated:
<GameCard key={game.id} id={game.id} title={game.title} coverUrl={game.coverUrl}
  platformLabel={game.platformLabel} igdbScore={game.igdbScore}
  metacriticScore={game.metacriticScore} />
```

The main games grid already uses `GameGrid` which now handles it.

- [ ] **Step 4: Verify type-check and visual**

```bash
pnpm build
```

Expected: Build succeeds. Open http://localhost:3000 — game cards should show dual score squares.

- [ ] **Step 5: Commit**

```bash
git add src/components/game-card.tsx src/components/game-grid.tsx src/app/page.tsx src/app/platform/[id]/page.tsx
git commit -m "feat: add dual IGDB + Metacritic score display on game cards"
```

---

### Task 2: Game Detail Page — Cinematic Hero Layout

**Files:**
- Modify: `src/app/game/[id]/page.tsx`

- [ ] **Step 1: Rewrite the Game Detail Page**

Replace the entire content of `src/app/game/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PlatformTag } from "@/components/platform-tag";
import { ScreenshotGallery } from "@/components/screenshot-gallery";
import { MarkdownContent } from "@/components/markdown-content";
import { EnrichWizard } from "@/components/enrich-wizard";

function safeJsonParse(str: string | null): string[] {
  if (!str) return [];
  try { const parsed = JSON.parse(str); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

function scoreColor(score: number): string {
  if (score >= 75) return "text-green-400";
  if (score >= 50) return "text-yellow-400";
  return "text-red-400";
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GameDetailPage({ params }: Props) {
  const { id } = await params;
  const gameId = parseInt(id, 10);
  if (isNaN(gameId)) notFound();

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) notFound();

  const screenshots = safeJsonParse(game.screenshotUrls);
  const genres = safeJsonParse(game.genres);
  const videoIds = safeJsonParse(game.videoIds);
  const safeVideoIds = videoIds.filter((vid) => /^[a-zA-Z0-9_-]{6,15}$/.test(vid));
  const artworks = safeJsonParse(game.artworkUrls);
  const themes = safeJsonParse(game.themes);

  // Get platform color for gradient fallback
  const platform = await prisma.platform.findUnique({ where: { id: game.platform } });
  const platformColor = platform?.color || "#6366f1";

  const heroImage = artworks[0] || null;

  return (
    <div className="max-w-5xl mx-auto">
      <Link href="/" className="text-vault-muted hover:text-vault-text text-sm mb-6 inline-block">
        &larr; Back to library
      </Link>

      {/* Hero Banner */}
      <div className="relative rounded-xl overflow-hidden mb-0" style={{ height: "280px" }}>
        {heroImage ? (
          <img
            src={heroImage}
            alt={game.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: `linear-gradient(135deg, ${platformColor}33, ${platformColor}11, ${platformColor}33)` }}
          />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-vault-bg" />

        {/* Cover + Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end gap-5">
          <div className="w-24 h-32 bg-vault-surface rounded-lg overflow-hidden border-2 border-vault-border flex-shrink-0 shadow-xl">
            {game.coverUrl ? (
              <img src={game.coverUrl} alt={game.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-vault-muted text-xs">No Cover</div>
            )}
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-white drop-shadow-lg">
              {game.title}
            </h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <PlatformTag label={game.platformLabel} />
              {game.franchise && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-500/20 text-purple-400">
                  {game.franchise}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Score Bar */}
      <div className="flex items-center gap-6 px-4 py-3 border-b border-vault-border">
        {game.igdbScore !== null && game.igdbScore !== undefined && (
          <div className="text-center">
            <div className={`text-2xl font-bold ${scoreColor(Math.round(game.igdbScore))}`}>
              {Math.round(game.igdbScore)}
            </div>
            <div className="text-[10px] text-vault-muted uppercase tracking-wider">IGDB</div>
          </div>
        )}
        {game.metacriticScore !== null && game.metacriticScore !== undefined && (
          <>
            {game.igdbScore !== null && <div className="w-px h-8 bg-vault-border" />}
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{game.metacriticScore}</div>
              <div className="text-[10px] text-vault-muted uppercase tracking-wider">Metacritic</div>
            </div>
          </>
        )}
        {game.releaseDate && (
          <>
            {(game.igdbScore !== null || game.metacriticScore !== null) && <div className="w-px h-8 bg-vault-border" />}
            <div className="text-center">
              <div className="text-2xl font-bold text-vault-amber">
                {new Date(game.releaseDate).getFullYear()}
              </div>
              <div className="text-[10px] text-vault-muted uppercase tracking-wider">Release</div>
            </div>
          </>
        )}
        {(genres.length > 0 || themes.length > 0) && (
          <>
            <div className="flex-1" />
            <div className="flex gap-1.5 flex-wrap justify-end">
              {genres.map((g) => (
                <span key={g} className="text-xs bg-vault-bg px-2.5 py-0.5 rounded-full text-vault-muted">{g}</span>
              ))}
              {themes.map((t) => (
                <span key={t} className="text-xs bg-indigo-500/10 px-2.5 py-0.5 rounded-full text-indigo-400">{t}</span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Info + Summary */}
      <div className="mt-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {game.developer && (
            <div>
              <span className="text-vault-muted text-xs">Developer</span>
              <p>{game.developer}</p>
            </div>
          )}
          {game.publisher && (
            <div>
              <span className="text-vault-muted text-xs">Publisher</span>
              <p>{game.publisher}</p>
            </div>
          )}
          {game.releaseDate && (
            <div>
              <span className="text-vault-muted text-xs">Release Date</span>
              <p>{new Date(game.releaseDate).toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
          )}
        </div>

        {game.summary && (
          <div className="card">
            <h2 className="font-heading font-semibold mb-2">Summary</h2>
            <p className="text-vault-muted text-sm leading-relaxed">{game.summary}</p>
          </div>
        )}
      </div>

      {/* Artwork Gallery */}
      {artworks.length > 1 && (
        <div className="mt-8">
          <h2 className="font-heading text-xl font-bold mb-4">Artwork</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {artworks.slice(1).map((url, i) => (
              <div key={i} className="aspect-video rounded-xl overflow-hidden bg-vault-surface">
                <img src={url} alt={`${game.title} artwork ${i + 2}`} className="w-full h-full object-cover" loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Videos */}
      {safeVideoIds.length > 0 && (
        <div className="mt-8">
          <h2 className="font-heading text-xl font-bold mb-4">Videos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {safeVideoIds.map((ytId) => (
              <div key={ytId} className="aspect-video rounded-xl overflow-hidden bg-vault-surface">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${ytId}`}
                  title="Game Trailer"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Screenshots */}
      {screenshots.length > 0 && (
        <div className="mt-8">
          <h2 className="font-heading text-xl font-bold mb-4">Screenshots</h2>
          <ScreenshotGallery urls={screenshots} />
        </div>
      )}

      {/* AI Content */}
      {game.aiFunFacts && (
        <details className="mt-8 card group" open>
          <summary className="font-heading text-xl font-bold cursor-pointer list-none flex items-center justify-between">
            Fun Facts
            <span className="text-vault-muted text-sm group-open:rotate-180 transition-transform">&#9660;</span>
          </summary>
          <div className="mt-4"><MarkdownContent content={game.aiFunFacts} /></div>
        </details>
      )}

      {game.aiStory && (
        <details className="mt-8 card group" open>
          <summary className="font-heading text-xl font-bold cursor-pointer list-none flex items-center justify-between">
            Story &amp; Background
            <span className="text-vault-muted text-sm group-open:rotate-180 transition-transform">&#9660;</span>
          </summary>
          <div className="mt-4"><MarkdownContent content={game.aiStory} /></div>
        </details>
      )}

      <EnrichWizard gameId={game.id} gameTitle={game.title} />
    </div>
  );
}
```

Key changes from current:
- Hero banner with artwork background + gradient overlay
- Cover overlapping the banner bottom-left
- Dedicated score bar with large numbers (IGDB green, Metacritic blue, Release amber)
- Genres + themes as pills on the right side of score bar
- First artwork used as hero, remaining artworks in gallery (skip index 0)
- Removed ScoreBadge import (no longer used on detail page)

- [ ] **Step 2: Verify type-check and visual**

```bash
pnpm build
```

Expected: Build succeeds. Open http://localhost:3000/game/1 — should show cinematic hero layout.

- [ ] **Step 3: Commit**

```bash
git add src/app/game/[id]/page.tsx
git commit -m "feat: redesign game detail page with cinematic hero layout and score bar"
```

---

### Task 3: IGDB Fetch by ID Function

**Files:**
- Modify: `src/lib/igdb.ts`

- [ ] **Step 1: Add fetchIgdbById function**

Add to the end of `src/lib/igdb.ts` (before the closing of the file), a new exported function:

```ts
/**
 * Fetch IGDB data by known IGDB game ID (for re-enrichment).
 * Same data as searchIgdb but uses direct ID lookup instead of search.
 */
export async function fetchIgdbById(
  igdbId: number,
  clientId: string,
  clientSecret: string
): Promise<IgdbGameData | null> {
  const token = await getIgdbToken(clientId, clientSecret);

  const fields = "fields name,rating,aggregated_rating,genres,first_release_date,summary,cover,involved_companies,screenshots,videos,artworks,franchise,themes;";

  const results = (await igdbQuery(clientId, token, "games",
    `${fields} where id = ${igdbId};`
  )) as Array<{
    id: number; name: string; rating?: number; aggregated_rating?: number; genres?: number[];
    first_release_date?: number; summary?: string; cover?: number;
    involved_companies?: number[]; screenshots?: number[];
    videos?: number[]; artworks?: number[]; franchise?: number; themes?: number[];
  }>;

  if (results.length === 0) return null;

  const game = results[0];

  let coverUrl: string | null = null;
  if (game.cover) {
    const covers = (await igdbQuery(clientId, token, "covers",
      `fields image_id; where id = ${game.cover};`
    )) as Array<{ image_id: string }>;
    if (covers.length > 0) {
      coverUrl = `https://images.igdb.com/igdb/image/upload/t_cover_big/${covers[0].image_id}.jpg`;
    }
  }

  let genreNames: string[] = [];
  if (game.genres && game.genres.length > 0) {
    const genres = (await igdbQuery(clientId, token, "genres",
      `fields name; where id = (${game.genres.join(",")}); limit 10;`
    )) as Array<{ name: string }>;
    genreNames = genres.map((g) => g.name);
  }

  let developer: string | null = null;
  let publisher: string | null = null;
  if (game.involved_companies && game.involved_companies.length > 0) {
    const companies = (await igdbQuery(clientId, token, "involved_companies",
      `fields company,developer,publisher; where id = (${game.involved_companies.join(",")}); limit 10;`
    )) as Array<{ company: number; developer: boolean; publisher: boolean }>;
    const companyIds = companies.map((c) => c.company);
    const companyDetails = (await igdbQuery(clientId, token, "companies",
      `fields name; where id = (${companyIds.join(",")}); limit 10;`
    )) as Array<{ id: number; name: string }>;
    const companyMap = new Map(companyDetails.map((c) => [c.id, c.name]));
    const devCompany = companies.find((c) => c.developer);
    const pubCompany = companies.find((c) => c.publisher);
    if (devCompany) developer = companyMap.get(devCompany.company) || null;
    if (pubCompany) publisher = companyMap.get(pubCompany.company) || null;
  }

  let screenshotUrls: string[] = [];
  if (game.screenshots && game.screenshots.length > 0) {
    const screenshots = (await igdbQuery(clientId, token, "screenshots",
      `fields image_id; where id = (${game.screenshots.slice(0, 4).join(",")}); limit 4;`
    )) as Array<{ image_id: string }>;
    screenshotUrls = screenshots.map(
      (s) => `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${s.image_id}.jpg`
    );
  }

  let videoIds: string[] = [];
  if (game.videos && game.videos.length > 0) {
    const videos = (await igdbQuery(clientId, token, "game_videos",
      `fields video_id; where id = (${game.videos.slice(0, 3).join(",")}); limit 3;`
    )) as Array<{ video_id: string }>;
    videoIds = videos.map((v) => v.video_id);
  }

  let artworkUrls: string[] = [];
  if (game.artworks && game.artworks.length > 0) {
    const artworks = (await igdbQuery(clientId, token, "artworks",
      `fields image_id; where id = (${game.artworks.slice(0, 4).join(",")}); limit 4;`
    )) as Array<{ image_id: string }>;
    artworkUrls = artworks.map(
      (a) => `https://images.igdb.com/igdb/image/upload/t_1080p/${a.image_id}.jpg`
    );
  }

  let franchise: string | null = null;
  if (game.franchise) {
    const franchises = (await igdbQuery(clientId, token, "franchises",
      `fields name; where id = ${game.franchise};`
    )) as Array<{ name: string }>;
    if (franchises.length > 0) franchise = franchises[0].name;
  }

  let themeNames: string[] = [];
  if (game.themes && game.themes.length > 0) {
    const themeResults = (await igdbQuery(clientId, token, "themes",
      `fields name; where id = (${game.themes.join(",")}); limit 10;`
    )) as Array<{ name: string }>;
    themeNames = themeResults.map((t) => t.name);
  }

  return {
    igdbId: game.id,
    coverUrl,
    igdbScore: game.rating ?? null,
    metacriticScore: game.aggregated_rating ? Math.round(game.aggregated_rating) : null,
    genres: genreNames,
    developer,
    publisher,
    releaseDate: game.first_release_date ? new Date(game.first_release_date * 1000) : null,
    summary: game.summary ?? null,
    screenshotUrls,
    videoIds,
    artworkUrls,
    franchise,
    themes: themeNames,
  };
}
```

- [ ] **Step 2: Verify type-check**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/igdb.ts
git commit -m "feat: add fetchIgdbById for direct IGDB lookup by game ID"
```

---

### Task 4: Re-Enrich API Route

**Files:**
- Create: `src/app/api/enrich/refresh/route.ts`

- [ ] **Step 1: Create the re-enrich route**

```ts
// src/app/api/enrich/refresh/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchIgdbById } from "@/lib/igdb";
import { requireAuth } from "@/lib/auth";

const DELAY_MS = parseInt(process.env.ENRICH_DELAY_MS || "500", 10) || 500;

function safeJsonParse(str: string | null): unknown[] {
  if (!str) return [];
  try { const parsed = JSON.parse(str); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

export async function POST(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const settings = await prisma.settings.findFirst({ where: { id: 1 } });
  if (!settings?.igdbClientId || !settings?.igdbClientSecret) {
    return NextResponse.json({ error: "IGDB credentials not configured" }, { status: 400 });
  }

  // Find games that have igdbId but are missing newer fields
  const allEnriched = await prisma.game.findMany({
    where: { igdbId: { not: null } },
  });

  // Filter to games with at least one NULL field that could be filled
  const games = allEnriched.filter((g) => {
    const videos = safeJsonParse(g.videoIds);
    const artworks = safeJsonParse(g.artworkUrls);
    const themes = safeJsonParse(g.themes);
    const screenshots = safeJsonParse(g.screenshotUrls);
    return (
      videos.length === 0 ||
      artworks.length === 0 ||
      g.franchise === null ||
      themes.length === 0 ||
      g.metacriticScore === null ||
      screenshots.length === 0
    );
  });

  if (games.length === 0) {
    return NextResponse.json({ success: true, processed: 0, enriched: 0, failed: 0, remaining: 0 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* Stream closed */ }
      };

      send({ type: "start", total: games.length, totalRemaining: games.length });

      let enriched = 0;
      let failed = 0;

      for (let i = 0; i < games.length; i++) {
        if (request.signal.aborted) break;

        const game = games[i];
        send({
          type: "progress",
          current: i + 1,
          total: games.length,
          title: game.title,
          platform: game.platformLabel,
        });

        try {
          const igdbData = await fetchIgdbById(
            game.igdbId!,
            settings.igdbClientId,
            settings.igdbClientSecret
          );

          if (igdbData) {
            // Only update fields that are currently NULL/empty
            const updates: Record<string, unknown> = {};
            const currentVideos = safeJsonParse(game.videoIds);
            const currentArtworks = safeJsonParse(game.artworkUrls);
            const currentThemes = safeJsonParse(game.themes);
            const currentScreenshots = safeJsonParse(game.screenshotUrls);

            if (currentVideos.length === 0 && igdbData.videoIds.length > 0) {
              updates.videoIds = JSON.stringify(igdbData.videoIds);
            }
            if (currentArtworks.length === 0 && igdbData.artworkUrls.length > 0) {
              updates.artworkUrls = JSON.stringify(igdbData.artworkUrls);
            }
            if (game.franchise === null && igdbData.franchise) {
              updates.franchise = igdbData.franchise;
            }
            if (currentThemes.length === 0 && igdbData.themes.length > 0) {
              updates.themes = JSON.stringify(igdbData.themes);
            }
            if (game.metacriticScore === null && igdbData.metacriticScore !== null) {
              updates.metacriticScore = igdbData.metacriticScore;
            }
            if (currentScreenshots.length === 0 && igdbData.screenshotUrls.length > 0) {
              updates.screenshotUrls = JSON.stringify(igdbData.screenshotUrls);
            }

            if (Object.keys(updates).length > 0) {
              await prisma.game.update({
                where: { id: game.id },
                data: updates,
              });
              enriched++;
              send({ type: "enriched", title: game.title, current: i + 1, fieldsUpdated: Object.keys(updates) });
            } else {
              send({ type: "skipped", title: game.title, current: i + 1 });
            }
          } else {
            send({ type: "missed", title: game.title, current: i + 1 });
          }

          await new Promise((r) => setTimeout(r, DELAY_MS));
        } catch (err) {
          console.warn(`Re-enrich failed for "${game.title}":`, err);
          failed++;
          send({ type: "error", title: game.title, error: err instanceof Error ? err.message : "Unknown", current: i + 1 });
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      const remaining = allEnriched.filter((g) => {
        const videos = safeJsonParse(g.videoIds);
        const artworks = safeJsonParse(g.artworkUrls);
        const themes = safeJsonParse(g.themes);
        return videos.length === 0 || artworks.length === 0 || g.franchise === null || themes.length === 0 || g.metacriticScore === null;
      }).length;

      send({ type: "done", processed: games.length, enriched, failed, remaining });
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
```

- [ ] **Step 2: Verify type-check**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/enrich/refresh/route.ts
git commit -m "feat: add re-enrich API route for filling missing IGDB fields"
```

---

### Task 5: Admin Page — Re-Enrich Button

**Files:**
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Add Re-Enrich button**

In `src/app/admin/page.tsx`, add a new state variable alongside the existing ones (around line 39):

```tsx
const [reEnriching, setReEnriching] = useState(false);
```

Then add a new button in the actions grid. After the "Fetch Critic Scores" / "Cleanup" grid (the `grid-cols-2` section), add:

```tsx
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <button onClick={() => runStreamingAction("/api/enrich/refresh", setReEnriching)}
          disabled={scanning || enriching || aiEnriching || cleaning || reEnriching}
          className={`${btnClass} bg-orange-600 text-white hover:bg-orange-500`}>
          {reEnriching ? "Re-Enriching..." : "Re-Enrich Missing Fields"}
        </button>
      </div>
```

Also add `reEnriching` to the disabled conditions of all other buttons.

- [ ] **Step 2: Verify type-check**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: add Re-Enrich Missing Fields button to admin panel"
```

---

### Task 6: Integration Test

- [ ] **Step 1: Run all tests**

```bash
pnpm test
```

Expected: All tests pass.

- [ ] **Step 2: Run build**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Visual verification**

Start dev server and check:
1. **Homepage** — Game cards show dual score squares (IGDB green + Metacritic blue)
2. **Game Detail** — Cinematic hero with artwork banner, overlapping cover, score bar
3. **Game Detail without artwork** — Gradient fallback banner
4. **Admin** — "Re-Enrich Missing Fields" orange button visible
5. **Platform page** — Game cards show dual scores

- [ ] **Step 4: Commit if fixes needed**

```bash
git add -A
git commit -m "fix: integration fixes for game view redesign"
```
