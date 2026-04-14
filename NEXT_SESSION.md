# Next Session Plan

## What was done this session

### ROM Search URL Bug (Priority 1) — FIXED
All 4 review findings resolved:
- `buildRomSearchUrl()` uses regex `/g` flag for all replacements
- `toggleWishlist` useCallback has `resolvedLabel` in dependency array
- Carousel description uses `resolvedLabel` instead of `platformId`
- IGDB error message switched from German to English
- **Root cause discovered & fixed:** Wishlist DB entries had `platformLabel = "snes"` instead of `"Super Nintendo"`. Fixed the API to always resolve from `PLATFORM_CONFIG` on both read and write.
- Added `slug` field to `PLATFORM_CONFIG` for platforms where the ROM site slug differs from the slugified label (e.g. megadrive → `sega-genesis`)
- Raised IGDB `total_rating_count` threshold from 10 to 50 to filter out inflated scores on niche titles

### Device Management System — NEW FEATURE
Full multi-device support implemented:
- **Prisma Device model** — name, type (steamdeck/android/custom), protocol (ssh/ftp), host, port, user, password, scanPaths (JSON), blacklist (JSON)
- **Connection abstraction** (`src/lib/connection.ts`) — SSH + FTP with unified `DeviceConnection` interface
- **Device CRUD API** — `/api/devices` with full CRUD, input validation, password masking
- **Remote File Browser** — `/api/devices/[id]/browse` endpoint, `<FileBrowser>` React component
- **Connection testing** — `/api/devices/[id]/test` and `/api/devices/test-connection` (pre-save)
- **Scanner refactor** — `scanDevice()` replaces hardcoded paths, blacklist filtering with wildcard support
- **Auto-migration** — legacy SSH settings auto-converted to Device on first scan
- **Devices page** (`/devices`) — file browser + scan path management + blacklist editing
- **Admin integration** — device CRUD in admin settings

### Device UX Polish (Spec A) — DONE
- Scan result shows game counts: "Found X games (Y new, Z updated)"
- Device editing in Admin Settings (Edit button per device, inline DeviceForm)
- `activeDeviceId` in Settings — global active device concept
- Header active device selector dropdown
- Admin default device dropdown
- Devices page auto-selects active device

### Review Status
All changes passed 4-agent review process (2x Codex, 2x Claude) with zero remaining findings.

## What to do next — in priority order

### Priority 1: Spec B — Scan Progress + Device Filter
**Spec:** `docs/superpowers/specs/2026-04-14-scan-progress-device-filter-design.md`
**Plan:** Not yet written — needs `writing-plans` skill

Features:
1. **GameDevice join model** — links games to devices (many-to-many)
2. **Enrichment-style scan progress bar** — sticky ScanBar, ScanContext, async scan with polling
3. **Device filter in header** — "All Devices" selector filters library view
4. **Device badges on game cards** — always show which devices have each game

### Priority 2: Spec C — Remote File Manager
**Spec:** `docs/superpowers/specs/2026-04-14-remote-file-manager-design.md`
**Plan:** Not yet written

Features:
1. Dual-panel file manager at `/files` (Total Commander style)
2. Full CRUD: mkdir, rename, delete
3. Cross-device file transfer with progress
4. File preview (images, text files)
5. Multi-select with batch operations

### Priority 3: Remaining from original PLAN.md
- Theme Toggle (Dark/Light)
- Export/Backup (JSON/CSV)

### Known Issues
- Pokemon "Blaue Edition" (German ROM) not recognized as duplicate of "Pokemon Blue" in IGDB missing games — needs fuzzy cross-language matching
- Plaintext device passwords in SQLite (acceptable for local app, noted by reviewers)

## Git State
- Branch: `master`
- All changes committed locally, NOT pushed to origin
- 20+ commits ahead of remote

## Key Files Reference
| Area | Files |
|------|-------|
| Device model | `prisma/schema.prisma` |
| Connection layer | `src/lib/connection.ts` |
| Scanner | `src/lib/scanner.ts` |
| Device APIs | `src/app/api/devices/**` |
| Settings API | `src/app/api/settings/route.ts` |
| Devices page | `src/app/devices/page.tsx` |
| File browser | `src/components/file-browser.tsx` |
| Device form | `src/components/device-form.tsx` |
| Header | `src/components/layout/header.tsx` |
| Admin | `src/app/admin/page.tsx` |
| Specs | `docs/superpowers/specs/` |
| Plans | `docs/superpowers/plans/` |
