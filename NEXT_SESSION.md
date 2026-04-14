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

## Next Up: Phase 3.2 — Auto-Organization

**Roadmap**: `docs/superpowers/specs/2026-04-14-feature-roadmap.md` (Phase 3.2)

### Summary
1. **Naming Convention Engine**: User wählt Konvention (No-Intro, TOSEC, Clean, Custom)
2. **Rename Preview**: Vorschau aller Umbenennungen, Conflict-Highlighting
3. **Batch-Rename via SyncQueue**: Umbenennungen in bestehende SyncQueue stagen → Review → Apply
4. **Ordnerstruktur-Vorschläge**: Falls ROMs nicht in erwarteten Plattform-Ordnern liegen

## Remaining Roadmap
- Phase 3.2: Auto-Organization (Naming Conventions, Batch Rename via SyncQueue)
- Phase 4.1: Onboarding & DX (Setup Wizard, Docker, README, Contributor Docs)
- Phase 4.2: PWA (optional)

## Bestehendes Backlog
- [ ] Scanner ES-DE Parity (Priority 0 — plan at `docs/superpowers/plans/2026-04-14-scanner-es-de-parity.md`)
- [ ] Theme Toggle (Dark/Light)
- [ ] Export/Backup (JSON/CSV)
- [ ] Platform Icons vervollständigen
- [ ] Plaintext Device-Passwörter verschlüsseln
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
