# Next Session Plan

## What was done this session

### ROM Management & Sync (Priority 0) — COMPLETE
- **SyncQueue Prisma model** with relations to Game and Device (cascade delete)
- **Sync Queue API** — GET/POST/DELETE `/api/sync/queue`, DELETE `/api/sync/queue/[id]`
  - Path traversal validation (rejects `..`, null bytes, verifies within device scan roots)
  - Deduplication: only latest rename kept, no duplicate deletes
  - JSON body validation with try/catch
- **Sync Apply API** — POST `/api/sync/apply`
  - Atomic claim pattern (updateMany to "in_progress") prevents concurrent apply races
  - Crash recovery: stale in_progress items reset to "failed" after 5min
  - Groups items by device, one connection per device, disconnects after
  - Delete: removes file, removes GameDevice link, idempotent on ENOENT
  - Rename: renames file, verifies destination exists on ENOENT, updates originalFile only on single-device games
  - Orphan game cleanup after deletes
  - Failed items retryable on next Apply
- **GameFiles component** — "Files on Devices" section on game detail page
  - Per-device file list with reconstructed paths
  - Inline rename with pre-selected filename, Stage/Cancel/Enter/Escape
  - Delete with ConfirmDialog, strikethrough styling
  - Buttons hidden after staging rename (prevents conflicting ops)
  - Filename validation (rejects `/`, `\`, `..`)
- **SyncPanel drawer** — accessible from header Sync badge
  - Badge shows pending+failed count, hidden when 0
  - Drawer shows items grouped by device with type icons
  - Failed items shown with red styling and error messages
  - Individual remove, Clear All (with confirm), Apply All
  - Result summary after apply
  - 5-second polling for updates
- **Scan runner improvements**
  - Orphan game cleanup (games with zero device links deleted)
  - Stale SyncQueue cleanup for removed GameDevice links
  - Zero-game scan guard (skips cleanup on empty scan to prevent data loss)
  - Safe JSON.parse for device config (skips device on invalid config)
- **3 rounds of 4-agent review** (Codex code, Codex spec, Claude code, Claude spec)

### Symlink Support in File Manager (Priority 1) — COMPLETE
- SSH listDir uses SFTP readdir to detect symlinks via mode bits (was using `ls -1p`)
- SSH listDirDetailed resolves symlink targets via SFTP readlink
- FTP and Local connections also detect symlinks
- Symlinks shown with link icon (🔗) in file manager, navigable like directories
- Symlink target path displayed in file panel
- Scanner follows symlinked platform directories during ROM scan
- Sort order: directories first, symlinks second, files last

## Priority 0: Remaining from PLAN.md
- Theme Toggle (Dark/Light)
- Export/Backup (JSON/CSV)

## Known Issues
- Pokemon "Blaue Edition" (German ROM) not recognized in IGDB
- Plaintext device passwords in SQLite
- ScanBar, EnrichmentBar, TransferBar can overlap
- Buffer-based file transfer (max 2GB)
- FTP `readFile` with `maxBytes` doesn't abort transfer
- Concurrent transfers rejected (409) instead of queued
- Path reconstruction for multi-device games uses first platform dir alias — if ROM is in alternate alias, wrong path is staged
- Badge updates via 5s polling (not immediate after staging)

## Git State
- Branch: `master`
- All changes committed locally, NOT pushed to origin
- 12 new commits this session (6 feature + 3 fix rounds + symlink)
