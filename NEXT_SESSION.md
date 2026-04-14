# Next Session Plan

## What was done this session (2026-04-14, Session 2)

### Feature Roadmap Created
- Comprehensive 4-phase roadmap at `docs/superpowers/specs/2026-04-14-feature-roadmap.md`
- 7 features prioritized by dependency order
- Phase 1: Fundament (Offline-First, Duplicate Detection)
- Phase 2: Intelligenz (Insights, Recommendations)
- Phase 3: Erlebnis (Epoch-Navigation, Auto-Organization)
- Phase 4: Polish (Onboarding/DX, PWA)

### Phase 1.1: Offline-First / Metadata Cache — COMPLETE
- **Design Spec**: `docs/superpowers/specs/2026-04-14-offline-first-cache-design.md`
- **New Prisma Models**: `CacheEntry` (image tracking), `ApiCache` (API response cache with TTL)
- **New Game Fields**: `localCoverPath`, `localScreenshotPaths`, `localArtworkPaths`
- **New Modules**:
  - `src/lib/image-cache.ts` — download/store/clear images, batch cache, stats
  - `src/lib/api-cache.ts` — generic TTL cache for API responses, lazy cleanup
  - `src/lib/image-url.ts` — helper functions (local path → /api/cache/ URL, remote fallback per-index)
- **New API Routes**:
  - `GET /api/cache/[...path]` — serve cached images with immutable headers
  - `POST /api/cache/batch` — SSE batch download with progress
  - `GET /api/cache/stats` — cache statistics
  - `DELETE /api/cache` — clear image cache (returns deletedFiles, freedBytes)
  - `DELETE /api/cache/api-responses` — clear API response cache
- **New Components**:
  - `cache-manager.tsx` — admin UI for cache stats, batch download, clear buttons
  - `refresh-metadata-button.tsx` — per-game metadata refresh
  - `platform-refresh-button.tsx` — per-platform batch refresh
- **IGDB Integration**: `searchIgdb` (24h TTL), `fetchIgdbById` (7d TTL) wrapped with API cache
- **Auto-caching**: Images cached automatically after enrichment (all 3 enrich routes)
- **Component Migration**: All game image rendering uses local paths with remote fallback
- **Docker**: `data/` volume added to docker-compose.yml
- **Security**: Path traversal prevention with `DATA_DIR + path.sep` check

### Review (4-agent, all passed after fixes)
- Path traversal bypass fixed (startsWith boundary issue)
- RefreshMetadataButton fixed (now uses stored igdbId via force=true)
- Per-game enrich route calls cacheGameImages
- Batch enrich supports force param for re-enrichment
- cacheAllImages covers screenshots/artwork gaps
- Sparse array holes eliminated (push instead of index assignment)
- Per-index fallback in image-url.ts
- batchRunning flag has 30min auto-reset timeout
- DELETE /api/cache returns stats
- Stale cover detection (re-downloads when coverUrl changes)

## Next Up: Phase 1.2 — Duplicate Detection

**Roadmap**: `docs/superpowers/specs/2026-04-14-feature-roadmap.md` (Phase 1.2)

### Summary
1. **Scan-Time Detection** — During device scans, mark potential duplicates:
   - Same title, different regions (USA vs Europe)
   - Same title, different formats (.iso vs .chd)
   - Same title on different devices (cross-device dupes)
   - Different versions (Rev A, Rev B, Beta, Proto)
2. **Fuzzy Matching** — Title normalization + Levenshtein distance
3. **Dedupe Dashboard** — New `/duplicates` page with grouped dupes, format/region info, "keep best" recommendations, one-click queue-for-deletion via SyncQueue
4. **No auto-delete** — Always manual review

### Key Design Decisions Still Needed
- Where to store duplicate group data (new model? computed on-the-fly?)
- Threshold for fuzzy matching
- How to handle multi-disc games (already deduplicated by scanner, but cross-device?)
- Integration with existing scan-runner flow

## Remaining Roadmap
- Phase 2.1: Sammlung-Insights (genre/era/franchise analytics)
- Phase 2.2: Smart Recommendations (franchise completion, genre gaps, hidden gems)
- Phase 3.1: Epoch-Navigation (timeline UI with era-specific styling)
- Phase 3.2: Auto-Organization (naming conventions, batch rename)
- Phase 4.1: Onboarding & DX (setup wizard, Docker, README, contributor docs)
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
- DB was reset last session — devices need reconfiguring after fresh clone

## Dev Notes
- Use `pnpm build` before every commit (pre-commit hooks enforce console.warn/error)
- Use `console.warn`/`console.error` instead of custom logger
- Prisma 6.x only (not 7.x)
- DB: SQLite at prisma/dev.db
- Clear `.next` cache if build gives cryptic errors: `rm -rf .next`
- Review process: 4-agent review (2x Codex, 2x Claude) mandatory before completion
