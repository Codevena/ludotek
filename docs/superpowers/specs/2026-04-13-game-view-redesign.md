# Game View Redesign + Re-Enrich — Design Spec

Redesign der Game Detail Page (Cinematic Hero Layout), verbesserte Score-Darstellung auf Game Cards, und Re-Enrich-Feature fuer fehlende IGDB-Felder.

## Context

- **Bestehendes System:** Game Vault — Next.js 14, Prisma 6, SQLite, TailwindCSS
- **Problem 1:** Game Detail Page ist funktional aber visuell flach — kein Hero-Bereich, Scores als kleine Pills ("MC 89"), kein visueller Impact
- **Problem 2:** Game Cards zeigen nur IGDB Score, Metacritic fehlt
- **Problem 3:** "Enrich All" fetcht nur Games ohne `igdbId` — Games die vor dem Videos/Artworks/Themes-Update enriched wurden, bekommen die neuen Felder nie

## Teil 1: Game Detail Page — Cinematic Hero Layout

### Neues Layout (oben nach unten)

**Hero Banner:**
- Erstes Artwork als Hintergrundbild (`artworkUrls[0]`), `object-cover`, volle Breite
- Fallback wenn kein Artwork: Gradient basierend auf Platform-Farbe
- Gradient-Overlay von transparent (oben) zu `#111113` (unten) fuer Lesbarkeit
- Hoehe: `280px` auf Desktop, `200px` auf Mobile

**Cover + Titel (ueberlappt den Banner unten):**
- Cover-Bild links, `80px` breit, gerundete Ecken, 2px Border `vault-border`
- Position: unten am Banner-Rand, ragt nach unten raus (negative margin oder absolute positioning)
- Titel rechts neben Cover, weiss, `text-2xl font-bold`, Text-Shadow fuer Lesbarkeit
- Platform-Tag + Franchise-Badge (falls vorhanden) als Pills unter dem Titel

**Score-Bar (direkt unter dem Hero):**
- Horizontale Leiste mit Trennlinien (`border-vault-border`)
- Drei Sektionen nebeneinander:
  - **IGDB Score**: Grosse Zahl (`text-2xl font-bold`), Farbe: gruen (>=75), gelb (>=50), rot (<50). Label "IGDB" darunter in `text-xs text-vault-muted uppercase tracking-wide`
  - **Metacritic Score**: Gleiche Darstellung, Farbe immer `text-blue-400`. Label "Metacritic". Nur anzeigen wenn `metacriticScore != null`
  - **Release-Jahr**: Grosse Zahl in `text-vault-amber`. Label "Release". Nur anzeigen wenn `releaseDate != null`
- Rechts in der Score-Bar: Genre-Pills (grau) + Theme-Pills (indigo)
- Padding: `py-3 px-4`, Border unten: `border-b border-vault-border`

**Info-Grid (unter der Score-Bar):**
- 2-Spalten Grid: Developer, Publisher
- Gleiche Darstellung wie aktuell (`text-vault-muted` Label, weisser Wert)
- Source-Feld entfernen (nicht nuetzlich fuer den User)

**Summary Card:**
- Eigene `.card` mit Heading "Summary" und Text in `text-vault-muted text-sm leading-relaxed`

**Rest bleibt wie gehabt:**
- Artwork Gallery (Grid)
- Video Embeds (Grid)
- Screenshot Gallery
- AI Fun Facts (details/summary)
- AI Story (details/summary)
- Enrich Wizard

### Betroffene Dateien

- Modify: `src/app/game/[id]/page.tsx` — komplettes Layout-Rewrite
- Modify: `src/components/score-badge.tsx` — nicht mehr auf Detail-Page genutzt, nur noch auf Game Cards

## Teil 2: Game Cards — Score-Bar

### Neues Card Layout

```
┌─────────────────┐
│                  │
│   Cover Image    │
│   (3:4 ratio)    │
│                  │
├─────────────────┤
│ Title            │
│ [Platform Tag]   │
│ ┌────┐ ┌────┐   │
│ │ 92 │ │ 89 │   │
│ │IGDB│ │ MC │   │
│ └────┘ └────┘   │
└─────────────────┘
```

- Titel + Platform-Tag bleiben wie aktuell
- Neue Score-Bar darunter: Zwei farbige Quadrate (`w-7 h-7 rounded-md`) nebeneinander
  - IGDB: `bg-green-500/15 text-green-400 font-bold text-xs` (Farbe nach Score-Range wie bisher)
  - Metacritic: `bg-blue-500/15 text-blue-400 font-bold text-xs`
  - Jeweils Label "IGDB" / "MC" in `text-[8px] text-vault-muted` daneben
- Metacritic nur anzeigen wenn vorhanden
- Wenn kein Score vorhanden: nichts anzeigen (kein leerer Platz)

### Betroffene Dateien

- Modify: `src/components/game-card.tsx` — Score-Bar statt einzelner ScoreBadge
- Modify: `src/app/page.tsx` — `metacriticScore` an GameCard prop durchreichen
- Modify: `src/app/platform/[id]/page.tsx` — gleich
- Modify: `src/components/game-grid.tsx` — falls Score-Prop durchgereicht wird

## Teil 3: Re-Enrich Feature

### Neuer Admin Button

- "Re-Enrich Missing Fields" Button im Admin Panel
- Farbe: `bg-orange-600 hover:bg-orange-500 text-white`
- Position: In der bestehenden 3er-Grid Reihe oder als eigene Reihe
- Disabled wenn andere Aktionen laufen

### API Route: `POST /api/enrich/refresh`

**Logik:**
1. Lade alle Games mit `igdbId != null` (bereits enriched)
2. Filtere auf Games die mindestens ein NULL-Feld haben aus: `videoIds`, `artworkUrls`, `franchise`, `themes`, `metacriticScore`
3. Fuer jedes Game: IGDB API erneut abfragen mit gespeicherter `igdbId`
4. Nur NULL-Felder befuellen, bestehende Werte nicht ueberschreiben
5. SSE-Stream fuer Progress (gleicher Pattern wie `/api/enrich`)

**SSE Events:**
```
data: {"type":"start","total":N,"totalRemaining":N}
data: {"type":"progress","current":N,"total":N,"title":"...","platform":"..."}
data: {"type":"enriched","title":"...","current":N,"fieldsUpdated":["videoIds","themes"]}
data: {"type":"skipped","title":"...","current":N}
data: {"type":"error","title":"...","error":"...","current":N}
data: {"type":"done","processed":N,"enriched":N,"failed":N,"remaining":N}
```

**Felder-Mapping (IGDB API → DB):**

| IGDB Feld | DB Feld | Nur wenn NULL |
|-----------|---------|---------------|
| videos | videoIds | ja |
| artworks | artworkUrls | ja |
| franchise.name | franchise | ja |
| themes | themes | ja |
| aggregated_rating | metacriticScore | ja |
| screenshots | screenshotUrls | ja |

### Betroffene Dateien

- Create: `src/app/api/enrich/refresh/route.ts`
- Modify: `src/app/admin/page.tsx` — neuer Button + Streaming-Handler
- Modify: `src/lib/igdb.ts` — evtl. neue Funktion `fetchIgdbById(igdbId)` fuer direkten Lookup statt Suche

## Nicht im Scope

- Automatisches Re-Enrich bei App-Start
- Per-Game Refresh Button auf Detail Page (spaeteres Feature)
- Cover-Refresh (Covers sind bereits vorhanden)
- Score-Darstellung auf Homepage-Sektionen (Recently Added, Top Rated) — aendert sich automatisch durch Game Card Aenderung
