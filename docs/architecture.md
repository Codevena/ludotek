# Ludotek Architecture

## Overview

Ludotek is a self-hosted web app for managing retro game ROM collections. It connects to devices (Steam Deck, Android, local PC) via SSH/FTP, scans for ROMs, enriches them with metadata from IGDB, and presents a browsable library.

```
Browser
  |
  v
Next.js App Router (React Server Components + Client Components)
  |
  |-- API Routes (/api/*)
  |     |
  |     |-- Prisma ORM --> SQLite (prisma/dev.db)
  |     |
  |     |-- External APIs
  |     |     |-- IGDB (covers, ratings, metadata)
  |     |     |-- OpenRouter (AI recommendations, stories)
  |     |     +-- SteamGridDB (alternative cover art)
  |     |
  |     +-- Device Connections
  |           |-- SSH (Steam Deck, Linux)
  |           |-- FTP (Android)
  |           +-- Local (filesystem)
  |
  +-- Static Assets + Cached Images (data/)
```

## Key Abstractions

### Scanner (`src/lib/scanner.ts`)
Connects to a device, lists files across platform directories, and produces a list of games. Uses `cleanFilename()` to extract titles from ROM filenames and `deduplicateGames()` to collapse multi-disc and regional variants.

### Connection (`src/lib/connection.ts`)
Protocol-agnostic interface for file operations: `listDir`, `rename`, `remove`, `readFile`, `writeFile`, `stat`. Three implementations: SSH (SFTP), FTP (`basic-ftp`), and Local (`fs`).

### Enrichment Pipeline (`src/lib/igdb.ts`, `src/lib/openrouter.ts`)
Two-phase enrichment:
1. **IGDB** — Searches by title + platform, returns covers, ratings, release dates, genres, summaries
2. **AI** — Generates fun facts and story summaries via OpenRouter (optional)

Images are cached locally in `data/` via `src/lib/image-cache.ts` for offline access.

### SyncQueue (Prisma model + API routes)
Staged file operations on remote devices:
1. User stages rename/delete actions from the UI
2. Actions queue as `pending` in the database
3. User reviews in the SyncPanel
4. "Apply" executes all pending operations via device connections

### Platforms (`src/lib/platforms.ts`)
Registry of 50+ gaming platforms with directory names, file extensions, and display labels. Used by the scanner to identify ROM files and by the UI for platform pages.

## Data Flow

### 1. Scanning
```
Device --SSH/FTP--> listDir --> parseRomListing --> cleanFilename --> dedup --> Prisma (Game + GameDevice)
```

### 2. Enrichment
```
Game (title + platform) --> IGDB search --> metadata + cover URL --> cache images to data/ --> update Game record
```

### 3. Browsing
```
Browser --> /api/games?sort=title --> Prisma query --> JSON --> InfiniteGameGrid (client component)
```

### 4. File Sync
```
UI action --> POST /api/sync/queue --> SyncQueue (pending) --> user reviews --> POST /api/sync/apply --> Connection.rename/remove
```

## Database Models

| Model | Purpose |
|-------|---------|
| `Game` | ROM metadata (title, platform, IGDB data, scores, images) |
| `Device` | Connection config (host, protocol, credentials, scan paths) |
| `GameDevice` | Junction table — which games exist on which devices |
| `SyncQueue` | Pending rename/delete operations per device |
| `Settings` | App configuration (API keys, active device, AI language) |
| `CacheEntry` | Tracks cached images per game |
| `ApiCache` | TTL-based cache for IGDB API responses |

## Route Groups

The app uses Next.js route groups to support multiple layouts:

- **`(main)/`** — All pages with Sidebar, Header, ScanBar, EnrichmentBar, TransferBar
- **`(setup)/`** — Setup wizard with standalone centered layout (no chrome)
- **`api/`** — API endpoints (no layout)

Pages: Home, Platform, Game Detail, Devices, Admin, Files, Discover, Insights, Timeline, Wishlist, Setup
