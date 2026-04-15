# README, Docker & Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Professional open-source presentation for Ludotek — README overhaul, Docker image distribution via GHCR, contributor documentation, and architecture overview.

**Architecture:** All documentation/config files. No application code changes. GitHub Actions workflow for automated Docker image builds. Playwright script for screenshot generation.

**Tech Stack:** Markdown, Docker, GitHub Actions, Playwright

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `README.md` | Rewrite | Project overview, features, quick-start, tech stack |
| `docker-compose.yml` | Rewrite | User-facing: pulls GHCR image, no build |
| `docker-compose.dev.yml` | Create | Contributor-facing: local build |
| `.github/workflows/docker-publish.yml` | Create | Automated image build + push to GHCR |
| `CONTRIBUTING.md` | Create | Setup, conventions, PR workflow |
| `docs/architecture.md` | Create | System overview, data flow, key abstractions |
| `LICENSE` | Create | MIT license |
| `scripts/take-screenshots.ts` | Create | Playwright screenshot of Home page |
| `docs/screenshots/.gitkeep` | Create | Directory for generated screenshots |

---

### Task 1: LICENSE

**Files:**
- Create: `LICENSE`

- [ ] **Step 1: Create MIT license**

```
MIT License

Copyright (c) 2026 Codevena

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Commit**

```bash
git add LICENSE
git commit -m "docs: add MIT license"
```

---

### Task 2: Docker Compose Files

**Files:**
- Rewrite: `docker-compose.yml`
- Create: `docker-compose.dev.yml`

- [ ] **Step 1: Rewrite docker-compose.yml for GHCR image**

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

- [ ] **Step 2: Create docker-compose.dev.yml for local builds**

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

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml docker-compose.dev.yml
git commit -m "feat(docker): split compose into user (GHCR) and dev (local build)"
```

---

### Task 3: GitHub Actions Docker Workflow

**Files:**
- Create: `.github/workflows/docker-publish.yml`

- [ ] **Step 1: Create workflow file**

```yaml
name: Build and Push Docker Image

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=raw,value=latest,enable={{is_default_branch}}
            type=sha,prefix=

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          platforms: linux/amd64,linux/arm64
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

- [ ] **Step 2: Commit**

```bash
mkdir -p .github/workflows
git add .github/workflows/docker-publish.yml
git commit -m "ci: add GitHub Actions workflow for Docker image publishing"
```

---

### Task 4: CONTRIBUTING.md

**Files:**
- Create: `CONTRIBUTING.md`

- [ ] **Step 1: Create the file**

```markdown
# Contributing to Ludotek

Thanks for your interest in contributing! This guide will help you get set up.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) (recommended) or npm
- Git

## Getting Started

```bash
git clone https://github.com/Codevena/ludotek.git
cd ludotek
pnpm install
cp .env.example .env
pnpm prisma migrate deploy
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Code Conventions

- **Logging:** Use `console.warn` / `console.error` — pre-commit hooks reject custom loggers
- **ORM:** Prisma 6.x only (not 7.x — incompatible config format)
- **Styling:** Tailwind CSS with the vault theme (`vault-bg`, `vault-text`, `vault-amber`, `vault-border`, `vault-muted`, `vault-surface`, `vault-dark`)
- **TypeScript:** Strict mode, fix all type errors before committing
- **Build check:** Run `pnpm build` before committing — it type-checks the entire project

## Project Structure

```
src/
  app/                # Next.js App Router
    (main)/           # Pages with Sidebar + Header layout
    (setup)/          # Setup wizard (standalone layout)
    api/              # API endpoints
  components/         # React components
  lib/                # Core logic (scanner, connection, enrichment, etc.)
  context/            # React context providers (scan, enrichment)
prisma/               # Schema, migrations, SQLite database
data/                 # Cached images (covers, screenshots, artwork)
scripts/              # Utility scripts
docs/                 # Documentation and specs
```

## Making Changes

1. Create a feature branch from `master`
2. Make your changes
3. Run `pnpm build` to verify everything compiles
4. Commit with a descriptive message using conventional prefixes:
   - `feat:` — new feature
   - `fix:` — bug fix
   - `chore:` — maintenance
   - `docs:` — documentation
5. Open a PR against `main`

## Docker Development

To run the app in Docker with local code changes:

```bash
docker compose -f docker-compose.dev.yml up --build
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./dev.db` | SQLite database path |
| `ADMIN_TOKEN` | _(empty)_ | Optional auth token (empty = no auth) |
| `OPENROUTER_MODEL` | `google/gemini-3.1-flash-lite-preview` | AI model for Discover & Stories |

All other settings (IGDB keys, devices, scan paths) are configured through the UI.
```

- [ ] **Step 2: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs: add CONTRIBUTING.md with setup and conventions"
```

---

### Task 5: Architecture Documentation

**Files:**
- Create: `docs/architecture.md`

- [ ] **Step 1: Create the file**

```markdown
# Ludotek Architecture

## Overview

Ludotek is a self-hosted web app for managing retro game ROM collections. It connects to devices (Steam Deck, Android, local PC) via SSH/FTP, scans for ROMs, enriches them with metadata from IGDB, and presents a browsable library.

```
Browser
  │
  ▼
Next.js App Router (React Server Components + Client Components)
  │
  ├── API Routes (/api/*)
  │     │
  │     ├── Prisma ORM ──► SQLite (prisma/dev.db)
  │     │
  │     ├── External APIs
  │     │     ├── IGDB (covers, ratings, metadata)
  │     │     ├── OpenRouter (AI recommendations, stories)
  │     │     └── SteamGridDB (alternative cover art)
  │     │
  │     └── Device Connections
  │           ├── SSH (Steam Deck, Linux)
  │           ├── FTP (Android)
  │           └── Local (filesystem)
  │
  └── Static Assets + Cached Images (data/)
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
Device ──SSH/FTP──► listDir ──► parseRomListing ──► cleanFilename ──► dedup ──► Prisma (Game + GameDevice)
```

### 2. Enrichment
```
Game (title + platform) ──► IGDB search ──► metadata + cover URL ──► cache images to data/ ──► update Game record
```

### 3. Browsing
```
Browser ──► /api/games?sort=title ──► Prisma query ──► JSON ──► InfiniteGameGrid (client component)
```

### 4. File Sync
```
UI action ──► POST /api/sync/queue ──► SyncQueue (pending) ──► user reviews ──► POST /api/sync/apply ──► Connection.rename/remove
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
```

- [ ] **Step 2: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: add architecture overview"
```

---

### Task 6: Screenshot Script

**Files:**
- Create: `scripts/take-screenshots.ts`
- Create: `docs/screenshots/.gitkeep`

- [ ] **Step 1: Install Playwright**

```bash
pnpm add -D playwright
```

- [ ] **Step 2: Create screenshots directory**

```bash
mkdir -p docs/screenshots
touch docs/screenshots/.gitkeep
```

- [ ] **Step 3: Create the script**

```typescript
// scripts/take-screenshots.ts
import { chromium } from "playwright";
import path from "path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const OUTPUT_DIR = path.resolve(__dirname, "../docs/screenshots");

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });

  console.warn(`Taking screenshots from ${BASE_URL}...`);

  // Home page
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000); // let images load
  await page.screenshot({
    path: path.join(OUTPUT_DIR, "home.png"),
    fullPage: false,
  });
  console.warn("Saved: docs/screenshots/home.png");

  await browser.close();
  console.warn("Done!");
}

main().catch((err) => {
  console.error("Screenshot failed:", err);
  process.exit(1);
});
```

- [ ] **Step 4: Test the script**

Start the dev server in another terminal, then:

```bash
pnpm tsx scripts/take-screenshots.ts
```

Expected: `docs/screenshots/home.png` created. If no games in DB, it will show an empty home page — that's fine for now.

Note: `pnpm playwright install chromium` may be needed on first run.

- [ ] **Step 5: Commit**

```bash
git add scripts/take-screenshots.ts docs/screenshots/.gitkeep package.json pnpm-lock.yaml
git commit -m "feat: add Playwright screenshot script"
```

---

### Task 7: README.md

**Files:**
- Rewrite: `README.md`

This is the main deliverable. It references the screenshot (if it exists), links to CONTRIBUTING.md, and provides Docker + manual quick-start.

- [ ] **Step 1: Rewrite README.md**

````markdown
<div align="center">
  <img src="logo.png" alt="Ludotek" width="120" />
  <h1>Ludotek</h1>
  <p><strong>Your personal retro game library — scan, enrich, browse.</strong></p>
  <p>
    Ludotek scans your devices for ROMs, enriches them with metadata from IGDB,
    and gives you a beautiful library to explore your collection.
  </p>

  <p>
    <img src="https://img.shields.io/badge/Next.js-15-black?logo=next.js" alt="Next.js" />
    <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma" alt="Prisma" />
    <img src="https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite" alt="SQLite" />
    <img src="https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss" alt="Tailwind" />
    <img src="https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker" alt="Docker" />
  </p>
</div>

---

![Ludotek Home](docs/screenshots/home.png)

## Features

- **Device Scanning** — Connect via SSH, FTP, or local filesystem. Auto-detect ROMs across 50+ platforms.
- **IGDB Enrichment** — Covers, ratings, release dates, genres, developer info, and summaries.
- **AI-Powered Discover** — Smart game recommendations and AI-generated stories via OpenRouter.
- **Timeline** — Browse your collection by gaming era, from 8-bit classics to modern retro.
- **Insights** — Genre distribution, top franchises, era charts, and collection analytics.
- **Setup Wizard** — Guided first-run setup. Add a device, configure scan paths, enter API keys.
- **File Manager** — Browse, rename, and delete ROMs on connected devices.
- **ROM Upload** — Upload ROMs from your browser with automatic format detection.
- **Docker Ready** — One-command deployment with persistent volumes.

## Quick Start

### Docker (recommended)

```bash
curl -O https://raw.githubusercontent.com/Codevena/ludotek/main/docker-compose.yml
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000) — the setup wizard will guide you through configuration.

### Manual

```bash
git clone https://github.com/Codevena/ludotek.git
cd ludotek
pnpm install
cp .env.example .env
pnpm prisma migrate deploy
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./dev.db` | SQLite database path |
| `ADMIN_TOKEN` | _(empty)_ | Optional auth token. Empty = no authentication. |
| `OPENROUTER_MODEL` | `google/gemini-3.1-flash-lite-preview` | AI model for Discover & Stories |

All other settings (IGDB API keys, devices, scan paths) are configured through the UI after first launch.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and guidelines.

See [docs/architecture.md](docs/architecture.md) for a system overview.

## License

[MIT](LICENSE)
````

- [ ] **Step 2: Verify screenshot reference**

If `docs/screenshots/home.png` doesn't exist yet, the image will show as broken. That's acceptable — it will render once the screenshot script is run against a seeded database.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README with features, quick-start, and badges"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | MIT License | `LICENSE` |
| 2 | Docker compose split | `docker-compose.yml`, `docker-compose.dev.yml` |
| 3 | GitHub Actions workflow | `.github/workflows/docker-publish.yml` |
| 4 | Contributor guide | `CONTRIBUTING.md` |
| 5 | Architecture docs | `docs/architecture.md` |
| 6 | Screenshot script | `scripts/take-screenshots.ts`, `docs/screenshots/.gitkeep` |
| 7 | README overhaul | `README.md` |
