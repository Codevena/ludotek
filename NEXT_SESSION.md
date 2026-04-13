# Next Session Plan — ROM Search URL Bug + Remaining Features

## Critical Bug: ROM Search URL uses platform ID instead of label

### Problem
The "Search ROM" button on carousel cards and wishlist generates URLs like:
`https://romsfun.com/roms/snes/?q=Top+Gear`

But the correct URL should be:
`https://romsfun.com/roms/super-nintendo/?q=Top+Gear`

The `{platformLabel}` variable in the URL template is being replaced with the platform ID (`snes`) instead of the slugified label (`super-nintendo`).

### What we tried
1. Passing `platformLabel` as prop from server component → didn't work (undefined in client)
2. Resolving from `PLATFORM_CONFIG.find(p => p.id === platformId)?.label` in client → still produces wrong URL
3. Multiple cache clears + rebuilds → same issue

### Root cause investigation needed
- Check `src/components/platform-stats.tsx` — the `resolvedLabel` is set via `PLATFORM_CONFIG.find()` but may not reach `buildRomSearchUrl()` correctly
- Check `src/lib/rom-search.ts` — the `buildRomSearchUrl` function and its replacement order
- The GameCard sub-component inside platform-stats.tsx receives `platformLabel` prop — trace the full data flow
- Check if there's a second code path (e.g. the wishlist page) that builds URLs differently
- The `romSearchUrl` template in the DB is correct: `https://romsfun.com/roms/{platformLabel}/?q={title}`

### Key files
| File | Role |
|------|------|
| `src/lib/rom-search.ts` | `buildRomSearchUrl()` — replaces template variables |
| `src/lib/platforms.ts` | `PLATFORM_CONFIG` with platform IDs and labels |
| `src/components/platform-stats.tsx` | Carousel component that builds + passes search URLs |
| `src/app/wishlist/page.tsx` | Wishlist page that also builds search URLs |
| `src/app/api/settings/rom-search/route.ts` | Public API returning the URL template |

---

## Remaining Features (from PLAN.md)

1. **Theme Toggle (Dark/Light)** — CSS variables for both themes, toggle in header, localStorage
2. **Export/Backup** — JSON export of collection + metadata, import function, optional CSV

## Session Summary — What was built today

### Features implemented:
- Sticky enrichment progress bar (global, all pages)
- Fun Facts & Story redesign (gradient blocks, prose-vault typography)
- Smart Upload with auto-detection (folder names, extensions, fuzzy matching)
- Search with cover thumbnails + platform badges (autocomplete dropdown)
- AI content language toggle (German/English)
- Stats dashboard (Recharts: bar chart, donut, 5 stat cards)
- Favorites system (heart icon, sidebar filter, toggle API)
- Platform collection overview (stats, genre tags, IGDB top rated missing)
- Infinite scroll (replaces pagination)
- Wishlist system (carousel catalog, detail modals, CRUD API)
- Configurable ROM search URL template
- Discovery wishlist button
- Home link in header

### Tech stack:
- Next.js 14 + React + TypeScript + Tailwind CSS
- Prisma 6.x + SQLite
- Recharts for dashboard charts
- @tailwindcss/typography for prose styling

### Git: all pushed to `origin/master` on GitHub (Codevena/game-vault)
