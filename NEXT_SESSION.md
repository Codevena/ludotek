# Next Session Plan

## What was done this session (2026-04-14, Session 3)

### Phase 1.2 Duplicate Detection — SKIPPED
- Existing `cleanFilename()` + `deduplicateGames()` already handle most duplicate cases (region variants, format variants, multi-disc)
- Fuzzy matching rarely needed with consistent ROM sets (No-Intro, TOSEC)
- Cross-platform info folded into Phase 2.1 Insights instead

### Phase 2.1: Sammlung-Insights — COMPLETE
- **Design Spec**: `docs/superpowers/specs/2026-04-14-sammlung-insights-design.md`
- **Implementation Plan**: `docs/superpowers/plans/2026-04-14-sammlung-insights.md`
- **New API Route**:
  - `GET /api/insights` — Server-side aggregation: genres (top 10 + Other), eras (7 buckets + Unknown), franchises/developers/publishers (top 10 each), cross-platform games, totalGames, enrichedGames
- **New Page**:
  - `/insights` — Client component with Recharts:
    - Genre Distribution (Donut Chart with tooltip: count + %)
    - Era Distribution (Horizontal Bar Chart, era-specific colors: Atari-brown, NES-red, SNES-purple, PS1-grey, Dreamcast-orange, Xbox-green, Switch-rose)
    - Top 10 Franchises / Developers / Publishers (Ranked Cards)
    - Cross-Platform Games (compact list, conditional)
    - Loading skeletons, error state, empty states
- **Modified**:
  - `src/components/layout/sidebar.tsx` — "Insights" nav link with bar-chart SVG icon
- **No new Prisma models** — all aggregation on-the-fly from existing Game fields
- **4-Agent Review passed** (2x Codex, 2x Claude)

### Review Fixes Applied
- `Dawn of Gaming` era bucket minYear: 0 → 1977 (prevents pre-1977 corrupted dates from wrong classification)
- Era tooltip: removed percentage display (spec says count only for eras)
- Fetch error handling: `r.ok` guard + explicit error state UI
- Reverted prisma/schema.prisma formatting noise

## Next Up: Phase 2.2 — Smart Recommendations

**Roadmap**: `docs/superpowers/specs/2026-04-14-feature-roadmap.md` (Phase 2.2)

### Summary
1. **Franchise-Completion**: "Du hast 8 Zelda-Spiele — dir fehlen: Zelda II, Minish Cap, Spirit Tracks" (IGDB Franchise-API + Library-Abgleich)
2. **Genre-Exploration**: "Du liebst JRPGs — hast aber kein Tactical RPG. Probier: Fire Emblem, FFT, Disgaea" (Genre-Gap-Analyse)
3. **Hidden Gems**: Spiele mit hohem Score die kein bekanntes Franchise sind
4. **Cross-Platform**: "Super Mario RPG gibt's auch für SNES — du hast nur die Switch-Version"
5. **Integration**: Home-Page "Suggested for you" + Discover-Page Tab

### Key Design Decisions Still Needed
- IGDB Franchise-API Calls: bei Enrichment oder lazy bei Seitenaufruf?
- OpenRouter-Integration für "What to play next"
- Wie viele Recommendations pro Kategorie?
- Caching-Strategie für Franchise-Daten

## Remaining Roadmap
- Phase 3.1: Epoch-Navigation (Timeline UI mit Ären-spezifischem Styling)
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
