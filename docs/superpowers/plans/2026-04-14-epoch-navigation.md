# Epoch-Navigation (Timeline) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/timeline` page that groups games by gaming era with a sticky era pill bar, era-colored background gradients, and the existing InfiniteGameGrid for browsing.

**Architecture:** Extract shared era constants into `src/lib/eras.ts`. Add `era` filter to existing `/api/games` endpoint. New lightweight `/api/timeline/counts` endpoint for pill counts. Client-side `/timeline` page composes `EraBar` + `EraHeader` + existing `InfiniteGameGrid`.

**Tech Stack:** Next.js 14 App Router, Prisma 6 (SQLite), Tailwind CSS, TypeScript

**Design Spec:** `docs/superpowers/specs/2026-04-14-epoch-navigation-design.md`

---

### Task 1: Extract shared era constants (`src/lib/eras.ts`)

**Files:**
- Create: `src/lib/eras.ts`
- Modify: `src/app/api/insights/route.ts` (lines 7–15 — replace local ERA_BUCKETS with import)

- [ ] **Step 1: Create `src/lib/eras.ts`**

```typescript
export const ERA_BUCKETS = [
  { name: "Dawn of Gaming", slug: "dawn-of-gaming", shortName: "Dawn", range: "1977–1982", minYear: 1977, maxYear: 1982, color: "#92400e" },
  { name: "8-Bit Era", slug: "8-bit-era", shortName: "8-Bit", range: "1983–1988", minYear: 1983, maxYear: 1988, color: "#dc2626" },
  { name: "16-Bit Golden Age", slug: "16-bit-golden-age", shortName: "16-Bit", range: "1989–1993", minYear: 1989, maxYear: 1993, color: "#7c3aed" },
  { name: "The 3D Revolution", slug: "3d-revolution", shortName: "3D", range: "1994–1997", minYear: 1994, maxYear: 1997, color: "#6b7280" },
  { name: "The Golden Era", slug: "golden-era", shortName: "Golden", range: "1998–2004", minYear: 1998, maxYear: 2004, color: "#ea580c" },
  { name: "HD Generation", slug: "hd-generation", shortName: "HD", range: "2005–2011", minYear: 2005, maxYear: 2011, color: "#16a34a" },
  { name: "Modern Era", slug: "modern-era", shortName: "Modern", range: "2012–today", minYear: 2012, maxYear: 9999, color: "#e11d48" },
] as const;

export type EraBucket = (typeof ERA_BUCKETS)[number];
export type EraSlug = EraBucket["slug"];

export function findEraBySlug(slug: string): EraBucket | undefined {
  return ERA_BUCKETS.find((e) => e.slug === slug);
}
```

- [ ] **Step 2: Update insights route to import from shared module**

In `src/app/api/insights/route.ts`, replace the local `ERA_BUCKETS` const (lines 7–15) with:

```typescript
import { ERA_BUCKETS } from "@/lib/eras";
```

Remove the old local `const ERA_BUCKETS = [ ... ] as const;` block entirely.

- [ ] **Step 3: Verify build passes**

Run: `pnpm build`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/eras.ts src/app/api/insights/route.ts
git commit -m "refactor: extract ERA_BUCKETS into shared src/lib/eras.ts"
```

---

### Task 2: Add `era` filter to `/api/games`

**Files:**
- Modify: `src/app/api/games/route.ts` (add import + era filter logic after line 18)

- [ ] **Step 1: Add era filter to games route**

In `src/app/api/games/route.ts`, add the import at the top:

```typescript
import { findEraBySlug } from "@/lib/eras";
```

After line 18 (`const deviceId = searchParams.get("deviceId");`), add:

```typescript
  const era = searchParams.get("era");
```

After the `deviceId` filter block (after line 35), add the era filter:

```typescript
  if (era) {
    const bucket = findEraBySlug(era);
    if (bucket) {
      where.releaseDate = {
        gte: new Date(bucket.minYear, 0, 1),
        lt: new Date(bucket.maxYear === 9999 ? 2100 : bucket.maxYear + 1, 0, 1),
        not: null,
      };
    }
  }
```

- [ ] **Step 2: Verify build passes**

Run: `pnpm build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/games/route.ts
git commit -m "feat(api): add era query parameter to /api/games"
```

---

### Task 3: Create `/api/timeline/counts` endpoint

**Files:**
- Create: `src/app/api/timeline/counts/route.ts`

- [ ] **Step 1: Create the counts endpoint**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ERA_BUCKETS } from "@/lib/eras";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const games = await prisma.game.findMany({
      where: { releaseDate: { not: null } },
      select: { releaseDate: true },
    });

    const counts = ERA_BUCKETS.map((bucket) => {
      const count = games.filter((g) => {
        const year = new Date(g.releaseDate!).getFullYear();
        return year >= bucket.minYear && year <= bucket.maxYear;
      }).length;
      return { slug: bucket.slug, count };
    });

    return NextResponse.json(counts);
  } catch (error) {
    console.error("Timeline counts error:", error);
    return NextResponse.json({ error: "Failed to load counts" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify build passes**

Run: `pnpm build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/timeline/counts/route.ts
git commit -m "feat(api): add /api/timeline/counts endpoint"
```

---

### Task 4: Create `EraBar` component

**Files:**
- Create: `src/components/timeline/era-bar.tsx`

- [ ] **Step 1: Create the EraBar component**

```typescript
"use client";

import { type EraSlug } from "@/lib/eras";

interface EraInfo {
  slug: EraSlug;
  shortName: string;
  count: number;
  color: string;
}

interface EraBarProps {
  eras: EraInfo[];
  activeEra: EraSlug;
  onEraChange: (slug: EraSlug) => void;
}

export function EraBar({ eras, activeEra, onEraChange }: EraBarProps) {
  return (
    <div className="sticky top-0 z-10 bg-vault-bg/80 backdrop-blur-sm border-b border-vault-border py-3 px-1 -mx-1">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {eras.map((era) => {
          const isActive = era.slug === activeEra;
          return (
            <button
              key={era.slug}
              onClick={() => onEraChange(era.slug)}
              className="flex-shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200"
              style={{
                background: `${era.color}${isActive ? "40" : "1a"}`,
                color: era.color,
                border: `${isActive ? "2px" : "1px"} solid ${era.color}${isActive ? "" : "4d"}`,
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {era.shortName} · {era.count}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `pnpm build`
Expected: Build succeeds (component not yet used, but must compile).

- [ ] **Step 3: Commit**

```bash
git add src/components/timeline/era-bar.tsx
git commit -m "feat(timeline): add EraBar sticky pill component"
```

---

### Task 5: Create `EraHeader` component

**Files:**
- Create: `src/components/timeline/era-header.tsx`

- [ ] **Step 1: Create the EraHeader component**

```typescript
"use client";

import { type EraBucket } from "@/lib/eras";

interface EraHeaderProps {
  era: EraBucket;
  gameCount: number;
  platforms: string[];
}

export function EraHeader({ era, gameCount, platforms }: EraHeaderProps) {
  return (
    <div className="mb-6 mt-4">
      <div className="flex items-baseline gap-3 mb-1">
        <h2
          className="font-heading text-xl font-bold"
          style={{ color: era.color }}
        >
          {era.name}
        </h2>
        <span className="text-sm text-vault-muted">{era.range}</span>
      </div>
      <p className="text-sm text-vault-muted mb-3">
        {gameCount} Spiele
      </p>
      {platforms.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {platforms.map((p) => (
            <span
              key={p}
              className="text-xs rounded-full px-2.5 py-0.5"
              style={{
                background: `${era.color}1a`,
                color: era.color,
              }}
            >
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `pnpm build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/timeline/era-header.tsx
git commit -m "feat(timeline): add EraHeader component"
```

---

### Task 6: Create `/timeline` page

**Files:**
- Create: `src/app/timeline/page.tsx`

- [ ] **Step 1: Create the timeline page**

```typescript
"use client";

import { useState, useEffect, useMemo } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { EraBar } from "@/components/timeline/era-bar";
import { EraHeader } from "@/components/timeline/era-header";
import { InfiniteGameGrid } from "@/components/infinite-game-grid";
import { SortSelect } from "@/components/sort-select";
import { ERA_BUCKETS, findEraBySlug, type EraSlug } from "@/lib/eras";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

interface EraCount {
  slug: EraSlug;
  count: number;
}

interface Game {
  id: number;
  title: string;
  coverUrl: string | null;
  localCoverPath?: string | null;
  platformLabel: string;
  igdbScore: number | null;
  metacriticScore: number | null;
  isFavorite?: boolean;
  devices?: { id: number; name: string; type: string }[];
}

function TimelineContent() {
  const searchParams = useSearchParams();
  const sort = searchParams.get("sort") || "igdbScore";
  const order = searchParams.get("order") || "desc";
  const search = searchParams.get("search") || "";

  const [eraCounts, setEraCounts] = useState<EraCount[]>([]);
  const [activeEra, setActiveEra] = useState<EraSlug | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [total, setTotal] = useState(0);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch era counts on mount
  useEffect(() => {
    fetch("/api/timeline/counts")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch counts");
        return r.json();
      })
      .then((counts: EraCount[]) => {
        setEraCounts(counts);
        // Select era with most games
        const maxEra = counts.reduce((max, c) =>
          c.count > max.count ? c : max, counts[0]
        );
        if (maxEra) setActiveEra(maxEra.slug);
      })
      .catch((err) => console.error("Failed to load era counts:", err));
  }, []);

  // Fetch games when era/sort/search changes
  useEffect(() => {
    if (!activeEra) return;
    setLoading(true);

    const params = new URLSearchParams({
      era: activeEra,
      sort,
      order,
      limit: "48",
    });
    if (search) params.set("search", search);

    fetch(`/api/games?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch games");
        return r.json();
      })
      .then((data) => {
        setGames(data.games || []);
        setTotal(data.pagination?.total ?? 0);
        // Extract distinct platform labels
        const labels = new Set<string>();
        for (const g of data.games || []) {
          if (g.platformLabel) labels.add(g.platformLabel);
        }
        setPlatforms(Array.from(labels).sort());
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load games:", err);
        setLoading(false);
      });
  }, [activeEra, sort, order, search]);

  const currentBucket = activeEra ? findEraBySlug(activeEra) : undefined;

  const eraBarData = useMemo(
    () =>
      ERA_BUCKETS.map((b) => ({
        slug: b.slug,
        shortName: b.shortName,
        count: eraCounts.find((c) => c.slug === b.slug)?.count ?? 0,
        color: b.color,
      })),
    [eraCounts]
  );

  const fetchUrl = activeEra
    ? `/api/games?era=${activeEra}&sort=${sort}&order=${order}${search ? `&search=${search}` : ""}&limit=48`
    : "";

  const activeCount = eraCounts.find((c) => c.slug === activeEra)?.count ?? 0;

  if (eraCounts.length === 0) {
    return (
      <div className="space-y-4">
        {/* Skeleton pills */}
        <div className="flex gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-8 w-24 rounded-full bg-vault-surface animate-pulse" />
          ))}
        </div>
        {/* Skeleton grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mt-8">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-lg bg-vault-surface animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="transition-all duration-500 ease-in-out rounded-xl -m-2 p-2"
      style={{
        background: currentBucket
          ? `radial-gradient(ellipse at top, ${currentBucket.color}14 0%, transparent 60%)`
          : undefined,
      }}
    >
      {activeEra && (
        <EraBar
          eras={eraBarData}
          activeEra={activeEra}
          onEraChange={setActiveEra}
        />
      )}

      {currentBucket && (
        <EraHeader
          era={currentBucket}
          gameCount={activeCount}
          platforms={platforms}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <div />
        <Suspense>
          <SortSelect />
        </Suspense>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-lg bg-vault-surface animate-pulse" />
          ))}
        </div>
      ) : (
        <InfiniteGameGrid
          initialGames={games}
          total={total}
          fetchUrl={fetchUrl}
        />
      )}
    </div>
  );
}

export default function TimelinePage() {
  return (
    <div className="max-w-7xl mx-auto">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Timeline" }]}
      />
      <h1 className="font-heading text-2xl font-bold mb-6">Timeline</h1>
      <Suspense>
        <TimelineContent />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `pnpm build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/timeline/page.tsx
git commit -m "feat(timeline): add /timeline page with era filtering"
```

---

### Task 7: Add Timeline link to sidebar

**Files:**
- Modify: `src/components/layout/sidebar.tsx` (add link after Insights, ~line 132)

- [ ] **Step 1: Add Timeline link after Insights link**

After the Insights `</Link>` (after line 132) and before the `{platforms.map(` (line 134), add:

```typescript
          <Link
            href="/timeline"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname === "/timeline"
                ? "bg-vault-amber/10 text-vault-amber"
                : "text-vault-muted hover:text-vault-text hover:bg-vault-bg"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>Timeline</span>
          </Link>
```

- [ ] **Step 2: Verify build passes**

Run: `pnpm build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat(sidebar): add Timeline navigation link"
```

---

### Task 8: Integration test & final verification

**Files:**
- No new files. Manual verification.

- [ ] **Step 1: Run full build**

Run: `pnpm build`
Expected: Build succeeds with zero errors.

- [ ] **Step 2: Start dev server and verify**

Run: `pnpm dev`

Verify in browser:
1. Sidebar shows "Timeline" link with clock icon below "Insights"
2. `/timeline` page loads, shows era pills with counts
3. Era with most games is selected by default
4. Clicking an era pill changes the grid, header, and background gradient
5. Sort dropdown works within era
6. Infinite scroll loads more games
7. Background gradient transitions smoothly between eras
8. Era pills are horizontally scrollable on small screens
9. Platform tags in header show platforms from the selected era
10. Existing pages (Home, Insights, Discover) still work correctly

- [ ] **Step 3: Commit any fixes**

If any issues found during verification, fix and commit:

```bash
git add -A
git commit -m "fix(timeline): address integration issues"
```
