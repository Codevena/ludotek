# Sammlung-Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/insights` page that shows collection-level analytics — genre distribution, era distribution, top franchises/developers/publishers, and cross-platform info.

**Architecture:** Single `GET /api/insights` endpoint with server-side aggregation from existing Game fields (genres, releaseDate, franchise, developer, publisher). Client-side `/insights` page using Recharts (already installed) for charts and Tailwind cards for lists. No new Prisma models.

**Tech Stack:** Next.js 14 App Router, Prisma 6 (SQLite), Recharts 3.8, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-14-sammlung-insights-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/app/api/insights/route.ts` | Server-side aggregation endpoint |
| Create | `src/app/insights/page.tsx` | Insights page (client component) |
| Modify | `src/components/layout/sidebar.tsx` | Add "Insights" nav link |

---

### Task 1: API Endpoint — `GET /api/insights`

**Files:**
- Create: `src/app/api/insights/route.ts`

- [ ] **Step 1: Create the insights API route**

```ts
// src/app/api/insights/route.ts
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
    const genres = otherGenreCount > 0
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

    const eras = ERA_BUCKETS.map((b) => ({
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
```

- [ ] **Step 2: Verify the endpoint works**

Run: `curl http://localhost:3000/api/insights | jq .`
Expected: JSON response with `genres`, `eras`, `franchises`, `developers`, `publishers`, `crossPlatform`, `totalGames`, `enrichedGames` fields.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/insights/route.ts
git commit -m "feat(insights): add GET /api/insights aggregation endpoint"
```

---

### Task 2: Insights Page — Charts Section

**Files:**
- Create: `src/app/insights/page.tsx`

- [ ] **Step 1: Create the insights page with header and charts**

```tsx
// src/app/insights/page.tsx
"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

/* ── Types ─────────────────────────────────────────── */

interface GenreEntry { name: string; count: number }
interface EraEntry { name: string; range: string | null; count: number }
interface RankedEntry { name: string; count: number }
interface CrossPlatformEntry { title: string; platforms: string[]; count: number }

interface InsightsData {
  genres: GenreEntry[];
  eras: EraEntry[];
  franchises: RankedEntry[];
  developers: RankedEntry[];
  publishers: RankedEntry[];
  crossPlatform: CrossPlatformEntry[];
  totalGames: number;
  enrichedGames: number;
}

/* ── Colors ────────────────────────────────────────── */

const GENRE_COLORS = [
  "#f59e0b", "#8b5cf6", "#ef4444", "#22c55e", "#3b82f6",
  "#ec4899", "#14b8a6", "#f97316", "#06b6d4", "#a855f7",
  "#71717a", // "Other"
];

const ERA_COLORS: Record<string, string> = {
  "Dawn of Gaming": "#92400e",
  "8-Bit Era": "#dc2626",
  "16-Bit Golden Age": "#7c3aed",
  "The 3D Revolution": "#6b7280",
  "The Golden Era": "#ea580c",
  "HD Generation": "#16a34a",
  "Modern Era": "#e11d48",
  "Unknown": "#3f3f46",
};

/* ── Tooltip ───────────────────────────────────────── */

function InsightTooltip({
  active,
  payload,
  label,
  total,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: string;
  total?: number;
}) {
  if (!active || !payload?.length) return null;
  const count = payload[0].value as number;
  const pct = total && total > 0 ? ((count / total) * 100).toFixed(1) : null;
  return (
    <div className="bg-vault-bg border border-vault-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-vault-text text-sm font-medium">{label ?? payload[0].name}</p>
      <p className="text-vault-muted text-xs">
        {count} games{pct ? ` (${pct}%)` : ""}
      </p>
    </div>
  );
}

/* ── Ranked List Card ──────────────────────────────── */

function RankedCard({ title, items }: { title: string; items: RankedEntry[] }) {
  if (items.length === 0) return null;
  return (
    <div className="bg-vault-surface border border-vault-border rounded-xl p-4">
      <h3 className="font-heading text-sm font-bold text-vault-text mb-3">{title}</h3>
      <ol className="space-y-2">
        {items.map((item, i) => (
          <li key={item.name} className="flex items-center gap-3 text-sm">
            <span className="text-vault-muted w-5 text-right font-mono text-xs">{i + 1}.</span>
            <span className="text-vault-text flex-1 truncate">{item.name}</span>
            <span className="text-vault-muted text-xs">{item.count}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────── */

export default function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/insights")
      .then((r) => r.json())
      .then((json) => setData(json))
      .catch((err) => console.error("Failed to load insights:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-vault-surface animate-pulse rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-80 bg-vault-surface animate-pulse rounded-xl" />
          <div className="h-80 bg-vault-surface animate-pulse rounded-xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-64 bg-vault-surface animate-pulse rounded-xl" />
          <div className="h-64 bg-vault-surface animate-pulse rounded-xl" />
          <div className="h-64 bg-vault-surface animate-pulse rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data || data.totalGames === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-vault-muted text-lg">No games yet — scan a device to get started.</p>
      </div>
    );
  }

  if (data.enrichedGames === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-vault-muted text-lg">
          Enrich your games with IGDB metadata to see insights.
        </p>
        <p className="text-vault-muted text-sm mt-2">
          {data.totalGames} games found, but none have metadata yet.
        </p>
      </div>
    );
  }

  const genreTotal = data.genres.reduce((s, g) => s + g.count, 0);

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────── */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-vault-text">Collection Insights</h1>
        <p className="text-vault-muted text-sm mt-1">
          Based on {data.enrichedGames.toLocaleString()} enriched games out of{" "}
          {data.totalGames.toLocaleString()} total
        </p>
      </div>

      {/* ── Charts Row (2-col) ────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Genre Donut */}
        <div className="bg-vault-surface border border-vault-border rounded-xl p-4">
          <h3 className="font-heading text-sm font-bold text-vault-text mb-3">
            Genre Distribution
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data.genres}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                stroke="none"
              >
                {data.genres.map((_, i) => (
                  <Cell key={i} fill={GENRE_COLORS[i % GENRE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<InsightTooltip total={genreTotal} />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
            {data.genres.map((g, i) => (
              <div key={g.name} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: GENRE_COLORS[i % GENRE_COLORS.length] }}
                />
                <span className="text-vault-muted text-xs">{g.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Era Bar Chart (horizontal) */}
        <div className="bg-vault-surface border border-vault-border rounded-xl p-4">
          <h3 className="font-heading text-sm font-bold text-vault-text mb-3">
            Era Distribution
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.eras} layout="vertical">
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={130}
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<InsightTooltip total={data.totalGames} />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.eras.map((era) => (
                  <Cell key={era.name} fill={ERA_COLORS[era.name] ?? "#71717a"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Cards Row (3-col) ─────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <RankedCard title="Top Franchises" items={data.franchises} />
        <RankedCard title="Top Developers" items={data.developers} />
        <RankedCard title="Top Publishers" items={data.publishers} />
      </div>

      {/* ── Cross-Platform (if any) ───────────── */}
      {data.crossPlatform.length > 0 && (
        <div className="bg-vault-surface border border-vault-border rounded-xl p-4">
          <h3 className="font-heading text-sm font-bold text-vault-text mb-3">
            Cross-Platform Games
          </h3>
          <p className="text-vault-muted text-xs mb-3">
            Games in your collection that appear on multiple platforms
          </p>
          <div className="space-y-2">
            {data.crossPlatform.map((cp) => (
              <div key={cp.title} className="flex items-center gap-3 text-sm">
                <span className="text-vault-text flex-1 truncate">{cp.title}</span>
                <span className="text-vault-muted text-xs">
                  {cp.platforms.join(", ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Start dev server and verify the page renders**

Run: `pnpm dev`
Open: `http://localhost:3000/insights`
Expected: Charts and cards render with real data. Genre donut shows colored segments, era bars show horizontal bars, ranked lists show top 10 entries.

- [ ] **Step 3: Commit**

```bash
git add src/app/insights/page.tsx
git commit -m "feat(insights): add /insights page with charts and cards"
```

---

### Task 3: Sidebar Navigation

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Add Insights link to sidebar**

In `src/components/layout/sidebar.tsx`, add the following after the Wishlist `<Link>` block (after line 106) and before the `{platforms.map(` block:

```tsx
          <Link
            href="/insights"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname === "/insights"
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
              <path d="M3 3v18h18" />
              <path d="M18 17V9" />
              <path d="M13 17V5" />
              <path d="M8 17v-3" />
            </svg>
            <span>Insights</span>
          </Link>
```

- [ ] **Step 2: Verify in browser**

Expected: "Insights" link appears in sidebar between Wishlist and platform list. Active state highlights amber when on `/insights`.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat(insights): add Insights link to sidebar navigation"
```

---

### Task 4: Build Verification & Type Check

- [ ] **Step 1: Run type check**

Run: `pnpm build`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 2: Fix any errors**

If there are type errors, fix them before proceeding.

- [ ] **Step 3: Manual QA in browser**

Open `http://localhost:3000/insights` and verify:
- [ ] Header shows correct enriched/total counts
- [ ] Genre donut renders with colored segments and hover tooltip shows count + %
- [ ] Era bar chart renders horizontal bars with era-specific colors
- [ ] Top Franchises/Developers/Publishers cards show ranked lists
- [ ] Cross-Platform section appears (if applicable) or is hidden (if no cross-platform games)
- [ ] Sidebar "Insights" link is highlighted when on the page
- [ ] Page is responsive: charts stack on mobile, cards stack on mobile
- [ ] Loading skeleton appears briefly before data loads
- [ ] Empty states work (if testable)

- [ ] **Step 4: Final commit (if fixes were needed)**

```bash
git add -A
git commit -m "fix(insights): address build/type issues"
```
