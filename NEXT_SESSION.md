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

### Root cause (from Claude Review)
The code logic is actually correct — `resolvedLabel` resolves to "Super Nintendo", `slugify` produces "super-nintendo". The reviewer confirmed the replacement chain works. Possible remaining causes:
1. **Browser/Next.js caching** — old client bundle may still be served despite cache clears
2. **`.replace()` uses string overload** — only replaces first occurrence. Use regex `/g` flag instead
3. **`useCallback` stale closure** — `toggleWishlist` has `resolvedLabel` in scope but not in dependency array

### Review findings to fix
- [C1] `toggleWishlist` useCallback missing `resolvedLabel` in deps (platform-stats.tsx:552)
- [I1] `buildRomSearchUrl` should use regex `g` flag for all replacements (rom-search.ts:30-34)
- [I2] Carousel description uses `platformId` instead of `resolvedLabel` (platform-stats.tsx:652)
- [I3] IGDB error message hardcoded in German, should be English (platform-stats.tsx:607-609)

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
