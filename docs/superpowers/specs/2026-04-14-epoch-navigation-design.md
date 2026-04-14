# Epoch-Navigation (Timeline) — Design Spec

> Phase 3.1 der Feature-Roadmap. Eine `/timeline` Seite die Games nach Gaming-Ären gruppiert, mit Ära-spezifischem Farbschema und dem bestehenden InfiniteGameGrid.

---

## Entscheidungen

| Frage | Entscheidung |
|---|---|
| Layout | Hybrid — Sticky Ära-Pills oben + vertikaler Content |
| Tiefe | Filtered Browse — Bestehender `InfiniteGameGrid` mit Ära-Filter |
| Styling | Mittel — Ära-Farbe + subtiler Background-Gradient-Übergang |
| Navigation | Sidebar — Neuer Link unter "Insights" |
| Default View | Ära mit den meisten Spielen ist vorausgewählt |

---

## Seitenstruktur: `/timeline`

**Layout (top → bottom):**

1. **Breadcrumbs**: Home → Timeline
2. **Sticky Ära-Leiste** (`EraBar`): Horizontal scrollbare Pills. Jede Pill zeigt Ära-Kurzname + Game-Count. Aktive Ära hat dickere Border + volle Ära-Farbe. Klebt beim Scrollen oben fest (`sticky top-0 z-10`).
3. **Ära-Header** (`EraHeader`): Ära-Name, Zeitraum, Game-Count, Plattform-Tags (extrahiert aus den Games der Ära).
4. **Game-Grid**: Bestehender `InfiniteGameGrid` mit `fetchUrl=/api/games?era=<era-slug>&sort=igdbScore&order=desc`. Sort/Search funktionieren wie gewohnt.

---

## Ära-Definitionen (shared Konstante)

Bestehende `ERA_BUCKETS` aus `src/app/api/insights/route.ts` werden in eine shared Datei extrahiert: `src/lib/eras.ts`.

```typescript
export const ERA_BUCKETS = [
  { name: "Dawn of Gaming", slug: "dawn-of-gaming", range: "1977–1982", minYear: 1977, maxYear: 1982, color: "#92400e" },
  { name: "8-Bit Era", slug: "8-bit-era", range: "1983–1988", minYear: 1983, maxYear: 1988, color: "#dc2626" },
  { name: "16-Bit Golden Age", slug: "16-bit-golden-age", range: "1989–1993", minYear: 1989, maxYear: 1993, color: "#7c3aed" },
  { name: "The 3D Revolution", slug: "3d-revolution", range: "1994–1997", minYear: 1994, maxYear: 1997, color: "#6b7280" },
  { name: "The Golden Era", slug: "golden-era", range: "1998–2004", minYear: 1998, maxYear: 2004, color: "#ea580c" },
  { name: "HD Generation", slug: "hd-generation", range: "2005–2011", minYear: 2005, maxYear: 2011, color: "#16a34a" },
  { name: "Modern Era", slug: "modern-era", range: "2012–today", minYear: 2012, maxYear: 9999, color: "#e11d48" },
] as const;

export type EraSlug = typeof ERA_BUCKETS[number]["slug"];
```

Insights-Route importiert aus `src/lib/eras.ts` statt lokal zu definieren.

---

## API-Änderung: `GET /api/games`

Neuer optionaler Query-Parameter: `era=<era-slug>`

Wenn gesetzt:
- Slug wird gegen `ERA_BUCKETS` aufgelöst zu `minYear`/`maxYear`
- Prisma-Where wird erweitert um: `releaseDate: { gte: new Date(minYear, 0, 1), lt: new Date(maxYear + 1, 0, 1) }`
- Spiele ohne `releaseDate` werden bei `era`-Filter ausgeschlossen

Kein neuer API-Endpoint nötig.

---

## Neue Komponenten

### `EraBar` (`src/components/timeline/era-bar.tsx`)

- **Props**: `eras: { slug, name, shortName, count, color }[]`, `activeEra: EraSlug`, `onEraChange: (slug: EraSlug) => void`
- **Darstellung**: Horizontal scrollbare Pill-Buttons in einer `flex gap-2 overflow-x-auto` Leiste
- **Pill-Styling**:
  - Inaktiv: `background: eraColor/15`, `color: eraColor`, `border: 1px solid eraColor/30`
  - Aktiv: `background: eraColor/25`, `border: 2px solid eraColor`, `font-weight: 600`
- **Sticky**: `sticky top-0 z-10 bg-vault-bg/80 backdrop-blur-sm` mit `border-b border-vault-border`
- **Kurzname-Mapping**: "Dawn of Gaming" → "Dawn", "16-Bit Golden Age" → "16-Bit", "The 3D Revolution" → "3D", "The Golden Era" → "Golden", "HD Generation" → "HD", "Modern Era" → "Modern"
- **Format pro Pill**: `{shortName} · {count}`

### `EraHeader` (`src/components/timeline/era-header.tsx`)

- **Props**: `era: EraBucket`, `gameCount: number`, `platforms: string[]`
- **Darstellung**:
  - Ära-Name in Ära-Farbe (font-heading, text-xl, font-bold)
  - Zeitraum in vault-muted (text-sm)
  - Game-Count: "{count} Spiele"
  - Plattform-Tags: Kleine Pills (`text-xs, rounded-full, px-2 py-0.5`) in Ära-Farbe/15
- **Plattform-Extraktion**: Wird vom Parent aus den geladenen Games berechnet (distinct `platformLabel`-Werte)

---

## Ära-Theming (Background-Gradient)

Beim Ära-Wechsel ändert sich der Hintergrund der gesamten Seite:

```css
/* Auf dem äußersten Container der Timeline-Page */
background: radial-gradient(ellipse at top, {eraColor}08 0%, transparent 60%);
transition: background 500ms ease;
```

- Sehr subtil (8% Opacity) — nur ein Hauch der Ära-Farbe
- Transition animiert sanft beim Wechsel
- Kein Scanline-Overlay, keine Custom-Fonts, keine Texturen

---

## Sidebar-Integration

Neuer Link in `src/components/layout/sidebar.tsx` nach "Insights":

- **Label**: "Timeline"
- **Icon**: Clock/History SVG (ähnlich simpel wie die bestehenden Sidebar-Icons)
- **Active State**: `bg-vault-amber/10 text-vault-amber` (wie Insights)
- **Href**: `/timeline`

---

## Ära-Counts für EraBar

Die Timeline-Page braucht pro Ära den Game-Count für die Pills. Zwei Optionen:

**Gewählt: Eigener leichtgewichtiger Endpoint `GET /api/timeline/counts`**
- Gibt nur `{ slug, count }[]` zurück
- Zählt Games pro Ära via `releaseDate`-Range
- Wird einmal beim Page-Load gefetcht
- Alternativ: Insights-API wiederverwenden, aber die liefert zu viel Daten

---

## Plattform-Tags im Ära-Header

Die Plattformen pro Ära werden client-seitig aus dem ersten Batch geladener Games extrahiert (`distinct platformLabel`). Das reicht für die Anzeige — es müssen nicht alle Plattformen der Ära gezeigt werden, die Top-Plattformen aus den ersten 48 Games sind repräsentativ genug.

---

## Datenfluss

```
1. Page Mount
   → fetch GET /api/timeline/counts
   → Erhält [{slug, count}, ...] für alle 7 Ären
   → Ära mit höchstem count wird activeEra

2. Era-Auswahl (initial + Klick)
   → EraBar highlighted activeEra
   → Background-Gradient wechselt zu Ära-Farbe
   → fetch GET /api/games?era={slug}&sort=igdbScore&order=desc&limit=48
   → EraHeader zeigt Name, Range, Count, Plattform-Tags
   → InfiniteGameGrid zeigt Games, lädt mehr bei Scroll

3. Sort/Search innerhalb Ära
   → fetchUrl wird angepasst: /api/games?era={slug}&sort={sort}&search={search}
   → InfiniteGameGrid reset + reload
```

---

## Nicht im Scope

- Scanline-Overlays, Ära-spezifische Fonts, Retro-Texturen (ggf. späteres Enhancement)
- Plattform-Swimlanes Toggle
- "Unknown Era" Bucket (Spiele ohne releaseDate werden auf der Timeline nicht gezeigt, sind weiterhin auf Home/Platform-Pages sichtbar)
- Ära-spezifische Tooltip-Styles auf Game-Cards
- Header-Navigation-Link (nur Sidebar)

---

## Geänderte Dateien

| Datei | Änderung |
|---|---|
| `src/lib/eras.ts` | **Neu** — Shared ERA_BUCKETS + EraSlug Type |
| `src/app/api/insights/route.ts` | Import ERA_BUCKETS aus `src/lib/eras.ts` |
| `src/app/api/games/route.ts` | `era` Query-Parameter → releaseDate-Filter |
| `src/app/api/timeline/counts/route.ts` | **Neu** — Ära-Counts Endpoint |
| `src/app/timeline/page.tsx` | **Neu** — Timeline Page (Client Component) |
| `src/components/timeline/era-bar.tsx` | **Neu** — Sticky Ära-Pill-Leiste |
| `src/components/timeline/era-header.tsx` | **Neu** — Ära-Info-Header |
| `src/components/layout/sidebar.tsx` | Neuer "Timeline" Link |
