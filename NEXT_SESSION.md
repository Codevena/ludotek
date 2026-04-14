# Next Session Plan

## What was done this session

### ROM Management & Sync — COMPLETE
- SyncQueue Prisma model, Queue API (GET/POST/DELETE), Apply API with atomic claim + crash recovery
- GameFiles component on game detail page (rename/delete staging with inline editor)
- SyncPanel drawer in header (badge, queue grouped by device, apply all, clear all, retry failed)
- Security: path traversal validation, race condition prevention, in_progress item protection
- Multi-device rename guard (only updates originalFile on single-device games)
- Orphan game cleanup in scan-runner and apply

### Symlink Support — COMPLETE
- SSH listDir uses SFTP readdir to detect symlinks via mode bits
- FTP and Local connections also detect symlinks
- Symlinks shown with link icon in file manager, navigable like directories
- Scanner follows symlinked platform directories

### Scanner Overhaul — COMPLETE
- Extension filtering: only platform-valid extensions + .7z/.zip universally accepted
- Multi-disc: .m3u playlists imported as game entries (disc-based platforms only)
- -multidisc directories skipped (discs represented by .m3u in parent dir)
- Directories filtered via type !== "dir" (not just extension check)
- Expanded skip list: .txt, .log, .sh, .lua, .toml, .ini, .bak, .pat, .ps
- deduplicateGames collapses disc variants by title+platform

### Admin Improvements
- Danger Zone: Wipe per-device or all games (with double-confirm)
- Scan button uses ScanContext for progress feedback (ScanBar)
- Settings API auto-creates record on first access (upsert)
- "Enrich" renamed to "Metadata" everywhere for clarity
- "Surprise Me" replaced with "Get Metadata" on platform pages
- Empty library hint replaces confusing "Device filter not working" warning

### Platform Icons
- 5 Wikimedia Commons logos downloaded (wii, nds, neogeo, ps3, xbox)
- Download script for remaining ~30 platforms: `bash scripts/download-platform-icons.sh`

### Security (4 rounds of 4-agent review)
- Path traversal validation on all endpoints (browse, sync queue, file operations)
- Atomic claim pattern in sync apply (prevents concurrent apply races)
- Crash recovery for stale in_progress items (5min timeout)
- DELETE queue/[id] rejects in_progress items
- Filename validation (rejects /, \, ..)
- JSON body validation with try/catch
- Zero-game scan guard (skips cleanup on empty scan)

## Priority 0: Scanner ES-DE Parity

**Plan**: `docs/superpowers/plans/2026-04-14-scanner-es-de-parity.md`

### Summary
1. **Expand platforms.ts** from 51 to ~95 systems with complete extensions + `subdir` field
2. **Recursive scan** within platform directories (depth 2) for ROMs in subdirectories
3. **IGDB mappings** for new systems

### Key Details
- Xbox, Wii U, Xbox 360, Model 2 have ROMs in `{platform}/roms/` subdirectory — new `subdir` field handles this
- Many platforms need additional dir aliases (megadrivejp, saturnjp, sega32xjp, etc.)
- Extensions need completion from ES-DE defaults (NES: .fds/.unf, SNES: .swc/.fig, N3DS: .3dsx/.cci/.cxi, etc.)
- New platforms: Atari Jaguar CD, Atari ST, Atari 800, Sega Model 2, Odyssey 2, Channel F, BBC Micro, X68000, PICO-8
- Steam Deck has 185 ROM directories, ~25 with actual content

### Steam Deck ROM Structure (reference)
```
/home/deck/EmuVirtual/Emulation/roms/
├── xbox/roms/*.iso          ← subdir: "roms"
├── xbox360/roms/*.iso       ← subdir: "roms"  
├── wiiu/roms/*.wux          ← subdir: "roms"
├── model2/roms/*.zip        ← subdir: "roms"
├── snes/*.7z                ← direct (most platforms)
├── psx/*.chd + *.m3u        ← .m3u for multi-disc
├── psx-multidisc/*.chd      ← skipped (handled by .m3u)
└── 3ds -> n3ds              ← symlink (already handled)
```

## Priority 1: Remaining from PLAN.md
- Theme Toggle (Dark/Light)
- Export/Backup (JSON/CSV)
- Platform icons: run `bash scripts/download-platform-icons.sh` when Wikimedia rate limit clears

## Known Issues
- Pokemon "Blaue Edition" (German ROM) not recognized in IGDB
- Plaintext device passwords in SQLite
- ScanBar, EnrichmentBar, TransferBar can overlap
- Buffer-based file transfer (max 2GB)
- FTP readFile with maxBytes doesn't abort transfer
- Concurrent transfers rejected (409) instead of queued
- Path reconstruction uses first platform dir alias (dirs[0]) — wrong if ROM is in alternate alias
- Badge updates via 5s polling (not immediate after staging)

## Git State
- Branch: `master`
- All changes committed locally, NOT pushed to origin
- 22 new commits this session
- Devices: Steam Deck (192.168.178.131), Retroid Pocket (192.168.178.21)
- DB was reset this session — devices need reconfiguring after fresh clone

## Dev Notes
- Use `pnpm build` before every commit (pre-commit hooks enforce console.warn/error)
- Use `console.warn`/`console.error` instead of custom logger
- Prisma 6.x only (not 7.x)
- DB: SQLite at prisma/dev.db
- Clear `.next` cache if build gives cryptic errors: `rm -rf .next`
