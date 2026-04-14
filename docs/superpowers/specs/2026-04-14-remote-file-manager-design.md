# Remote File Manager — Design Spec

**Date:** 2026-04-14
**Status:** Approved

## Problem

Users have no way to manage files on their remote devices from the Game Vault UI. Moving ROMs between devices, organizing folders, or cleaning up files requires SSH/FTP clients outside the app.

## Solution

A dual-panel file manager at `/files` (Total Commander / WinSCP style) with full file operations, multi-select, cross-device transfer, and file preview.

---

## 1. Page Layout

Dedicated page at `/files`. Two independent panels side by side.

```
┌──────────────────────────────┬──────────────────────────────┐
│  [Device: Steam Deck     ▼]  │  [Device: Retroid Pocket  ▼]  │
│  /home/deck/Games/           │  /storage/emulated/0/roms/    │
│  ────────────────────────── │  ────────────────────────── │
│  ☑ 📁 snes/          42 MB   │  □ 📁 gba/           128 MB   │
│  ☑ 📄 game.rom       2.1 MB  │  □ 📄 pokemon.gba     8 MB    │
│  □ 📁 steam/         1.2 GB   │  □ 📁 snes/          256 MB   │
│                               │                               │
│  [Copy →] [Move →] [Delete]   │  [← Copy] [← Move] [Delete]  │
│  [New Folder] [Rename]        │  [New Folder] [Rename]        │
└──────────────────────────────┴──────────────────────────────┘
                     Status: Copying game.rom... 45%
```

### Panel Structure

Each panel contains:
- **Device selector** — dropdown at top to pick which device to browse
- **Path bar** — current path with back/root navigation (same as existing file browser)
- **File list** — scrollable list with checkbox, icon, name, and size per entry
- **Action buttons** — below the file list

### Responsive Behavior

- Desktop (lg+): two panels side by side
- Mobile/tablet: stacked vertically, or single panel with a "switch panel" toggle

---

## 2. File List Enhancements

### Entry Display

Each file/folder entry shows:
- **Checkbox** for multi-select
- **Icon** — 📁 for directories, 📄 for files (or type-specific icons for known extensions like .sfc, .gba, .iso)
- **Name** — clickable for directories (navigate), clickable for files (preview)
- **Size** — human-readable (KB, MB, GB), directories show total size if available or "—"

### Multi-Select

- Individual checkboxes per entry
- "Select All" toggle in the column header
- Selected count shown: "3 items selected (12.4 MB)"
- Action buttons operate on selected items

### Sorting

Default: directories first, then alphabetical. No additional sort options needed initially.

---

## 3. File Operations

### Create Folder

- "New Folder" button below each panel
- Inline input appears at top of list, user types name, Enter to confirm
- API: `POST /api/devices/[id]/files/mkdir`
- Body: `{ path: "/full/path/to/new-folder" }`

### Rename

- "Rename" button (active when exactly 1 item selected)
- Inline edit: name becomes editable input, Enter to confirm, Escape to cancel
- API: `POST /api/devices/[id]/files/rename`
- Body: `{ oldPath: "/full/old/path", newPath: "/full/new/path" }`

### Delete

- "Delete" button (active when 1+ items selected)
- Confirmation dialog: "Delete 3 items? This cannot be undone."
- Lists the items to be deleted
- API: `DELETE /api/devices/[id]/files`
- Body: `{ paths: ["/path/to/file1", "/path/to/file2"] }`

### All operations refresh the file list after completion.

---

## 4. Cross-Device Transfer

### Copy / Move

- "Copy →" sends selected files from left panel to right panel's current directory
- "← Copy" sends selected files from right panel to left panel's current directory
- "Move →" / "← Move" copies then deletes source
- Both panels must have a device selected for transfer buttons to be active

### Transfer Flow

1. User selects files in source panel
2. Clicks "Copy →" or "Move →"
3. Transfer starts — progress bar appears at bottom of the page
4. Status: "Copying game.rom... 45% (2/5 files)"
5. On completion: both panels refresh, success message shown

### API

`POST /api/devices/transfer`

Body:
```json
{
  "sourceDeviceId": 1,
  "targetDeviceId": 2,
  "targetPath": "/storage/emulated/0/roms/snes/",
  "files": ["/home/deck/Games/snes/game.rom", "/home/deck/Games/snes/game2.rom"],
  "mode": "copy"
}
```

Response (streamed or polled):
```json
{
  "status": "in_progress",
  "current": "game.rom",
  "progress": 45,
  "completed": 1,
  "total": 2
}
```

### Transfer Implementation

The server acts as a relay:
1. Connect to source device (SSH/FTP)
2. Connect to target device (SSH/FTP)
3. Stream file from source → server memory/temp → target
4. For SSH: use SFTP `get` and `put` streams
5. For FTP: use `downloadTo` and `uploadFrom` with temp files
6. Report progress via polling endpoint: `GET /api/devices/transfer/status`

### Transfer Limits

- Max file size per transfer: 2 GB (configurable)
- Concurrent transfers: 1 at a time (queue additional)
- Timeout per file: 10 minutes

---

## 5. File Preview

### Preview Modal

Clicking a file name opens a preview modal:

**Images** (`.png`, `.jpg`, `.jpeg`, `.gif`, `.bmp`, `.webp`):
- Fetched via API and displayed inline
- API streams the file content as binary

**Text files** (`.txt`, `.log`, `.cfg`, `.ini`, `.xml`, `.json`, `.m3u`):
- Fetched via API, displayed in a code block with monospace font
- Max 100 KB preview (truncated with "File truncated..." message)

**Other files:**
- Show metadata only: filename, size, last modified date
- No content preview

### API

`GET /api/devices/[id]/files/preview?path=/path/to/file`

- For images: returns binary with appropriate Content-Type header
- For text: returns `{ content: "file text...", truncated: false }`
- For other: returns `{ name, size, type: "binary" }`

---

## 6. Backend — Connection Layer Extensions

The existing `DeviceConnection` interface in `src/lib/connection.ts` needs new methods:

```typescript
interface DeviceConnection {
  // Existing
  listDir(path: string): Promise<DirEntry[]>;
  disconnect(): void;

  // New for file manager
  listDirDetailed(path: string): Promise<DetailedDirEntry[]>;
  mkdir(path: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  remove(path: string): Promise<void>;
  readFile(path: string, maxBytes?: number): Promise<Buffer>;
  writeFile(remotePath: string, data: Buffer): Promise<void>;
  stat(path: string): Promise<FileStat>;
}

interface DetailedDirEntry {
  name: string;
  type: "dir" | "file";
  size: number;        // bytes, 0 for dirs if unknown
  modifiedAt?: string; // ISO date string
}

interface FileStat {
  size: number;
  modifiedAt?: string;
  isDirectory: boolean;
}
```

### SSH Implementation

- `listDirDetailed`: `ls -1psh --time-style=iso` or SFTP `readdir` with stat
- `mkdir`: SFTP `mkdir` or `ssh exec mkdir -p`
- `rename`: SFTP `rename`
- `remove`: SFTP `unlink` for files, `rmdir` for empty dirs, or `ssh exec rm -rf` for non-empty dirs (with confirmation)
- `readFile`: SFTP `get` to buffer
- `writeFile`: SFTP `put` from buffer
- `stat`: SFTP `stat`

### FTP Implementation

- `listDirDetailed`: `client.list()` already returns size and date
- `mkdir`: `client.ensureDir()`
- `rename`: `client.rename()`
- `remove`: `client.remove()` for files, `client.removeDir()` for dirs
- `readFile`: `client.downloadTo()` to buffer
- `writeFile`: `client.uploadFrom()` from buffer
- `stat`: `client.size()` + `client.lastMod()`

### Path Sanitization

All file operation endpoints must sanitize paths using the existing `sanitizeShellArg` pattern. Reject paths containing `..` to prevent directory traversal.

---

## 7. Header Navigation

Add "Files" link to the header between "Devices" and "Upload".

---

## Key Files Summary

| File | Role |
|------|------|
| `src/app/files/page.tsx` | NEW — dual-panel file manager page |
| `src/components/file-panel.tsx` | NEW — single panel component (reusable for left/right) |
| `src/components/file-preview-modal.tsx` | NEW — file preview modal |
| `src/components/transfer-bar.tsx` | NEW — transfer progress bar |
| `src/lib/connection.ts` | MODIFY — add file operation methods to DeviceConnection |
| `src/app/api/devices/[id]/files/mkdir/route.ts` | NEW — create folder |
| `src/app/api/devices/[id]/files/rename/route.ts` | NEW — rename file/folder |
| `src/app/api/devices/[id]/files/route.ts` | NEW — DELETE files |
| `src/app/api/devices/[id]/files/preview/route.ts` | NEW — file preview/content |
| `src/app/api/devices/transfer/route.ts` | NEW — cross-device file transfer |
| `src/app/api/devices/transfer/status/route.ts` | NEW — transfer progress polling |
| `src/app/api/devices/[id]/browse/route.ts` | MODIFY — return file sizes |
| `src/components/layout/header.tsx` | MODIFY — add Files nav link |
