# Next Session Plan

## What was done this session (2026-04-14, Session 4)

### Phase 2.2 Smart Recommendations — SKIPPED
- Existing Discover page (`/discover`) already covers all planned use-cases: Genre-Exploration (Wizard), Hidden Gems (Library tab), Cross-Platform (Wishlist tab)
- AI-powered approach via OpenRouter delivers better results than pure data-driven logic
- Cross-platform info already shown in Insights

### Phase 3.1: Epoch-Navigation (Timeline) — COMPLETE
- **Design Spec**: `docs/superpowers/specs/2026-04-14-epoch-navigation-design.md`
- **Implementation Plan**: `docs/superpowers/plans/2026-04-14-epoch-navigation.md`
- **New Shared Module**:
  - `src/lib/eras.ts` — ERA_BUCKETS with slug, shortName, color, minYear/maxYear. Used by both Insights and Timeline.
- **New API Routes**:
  - `GET /api/timeline/counts` — Returns `[{slug, count}]` per era (parallel DB COUNT queries)
  - `GET /api/games?era=<slug>` — Era filter on existing games endpoint (releaseDate range, 400 on invalid slug)
- **New Page**:
  - `/timeline` — Client component with:
    - Sticky EraBar (horizontal pills with era colors, shortName + count, aria-pressed)
    - EraHeader (era name colored, date range, game count, platform tags)
    - InfiniteGameGrid reuse with era filter
    - Subtle radial background gradient in era color (500ms transition)
    - AbortController for race condition protection
    - Error states with retry for both counts and games fetches
    - Loading skeletons
- **Modified**:
  - `src/app/api/insights/route.ts` — Imports ERA_BUCKETS from shared `eras.ts`
  - `src/components/layout/sidebar.tsx` — Timeline link with clock icon after Insights
- **No new Prisma models** — uses existing releaseDate field
- **4-Agent Review passed** (2x Codex, 2x Claude, 2 rounds)

### Review Fixes Applied (Round 1)
- fetchUrl: URLSearchParams statt string interpolation (URL encoding)
- Invalid era slug: returns 400 statt silent ignore
- Race condition: AbortController + cleanup
- Error state: clear stale games + retry button
- Empty reduce guard: early return on empty counts
- aria-pressed on era pill buttons
- Counts endpoint: parallel prisma.count statt O(n*eras) in-memory

### Review Fixes Applied (Round 2)
- Counts fetch error: error state + retry statt permanent skeleton

### Phase 3.2: Auto-Organization — SKIPPED
- Game Vault zeigt bereits saubere Titel via cleanFilename() + IGDB-Enrichment
- Batch-Rename birgt Risiko (bricht ES-DE/RetroArch-Scraper-Mappings)
- Einzel-Rename existiert bereits im Game-Detail via SyncQueue

### Phase 4.1a: Setup-Wizard — COMPLETE (2026-04-14)
- **Design Spec**: `docs/superpowers/specs/2026-04-14-setup-wizard-design.md`
- **Implementation Plan**: `docs/superpowers/plans/2026-04-14-setup-wizard.md`
- **Route Groups**: Restructured app to `(main)/` and `(setup)/` route groups
  - Root layout: html/body/fonts/providers only
  - `(main)/layout.tsx`: Sidebar, Header, ScanBar, EnrichmentBar, TransferBar
  - `(setup)/setup/`: Standalone centered layout, no chrome
- **New Files**:
  - `src/app/api/setup-status/route.ts` — Returns `{needsSetup: boolean}`
  - `src/app/(setup)/setup/layout.tsx` — Standalone layout
  - `src/app/(setup)/setup/page.tsx` — Renders SetupWizard
  - `src/components/setup-wizard.tsx` — 5-step wizard (Welcome, Device, Paths, API Keys, Scan)
  - `src/components/setup-redirect.tsx` — Client redirect on Home when setup needed
- **Modified**: `src/app/(main)/page.tsx` — SetupRedirect component added
- **4-Agent Review passed** (2x Codex, 2x Claude, 2 rounds)

### Review Fixes Applied (Round 1)
- Connection failure no longer advances wizard (stays on Step 2)
- handleSubmit uses setError instead of throw
- handleAddPath/handleRemovePath check API response, revert on failure
- setup-status route: try/catch + force-dynamic
- Labels htmlFor/id for WCAG 1.3.1 accessibility
- Device name/type shown in Step 5 summary
- ScanPath type extracted to avoid inline repetition

### Review Fixes Applied (Round 2)
- StepDevice: full try/catch wrapper, settings PUT checked
- StepPaths: rollback snapshot before optimistic update, disable during persist
- StepApiKeys: disable Skip while save in flight
- Route group restructure: /setup now truly standalone (no Sidebar/Header)

### Phase 4.1b: README, Docker, Docs — COMPLETE (2026-04-15)
- **Design Spec**: `docs/superpowers/specs/2026-04-15-readme-docker-docs-design.md`
- **Implementation Plan**: `docs/superpowers/plans/2026-04-15-readme-docker-docs.md`
- **README.md**: Hero mit Logo, Feature-Liste, Docker + Manual Quick-Start, Tech-Badges, Config-Tabelle
- **Docker**:
  - `docker-compose.yml` — User-facing, pulls `ghcr.io/codevena/ludotek:latest`
  - `docker-compose.dev.yml` — Contributor-facing, local build
  - `.github/workflows/docker-publish.yml` — Auto-build + push to GHCR on push to main
- **CONTRIBUTING.md**: Prerequisites, Setup, Code Conventions, Projektstruktur, PR-Workflow
- **docs/architecture.md**: System-Diagramm, Key Abstractions, Data Flow, DB Models, Route Groups
- **LICENSE**: MIT
- **scripts/take-screenshots.ts**: Playwright screenshot script (Home page)
- **Cleanup**: Dead ENV vars entfernt (.env.example, docker-compose), Repo umbenannt zu `Codevena/ludotek`

### Backlog: Secret Encryption — COMPLETE (2026-04-15)
- **Design Spec**: `docs/superpowers/specs/2026-04-15-secret-encryption-design.md`
- **Implementation Plan**: `docs/superpowers/plans/2026-04-15-secret-encryption.md`
- AES-256-GCM field-level encryption for Device.password + Settings API keys
- Key management: ENV `ENCRYPTION_KEY` → `data/.encryption-key` → auto-generate
- Auto-migration at startup via Next.js instrumentation hook
- Encrypt on write (device create/update, settings update)
- Decrypt on read (20+ route files using getDecryptedDevice/getDecryptedSettings)
- 4-Agent Review passed (2x Codex, 2x Claude)

## Next Up

Backlog items to brainstorm:
- Scanner ES-DE Parity (Priority 0)
- Theme Toggle (Dark/Light)

## Remaining Roadmap
- Phase 4.2: PWA (optional)

## Bestehendes Backlog
- [ ] Scanner ES-DE Parity (Priority 0 — plan at `docs/superpowers/plans/2026-04-14-scanner-es-de-parity.md`)
- [ ] Theme Toggle (Dark/Light)
- [ ] Export/Backup (JSON/CSV)
- [ ] Platform Icons vervollständigen
- [x] ~~Plaintext Device-Passwörter verschlüsseln~~ (DONE)
- [ ] Progress-Bar Overlap fixen (ScanBar/EnrichmentBar/TransferBar)
- [ ] Buffer-basierter File-Transfer (2GB Limit)
- [ ] Concurrent Transfer Queue statt 409

## Git State
- Branch: `master`
- All changes committed locally, NOT pushed to origin
- Devices: Steam Deck (192.168.178.131), Retroid Pocket (192.168.178.21)

## Dev Notes
- Use `pnpm build` before every commit (pre-commit hooks enforce console.warn/error)
- Use `console.warn`/`console.error` instead of custom logger
- Prisma 6.x only (not 7.x)
- DB: SQLite at prisma/dev.db
- Clear `.next` cache if build gives cryptic errors: `rm -rf .next`
- Review process: 4-agent review (2x Codex, 2x Claude) mandatory before completion
- Note: DB has 2504 games but 0 with releaseDate — Timeline will populate after IGDB enrichment
