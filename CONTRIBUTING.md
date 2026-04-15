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
