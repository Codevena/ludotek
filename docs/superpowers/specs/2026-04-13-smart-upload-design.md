# Smart Upload — Auto-Erkennung der Systeme

## Summary

Replace the manual platform-select step in the ROM upload flow with automatic system detection based on folder names and file extensions. Users can drop folders (or a parent folder containing system sub-folders) and the system groups files by detected platform automatically, with manual override options.

## Approach

Client-side detection. The browser has access to the full directory structure via `webkitGetAsEntry()`. Platform matching happens before any files are uploaded, giving instant feedback. The existing server-side API routes remain unchanged.

## Detection Logic

New file: `src/lib/platform-detector.ts`

### `detectPlatformFromPath(relativePath: string): { platform: PlatformDef; confidence: 'high' | 'medium' | 'low' } | null`

1. Split path into directory segments: `roms/snes/game.sfc` → `["roms", "snes"]`
2. For each segment (deepest first), try matching against `PLATFORM_CONFIG.dirs` (case-insensitive exact match) → confidence `high`
3. If no exact match, try fuzzy aliases (e.g. `genesis` → megadrive, `super-nintendo` → snes) → confidence `medium`
4. If no directory match, check the file extension against `PLATFORM_CONFIG.extensions` → confidence `low`
5. Return `null` if no match found

### `groupFilesByPlatform(files: { file: File; relativePath: string }[]): { groups: Map<string, PlatformGroup>; unknown: FileWithPath[] }`

Groups all files by their detected platform. Each `PlatformGroup` contains:
- `platform: PlatformDef`
- `confidence: 'high' | 'medium' | 'low'`
- `files: { file: File; relativePath: string }[]`

Files with no detected platform go into the `unknown` array.

## Platform Config Changes

File: `src/lib/platforms.ts`

### New dir aliases

| Platform | New aliases |
|----------|-----------|
| snes | `super-nintendo`, `super-famicom`, `supernintendo`, `superfamicom` |
| megadrive | `genesis`, `mega-drive`, `sega-genesis`, `segagenesis` |
| gb | `gameboy`, `game-boy` |
| gba | `gameboy-advance`, `game-boy-advance`, `gameboyadvance` |
| gbc | `gameboy-color`, `game-boy-color`, `gameboycolor` |
| mastersystem | `master-system`, `sms` |
| gamegear | `game-gear` |
| n64 | `nintendo64`, `nintendo-64` |
| psx | `ps1`, `playstation`, `playstation1` |
| ps2 | `playstation2`, `playstation-2` |
| gc | `nintendo-gamecube` |
| n3ds | `nintendo-3ds` |
| segacd | `sega-cd`, `mega-cd`, `megacd` |

### New `extensions` field

| Platform | Extensions |
|----------|-----------|
| snes | `.sfc`, `.smc` |
| gba | `.gba` |
| gb | `.gb` |
| gbc | `.gbc` |
| nes | `.nes` |
| n64 | `.n64`, `.z64`, `.v64` |
| megadrive | `.md`, `.smd`, `.gen` |
| mastersystem | `.sms` |
| gamegear | `.gg` |
| Others | `[]` (empty — rely on folder names) |

## Upload Flow Changes

### Current flow
`Select Platform → Drop Files → Preview → Processing → Done`

### New flow

**Auto-detected folders:**
`Drop Folders → Grouped Preview (auto-detected) → Upload & Process per group → Done`

**Unrecognized files (fallback):**
`Drop Files → Platform Prompt for unknown group → Grouped Preview → Upload & Process → Done`

**Manual mode (link under dropzone):**
`Click "Manual mode" → Select Platform → Drop Files → Preview → Processing → Done`

### Phases

Old: `select | upload | preview | processing | done`
New: `upload | grouped-preview | processing | done`

- **`upload`**: Dropzone shown immediately, no platform-select required. Accepts folders and files.
- **`grouped-preview`**: New component shows groups by detected platform. Each group has confidence badge, platform override dropdown, file count and total size. Unknown files group requires manual platform assignment. "Upload All" button starts batch.
- **`processing`**: Sequentially per group: `POST /api/upload` → `POST /api/upload/detect` → `POST /api/upload/process`. Progress shown per group.
- **`done`**: Summary across all groups.

## Component Changes

### `src/components/upload-dropzone.tsx`

- `traverseEntry()` returns `{ file: File, relativePath: string }` instead of just `File`
- `relativePath` is the full path from the drop root (e.g. `snes/game.sfc` or `roms/snes/game.sfc`)
- `onFilesSelected` callback signature changes to `(files: { file: File; relativePath: string }[]) => void`
- For flat file input (Browse Files button), `relativePath` is just the filename

### `src/components/upload-group-preview.tsx` (New)

Props:
```typescript
interface PlatformGroup {
  platformId: string;
  platform: PlatformDef;
  confidence: 'high' | 'medium' | 'low';
  files: { file: File; relativePath: string }[];
}

interface UploadGroupPreviewProps {
  groups: PlatformGroup[];
  unknownFiles: { file: File; relativePath: string }[];
  onConfirm: (finalGroups: PlatformGroup[]) => void;
}
```

Renders:
- Per group: platform icon + label, confidence badge (green/yellow/red), file count, total size, platform override dropdown
- Unknown files section with mandatory platform dropdown
- "Upload All" button (disabled until all unknown files have a platform assigned)

### `src/app/admin/upload/page.tsx`

- Remove phase `select` — dropzone is shown immediately
- Add phase `grouped-preview` between upload and processing
- When files are dropped, run `groupFilesByPlatform()` client-side
- If all files land in one group with high confidence, could optionally skip grouped-preview (stretch goal — not required)
- Processing runs sequentially per group through existing API endpoints
- "Manual mode" link switches to old flow (set platform first, then drop)

## API Changes

None. All three API routes (`/api/upload`, `/api/upload/detect`, `/api/upload/process`) remain unchanged. The client orchestrates the per-group calls.

## Data Flow

```
User drops folders/files
    ↓
Dropzone traverses entries → [{ file, relativePath }]
    ↓
platform-detector.groupFilesByPlatform()
  → Map<platformId, PlatformGroup> + unknownFiles[]
    ↓
UploadGroupPreview — user confirms/overrides
    ↓
Per group (sequential):
  1. POST /api/upload (FormData)     → sessionId
  2. POST /api/upload/detect          → detected games
  3. POST /api/upload/process         → SSE progress stream
    ↓
Done summary across all groups
```

## Error Handling

- If a group's upload fails, mark that group as failed and continue with remaining groups
- Show per-group error messages in the done summary
- If detection finds 0 games in a group, show warning and allow retry or skip

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/lib/platforms.ts` | Modify — add dir aliases + `extensions` field |
| `src/lib/platform-detector.ts` | Create — `detectPlatformFromPath()` + `groupFilesByPlatform()` |
| `src/components/upload-dropzone.tsx` | Modify — return relativePath, change callback signature |
| `src/components/upload-group-preview.tsx` | Create — grouped preview with override |
| `src/app/admin/upload/page.tsx` | Modify — new flow with grouped-preview phase |
