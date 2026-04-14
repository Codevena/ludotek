# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start Next.js dev server
pnpm build        # Production build (use to type-check before committing)
pnpm lint         # ESLint
pnpm test         # Vitest (single run)
pnpm test:watch   # Vitest in watch mode
npx prisma db push       # Apply schema changes to SQLite
npx prisma generate       # Regenerate Prisma client after schema changes
npx tsx prisma/seed.ts    # Seed database
```

## Architecture

**Next.js 14 App Router** with SQLite (Prisma 6.x) and pnpm. Standalone output for Docker deployment.

### Core Data Flow

Games are discovered by **scanning** remote devices (SSH/FTP) or local paths, then **enriched** with metadata from IGDB, cover art from SteamGridDB, and AI-generated content (Fun Facts & Story) via OpenRouter (Gemini 2.5 Flash).

### Key Subsystems

- **Enrichment** (`src/context/enrichment-context.tsx`, `/api/enrich`): Bulk IGDB metadata fetch via SSE streaming. Sequential processing with 500ms delay (configurable via `ENRICH_DELAY_MS`). Retry on 429/5xx with exponential backoff. The `searchIgdb()` function in `src/lib/igdb.ts` has a multi-phase search: platform-specific, then cross-platform, then hyphen-split fallback (e.g. "Project Justice - Rival Schools 2" tries "Project Justice").

- **Scanning** (`src/context/scan-context.tsx`, `/api/scan`): Background device scanning with 2s polling. Platform auto-detection from directory names. ROM filename cleaning via `cleanFilename()`.

- **Image Cache** (`src/lib/image-cache.ts`, `/api/cache`): Downloads covers, screenshots, artwork to `data/` directory. Served via catch-all route `/api/cache/[...path]`.

- **Device Connections** (`src/lib/connection.ts`): SSH2 with FTP fallback. Used for scanning, file browsing, transfers, and sync operations.

- **Sync Queue** (`/api/sync`): Stages rename/delete operations on remote devices. User reviews in SyncPanel, then applies.

### State Management

Two React contexts wrap the app in `layout.tsx`:
- `EnrichmentProvider` — SSE-based enrichment progress (consumed by `EnrichmentBar`)
- `ScanProvider` — polling-based scan progress (consumed by `ScanBar`)

### Auth

Bearer token or `admin_token` cookie, enforced via `requireAuth(request)` in `src/lib/auth.ts`. No auth required when `ADMIN_TOKEN` env var is unset (dev mode).

### API Pattern

Most bulk operations use SSE streaming (`text/event-stream`): enrichment, AI generation, device transfers, recommendations. Events follow `{ type: "progress" | "enriched" | "missed" | "error" | "done", ... }`.

## Styling

Tailwind 3.4 with custom `vault-*` color palette (dark theme). Fonts: Space Grotesk (headings) and Inter (body) via `next/font`. Typography plugin for markdown rendering. `@next/next/no-img-element` rule is disabled.

## Conventions

- Use `console.warn`/`console.error`, not custom loggers (pre-commit hooks enforce this).
- JSON arrays stored as strings in SQLite (genres, themes, screenshotUrls, videoIds, artworkUrls) — parse with `JSON.parse()`, handle failures.
- Prisma 6.x only (not 7.x) — incompatible config format.
- Platform mapping lives in `src/lib/platforms.ts` (50+ platforms) and `IGDB_PLATFORM_MAP` in `src/lib/igdb.ts`.
- Test files go in `__tests__/lib/`.
