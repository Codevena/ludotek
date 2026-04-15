# Next Session Plan

## What was done this session (2026-04-15, Session 5)

### Backlog: Theme Toggle (Dark/Light) — COMPLETE
- **Design Spec**: `docs/superpowers/specs/2026-04-15-theme-toggle-design.md`
- **Implementation Plan**: `docs/superpowers/plans/2026-04-15-theme-toggle.md`
- **Approach**: CSS custom properties (RGB channels) + `next-themes` — zero component file changes needed
- **Light palette**: "Warm Stone" — warm off-white (`#fafaf9` bg, `#f0efed` surface, `#d6d3d1` border)
- **Key files changed**:
  - `src/app/globals.css` — `:root` (light) and `.dark` (dark) CSS variables for all vault tokens + prose overrides
  - `tailwind.config.ts` — `darkMode: "class"`, vault colors now `rgb(var(--vault-*) / <alpha-value>)`
  - `src/app/layout.tsx` — `ThemeProvider` wrapper, `suppressHydrationWarning`, `disableTransitionOnChange`
  - `src/components/theme-toggle.tsx` — NEW: sun/moon icon, cycles dark → light → system
  - `src/components/layout/header.tsx` — ThemeToggle after device selector with divider
  - `src/components/stats-dashboard.tsx` + `insights/page.tsx` — chart colors → CSS vars
  - `src/components/markdown-content.tsx` — removed `prose-invert`, `text-vault-muted`, `prose-strong:text-white` overrides
- **4-Agent Review passed** (2x Codex, 2x Claude, 3 rounds)

### Review Fixes Applied (Round 1)
- Prose body/bold: dedicated `--vault-prose-body` and `--vault-prose-bold` CSS variables (spec-exact values)
- ThemeToggle: cycle dark → light → system (was only dark ↔ light)
- ThemeProvider: added `disableTransitionOnChange` to prevent transition flash

### Review Fixes Applied (Round 2)
- `prose-strong:text-white` override removed from `markdown-content.tsx`

### Review Fixes Applied (Round 3)
- `prose-invert` and `text-vault-muted` removed from markdown container (conflicted with CSS variables)

### Scanner ES-DE Parity — Already Done (Session 4)
- Confirmed all 3 files (platforms.ts, scanner.ts, igdb.ts) already match plan from commit `aa1c66c` + fixes

## Previous Sessions
- Session 4 (2026-04-14): Timeline, Setup Wizard, README/Docker/Docs, Secret Encryption
- Session 3: Discover page, AI content, Transfer system
- Session 2: Game detail, Enrichment, Sidebar
- Session 1: Initial setup, Scanner, Platform config

## Next Up

Backlog items to brainstorm:
- Export/Backup (JSON/CSV)
- Platform Icons vervollständigen

## Remaining Roadmap
- Phase 4.2: PWA (optional)

## Bestehendes Backlog
- [x] ~~Scanner ES-DE Parity~~ (DONE)
- [x] ~~Theme Toggle (Dark/Light)~~ (DONE)
- [x] ~~Plaintext Device-Passwörter verschlüsseln~~ (DONE)
- [ ] Export/Backup (JSON/CSV)
- [ ] Platform Icons vervollständigen
- [ ] Progress-Bar Overlap fixen (ScanBar/EnrichmentBar/TransferBar)
- [ ] Buffer-basierter File-Transfer (2GB Limit)
- [ ] Concurrent Transfer Queue statt 409
- [ ] Scanner test fixen (`__tests__/lib/scanner.test.ts` — 1 failing test seit ES-DE parity, Extensions geändert)

## Git State
- Branch: `master`
- All changes committed locally, NOT pushed to origin
- Remote: `Codevena/ludotek` on GitHub
- Devices: Steam Deck (192.168.178.131), Retroid Pocket (192.168.178.21)

## Dev Notes
- Use `pnpm build` before every commit (pre-commit hooks enforce console.warn/error)
- Use `console.warn`/`console.error` instead of custom logger
- Prisma 6.x only (not 7.x)
- DB: SQLite at prisma/dev.db
- Clear `.next` cache if build gives cryptic errors: `rm -rf .next`
- Review process: 4-agent review (2x Codex, 2x Claude) mandatory before completion
- Note: DB has 2504 games but 0 with releaseDate — Timeline will populate after IGDB enrichment
- Theme: CSS custom properties in globals.css (RGB channels), `next-themes` for system detection + persistence
- Secrets: AES-256-GCM encryption in `src/lib/encryption.ts`
- App uses Route Groups: `(main)/` for pages with Sidebar, `(setup)/` for Setup-Wizard
