# ROM Upload Feature — Design Spec

Upload ROMs via Web-UI zum Steam Deck mit automatischer CHD/RVZ-Konvertierung, Multi-Disc-Erkennung und Auto-Enrichment.

## Context

- **Bestehendes System:** Game Vault — Next.js 14, Prisma 6, SQLite, TailwindCSS, Docker auf Proxmox
- **Steam Deck:** ROMs unter `/run/media/deck/SD/Emulation/roms/{platform}/`, SSH-Zugang vorhanden
- **EmuDeck Struktur:** Multi-Disc Games in `{platform}-multidisc/` Ordnern, `.m3u` Playlists im Hauptordner mit absoluten Pfaden via `/home/deck/EmuVirtual/Emulation/roms/...`
- **Ziel:** Games bequem über den Browser hochladen, konvertieren und aufs Deck bringen — ein Klick

## Upload Flow

```
1. User wählt Platform (SNES, PSX, PS2, Dreamcast, etc.)
2. User zieht Files in Dropzone (einzelne ROMs, ZIPs, oder ganze Ordner)
3. Files werden zum Server hochgeladen (temp storage)
4. Detection Engine analysiert die Files:
   - Erkennt Einzel-ROMs vs. Multi-Disc Games
   - Gruppiert zusammengehörige Discs automatisch (Namens-Pattern)
   - Bestimmt ob Konvertierung nötig ist
5. User sieht Preview und bestätigt
6. Pipeline startet (SSE-Stream für Live-Progress):
   a. Convert: chdman/DolphinTool wo nötig
   b. Transfer: SFTP zum Steam Deck in korrekten Ordner
   c. M3U: Erstellt .m3u Playlist für Multi-Disc Games
   d. Scan: Nimmt neue Games in die DB auf
   e. Enrich: Holt IGDB Metadata (Cover, Score, etc.)
7. Temp Files werden aufgeräumt
```

## Seite & UI

### Upload Page (`/admin/upload`)

**Elemente:**
- Platform-Auswahl als Chip-Row (alle 18+ Plattformen)
- Drag & Drop Zone — akzeptiert Files, Ordner, ZIPs
- "Browse Files" + "Browse Folder" Buttons
- Detected Games Preview:
  - Einzel-ROMs: Dateiname, Größe, Conversion-Status
  - Multi-Disc: Gruppiert mit Disc-Liste, Badge "N Discs"
  - Conversion-Indikator: "No conversion needed" / "Will convert to .chd" / "Will convert to .rvz"
- "Upload to Steam Deck" Button mit Gesamtgröße
- Link zurück zum Admin Panel

### Progress View (ersetzt Preview nach Start)

**Pro Game:**
- Status-Icon: ✅ Done / 🟡 Processing / ⏳ Queued / ❌ Failed
- Titel + Disc-Info
- Aktuelle Pipeline-Phase (Upload → Convert → Transfer → Scan → Enrich)

**Aktives Game zeigt:**
- Sub-Progress für Multi-Disc (Disc 1 ✓, Disc 2 68%)
- chdman Output: verarbeitete MB, geschätzte Restzeit
- Pipeline-Visualisierung: 5 Steps mit aktuellem Highlight

**Gesamt:**
- Fortschrittsbalken oben (N/M Games complete)
- Am Ende: Zusammenfassung mit Links zu den neuen Games

## API Routes

### `POST /api/upload`

Multipart File Upload. Speichert Files in temporärem Verzeichnis (`/tmp/game-vault-uploads/{sessionId}/`).

**Request:** `multipart/form-data` mit Files
**Response:** `{ sessionId, files: [{ name, size, path }] }`

Unterstützt:
- Einzelne Files
- Mehrere Files gleichzeitig
- ZIP-Dateien (werden serverseitig entpackt)

### `POST /api/upload/detect`

Analysiert hochgeladene Files und erkennt Games.

**Request:** `{ sessionId, platform }`
**Response:**
```json
{
  "games": [
    {
      "id": "temp-1",
      "title": "Final Fantasy IX",
      "type": "multi-disc",
      "discCount": 4,
      "files": [
        { "name": "FF9 (Disc 1).bin", "size": 540000000, "disc": 1 },
        { "name": "FF9 (Disc 1).cue", "size": 120, "disc": 1 },
        { "name": "FF9 (Disc 2).bin", "size": 520000000, "disc": 2 },
        ...
      ],
      "conversion": "chd",
      "totalSize": 2100000000
    },
    {
      "id": "temp-2",
      "title": "Super Mario World",
      "type": "single",
      "files": [{ "name": "super_mario_world.sfc", "size": 524288 }],
      "conversion": "none",
      "totalSize": 524288
    }
  ]
}
```

**Detection-Logik:**
- Gruppiert Files nach bereinigtem Titel (via `cleanFilename`)
- Erkennt Multi-Disc an `(Disc N)`, `(Disk N)`, `(CD N)` Patterns
- Erkennt .bin+.cue Paare (gleicher Basisname)
- Erkennt .gdi + zugehörige Track-Files
- Bestimmt Conversion anhand Platform + File-Extension

### `POST /api/upload/process`

Startet die Upload-Pipeline. Streamt Progress via SSE.

**Request:** `{ sessionId, platform, games: [gameIds] }`
**Response:** SSE Stream mit Events:

```
data: {"type":"start","totalGames":5}
data: {"type":"game-start","gameId":"temp-1","title":"Final Fantasy IX","step":"convert"}
data: {"type":"convert-progress","gameId":"temp-1","disc":1,"percent":45,"mbDone":243,"mbTotal":540}
data: {"type":"convert-done","gameId":"temp-1","disc":1}
data: {"type":"game-step","gameId":"temp-1","step":"transfer"}
data: {"type":"transfer-progress","gameId":"temp-1","percent":67}
data: {"type":"game-step","gameId":"temp-1","step":"scan"}
data: {"type":"game-step","gameId":"temp-1","step":"enrich"}
data: {"type":"game-done","gameId":"temp-1","dbId":1234,"title":"Final Fantasy IX","coverUrl":"..."}
data: {"type":"done","processed":5,"succeeded":5,"failed":0}
```

## Detection Engine (`src/lib/upload-detector.ts`)

**Verantwortung:** Analysiert eine Liste von File-Pfaden und gruppiert sie zu Games.

**Multi-Disc Erkennung:**
1. Bereinigt Dateinamen via `cleanFilename` (ohne Disc-Tag)
2. Extrahiert Disc-Nummer aus `(Disc N)`, `(Disk N)`, `(CD N)` Pattern
3. Gruppiert Files mit gleichem bereinigtem Namen
4. Ordnet .cue/.bin Paare zusammen (gleicher Basisname)

**Conversion-Bestimmung:**

| Platform | Extensions die Conversion brauchen | Zielformat |
|----------|-----------------------------------|------------|
| psx | .bin+.cue, .iso | .chd |
| ps2 | .bin+.cue, .iso | .chd |
| dreamcast | .gdi+tracks, .cdi, .bin+.cue | .chd |
| saturn | .bin+.cue, .iso | .chd |
| segacd | .bin+.cue, .iso | .chd |
| gc | .iso | .rvz |
| Alle anderen | — | Keine |

## Converter (`src/lib/converter.ts`)

**Tools im Docker Image:**
- `chdman` (Teil von mame-tools) — für CD/DVD → CHD
- `DolphinTool` — für GameCube ISO → RVZ

**Interface:**
```ts
interface ConvertJob {
  inputPath: string;       // Pfad zur Quelldatei
  outputPath: string;      // Pfad zur Zieldatei
  format: "chd" | "rvz";
  onProgress: (percent: number, mbDone: number, mbTotal: number) => void;
}

async function convert(job: ConvertJob): Promise<void>
```

**chdman Kommandos:**
- `.bin + .cue → .chd`: `chdman createcd -i input.cue -o output.chd`
- `.iso → .chd`: `chdman createcd -i input.iso -o output.chd`
- `.gdi → .chd`: `chdman createcd -i input.gdi -o output.chd`

**DolphinTool Kommando:**
- `.iso → .rvz`: `DolphinTool convert -i input.iso -o output.rvz -f rvz -b 131072 -c zstd -l 5`

**Progress-Tracking:** chdman gibt Progress auf stderr aus. Parser liest `Compressing, X.X% complete...` und extrahiert Prozentwert.

## Uploader (`src/lib/uploader.ts`)

**Verantwortung:** SFTP Transfer zum Steam Deck + M3U Generierung.

**Transfer-Ziele (basierend auf Deck-Analyse):**

| Typ | Zielordner |
|-----|-----------|
| Einzel-ROM | `/run/media/deck/SD/Emulation/roms/{platform}/` |
| Multi-Disc Files | `/run/media/deck/SD/Emulation/roms/{platform}-multidisc/` |
| Multi-Disc M3U | `/run/media/deck/SD/Emulation/roms/{platform}/` |

**M3U Generierung:**
```
/home/deck/EmuVirtual/Emulation/roms/{platform}-multidisc/{Spielname} (Disc 1).chd
/home/deck/EmuVirtual/Emulation/roms/{platform}-multidisc/{Spielname} (Disc 2).chd
```

Nutzt den EmuVirtual Symlink-Pfad (`/home/deck/EmuVirtual/...`) wie es EmuDeck erwartet. Ausnahme: Saturn nutzt den direkten SD-Pfad (`/run/media/deck/SD/...`).

**M3U Pfad-Mapping (basierend auf Deck-Analyse):**

| Platform | M3U Basis-Pfad |
|----------|---------------|
| psx, dreamcast, gc | `/home/deck/EmuVirtual/Emulation/roms/{platform}-multidisc/` |
| saturn | `/run/media/deck/SD/Emulation/roms/saturn-multidisc/` |

**SFTP Transfer:**
- Nutzt bestehende SSH-Credentials aus Settings
- `conn.sftp()` für Dateitransfer (statt `scp` Kommando)
- Progress-Tracking über übertragene Bytes

## Docker Changes

**Dockerfile Update:**
```dockerfile
# Im builder oder runner stage:
RUN apk add --no-cache mame-tools
# DolphinTool: muss als Binary kopiert werden (kein Alpine Package)
COPY --from=dolphin-builder /app/DolphinTool /usr/local/bin/DolphinTool
```

Alternative für DolphinTool: als vorcompiliertes Linux Binary ins Image kopieren, oder über ein Multi-Stage Build mit dem Dolphin Source.

**Temp Storage Volume:**
```yaml
volumes:
  - game-data:/app/prisma
  - upload-temp:/tmp/game-vault-uploads
```

## File Structure (neue Files)

```
src/
├── app/
│   ├── admin/upload/page.tsx          # Upload Page UI
│   └── api/
│       └── upload/
│           ├── route.ts               # POST: File Upload
│           ├── detect/route.ts        # POST: Game Detection
│           └── process/route.ts       # POST: Pipeline (SSE)
├── lib/
│   ├── upload-detector.ts             # File-Analyse, Gruppierung
│   ├── converter.ts                   # chdman/DolphinTool Wrapper
│   └── uploader.ts                    # SFTP Transfer + M3U
└── components/
    ├── upload-dropzone.tsx            # Drag & Drop Zone
    ├── upload-preview.tsx             # Detected Games Preview
    └── upload-progress.tsx            # Pipeline Progress View
```

## Error Handling

- **Upload fehlgeschlagen:** File-Size Warnung, Retry-Button
- **Conversion fehlgeschlagen:** chdman/DolphinTool Error-Output anzeigen, Option zum Überspringen
- **Transfer fehlgeschlagen:** SSH-Verbindungsfehler, Deck nicht erreichbar → Retry mit Backoff
- **Partial Failure:** Einzelne Games können fehlschlagen ohne den Rest zu blockieren
- **Temp Cleanup:** Temp Files werden nach Abschluss (oder nach 24h via Cron) gelöscht

## Nicht im Scope

- ROM-Download via URL (nur lokale Files)
- Automatische Region-Erkennung
- ROM-Patching (IPS/BPS)
- Batch-Rename von bestehenden ROMs auf dem Deck
- Streaming von ROMs (nur Upload)
