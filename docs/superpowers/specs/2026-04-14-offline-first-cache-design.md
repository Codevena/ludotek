# Offline-First / Metadata & Image Cache — Design Spec

> Phase 1.1 der Feature-Roadmap. Macht Game Vault unabhängig von externen APIs für den täglichen Betrieb.

## Ziele

1. **Robustheit** — Die App funktioniert vollständig wenn IGDB/OpenRouter/SteamGridDB nicht erreichbar sind. Covers, Screenshots, Artwork laden lokal.
2. **Performance** — Keine externen CDN-Requests beim Browsen der Sammlung. Seiten laden sofort. IGDB-Rate-Limits werden durch API-Response-Caching minimiert.

## Entscheidungen

| Frage | Entscheidung |
|-------|-------------|
| Bild-Storage | Filesystem (`data/`) + DB-Tracking via `CacheEntry`-Model |
| Migration bestehender Bilder | Lazy Caching (beim Anzeigen) + Admin-Button "Cache all images" |
| Offline-Verhalten | Silent Fallback — App zeigt cached Daten, Fehler nur bei aktivem API-Request |
| Cache-Invalidierung | Manuell per Spiel ("Refresh Metadata") + Batch per Plattform |
| Cache-Größenlimit | Kein Limit — User kontrolliert Speicher selbst. Admin zeigt Statistik + Clear-Button |
| API-Response-Cache | 24h TTL für IGDB-Suchen, 7 Tage für Game-Details. Lazy Cleanup. |
| Image-Serving | Lokale Pfade in Game-Model, API-Route `/api/cache/[...path]` liefert Dateien aus |
| Bestehende Bilder | Funktionieren weiter über Remote-URLs bis gecacht |

## Datenmodell

### Neue Prisma-Models

```prisma
model CacheEntry {
  id        Int      @id @default(autoincrement())
  type      String   // "cover" | "screenshot" | "artwork"
  sourceUrl String   @unique
  localPath String   // relativer Pfad: "covers/123.jpg"
  fileSize  Int      // Bytes
  gameId    Int
  game      Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}

model ApiCache {
  id        Int      @id @default(autoincrement())
  cacheKey  String   @unique // z.B. "igdb:search:super mario world"
  response  String   // JSON-encoded API response
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([expiresAt])
}
```

### Erweiterte Game-Felder

```prisma
model Game {
  // ... bestehende Felder ...
  localCoverPath       String?  // "covers/123.jpg"
  localScreenshotPaths String?  // JSON array: ["screenshots/123/0.jpg", ...]
  localArtworkPaths    String?  // JSON array: ["artwork/123/0.jpg", ...]
  cacheEntries         CacheEntry[]
}
```

### Verzeichnisstruktur

```
data/
├── covers/          # {gameId}.jpg
├── screenshots/     # {gameId}/{index}.jpg
├── artwork/         # {gameId}/{index}.jpg
└── .gitkeep
```

- `data/` in `.gitignore`
- `data/` als Docker-Volume in `docker-compose.yml`

## Module

### `src/lib/image-cache.ts`

**`cacheGameImages(gameId: number): Promise<void>`**
- Lädt Cover + Screenshots + Artwork eines Spiels herunter
- Prüft ob `localCoverPath` bereits existiert → Skip
- Download mit 10s Timeout pro Bild, 1x Retry bei Fehler
- Erstellt `CacheEntry` pro Bild + updatet Game-Felder (`localCoverPath`, etc.)
- Fehler bei einem Bild bricht nicht den Vorgang ab — partial caching ist OK

**`cacheAllImages(onProgress?: (done: number, total: number) => void): Promise<void>`**
- Holt alle Games wo `localCoverPath IS NULL AND coverUrl IS NOT NULL`
- Verarbeitet sequentiell mit 100ms Delay (kein CDN-Hammering)
- Progress-Callback für SSE-Stream

**`clearCache(): Promise<void>`**
- Löscht alle Dateien in `data/covers/`, `data/screenshots/`, `data/artwork/`
- Löscht alle `CacheEntry`-Rows
- Setzt `localCoverPath`/`localScreenshotPaths`/`localArtworkPaths` auf NULL für alle Games

**`getCacheStats(): Promise<{ covers: number, screenshots: number, artwork: number, totalSize: number, totalFiles: number }>`**
- Aggregiert aus `CacheEntry`-Tabelle

### `src/lib/api-cache.ts`

**`getCachedOrFetch<T>(key: string, fetchFn: () => Promise<T>, ttlHours?: number): Promise<T>`**
- Prüft `ApiCache` nach `cacheKey` wo `expiresAt > now()`
- Hit → `JSON.parse(response)` zurückgeben
- Miss → `fetchFn()` ausführen, Ergebnis in `ApiCache` speichern, zurückgeben
- Default TTL: 24h

**Lazy Cleanup:** Bei jedem Cache-Write werden Einträge mit `expiresAt < now() - 7 Tage` gelöscht (max 100 pro Durchlauf).

### `src/lib/image-url.ts`

Helper-Funktionen für Components:

```ts
export function coverUrl(game: { localCoverPath?: string | null; coverUrl?: string | null }): string | undefined
export function screenshotUrls(game: { localScreenshotPaths?: string | null; screenshotUrls?: string | null }): string[]
export function artworkUrls(game: { localArtworkPaths?: string | null; artworkUrls?: string | null }): string[]
```

Logik: lokaler Pfad vorhanden → `/api/cache/{path}`, sonst Remote-URL Fallback.

## API-Routen

### `GET /api/cache/[...path]`
- Liest Datei aus `data/{path}` und liefert mit korrektem `Content-Type`
- `Cache-Control: public, max-age=31536000` (immutable)
- 404 wenn Datei nicht existiert
- Path-Traversal-Validierung (wie bestehende File-Routen)

### `POST /api/cache/batch`
- Startet Batch-Download aller nicht-gecachten Bilder
- Response: SSE-Stream mit Progress-Events (`{ done, total, currentGame }`)
- Nur ein Batch-Job gleichzeitig (409 wenn bereits läuft)

### `DELETE /api/cache`
- Löscht gesamten Image-Cache
- Returns: `{ deletedFiles, freedBytes }`

### `GET /api/cache/stats`
- Returns: `{ covers: { count, size }, screenshots: { count, size }, artwork: { count, size }, total: { count, size } }`

### `DELETE /api/cache/api-responses`
- Löscht alle `ApiCache`-Einträge
- Returns: `{ deletedCount }`

## IGDB-Integration

Bestehende Funktionen in `src/lib/igdb.ts` werden mit API-Cache gewrappt:

| Funktion | Cache-Key | TTL |
|----------|-----------|-----|
| `searchGames(title)` | `igdb:search:{normalizedTitle}` | 24h |
| `getGameById(igdbId)` | `igdb:game:{igdbId}` | 7 Tage |
| `getCoverUrl(igdbId)` | `igdb:cover:{igdbId}` | 7 Tage |

OpenRouter-Calls werden NICHT gecacht (AI-Content soll bei Re-Generation variieren).

Nach erfolgreichem Enrichment wird `cacheGameImages(gameId)` aufgerufen.

## Component-Änderungen

Alle Stellen die `game.coverUrl` / `game.screenshotUrls` / `game.artworkUrls` direkt als `<img src>` nutzen, werden auf die Helper-Funktionen aus `image-url.ts` umgestellt:

- `GameCard` — Cover
- `GameDetail` — Cover, Screenshots, Artwork-Gallery
- `RecommendationCard` — Cover
- `SearchBar` — Autocomplete-Thumbnails
- `DiscoverResults` — Empfehlungs-Covers

## Admin-UI

### Neuer Abschnitt "Image Cache" auf `/admin`:

- **Cache-Statistik**: Covers: X (Y MB) | Screenshots: X (Y MB) | Artwork: X (Y MB) | Gesamt: N MB
- **"Cache all images"-Button**: Startet Batch-Download, zeigt Progress-Bar
- **"Clear image cache"-Button**: Danger Zone, Confirm-Dialog
- **API-Cache-Statistik**: X cached responses, ältester Eintrag: Datum
- **"Clear API cache"-Button**

### Game-Detail-Seite:
- **"Refresh Metadata"-Button**: Re-fetcht IGDB-Daten (ignoriert ApiCache für dieses Spiel), lädt Bilder neu herunter

### Platform-Seite:
- **"Refresh all metadata"-Button**: Batch-Re-Enrich aller Spiele der Plattform, SSE-Progress

## Migration

- Prisma-Migration fügt `CacheEntry`, `ApiCache` Models + neue Game-Felder hinzu
- Kein automatischer Batch-Download — User entscheidet wann "Cache all images"
- Bestehende Spiele funktionieren weiter über Remote-URL-Fallback
- `data/` Verzeichnis wird beim ersten Image-Cache-Write automatisch erstellt (mkdirp)

## Nicht im Scope

- Service Worker / PWA (eigenes Feature, Phase 4.2)
- Automatisches Stale-Marking / Background-Refresh
- Cache-Größenlimit / LRU-Eviction
- Video-Caching (YouTube-Embeds bleiben extern)
