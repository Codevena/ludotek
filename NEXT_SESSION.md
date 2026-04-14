# Next Session Plan

## What was done this session

### Device Filter & Dedup Fixes
- **Root cause found**: GameDevice table had 0 records — games scanned before device-link code existed
- Cross-device dedup: match by `originalFile+platform` first, then `title+platform` fallback
- Scan-runner now upserts Platform records (were missing from sidebar)
- Sidebar, Stats Dashboard, and Platform API all respect `activeDeviceId`
- Pagination total adjusted after client-side dedup
- Scanner filters `.m3u/.cue/.sbi` files automatically

### Platform Expansion (18 → 51)
- Added: NDS, Wii, Wii U, PSP, PS3, PS Vita, Xbox OG, Atari (2600/5200/7800/Lynx/Jaguar), Neo Geo (AES/CD/NGP/NGPC), PC Engine, PC-FX, WonderSwan/Color, 3DO, ColecoVision, Vectrex, Intellivision, DOS, C64, Amiga, MSX, ZX Spectrum, Amstrad CPC, Arcade/MAME, Naomi, Atomiswave, ScummVM, SG-1000, Sega 32X, Virtual Boy, Pokemon Mini
- 38 SVG icons created, PNG→SVG fallback in all icon-loading components
- IGDB platform map expanded to match

### Admin Cleanup
- Removed legacy Steam Deck SSH settings (deckHost/deckUser/deckPassword) from schema, API, and UI
- Deleted `migrate-device.ts` (migration no longer needed)
- Maintenance tools (Fetch Critic Scores, Re-Enrich, Cleanup) moved to collapsible section at bottom
- "Scan Steam Deck" renamed to "Scan Devices"
- Warning banner when GameDevice links are missing

### Upload Process
- Uses device credentials instead of old Settings fields
- Creates GameDevice link on upload
- Validates deviceId, rejects FTP/local protocols
- Passes device port to SSH uploader

### Security Hardening
- Strict `/^\d+$/` regex validation for all deviceId parameters across all APIs

### ROM Management & Sync Design Spec
- Written and approved: `docs/superpowers/specs/2026-04-14-rom-management-sync-design.md`

## Priority 0: Implement ROM Management & Sync

**Spec**: `docs/superpowers/specs/2026-04-14-rom-management-sync-design.md`

### Summary
1. **Game Detail "Files on Devices" section** — shows which file on which device, with Rename/Delete buttons that stage changes to a queue
2. **SyncQueue DB table** — stores pending rename/delete operations
3. **Sync Panel (Drawer)** — accessible from header, shows pending queue, "Apply All" executes changes on devices
4. **Scan enhancement** — detect deleted ROMs, remove orphaned games (no device links left)

### Key Design Decisions
- Actions are **per device** (rename on Steamdeck doesn't affect Retroid)
- Changes are **staged** in a queue, not executed immediately
- Queue is **reviewable** before applying (staged changes concept)
- Sync Panel is a **drawer** accessible from header with badge count
- Scan remains **separate** from the queue (scan imports/removes, queue is for user actions)
- Deleted games: remove GameDevice link, delete game only when zero devices remain
- Rename only changes **filename on device**, not game title (title comes from IGDB)

### Implementation Order
1. Add `SyncQueue` model to Prisma schema
2. Create sync queue API endpoints (`/api/sync/queue`, `/api/sync/apply`)
3. Build `GameFiles` component for game detail page
4. Build `SyncPanel` drawer component
5. Add sync badge to header
6. Enhance scan-runner with orphan game cleanup

## Priority 1: Symlink Support in File Manager
- SSH `listDir` needs to recognize symlinks (currently may skip them)
- Important for Steam Deck where many paths are symlinks

## Priority 2: Remaining from PLAN.md
- Theme Toggle (Dark/Light)
- Export/Backup (JSON/CSV)

## Known Issues
- Pokemon "Blaue Edition" (German ROM) not recognized in IGDB
- Plaintext device passwords in SQLite
- ScanBar, EnrichmentBar, TransferBar can overlap
- Buffer-based file transfer (max 2GB)
- FTP `readFile` with `maxBytes` doesn't abort transfer
- Concurrent transfers rejected (409) instead of queued

## Git State
- Branch: `master`
- All changes committed locally, NOT pushed to origin
- 56+ commits ahead of remote
