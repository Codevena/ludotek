# Device Management & Remote File Browser — Design Spec

**Date:** 2026-04-13
**Status:** Approved

## Problem

Game Vault's scanner has hardcoded paths for one Steam Deck. Users with multiple devices (Steam Deck, Retroid Pocket, other Android handhelds) can't configure scan locations. Non-game Steam entries (Proton, SteamLinuxRuntime, SteamworksShared) pollute the collection. Users can't add custom paths like `/home/deck/Games`.

## Solution

A multi-device management system with a remote file browser. Users add devices (SSH or FTP), browse their file systems in the browser, select scan paths per device, and manage a per-device blacklist to filter non-game entries.

---

## 1. Data Model

### Device (new Prisma model)

```prisma
model Device {
  id          Int      @id @default(autoincrement())
  name        String               // "Steam Deck Wohnzimmer"
  type        String               // steamdeck | android | custom
  protocol    String               // ssh | ftp
  host        String
  port        Int      @default(22)
  user        String
  password    String
  scanPaths   String   @default("[]")   // JSON: [{path, type}]
  blacklist   String   @default("[]")   // JSON: string[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### scanPaths format

```json
[
  {"path": "/run/media/deck/SD/Emulation/roms", "type": "rom"},
  {"path": "/home/deck/Games", "type": "steam"},
  {"path": "/home/deck/.local/share/Steam/steamapps/common", "type": "steam"}
]
```

### Default blacklists by device type

**steamdeck:**
```json
["Proton *", "SteamLinuxRuntime*", "Steamworks Common Redistributables", "SteamworksShared"]
```

**android / custom:** empty

### Migration

- New Prisma migration adds `Device` table.
- On first app load: if `deckHost` in Settings is non-empty, auto-create a Device named "Steam Deck" with existing credentials and the previously hardcoded paths:
  - ROM: `/run/media/deck/SD/Emulation/roms`
  - Steam: `/run/media/deck/SD/Games`, `/home/deck/.local/share/Steam/steamapps/common`
  - Blacklist: default steamdeck blacklist
- Old Settings fields (`deckHost`, `deckUser`, `deckPassword`) remain in schema but are no longer actively used.

---

## 2. API Endpoints

### Device CRUD — `/api/devices`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/devices` | List all devices (passwords masked) |
| POST | `/api/devices` | Create new device |
| PUT | `/api/devices/[id]` | Update device |
| DELETE | `/api/devices/[id]` | Delete device |

### File Browser — `/api/devices/[id]/browse`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/devices/[id]/browse?path=/home/deck` | List directory contents on remote device |

Response:
```json
{
  "path": "/home/deck",
  "parent": "/home",
  "entries": [
    {"name": "Games", "type": "dir"},
    {"name": ".local", "type": "dir"},
    {"name": ".bashrc", "type": "file"}
  ]
}
```

Only directories are actionable; files are shown but greyed out.

### Connection Test — `/api/devices/[id]/test`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/devices/[id]/test` | Test SSH/FTP connection, returns `{ok: true}` or error message |

### Scan — `/api/devices/[id]/scan`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/devices/[id]/scan` | Scan a single device using its configured scanPaths |
| POST | `/api/scan` | Scan all devices (existing endpoint, refactored) |

### Blacklist — `/api/devices/[id]/blacklist`

| Method | Path | Description |
|--------|------|-------------|
| PUT | `/api/devices/[id]/blacklist` | Update device blacklist |

---

## 3. Frontend

### Admin Settings (`/admin`) — "Devices" section

- Device list: name, type, host, connection status indicator
- "Add Device" button opens form: name, type dropdown (Steam Deck / Android / Custom), protocol (SSH / FTP), host, port, user, password
- "Test Connection" button inline per device
- Edit / Delete per device

### Devices Page (`/devices`)

Two-column layout:

```
+-----------------------------------+--------------------------------+
|  File Browser                     |  Configured Paths              |
|                                   |                                |
|  /home/deck/                      |  ROM Paths:                    |
|    Games/           [+ Steam]     |  /run/media/.../roms      [x]  |
|    .local/                        |                                |
|      share/                       |  Steam Paths:                  |
|        Steam/                     |  /home/deck/Games         [x]  |
|          steamapps/               |  /run/media/.../Games     [x]  |
|            common/  [+ Steam]     |                                |
|  /run/media/deck/SD/              |  Blacklist:                    |
|    Emulation/                     |  Proton *                 [x]  |
|      roms/          [+ ROM]       |  SteamLinuxRuntime*       [x]  |
|    Games/           [+ Steam]     |  + Add entry                   |
|                                   |                                |
|  [Parent] [/ Root]                |  [Scan Device]                 |
+-----------------------------------+--------------------------------+
```

- **Left column:** Interactive file browser. Click folders to navigate. `[+ ROM]` and `[+ Steam]` buttons per folder to add as scan path.
- **Right column:** Configured paths with remove button, editable blacklist, scan trigger.
- **Device dropdown** at top of page to switch between devices.

### Header

New nav link "Devices" alongside Home / Wishlist / Discover.

---

## 4. Connection Layer

### Abstraction — `src/lib/connection.ts`

```typescript
interface DeviceConnection {
  listDir(path: string): Promise<DirEntry[]>
  disconnect(): void
}
```

Two implementations:
- `SshConnection` — uses `ssh2` (existing dependency)
- `FtpConnection` — uses `basic-ftp` (new dependency, ~50KB, zero transitive deps)

Factory function: `createConnection(device)` returns the correct implementation based on `device.protocol`.

### Timeouts

- Connection timeout: 10 seconds
- Command timeout: 15 seconds

---

## 5. Scanner Refactor

### scanDevice(device: Device)

```
1. Create connection (SSH or FTP)
2. For each scanPath:
   - type "rom": scan subdirectories, map to platforms via getPlatformByDir()
   - type "steam": list directories, apply blacklist filter, remainder = games
3. Close connection
4. Return discovered games
```

### Blacklist matching

- Case-insensitive
- Wildcard `*` only at end of pattern (prefix match): `"Proton *"` matches `"Proton 8.0"`, `"Proton Experimental"`
- No regex, no complex glob — user-friendly

### Deduplication

- Unique key: `originalFile + platform + deviceId`
- Same game on multiple devices = separate entries (each tied to its device)

---

## 6. Error Handling

### Connection errors
- Timeout after 10s on SSH/FTP connect
- File browser shows inline error: "Connection failed — check credentials in Admin Settings"
- "Test Connection" gives clear feedback: green check or red message with reason (auth failed, host unreachable, timeout)

### File browser edge cases
- Permission denied on folder: greyed out with lock icon, no crash
- Empty directory: "Empty directory" hint
- Symlinks: treated as normal directories, max depth tracking to prevent loops
- Long directory listings: capped at 500 entries, sorted alphabetically

### Scan edge cases
- Device offline: skip with warning, continue scanning other devices
- Scan path no longer exists: log warning, continue with next path
- Duplicates across devices: unique key includes deviceId, so same game on two devices = two entries

---

## 7. Key Files

| File | Role |
|------|------|
| `prisma/schema.prisma` | Add Device model |
| `src/lib/connection.ts` | NEW — DeviceConnection interface, SSH + FTP implementations |
| `src/lib/scanner.ts` | Refactor to use Device + connection abstraction |
| `src/app/api/devices/route.ts` | NEW — Device CRUD |
| `src/app/api/devices/[id]/route.ts` | NEW — Single device CRUD |
| `src/app/api/devices/[id]/browse/route.ts` | NEW — File browser endpoint |
| `src/app/api/devices/[id]/test/route.ts` | NEW — Connection test |
| `src/app/api/devices/[id]/scan/route.ts` | NEW — Per-device scan |
| `src/app/api/devices/[id]/blacklist/route.ts` | NEW — Blacklist update |
| `src/app/api/scan/route.ts` | Refactor to iterate over all devices |
| `src/app/devices/page.tsx` | NEW — Devices page with file browser |
| `src/components/file-browser.tsx` | NEW — File browser component |
| `src/components/device-form.tsx` | NEW — Device add/edit form |
| `src/app/admin/page.tsx` | Add Devices section |
| `src/app/layout.tsx` | Add Devices nav link |

---

## 8. Dependencies

| Package | Purpose | Size |
|---------|---------|------|
| `ssh2` | SSH/SFTP connections | Already installed |
| `basic-ftp` | FTP connections | ~50KB, zero deps |
