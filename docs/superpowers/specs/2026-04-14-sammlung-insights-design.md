# Phase 2.1 — Sammlung-Insights

> Analyse der gesamten ROM-Sammlung: Genre-Verteilung, Ären-Verteilung, Top Franchises/Developer/Publisher, Cross-Platform-Info.

## Motivation

Die Sammlung hat hunderte Games mit IGDB-Metadaten (Genres, Release-Dates, Franchises, Developer, Publisher). Diese Daten werden bisher nur pro Game angezeigt. Phase 2.1 aggregiert sie zu Collection-Level-Insights — der User sieht zum ersten Mal das "Big Picture" seiner Sammlung.

Bildet die Datenbasis für Phase 2.2 (Smart Recommendations) und Phase 3.1 (Epoch-Navigation).

## Scope

### In Scope
- Genre-Verteilung (Top 10 + "Other")
- Ären-Verteilung (7 feste Ären-Buckets + "Unknown")
- Top 10 Franchises (nach Anzahl Games)
- Top 10 Developers, Top 10 Publishers
- Cross-Platform-Info (Games die auf 2+ Plattformen existieren)
- Neue `/insights`-Seite mit Charts (Recharts) und Cards
- Ein API-Endpunkt mit Server-Side-Aggregation

### Nicht in Scope
- Device-Filter (immer gesamte Sammlung)
- Natürlichsprachliche Insight-Karten auf der Home-Page (späterer Schritt)
- Franchise-Completion ("X von Y") — braucht IGDB-Franchise-API, kommt in Phase 2.2
- Neue Prisma-Models / Caching — on-the-fly Aggregation reicht

## API: `GET /api/insights`

Server-Side-Aggregation. Kein Device-Filter.

### Response-Struktur

```ts
{
  genres: [{ name: string, count: number }],       // Top 10 + "Other", absteigend
  eras: [{
    name: string,       // "8-Bit Era"
    range: string|null, // "1983–1988"
    count: number,
  }],
  franchises: [{ name: string, count: number }],    // Top 10, absteigend
  developers: [{ name: string, count: number }],    // Top 10, absteigend
  publishers: [{ name: string, count: number }],    // Top 10, absteigend
  crossPlatform: [{
    title: string,
    platforms: string[], // platform IDs
    count: number,
  }],
  totalGames: number,
  enrichedGames: number,
}
```

### Aggregation-Logik

- **Genres/Themes:** JSON-Strings (`'["RPG","Action"]'`) parsen, flatten, pro Genre zählen. Top 10, Rest als "Other" summiert. Nur enriched Games (genres !== null).
- **Ären:** Aus `releaseDate` ableiten mit festen Buckets:
  - `< 1983` → "Dawn of Gaming" (1977–1982)
  - `1983–1988` → "8-Bit Era"
  - `1989–1993` → "16-Bit Golden Age"
  - `1994–1997` → "The 3D Revolution"
  - `1998–2004` → "The Golden Era"
  - `2005–2011` → "HD Generation"
  - `2012+` → "Modern Era"
  - `null` → "Unknown"
- **Franchises/Developers/Publishers:** Aus den jeweiligen String-Feldern gruppieren und zählen. Null-Werte überspringen.
- **Cross-Platform:** Gruppierung nach `title`. Nur Einträge mit 2+ verschiedenen `platform`-Werten.
- **enrichedGames:** Games wo mindestens `genres` oder `igdbId` gesetzt ist.

## UI: `/insights`-Seite

### Layout

```
┌──────────────────────────────────────────────────┐
│  Collection Insights                              │
│  Based on 320 enriched games out of 350 total     │
├────────────────────────┬─────────────────────────┤
│                        │                         │
│   Genre-Verteilung     │   Ären-Verteilung       │
│   (Donut Chart)        │   (Horizontal Bar)      │
│   Top 10 + Other       │   7 Ären + Unknown      │
│   Hover: Count + %     │   Hover: Count          │
│                        │                         │
├──────────┬─────────────┴────────┬────────────────┤
│          │                      │                │
│  Top     │  Top                 │  Top           │
│  Franch. │  Developers          │  Publishers    │
│  (List)  │  (List)              │  (List)        │
│          │                      │                │
├──────────┴──────────────────────┴────────────────┤
│  Cross-Platform Games (compact list, if any)      │
│  "Super Mario World — SNES, GBA"                  │
└──────────────────────────────────────────────────┘
```

### Charts (Recharts, bereits in Dependencies)

- **Genre Donut:** `PieChart` mit `Pie` (innerRadius für Donut-Effekt). Custom Tooltip mit Name, Count, Prozent. 10 distinkte Farben + grau für "Other".
- **Ären Bar:** `BarChart` horizontal. Jede Ära eine eigene Farbe passend zum Retro-Theme:
  - Dawn of Gaming: Atari-Braun
  - 8-Bit Era: NES-Rot
  - 16-Bit Golden Age: SNES-Lila
  - 3D Revolution: PS1-Grau
  - Golden Era: Dreamcast-Orange
  - HD Generation: Xbox-Grün
  - Modern Era: Switch-Neon
  - Unknown: Grau

### Cards (3er Grid)

Jede Card zeigt eine sortierte Top-10-Liste: Rang + Name + Count. Einheitliches Design, keine Charts in den Cards — nur Text.

### Edge Cases

- **Leere Sammlung:** "No games yet — scan a device to get started"
- **Keine enriched Games:** Charts leer, Hinweis "Enrich your games with IGDB metadata to see insights"
- **Cross-Platform leer:** Sektion wird nicht angezeigt

### Responsiveness

- Charts: 2er Grid → 1 Spalte auf Mobile
- Cards: 3er Grid → 1 Spalte auf Mobile

### Navigation

Neuer Eintrag in der Sidebar: "Insights" (Icon: BarChart3 oder PieChart aus Lucide).

## Technische Details

- **Kein neues Prisma-Model.** Aggregation on-the-fly aus bestehenden Game-Feldern.
- **Kein Cache.** Bei <5000 Games ist die Aggregation schnell genug. Falls Performance-Probleme auftreten: ApiCache mit kurzer TTL nachrüsten (YAGNI bis dahin).
- **Client-Component** für die Seite (Recharts braucht Client-Side-Rendering). Daten per `fetch` im `useEffect` laden.
- **Bestehende Patterns nutzen:** Auth-Check wie andere API-Routes (`requireAuth`), Prisma-Queries wie bestehende Endpoints.
