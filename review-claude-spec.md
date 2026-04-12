# Game Vault -- Spec Verification Report

Date: 2026-04-12

## Tech Stack

- [x] Next.js 14 (App Router) -- package.json: `"next": "14.2.35"`
- [x] Prisma 6 + SQLite -- `"prisma": "^6.19.3"`, datasource sqlite
- [x] TailwindCSS -- present and configured
- [x] Docker -- Dockerfile + docker-compose.yml present
- [x] IGDB API integration -- `src/lib/igdb.ts`
- [x] SteamGridDB fallback -- `src/lib/steamgriddb.ts`
- [x] OpenRouter AI -- `src/lib/openrouter.ts`

## Visual Design

- [x] Dark background #111113 -- tailwind config `vault.bg: "#111113"`
- [x] Warm amber accents #f59e0b -- `vault.amber: "#f59e0b"`
- [x] Space Grotesk headings -- loaded via `next/font/google`, `--font-heading`
- [x] Inter body -- loaded via `next/font/google`, `--font-body`
- [x] Platform sidebar left, game grid right -- layout.tsx: sidebar + flex-1 content
- [x] Cards with cover, title, platform tag, score badge -- game-card.tsx
- [x] Hover effects: border highlight + Y translate -- globals.css: `.card:hover` has `border-vault-amber -translate-y-0.5`

## Data Model

### Game
- [x] id (Int auto) -- `@id @default(autoincrement())`
- [x] title (String)
- [x] originalFile (String)
- [x] platform (String)
- [x] platformLabel (String)
- [x] source (Enum rom/steam) -- stored as String with default "rom"
- [x] coverUrl (String?)
- [x] screenshotUrls (JSON?) -- stored as String, parsed as JSON
- [x] igdbId (Int?)
- [x] igdbScore (Float?)
- [x] metacriticScore (Int?)
- [x] releaseDate (DateTime?)
- [x] genres (JSON?) -- stored as String, parsed as JSON
- [x] developer (String?)
- [x] publisher (String?)
- [x] summary (String?)
- [x] aiFunFacts (String?)
- [x] aiStory (String?)
- [x] aiEnrichedAt (DateTime?)
- [x] createdAt (DateTime)
- [x] updatedAt (DateTime)
- [x] Unique constraint on [originalFile, platform]

### Platform
- [x] id (String)
- [x] label (String)
- [x] icon (String?)
- [x] color (String)
- [x] gameCount (Int)
- [x] sortOrder (Int)

### Settings
- [x] id (Int, singleton)
- [x] deckHost (String)
- [x] deckUser (String)
- [x] deckPassword (String)
- [x] igdbClientId (String?)
- [x] igdbClientSecret (String?)
- [x] openrouterApiKey -- field named `openrouterKey`
- [x] steamApiKey (String?)
- [x] SteamGridDB key -- `steamgriddbKey` (not in spec's Settings table, but needed by IGDB Enrichment fallback)

## Pages & Features

### Homepage (/)
- [x] Hero section with total stats (game count, platforms, avg score)
- [x] Platform sidebar for filtering (left side)
- [x] Game grid with covers, title, platform badge, score
- [x] "Recently Added" section
- [x] "Top Rated" section
- [x] Search bar with live search across all games (debounce 300ms)
- [x] Sort options: name, score, release date, recently added

### Game Detail Page (/game/[id])
- [x] Large cover + screenshots gallery
- [x] Title, platform, developer, publisher, release date
- [x] IGDB score display
- [x] Metacritic score display
- [x] Genre tags
- [x] IGDB summary text
- [x] AI Fun Facts (expandable section) -- uses `<details>` element
- [x] AI Story/Background (expandable section) -- uses `<details>` element
- [x] AI content rendered with react-markdown

### Platform Page (/platform/[id])
- [x] All games for one platform in grid view
- [x] Platform statistics (count, average score)
- [x] Sort by name, score, release date

### Admin Page (/admin)
- [x] "Scan Steam Deck" button
- [x] "Enrich All" button (IGDB)
- [x] "Generate AI Content" button
- [x] Progress indicators for bulk operations (streaming SSE with progress bar)
- [x] Settings form: Steam Deck SSH (host, user, password)
- [x] Settings form: OpenRouter API key
- [x] Settings form: IGDB credentials (client ID, client secret)
- [x] Settings form: SteamGridDB API key
- [x] Settings form: Steam Web API key

## API Routes

- [x] GET /api/games -- list with filter, search, pagination
- [x] GET /api/games/[id] -- single game with full details
- [x] POST /api/scan -- trigger Steam Deck scan
- [x] POST /api/enrich -- pull IGDB metadata for unmatched games
- [x] POST /api/enrich/ai -- generate AI content for games missing it
- [x] GET /api/platforms -- all platforms with counts
- [x] PUT /api/settings -- save admin settings
- [x] GET /api/settings -- load admin settings (not in spec but required by admin page)

## Scanner Logic

- [x] SSH connection to Steam Deck
- [x] Iterates ROM directories under /run/media/deck/SD/Emulation/roms/
- [x] Filters out metadata.txt, systeminfo.txt, media/, .sbi files
- [x] Cleans filenames: strips region tags, format suffixes, version info, bracket tags
- [x] Reads Steam library from /run/media/deck/SD/Games/ and /home/deck/.local/share/Steam/steamapps/common/
- [x] Deduplicates across aliased directories (prefers canonical platform key)
- [x] Upserts games (match on originalFile + platform)
- [x] Updates platform game counts

### Platform Mapping
- [x] snes -> Super Nintendo
- [x] gba -> Game Boy Advance
- [x] gb -> Game Boy
- [x] megadrive -> Mega Drive / Genesis
- [x] nes -> Nintendo Entertainment System
- [x] gbc -> Game Boy Color
- [x] gamegear -> Game Gear
- [x] mastersystem -> Master System
- [x] n64 -> Nintendo 64
- [x] psx, psx-multidisc -> PlayStation
- [x] ps2 -> PlayStation 2
- [x] dreamcast, dreamcast-multidisc -> Dreamcast
- [x] saturn, saturn-multidisc -> Sega Saturn
- [x] gc, gamecube, gc-multidisc -> GameCube
- [x] switch -> Nintendo Switch
- [x] segacd -> Sega CD
- [x] n3ds, 3ds -> Nintendo 3DS
- [x] xbox360 -> Xbox 360
- [x] steam -> Steam

## IGDB Enrichment

- [x] Search IGDB with cleaned title + platform filter
- [x] Take top match
- [x] Pull: cover URL, rating, genres, developer, publisher, release date, summary, screenshots
- [x] Store IGDB ID for future re-enrichment
- [x] Fallback to SteamGridDB for covers if IGDB has none
- [x] Screenshots limited to 4

## AI Enrichment (OpenRouter)

- [x] Only games with IGDB metadata but no AI content
- [x] Prompt built with title, platform, developer, release year, genres, summary
- [x] Request via OpenRouter API
- [x] Default model: claude-sonnet-4-20250514
- [x] Generates Fun Facts (3-5 facts) and Story/Background (2-3 paragraphs)
- [x] Stored as Markdown in aiFunFacts and aiStory
- [x] Rate-limiting: 1s delay between requests, batch size of 10

## Docker Deployment

- [x] Single container: Next.js + SQLite (standalone output)
- [x] Volume mount for games.db persistence
- [x] ENV vars for API keys (DATABASE_URL, ADMIN_TOKEN, DECK_HOST, DECK_USER, DECK_PASSWORD, IGDB_CLIENT_ID, IGDB_CLIENT_SECRET, STEAMGRIDDB_API_KEY, OPENROUTER_API_KEY)
- [x] Exposed on port 3000
- [x] Prisma migrate deploy on container start

## Minor Observation (Not a Spec Gap)

- The docker-compose.yml does not include a `STEAM_API_KEY` env var, though the Settings model has a `steamApiKey` field. This key is managed entirely through the admin UI settings form and stored in the database, so it does not need a Docker env var. This is consistent behavior -- only connection/infrastructure secrets are in env vars.

---

All spec requirements verified and met.
