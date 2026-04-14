# ROM Management & Sync Design

## Overview

Add ROM file management (rename/delete) directly from the game detail page, with a staged queue system and a global sync panel. Changes are collected in a queue and applied in batch when the user clicks "Apply".

## Goals

- Let users organize ROM files on their devices without leaving the game library
- Provide a safe, reviewable queue before applying changes to devices
- Keep the existing scan/import flow separate and improve it to detect deletions

## Non-Goals

- Batch operations across multiple games (future)
- Moving ROMs between devices
- Editing game titles (titles come from IGDB enrichment)

---

## A) ROM Actions in Game Detail View

### New "Files on Devices" Section

Located below the existing game info (Summary, Videos, Screenshots) on `/game/[id]`.

For each device the game is linked to, display:

```
[Device Icon] Steamdeck
  /run/media/deck/SD/Emulation/roms/snes/Super Mario World (U).sfc
  [Rename]  [Delete]

[Device Icon] Retroid Pocket
  /storage/68A1-9B84/Roms/snes/Super Mario World.sfc
  [Rename]  [Delete]
```

### Rename Flow

1. User clicks "Rename" next to a file
2. Inline text input appears with the current filename (without path), pre-selected
3. User edits the filename, clicks "Stage" or presses Enter
4. A `SyncQueue` record is created with type "rename"
5. The header badge increments
6. No device connection is made yet

### Delete Flow

1. User clicks "Delete" next to a file
2. ConfirmDialog: "Stage deletion of `Super Mario World (U).sfc` from Steamdeck?"
3. On confirm, a `SyncQueue` record is created with type "delete"
4. The file entry in the detail view shows a strikethrough style to indicate pending deletion
5. The header badge increments

### Determining File Paths

The `Game.originalFile` field stores the filename, not the full path. To determine the full device path for rename/delete operations, we need to reconstruct it:

- For ROM games: `{scanPath}/{platformDir}/{originalFile}`
- The scan path comes from the device's `scanPaths` config
- The platform directory comes from the `PLATFORM_CONFIG.dirs[0]` for the game's platform

This reconstruction is stored in the `SyncQueue.filePath` field at staging time.

### Scope

- Actions are **per device** — renaming on Steamdeck doesn't affect Retroid Pocket
- Only the **filename on the device** changes, not the game title in the library
- `Game.originalFile` in the DB is updated only after successful apply

---

## B) Sync Panel (Drawer)

### Header Integration

A sync icon in the header with a badge showing pending change count:

```
[... existing header ...] [Sync (3)]  [All Devices ▾]
```

- Badge only shows when count > 0
- Click opens a slide-out drawer from the right

### Drawer Content

```
┌─────────────────────────────────┐
│  Pending Changes (3)    [Clear] │
├─────────────────────────────────┤
│                                 │
│  Steamdeck                      │
│  ─────────                      │
│  ↻ Rename: Mario (U).sfc       │
│    → Super Mario World.sfc  [✕] │
│  ✕ Delete: Bad Dump.nes      [✕] │
│                                 │
│  Retroid Pocket                 │
│  ──────────────                 │
│  ↻ Rename: Zelda (J).sfc       │
│    → Zelda.sfc               [✕] │
│                                 │
├─────────────────────────────────┤
│  [Apply All Changes]            │
└─────────────────────────────────┘
```

### Apply Flow

1. User clicks "Apply All Changes"
2. For each device with pending changes:
   a. Connect to device (SSH/FTP/local)
   b. Execute each rename/delete operation
   c. On success: update `SyncQueue.status` to "applied", update `Game.originalFile` (for renames), remove `GameDevice` link (for deletes)
   d. On failure: set `SyncQueue.status` to "failed" with error message
3. After deletes: check if any games have zero remaining device links → delete those games from DB
4. Show result summary in the drawer: "2 applied, 1 failed"
5. Failed items remain in the queue for retry

### Clear All

Removes all pending items from `SyncQueue` without executing anything.

### Individual Remove

Each queue item has a [✕] button to remove just that item from the queue.

---

## C) Scan Remains Separate

The existing "Scan Devices" button in Admin keeps its current behavior:

- Connects to all devices, lists ROM directories
- Imports new games, creates GameDevice links
- Deduplicates by title+platform across devices

### Enhanced: Detect Deleted ROMs

After scanning a device, the scan-runner already cleans up stale `GameDevice` links (lines 172-183 in scan-runner.ts). This effectively removes links for games no longer found on the device.

**Addition**: After removing stale links, check for games with zero remaining device links and delete them:

```typescript
// After stale link cleanup, remove orphaned games
const orphanedGames = await prisma.game.findMany({
  where: { devices: { none: {} } },
  select: { id: true },
});
if (orphanedGames.length > 0) {
  await prisma.game.deleteMany({
    where: { id: { in: orphanedGames.map(g => g.id) } },
  });
}
```

---

## Data Model

### New Table: SyncQueue

```prisma
model SyncQueue {
  id        Int      @id @default(autoincrement())
  type      String   // "rename" | "delete"
  deviceId  Int
  gameId    Int
  filePath  String   // full current path on device
  newPath   String?  // full new path (rename only)
  status    String   @default("pending") // "pending" | "applied" | "failed"
  error     String?  // error message if failed
  createdAt DateTime @default(now())

  device    Device   @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  game      Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
}
```

Relations to add:
- `Device.syncQueue SyncQueue[]`
- `Game.syncQueue SyncQueue[]`

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/sync/queue` | List pending queue items |
| POST | `/api/sync/queue` | Add item to queue (rename/delete) |
| DELETE | `/api/sync/queue/[id]` | Remove single item from queue |
| DELETE | `/api/sync/queue` | Clear all pending items |
| POST | `/api/sync/apply` | Execute all pending changes |

---

## Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `GameFiles` | `src/components/game-files.tsx` | "Files on Devices" section in game detail |
| `SyncPanel` | `src/components/sync-panel.tsx` | Drawer with queue and apply button |
| `SyncBadge` | In Header | Shows pending count, opens drawer |

---

## Key Files to Modify

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `SyncQueue` model |
| `src/app/game/[id]/page.tsx` | Add `GameFiles` component, load device data |
| `src/components/layout/header.tsx` | Add sync badge |
| `src/app/layout.tsx` | Mount `SyncPanel` drawer |
| `src/lib/scan-runner.ts` | Add orphaned game cleanup after stale link removal |

---

## Edge Cases

- **Device offline during Apply**: Mark individual items as failed, leave in queue for retry
- **File already renamed/deleted on device**: Treat as success (idempotent)
- **Game deleted from library while in queue**: `onDelete: Cascade` on `SyncQueue.game` auto-removes queue items
- **Multiple renames of same file**: Only the latest rename is in the queue (replace previous entry)
- **Queue item for a file that was also found deleted by Scan**: Scan removes the GameDevice link; the queue item becomes stale and should be cleaned up
