# Game Vault -- Spec Compliance Review

Reviewed: 2026-04-12
Spec: `/Users/markus/Desktop/docs/superpowers/specs/2026-04-12-game-vault-design.md`
Codebase: `/Users/markus/Desktop/game-vault/`

---

## Summary

The implementation covers the core architecture well but has several gaps ranging from missing features to minor deviations. 14 findings total: 5 Critical, 5 Important, 4 Suggestions.

---

## CRITICAL (must fix)

### C1. Homepage missing "Recently Added" and "Top Rated" sections

**Spec says:** Homepage should have a "Recently Added" section and a "Top Rated" section.
**Actual:** `src/app/page.tsx` only renders a single "All Games" grid with a stats bar. There are no dedicated "Recently Added" or "Top Rated" sections/widgets anywhere.

### C2. Search bar is NOT live search

**Spec says:** "Search bar with live search across all games."
**Actual:** `src/components/search-bar.tsx` requires pressing Enter (form submit) to trigger navigation. There is no debounced/incremental live search as the user types.

### C3. Game detail AI sections are NOT expandable

**Spec says:** "AI Fun Facts (expandable section)" and "AI Story/Background (expandable section)."
**Actual:** `src/app/game/[id]/page.tsx` renders both as static `<div>` blocks that are always visible. There is no collapse/expand (disclosure/accordion) behavior.

### C4. AI content rendered as raw HTML without Markdown parsing

**Spec says:** AI content is stored as Markdown in `aiFunFacts` and `aiStory`.
**Actual:** The game detail page uses `dangerouslySetInnerHTML={{ __html: game.aiFunFacts }}` directly on the raw Markdown string. Markdown is NOT HTML -- this will render the raw Markdown text literally (bullet `- ` stays as text, `**bold**` stays as text). A Markdown-to-HTML library (e.g., `react-markdown` or `marked`) is needed.

### C5. Settings password NOT encrypted

**Spec says:** Settings model `deckPassword` should be "encrypted."
**Actual:** The password is stored as a plain `String` in SQLite with no encryption. The GET endpoint masks it with `********` in the response, but the PUT endpoint stores whatever the client sends directly. No encryption/decryption logic exists.

---

## IMPORTANT (should fix)

### I1. Platform page missing "average score" statistic

**Spec says:** Platform page should show "Platform statistics (count, average score, etc.)."
**Actual:** `src/app/platform/[id]/page.tsx` shows only the game count. There is no average score or any other aggregate statistic.

### I2. Admin page missing progress indicators for bulk operations

**Spec says:** "Progress indicators for bulk operations."
**Actual:** `src/app/admin/page.tsx` shows loading text ("Scanning...", "Enriching...", "Generating...") and a JSON result dump after completion. There are no progress bars, percentage indicators, or streamed progress updates during the operation.

### I3. Admin page missing Steam API key field in the UI

**Spec says:** Settings form should include "SteamGridDB API key" (present) and the Settings model has `steamApiKey`.
**Actual:** The admin page UI has fields for SteamGridDB key and OpenRouter key but does NOT render an input for `steamApiKey` (Steam Web API key). The field exists in the schema and the API handles it, but the UI omits it.

### I4. Settings GET endpoint does NOT mask `steamgriddbKey`

**Spec says:** Sensitive keys should be protected.
**Actual:** In `src/app/api/settings/route.ts`, the GET handler masks `deckPassword`, `igdbClientSecret`, `openrouterKey`, and `steamApiKey` -- but it returns `steamgriddbKey` in plain text. This is inconsistent.

### I5. Docker Compose missing ENV vars for API keys

**Spec says:** "ENV vars for API keys."
**Actual:** `docker-compose.yml` only sets `DATABASE_URL`. There are no environment variables for IGDB, SteamGridDB, OpenRouter, or Steam API keys. While the app uses a database-stored Settings model, the spec explicitly calls for ENV var support.

---

## SUGGESTIONS (nice to have)

### S1. No "steam" platform in the static PLATFORM_CONFIG

The `PLATFORM_CONFIG` in `src/lib/platforms.ts` lists 18 ROM platforms but does not include `steam`. Steam is only dynamically created in the scan route when Steam games are found. This means Steam never appears in the sidebar until a scan completes, and the seed script does not create it.

### S2. Hover effect deviates slightly from spec

**Spec says:** "Hover-Effekte: Border-Highlight + leichter Y-Translate."
**Actual:** The `.card` class in `globals.css` applies `border-vault-amber` + `-translate-y-0.5` on hover -- this matches. However, the `GameCard` image also does a `scale-105` zoom on hover which was not in the spec. Minor but worth noting.

### S3. SortSelect does not include a plain ascending "Name" default label

**Spec says:** Sort options: name, score, release date, recently added.
**Actual:** The sort dropdown options are "Name", "Score (high)", "Release (new)", "Recently Added". There is no way to sort by score ascending or release date ascending from the UI -- only descending variants are offered. This is a reasonable UX choice but deviates from the spec's implication of bidirectional sorting.

### S4. `source` field is `String` instead of `Enum`

**Spec says:** `source` field type is `Enum` with values `rom` or `steam`.
**Actual:** Prisma schema defines `source String @default("rom")` with a comment noting the allowed values. SQLite does not support native enums, so this is a pragmatic choice, but no runtime validation enforces the enum constraint.

---

## Verified and Matching

The following spec requirements were verified and found correctly implemented:

| Requirement | Status |
|---|---|
| **Data Model -- Game table:** All 20 fields present with correct types | PASS |
| **Data Model -- Platform table:** All 6 fields present | PASS |
| **Data Model -- Settings table:** All 8 fields present | PASS |
| **Data Model -- Game unique constraint** on `[originalFile, platform]` | PASS |
| **Tech Stack:** Next.js 14, Prisma 6, TailwindCSS, Docker | PASS |
| **Font:** Space Grotesk (headings) + Inter (body) via next/font/google | PASS |
| **Colors:** Dark bg `#111113`, amber accent `#f59e0b` | PASS |
| **Layout:** Platform sidebar left, game grid right | PASS |
| **Cards:** Cover image, title, platform tag, score badge | PASS |
| **Page: Homepage `/`** -- hero stats, game grid, search, sort, pagination | PASS |
| **Page: Game Detail `/game/[id]`** -- cover, screenshots, title, platform, developer, publisher, release date, scores, genres, summary, AI sections | PASS |
| **Page: Platform `/platform/[id]`** -- grid view, sort, pagination | PASS |
| **Page: Admin `/admin`** -- scan/enrich/AI buttons, settings form | PASS |
| **API: `GET /api/games`** -- filter, search, pagination | PASS |
| **API: `GET /api/games/[id]`** -- full details with parsed JSON fields | PASS |
| **API: `POST /api/scan`** -- triggers SSH scan | PASS |
| **API: `POST /api/enrich`** -- pulls IGDB metadata | PASS |
| **API: `POST /api/enrich/ai`** -- generates AI content | PASS |
| **API: `GET /api/platforms`** -- returns platforms with counts | PASS |
| **API: `PUT /api/settings`** -- saves admin settings | PASS |
| **Scanner:** SSH to Steam Deck, iterates ROM dirs under correct path | PASS |
| **Scanner:** Reads Steam library from both specified paths | PASS |
| **Scanner:** Filters metadata.txt, systeminfo.txt, media/, .sbi files | PASS |
| **Scanner:** Cleans filenames (region tags, extensions, version info) | PASS |
| **Scanner:** Deduplicates aliased directories (gc/gamecube preference) | PASS |
| **Scanner:** Upserts on `originalFile + platform` | PASS |
| **Scanner:** Updates platform game counts after scan | PASS |
| **Platform mapping:** All 18+ directory-to-platform mappings correct including multidisc variants | PASS |
| **IGDB enrichment:** Search with title + platform filter | PASS |
| **IGDB enrichment:** Pulls cover, rating, genres, developer, publisher, release date, summary, screenshots | PASS |
| **IGDB enrichment:** Stores IGDB ID for re-enrichment | PASS |
| **IGDB enrichment:** SteamGridDB fallback for missing covers | PASS |
| **IGDB enrichment:** Screenshots limited to 4 | PASS |
| **AI enrichment:** Only processes games with IGDB data but no AI content | PASS |
| **AI enrichment:** Builds prompt with title, platform, developer, year, genres, summary | PASS |
| **AI enrichment:** Uses OpenRouter with configurable model, default `claude-sonnet-4-20250514` | PASS |
| **AI enrichment:** Generates Fun Facts (3-5 items) and Story (2-3 paragraphs) | PASS |
| **AI enrichment:** Rate-limited (1s delay between games, batch of 10) | PASS |
| **Docker:** Single container, Next.js standalone output, port 3000, volume for SQLite persistence | PASS |
| **Docker:** Prisma migrate deploy on startup | PASS |

---

## File Reference

- Prisma schema: `/Users/markus/Desktop/game-vault/prisma/schema.prisma`
- Homepage: `/Users/markus/Desktop/game-vault/src/app/page.tsx`
- Game detail: `/Users/markus/Desktop/game-vault/src/app/game/[id]/page.tsx`
- Platform page: `/Users/markus/Desktop/game-vault/src/app/platform/[id]/page.tsx`
- Admin page: `/Users/markus/Desktop/game-vault/src/app/admin/page.tsx`
- Scanner: `/Users/markus/Desktop/game-vault/src/lib/scanner.ts`
- IGDB enrichment: `/Users/markus/Desktop/game-vault/src/lib/igdb.ts`
- AI enrichment: `/Users/markus/Desktop/game-vault/src/lib/openrouter.ts`
- SteamGridDB: `/Users/markus/Desktop/game-vault/src/lib/steamgriddb.ts`
- Settings API: `/Users/markus/Desktop/game-vault/src/app/api/settings/route.ts`
- Docker: `/Users/markus/Desktop/game-vault/Dockerfile`, `/Users/markus/Desktop/game-vault/docker-compose.yml`
- Tailwind config: `/Users/markus/Desktop/game-vault/tailwind.config.ts`
