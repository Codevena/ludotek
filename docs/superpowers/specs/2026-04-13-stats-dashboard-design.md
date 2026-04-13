# Stats Dashboard — Home Page

## Summary

Replace the simple 3-card stats bar on the home page with a full analytics dashboard featuring interactive Recharts charts: platform distribution bar chart, score donut chart, games-added timeline, and enrichment coverage stats.

## Chart Library

**Recharts** — SVG-based, React-native components, ~150KB. Chosen for its composable JSX API, sharp rendering on Retina displays, and built-in tooltips/animations.

## Layout

Top-to-bottom on the home page, replacing the current `StatsBar` component:

1. **Stats Row** — 5 cards in a grid
2. **Charts Row** — Bar chart (2/3 width) + Donut chart (1/3 width)
3. **Timeline** — Full-width area chart
4. **Recently Added** — 6 game cards (existing)
5. **Top Rated** — 6 game cards (existing)
6. **All Games** — Paginated grid (existing)

## Stats Row (5 cards)

| Stat | Source | Color |
|------|--------|-------|
| Total Games | `prisma.game.count()` | amber |
| Platforms | `prisma.platform.count({ where: { gameCount: { gt: 0 } } })` | amber |
| Avg Score | `prisma.game.aggregate({ _avg: { igdbScore: true } })` | amber |
| Cover Coverage | `count(coverUrl != null) / total * 100` | green |
| AI Content Coverage | `count(aiFunFacts != null) / total * 100` | purple |

## Bar Chart — Games per Platform

- Top 10 platforms by game count
- Each bar uses the platform's `color` from `PLATFORM_CONFIG`
- Gradient fill (darker at bottom, lighter at top)
- Horizontal layout if many platforms, vertical bars
- Tooltip shows platform name + exact count
- Sorted descending by count

Data source: `prisma.game.groupBy({ by: ['platform'], _count: true, orderBy: { _count: { id: 'desc' } }, take: 10 })`

## Donut Chart — Score Distribution

- 4 segments: 75+ (green), 50-74 (amber), <50 (red), Unrated (gray/zinc)
- Center label shows average score
- Tooltip shows segment count and percentage
- Legend below the chart

Data source: Count games in each score bucket using `igdbScore` ranges.

## Area Chart — Games Added Over Time

- Last 12 months, grouped by month
- Purple gradient fill under the line
- Dots on data points
- X-axis: month labels (Jan, Feb, etc.)
- Y-axis: game count
- Tooltip shows month + count

Data source: `prisma.game.groupBy({ by: createdAt month })` — requires raw SQL or post-processing since Prisma doesn't natively support date grouping. Use `prisma.$queryRaw` with SQLite's `strftime('%Y-%m', createdAt)`.

## API Endpoint

`GET /api/stats` — returns all dashboard data in one call:

```typescript
interface StatsResponse {
  totalGames: number;
  totalPlatforms: number;
  avgScore: number | null;
  coverPercent: number;
  aiPercent: number;
  platformCounts: { platform: string; label: string; color: string; count: number }[];
  scoreBuckets: { name: string; count: number; color: string }[];
  monthlyAdds: { month: string; count: number }[];
}
```

No auth required — stats are public like the game library.

## Components

### `src/app/api/stats/route.ts` (New)

Server-side route handler that runs all aggregation queries and returns `StatsResponse`.

### `src/components/stats-dashboard.tsx` (New)

Client component (`"use client"`) that:
- Fetches from `/api/stats` on mount
- Renders the 5 stat cards
- Renders the 3 Recharts charts (`BarChart`, `PieChart`, `AreaChart`)
- Shows loading skeleton while fetching
- Responsive: charts stack vertically on mobile

### `src/app/page.tsx` (Modified)

Replace the existing `StatsBar` component with `<StatsDashboard />` wrapped in `<Suspense>`.

## Styling

- Stat cards: `bg-vault-surface border border-vault-border rounded-xl`
- Chart containers: same card styling
- Chart colors: platform colors from config, score bucket colors (green/amber/red/zinc)
- Tooltips: `bg-vault-bg border border-vault-border text-vault-text`
- Responsive: `grid-cols-5` on desktop, `grid-cols-2` + last one full-width on mobile for stats

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/app/api/stats/route.ts` | Create — aggregation endpoint |
| `src/components/stats-dashboard.tsx` | Create — dashboard with Recharts |
| `src/app/page.tsx` | Modify — replace StatsBar with StatsDashboard |
| `package.json` | Modify — add `recharts` dependency |
