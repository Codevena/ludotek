# Next Session Plan

## What was done this session

### Spec C: Remote File Manager — DONE
Full dual-panel file manager at `/files` (Total Commander style):
- DeviceConnection extended with CRUD methods (SSH SFTP + FTP + Local filesystem)
- API routes: mkdir, rename, delete, preview, cross-device transfer with progress
- FilePanel, FilePreviewModal, TransferBar, ConfirmDialog/AlertDialog components
- Hidden files toggle (`.* ` button), Local PC device support
- 4 rounds of 4-agent code review passed

### Post-Review Polish
- Custom modals replacing browser `confirm()`/`alert()` dialogs (vault theme)
- SFTP session caching (fixes "Channel open failure" on batch operations)
- Local filesystem protocol (`LocalConnection` class, device form, API validation)
- Hidden dotfiles filter with toggle
- Navigation freeze fix (useCallback for selection handlers)
- TransferBar moved to root layout (visible on all pages)
- Device filter: `window.location.reload()` instead of `router.refresh()`
- Game deduplication by `igdbId` in "All Devices" view
- Context-aware empty messages ("No games on this device")

## CRITICAL — What to fix next (Priority 0)

### Device Filter is BROKEN
**Problem:** When user switches device in the header dropdown, platform pages show "No games on this device for this platform" even though games exist. The device filter logic has fundamental issues:

**Root cause investigation needed:**
1. **GameDevice links may be incomplete** — Games might not be properly linked to devices via the `GameDevice` join table after scanning. Check `src/lib/scan-runner.ts` and `src/lib/scanner.ts` to verify that `GameDevice` records are created for every game found on each device during scan.

2. **Platform page server component caching** — `src/app/platform/[id]/page.tsx` reads `activeDeviceId` from Settings DB and filters with `where.devices = { some: { deviceId: activeDeviceId } }`. After `window.location.reload()`, the page should re-fetch from DB. But verify the Prisma query is actually returning results — add console.log in the platform page to debug.

3. **"All Devices" shows duplicates** — The deduplication by `igdbId` in `src/app/api/games/route.ts` only works for games that HAVE an igdbId. Games without IGDB enrichment (igdbId is null) won't be deduped. Also, if the same ROM is scanned from two devices and creates two separate `Game` records (different `originalFile`), they show as duplicates. The real fix might be: deduplicate Game records at scan time (match by title+platform, not just originalFile+platform).

4. **Sidebar game counts ignore device filter** — `src/components/layout/sidebar.tsx` fetches from `/api/platforms` which returns total game counts without device filter. When a device is selected, the sidebar still shows total counts which is misleading.

**Debug steps for next session:**
```bash
# Check GameDevice links
sqlite3 prisma/dev.db "SELECT d.name, COUNT(gd.id) FROM Device d LEFT JOIN GameDevice gd ON d.id = gd.deviceId GROUP BY d.id;"

# Check if games have igdbId for dedup
sqlite3 prisma/dev.db "SELECT COUNT(*) as total, COUNT(igdbId) as with_igdb FROM Game;"

# Check duplicate games (same title+platform, different originalFile)
sqlite3 prisma/dev.db "SELECT title, platform, COUNT(*) as cnt FROM Game GROUP BY title, platform HAVING cnt > 1 LIMIT 20;"
```

**Key files to investigate:**
- `src/lib/scanner.ts` — Does it create GameDevice links? Check `scanDevice()` function
- `src/lib/scan-runner.ts` — Orchestrates scan, should link games to devices
- `src/app/api/games/route.ts` — Deduplication logic (line ~57+)
- `src/app/platform/[id]/page.tsx` — Device filter in WHERE clause (line 46)
- `src/app/page.tsx` — Home page device filter (line 108)
- `src/components/layout/sidebar.tsx` — Game counts (no device filter applied)

### Local PC Scan Support
The Local PC device type was added (protocol "local", `LocalConnection` class) and the file browser works. BUT: the scanner (`src/lib/scanner.ts`) needs to handle `protocol: "local"` — currently it only scans via SSH/FTP connections. The scanner should use `LocalConnection` (or direct `fs` operations) when the device protocol is "local".

**Files:** `src/lib/scanner.ts`, `src/lib/scan-runner.ts`

## Priority 1: Remaining from original PLAN.md
- Theme Toggle (Dark/Light)
- Export/Backup (JSON/CSV)

## Known Issues
- Pokemon "Blaue Edition" (German ROM) not recognized as duplicate in IGDB missing games
- Plaintext device passwords in SQLite (acceptable for local app)
- ScanBar, EnrichmentBar, and TransferBar can overlap if multiple active simultaneously
- Scan/transfer locks are process-local
- Buffer-based file transfer (max 2GB in memory)
- FTP `readFile` with `maxBytes` doesn't abort network transfer
- Concurrent transfers rejected with 409 instead of queued

## Git State
- Branch: `master`
- All changes committed locally, NOT pushed to origin
- 55+ commits ahead of remote

## Key Files Reference
| Area | Files |
|------|-------|
| Prisma schema | `prisma/schema.prisma` |
| Connection layer | `src/lib/connection.ts` (SSH, FTP, Local) |
| Path validation | `src/lib/path-validation.ts` |
| Scanner | `src/lib/scanner.ts` |
| Scan runner | `src/lib/scan-runner.ts` |
| Scan progress | `src/lib/scan-progress.ts` |
| Transfer progress | `src/lib/transfer-progress.ts` |
| Scan context | `src/context/scan-context.tsx` |
| Games API | `src/app/api/games/route.ts` |
| Device APIs | `src/app/api/devices/**` |
| File ops APIs | `src/app/api/devices/[id]/files/**` |
| Transfer APIs | `src/app/api/devices/transfer/**` |
| Scan APIs | `src/app/api/scan/**` |
| Settings API | `src/app/api/settings/route.ts` |
| Home page | `src/app/page.tsx` |
| Platform page | `src/app/platform/[id]/page.tsx` |
| Files page | `src/app/files/page.tsx` |
| Devices page | `src/app/devices/page.tsx` |
| File panel | `src/components/file-panel.tsx` |
| File preview | `src/components/file-preview-modal.tsx` |
| Transfer bar | `src/components/transfer-bar.tsx` |
| Confirm dialog | `src/components/confirm-dialog.tsx` |
| Game grid | `src/components/infinite-game-grid.tsx` |
| Game card | `src/components/game-card.tsx` |
| Header | `src/components/layout/header.tsx` |
| Sidebar | `src/components/layout/sidebar.tsx` |
| Device form | `src/components/device-form.tsx` |
| File browser | `src/components/file-browser.tsx` |
| Admin | `src/app/admin/page.tsx` |
| Specs | `docs/superpowers/specs/` |
| Plans | `docs/superpowers/plans/` |
