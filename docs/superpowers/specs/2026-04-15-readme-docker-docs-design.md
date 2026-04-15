# Phase 4.1b: README, Docker, Docs — Design Spec

> Professional open-source presentation for Ludotek: README overhaul, Docker image distribution, contributor documentation, and architecture overview.

---

## 1. README.md

### Structure

1. **Hero Section**
   - Logo (`logo.png` from repo root) centered
   - Tagline: "Your personal retro game library — scan, enrich, browse."
   - 1-sentence description: Ludotek scans your devices for ROMs, enriches them with IGDB metadata, and gives you a beautiful library to explore.

2. **Screenshot**
   - Single hero screenshot of the Home page with games
   - Path: `docs/screenshots/home.png`
   - Generated via Playwright script (see Section 5)
   - If screenshot doesn't exist yet, use a placeholder text ("Screenshot coming soon")

3. **Features**
   - Bullet list, each with bold title + short description:
     - **Device Scanning** — Connect via SSH/FTP/Local, auto-detect ROMs across 50+ platforms
     - **IGDB Enrichment** — Covers, ratings, release dates, genres, summaries
     - **AI-Powered Discover** — Smart recommendations via OpenRouter
     - **Timeline** — Browse your collection by gaming era
     - **Insights** — Genre distribution, top franchises, era charts
     - **Setup Wizard** — Guided first-run configuration
     - **File Manager** — Browse, rename, delete ROMs on connected devices
     - **ROM Upload** — Upload ROMs from browser with format conversion
     - **Docker Ready** — One-command deployment

4. **Quick Start**

   **Docker (recommended):**
   ```bash
   curl -O https://raw.githubusercontent.com/Codevena/ludotek/main/docker-compose.yml
   docker compose up -d
   # Open http://localhost:3000
   ```

   **Manual:**
   ```bash
   git clone https://github.com/Codevena/ludotek.git
   cd ludotek
   pnpm install
   cp .env.example .env
   pnpm prisma migrate deploy
   pnpm dev
   # Open http://localhost:3000
   ```

5. **Configuration**
   - Table with 3 ENV vars:
     | Variable | Default | Description |
     |----------|---------|-------------|
     | `DATABASE_URL` | `file:./dev.db` | SQLite database path |
     | `ADMIN_TOKEN` | _(empty)_ | Optional auth token (empty = no auth) |
     | `OPENROUTER_MODEL` | `google/gemini-3.1-flash-lite-preview` | AI model for Discover/Stories |
   - Note: "All other settings (IGDB keys, devices, scan paths) are configured through the UI."

6. **Tech Stack**
   - Badge row: Next.js, TypeScript, Prisma, SQLite, Tailwind CSS, Docker

7. **Contributing**
   - "See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and guidelines."

8. **License**
   - MIT License

---

## 2. Docker Distribution

### docker-compose.yml (for users)

Pulls pre-built image from GHCR. No local build needed.

```yaml
services:
  ludotek:
    image: ghcr.io/codevena/ludotek:latest
    ports:
      - "3000:3000"
    volumes:
      - ludotek-data:/app/prisma
      - ludotek-cache:/app/data
      - ludotek-uploads:/tmp/ludotek-uploads
    environment:
      - DATABASE_URL=file:/app/prisma/games.db
      - ADMIN_TOKEN=${ADMIN_TOKEN:-}
      - OPENROUTER_MODEL=${OPENROUTER_MODEL:-google/gemini-3.1-flash-lite-preview}
    restart: unless-stopped

volumes:
  ludotek-data:
  ludotek-cache:
  ludotek-uploads:
```

### docker-compose.dev.yml (for contributors)

Builds from local Dockerfile.

```yaml
services:
  ludotek:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ludotek-data:/app/prisma
      - ludotek-cache:/app/data
      - ludotek-uploads:/tmp/ludotek-uploads
    environment:
      - DATABASE_URL=file:/app/prisma/games.db
      - ADMIN_TOKEN=${ADMIN_TOKEN:-}
      - OPENROUTER_MODEL=${OPENROUTER_MODEL:-google/gemini-3.1-flash-lite-preview}
    restart: unless-stopped

volumes:
  ludotek-data:
  ludotek-cache:
  ludotek-uploads:
```

### .github/workflows/docker-publish.yml

Triggers on push to `main`. Builds multi-platform image (linux/amd64, linux/arm64) and pushes to `ghcr.io/codevena/ludotek:latest` + SHA tag.

Uses standard GitHub Actions:
- `actions/checkout`
- `docker/setup-buildx-action`
- `docker/login-action` (GHCR)
- `docker/build-push-action`

### Dockerfile

Stays as-is. Already has multi-stage build (deps → builder → runner). No changes needed.

---

## 3. CONTRIBUTING.md

### Sections

1. **Prerequisites**
   - Node.js 20+
   - pnpm
   - SQLite (comes with Prisma)

2. **Getting Started**
   ```bash
   git clone https://github.com/Codevena/ludotek.git
   cd ludotek
   pnpm install
   cp .env.example .env
   pnpm prisma migrate deploy
   pnpm dev
   ```

3. **Code Conventions**
   - Use `console.warn`/`console.error` — pre-commit hooks reject custom loggers
   - Prisma 6.x (not 7.x)
   - Tailwind with vault theme (`vault-bg`, `vault-text`, `vault-amber`, etc.)
   - TypeScript strict mode

4. **Project Structure**
   Brief directory tree:
   ```
   src/
     app/           # Next.js App Router pages + API routes
       (main)/      # Pages with Sidebar/Header layout
       (setup)/     # Setup wizard (standalone layout)
       api/         # API endpoints
     components/    # React components
     lib/           # Core logic (scanner, connection, enrichment, etc.)
     context/       # React context providers
   prisma/          # Schema + migrations + SQLite DB
   data/            # Cached images (covers, screenshots, artwork)
   ```

5. **Making Changes**
   - Create a feature branch from `master`
   - Run `pnpm build` before committing (type-checks)
   - Commit messages: `feat:`, `fix:`, `chore:`, `docs:` prefixes
   - Open a PR against `main`

6. **Docker Development**
   ```bash
   docker compose -f docker-compose.dev.yml up --build
   ```

---

## 4. docs/architecture.md

### Sections

1. **Overview**
   - Text-based architecture diagram showing the layers:
     ```
     Browser → Next.js App Router → API Routes → Prisma ORM → SQLite
                                       ↓
                              External APIs (IGDB, OpenRouter, SteamGridDB)
                                       ↓
                              Remote Devices (SSH / FTP / Local)
     ```

2. **Key Abstractions**
   - **Scanner** (`src/lib/scanner.ts`) — Connects to devices, lists ROMs, parses filenames, deduplicates
   - **Connection** (`src/lib/connection.ts`) — Protocol abstraction (SSH/FTP/Local) for file operations
   - **Enrichment** (`src/lib/igdb.ts`, `src/lib/openrouter.ts`) — Fetches metadata from external APIs
   - **SyncQueue** — Staged rename/delete operations: queue → review → apply
   - **Image Cache** (`src/lib/image-cache.ts`) — Downloads and serves cover/screenshot images locally

3. **Data Flow**
   ```
   1. Scan:    Device → SSH/FTP → listDir → parseRomListing → cleanFilename → dedup → DB
   2. Enrich:  DB games → IGDB search → metadata + covers → cache images → update DB
   3. Browse:  Browser → /api/games → Prisma query → JSON → InfiniteGameGrid
   4. Sync:    UI stages rename/delete → SyncQueue → user reviews → apply via Connection
   ```

4. **Database**
   - Models: Game, Device, GameDevice, SyncQueue, Settings, CacheEntry, ApiCache
   - SQLite at `prisma/dev.db`
   - Migrations via `prisma migrate deploy`

5. **Route Groups**
   - `(main)/` — All pages with Sidebar, Header, status bars
   - `(setup)/` — Setup wizard with standalone layout
   - `api/` — All API endpoints (no layout)

---

## 5. Screenshot Script

### scripts/take-screenshots.ts

- Uses Playwright (`@playwright/test`)
- Navigates to `http://localhost:3000` (assumes running dev server with seeded data)
- Takes full-page screenshot of Home page
- Saves to `docs/screenshots/home.png`
- Run manually: `pnpm tsx scripts/take-screenshots.ts`
- Playwright added as dev dependency

### Limitations

- Requires a running dev server with games in DB
- Not part of CI — run manually when screenshots need updating
- Only captures Home page (expand later if needed)

---

## Not in Scope

- API documentation
- Component guide
- Unraid community app template
- Changelog / release notes
- i18n
- Automated screenshot updates in CI
