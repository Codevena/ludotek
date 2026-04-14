# Scan Progress + Device Filter — Design Spec

**Date:** 2026-04-14
**Status:** Approved

## Problem

1. Scanning shows no progress — the user stares at a "Scanning..." button with no feedback, can't navigate away without losing context.
2. No way to filter the library by device or see which device a game is on.
3. Games have no relationship to devices — can't track which game lives on which device.

## Solution

Enrichment-style sticky progress bar for scans, device filter in the header selector, device badges on game cards, and a new GameDevice join model.

---

## 1. Game-Device Relationship (Data Model)

### New Prisma Model

```prisma
model GameDevice {
  id       Int    @id @default(autoincrement())
  gameId   Int
  deviceId Int
  game     Game   @relation(fields: [gameId], references: [id], onDelete: Cascade)
  device   Device @relation(fields: [deviceId], references: [id], onDelete: Cascade)

  @@unique([gameId, deviceId])
}
```

Add relations to existing models:

```prisma
// In Game model:
devices GameDevice[]

// In Device model:
games GameDevice[]
```

### Scanner Behavior Change

When scanning a device:
1. Upsert the Game as before (unique on `originalFile + platform`)
2. After upsert, create a `GameDevice` entry linking the game to the scanned device (upsert to avoid duplicates)
3. Result: one Game record can be linked to multiple Devices

### Migration

- Prisma migration adds `GameDevice` table
- Existing games get no device associations (they were scanned before devices existed) — on next scan they'll be linked automatically

---

## 2. Scan Progress Bar (Enrichment-Style)

### Architecture

Same pattern as the existing `EnrichmentContext` + `EnrichmentBar`:

**ScanContext** (`src/context/scan-context.tsx`):
- Wraps the app in a provider (added to `layout.tsx` alongside `EnrichmentProvider`)
- State: `isScanning`, `progress` (0-100), `status` (current text), `gamesFound` (count), `deviceName`
- `startScan(deviceId?: number)` — kicks off scan, starts polling
- Polls `GET /api/scan/status` every 2 seconds while scanning

**ScanBar** (`src/components/scan-bar.tsx`):
- Sticky bar at bottom (or top, matching EnrichmentBar placement)
- Shows: progress bar, percentage, status text, games found count
- Visible on all pages while scan is running
- Hides when scan completes (after showing result for 5 seconds)

**Backend Changes:**

The scan needs to run asynchronously and report progress. Current approach runs synchronously in the POST handler.

New flow:
- `POST /api/scan` (or `/api/devices/[id]/scan`) — starts scan in background, immediately returns `{ scanId }` 
- Scan progress stored in-memory (Map or global variable — SQLite doesn't need a table for transient state)
- `GET /api/scan/status` — returns current progress: `{ scanning, progress, status, gamesFound, total, deviceName }`

### Progress Tracking

Progress is calculated per scan path:
- Count total scan paths across all devices (or for single device)
- Each completed path increments progress
- Status text updates: "Scanning Super Nintendo..." → "Scanning Steam games..."
- `gamesFound` increments as games are discovered

### Display Format

```
[████████░░░░░░░░] 45%  Scanning Super Nintendo...  127 games found
```

When complete (shown for 5 seconds):
```
[████████████████] 100%  Scan complete — 284 games (15 new, 269 updated)
```

### Files
- Create: `src/context/scan-context.tsx`
- Create: `src/components/scan-bar.tsx`
- Modify: `src/app/layout.tsx` — add ScanProvider
- Modify: `src/app/api/scan/route.ts` — async scan with progress tracking
- Modify: `src/app/api/devices/[id]/scan/route.ts` — async scan with progress tracking
- Create: `src/app/api/scan/status/route.ts` — progress polling endpoint
- Modify: `src/app/devices/page.tsx` — use ScanContext instead of local scan state

---

## 3. Device Filter in Header

### Header Device Selector

The active device selector from Spec A becomes dual-purpose:
- Sets the active device for uploads
- Filters the library view

Options in the dropdown:
- "All Devices" (default) — shows all games, deduplicated
- Each configured device — shows only games on that device

Selecting a device:
1. Updates `activeDeviceId` in Settings via `PUT /api/settings`
2. Triggers a re-fetch of the game library with the device filter

### Library API Changes

`GET /api/games` (or whatever the main library endpoint is) accepts an optional `?deviceId=N` query param:
- If omitted or "all": returns all games, with their device associations
- If set: returns only games linked to that device via GameDevice

### Deduplication (All Devices mode)

When showing all devices, games are deduplicated by `title + platform`. The response includes a `deviceIds` array for each game so the frontend can render badges.

---

## 4. Device Badges on Game Cards

### Always Visible

Every game card shows small device indicator badges. These appear regardless of the current filter.

### Badge Design

Small colored dots or mini-labels below the game title or in the card footer:
- Each device gets a color (derived from the device type or a user-assigned color)
- Steam Deck: one color, Android devices: another, etc.
- Format: small rounded pill with device name abbreviated, e.g. "SD" for Steam Deck, "RP" for Retroid Pocket

### Data Flow

- API returns game with `devices: [{ id, name, type }]` array
- GameCard component renders device badges from this array
- Games with no device association show no badges (legacy data before device feature)

### Files
- Modify: `src/components/game-card.tsx` (or equivalent) — render device badges
- Modify: game list API — include device associations in response

---

## Key Files Summary

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add GameDevice model, relations on Game and Device |
| `src/context/scan-context.tsx` | NEW — scan progress context provider |
| `src/components/scan-bar.tsx` | NEW — sticky scan progress bar |
| `src/app/layout.tsx` | Add ScanProvider |
| `src/app/api/scan/route.ts` | Async scan with progress, create GameDevice entries |
| `src/app/api/scan/status/route.ts` | NEW — progress polling endpoint |
| `src/app/api/devices/[id]/scan/route.ts` | Async scan with progress, create GameDevice entries |
| `src/app/devices/page.tsx` | Use ScanContext, show active device |
| `src/components/layout/header.tsx` | Device selector filters library |
| `src/components/game-card.tsx` | Device badges |
| Game list API | Include device associations, support deviceId filter |
