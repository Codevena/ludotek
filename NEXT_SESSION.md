# Next Session Plan

## What was done this session

### Spec B: Scan Progress + Device Filter — DONE

12 commits implementing the full feature:

1. **GameDevice join model** — Prisma many-to-many linking games to devices, cascade deletes, unique constraint
2. **In-memory scan progress store** — Module-level Map for transient scan state
3. **Async scan runner** — `runScanInBackground()` with progress callbacks, GameDevice linking, stale link cleanup
4. **Scan API refactor** — POST /api/scan and /api/devices/[id]/scan now return immediately; GET /api/scan/status for polling
5. **ScanContext provider** — React context with 2s polling, mount-time detection of running scans, auto-dismiss
6. **ScanBar component** — Sticky bottom bar with progress %, status text, game counts, dismiss button
7. **Layout wiring** — ScanProvider + ScanBar in root layout alongside EnrichmentProvider
8. **Games API device filter** — `?deviceId=N` param filters via GameDevice join, includes device associations
9. **Home + Platform page filters** — Server components read activeDeviceId from Settings, apply filter, use React cache()
10. **Header refresh** — Device selector calls router.refresh() to re-render server components
11. **Device badges** — Colored pills on game cards showing device abbreviations (SD, RP, etc.)
12. **Devices page ScanContext** — Replaced local scan state with global ScanContext

### Review Findings Fixed
- TOCTOU race on scan guard (set scanning=true synchronously before async work)
- NaN validation on deviceId query param
- Stale GameDevice cleanup (including zero-game scans)
- Deduplicated settings queries with React cache()
- Auth on scan status endpoint
- `?deviceId=all` handling
- Percentage text in ScanBar
- `.catch()` on fire-and-forget promises
- Polling interval extracted to constant
- deviceAbbrev empty name guard

### Review Status
All changes passed 4-agent review process (2x Codex, 2x Claude) with all findings resolved.

## What to do next — in priority order

### Priority 1: Spec C — Remote File Manager
**Spec:** `docs/superpowers/specs/2026-04-14-remote-file-manager-design.md`
**Plan:** Not yet written — needs `writing-plans` skill

Features:
1. Dual-panel file manager at `/files` (Total Commander style)
2. Full CRUD: mkdir, rename, delete
3. Cross-device file transfer with progress
4. File preview (images, text files)
5. Multi-select with batch operations

### Priority 2: Remaining from original PLAN.md
- Theme Toggle (Dark/Light)
- Export/Backup (JSON/CSV)

### Known Issues
- Pokemon "Blaue Edition" (German ROM) not recognized as duplicate of "Pokemon Blue" in IGDB missing games — needs fuzzy cross-language matching
- Plaintext device passwords in SQLite (acceptable for local app, noted by reviewers)
- ScanBar and EnrichmentBar can overlap if both active simultaneously (both fixed bottom-0)
- Scan lock is process-local (fine for single-process local app, not for multi-worker deployment)
- Platform label fallback in rom-search.ts may not be slugified for platforms without explicit slug (pre-existing issue)

## Git State
- Branch: `master`
- All changes committed locally, NOT pushed to origin
- 30+ commits ahead of remote

## Key Files Reference
| Area | Files |
|------|-------|
| Device model | `prisma/schema.prisma` |
| GameDevice join | `prisma/schema.prisma` (GameDevice model) |
| Connection layer | `src/lib/connection.ts` |
| Scanner | `src/lib/scanner.ts` |
| Scan progress | `src/lib/scan-progress.ts` |
| Scan runner | `src/lib/scan-runner.ts` |
| Scan context | `src/context/scan-context.tsx` |
| Scan bar | `src/components/scan-bar.tsx` |
| Device APIs | `src/app/api/devices/**` |
| Scan APIs | `src/app/api/scan/route.ts`, `src/app/api/scan/status/route.ts` |
| Games API | `src/app/api/games/route.ts` |
| Settings API | `src/app/api/settings/route.ts` |
| Devices page | `src/app/devices/page.tsx` |
| File browser | `src/components/file-browser.tsx` |
| Device form | `src/components/device-form.tsx` |
| Game card | `src/components/game-card.tsx` |
| Header | `src/components/layout/header.tsx` |
| Admin | `src/app/admin/page.tsx` |
| Specs | `docs/superpowers/specs/` |
| Plans | `docs/superpowers/plans/` |
