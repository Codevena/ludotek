# Next Session Plan

## What was done this session

### Spec C: Remote File Manager — DONE

19 commits implementing the full dual-panel file manager:

1. **DeviceConnection extensions** — Added `listDirDetailed`, `mkdir`, `rename`, `remove`, `readFile`, `writeFile`, `stat` to interface with SSH (SFTP) + FTP implementations
2. **Path validation helper** — `validateRemotePath` (blocks `..`, null bytes, root path), `loadDevice` (positive integer validation)
3. **Transfer progress store** — In-memory singleton for tracking cross-device transfer state
4. **Browse API upgrade** — Returns `DetailedDirEntry[]` with file sizes and modification dates
5. **File operation APIs** — `POST mkdir`, `POST rename`, `DELETE files` (multi-path with 207 partial), `GET preview`
6. **Transfer APIs** — `POST /api/devices/transfer` (background relay with progress), `GET status` (spec-compliant field names)
7. **FilePanel component** — Device selector, path bar, file list with checkboxes/sizes, inline mkdir/rename, delete with item listing
8. **FilePreviewModal** — Image (blob URL), text (code block with 100KB truncation), binary metadata
9. **TransferBar** — Fixed bottom bar with polling, progress display, success message, error auto-dismiss
10. **Files page** — Dual-panel layout at `/files` with Copy/Move in both directions
11. **Header nav** — "Files" link between Devices and Upload

### Review Findings Fixed (4 rounds)
- FTP `stat()` directory detection (verify via `list()`)
- Transfer TOCTOU race (lock before body parsing)
- Image preview 10MB cap
- Delete confirmation lists item names
- Move confirmation dialog
- `validateRemotePath` type safety + null-byte + root blocking
- Delete handler shows 207 partial errors
- `formatSize` binary consistency
- TransferBar error polling limit + auto-dismiss
- SSH `readFile` double-resolve guard
- Transfer target "/" allowed (allowRoot param)
- Stale selection paths (useEffect deps fixed)
- Transfer device ID integer validation
- Poll timer cleanup on unmount
- Transfer status API field names aligned with spec
- Self-move prevention with `posix.normalize`
- Self-move check ordered after path validation

### Review Status
All changes passed 4-agent review process (2x Codex, 2x Claude). Claude reviews: zero findings (code) + 15/15 pass (spec). Codex reviews: zero new code findings + 13/15 spec (remaining 2 are documented v1 design decisions: 409 instead of queue, inline regex instead of named function).

## What to do next — in priority order

### Priority 1: Remaining from original PLAN.md
- Theme Toggle (Dark/Light)
- Export/Backup (JSON/CSV)

### Known Issues
- Pokemon "Blaue Edition" (German ROM) not recognized as duplicate of "Pokemon Blue" in IGDB missing games — needs fuzzy cross-language matching
- Plaintext device passwords in SQLite (acceptable for local app, noted by reviewers)
- ScanBar, EnrichmentBar, and TransferBar can overlap if multiple are active simultaneously (all fixed bottom-0)
- Scan/transfer locks are process-local (fine for single-process local app)
- Buffer-based transfer (max 2GB read into memory) — streaming would require new connection interface
- FTP `readFile` with `maxBytes` doesn't abort network transfer (basic-ftp limitation)
- Concurrent transfers rejected with 409 instead of queued (v1 design)

## Git State
- Branch: `master`
- All changes committed locally, NOT pushed to origin
- 50+ commits ahead of remote

## Key Files Reference
| Area | Files |
|------|-------|
| Device model | `prisma/schema.prisma` |
| GameDevice join | `prisma/schema.prisma` (GameDevice model) |
| Connection layer | `src/lib/connection.ts` |
| Path validation | `src/lib/path-validation.ts` |
| Transfer progress | `src/lib/transfer-progress.ts` |
| Scanner | `src/lib/scanner.ts` |
| Scan progress | `src/lib/scan-progress.ts` |
| Scan runner | `src/lib/scan-runner.ts` |
| Scan context | `src/context/scan-context.tsx` |
| Scan bar | `src/components/scan-bar.tsx` |
| Device APIs | `src/app/api/devices/**` |
| File ops APIs | `src/app/api/devices/[id]/files/**` |
| Transfer APIs | `src/app/api/devices/transfer/**` |
| Scan APIs | `src/app/api/scan/**` |
| Games API | `src/app/api/games/route.ts` |
| Settings API | `src/app/api/settings/route.ts` |
| Files page | `src/app/files/page.tsx` |
| File panel | `src/components/file-panel.tsx` |
| File preview | `src/components/file-preview-modal.tsx` |
| Transfer bar | `src/components/transfer-bar.tsx` |
| Devices page | `src/app/devices/page.tsx` |
| File browser | `src/components/file-browser.tsx` |
| Device form | `src/components/device-form.tsx` |
| Game card | `src/components/game-card.tsx` |
| Header | `src/components/layout/header.tsx` |
| Admin | `src/app/admin/page.tsx` |
| Specs | `docs/superpowers/specs/` |
| Plans | `docs/superpowers/plans/` |
