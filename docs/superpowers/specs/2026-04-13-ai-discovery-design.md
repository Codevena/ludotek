# AI Game Discovery — Design Spec

Personalisierte Spieleempfehlungen via AI. Wizard-basiert und als Quick-Action auf Platform-Seiten. Zwei Modi: Empfehlungen aus der eigenen Library ("Hidden Gems") und Empfehlungen fuer fehlende Games ("Wishlist").

## Context

- **Bestehendes System:** Game Vault — Next.js 14, Prisma 6, SQLite, TailwindCSS
- **AI Backend:** OpenRouter (bereits integriert, Key in Settings, Modell konfigurierbar)
- **Daten verfuegbar:** Alle Games mit IGDB-Metadaten (Cover, Score, Genres, Themes, Videos, Artworks, Summary)
- **IGDB API:** Bereits integriert, kann externe Games suchen

## Zwei Zugangswege

### 1. Quick Pick Wizard (`/discover`)

Eigene Seite mit 2-Step Wizard:

**Step 1 — Konsolen waehlen:**
- Multi-Select Chip-Row aller Plattformen (aus PLATFORM_CONFIG)
- Nur Plattformen mit Games anzeigen (gameCount > 0)
- Amber-Highlight fuer selektierte Chips (gleicher Style wie Upload-Page)

**Step 2 — Genres waehlen:**
- Chip-Row mit allen Genres die auf den gewaehlten Plattformen vorkommen
- Dynamisch geladen: Query alle distinct Genres der selektierten Plattformen
- Multi-Select, mindestens 1 Genre erforderlich
- Themes als zweite Reihe (optional selektierbar)

**Generate Button:** Startet AI-Generierung, SSE-Stream fuer Live-Progress.

### 2. Surprise Me (Platform-Seiten)

- Button auf `/platform/[id]` Seite: "Surprise Me" (Amber, neben Sort-Select)
- Kein Wizard — nutzt alle Genres der Plattform
- Navigiert zu `/discover?platforms=[id]&surprise=true` und startet sofort

## AI Engine

### Prompt-Aufbau

**Fuer "In deiner Library" Tab:**
```
Du bist ein Gaming-Experte. Der User hat folgende Games auf seinen Konsolen:

[Liste aller Games der gewaehlten Plattformen mit: Titel, Platform, Genres, Themes, IGDB Score]

Der User mag besonders: [gewaehlte Genres/Themes]

Empfehle 5-8 Games aus dieser Library die der User unbedingt spielen sollte.
Fokus auf versteckte Perlen und unterschaetzte Titel, nicht nur die offensichtlichen Klassiker.

Fuer jedes Game:
- title: Exakter Titel wie in der Liste (WICHTIG: muss exakt matchen!)
- platform: Exakte Platform-ID wie in der Liste
- reason: 2-3 Saetze warum der User dieses Game lieben wird (personalisiert auf seine Genre-Praeferenzen)
- vibeTag: Einer von: "Hidden Gem", "Absoluter Klassiker", "Unterschaetzt", "Must Play", "Geheimtipp", "Ueberraschung"

Antworte NUR mit einem JSON-Array, kein anderer Text.
```

**Fuer "Fehlt dir noch" Tab:**
```
Du bist ein Gaming-Experte. Der User hat folgende Games auf [Plattform(en)]:

[Liste der vorhandenen Game-Titel]

Der User mag besonders: [gewaehlte Genres/Themes]

Empfehle 5-8 Games fuer [Plattform(en)] die der User NICHT hat aber lieben wuerde.
Die Games muessen real existieren und fuer die genannte(n) Plattform(en) verfuegbar sein.

Fuer jedes Game:
- title: Offizieller Spieletitel
- platform: Plattform-ID (eins von: [platform IDs])
- reason: 2-3 Saetze warum der User dieses Game lieben wird
- vibeTag: Einer von: "Must Have", "Fehlt dir!", "Absolut genial", "Versteckter Klassiker", "Top Empfehlung"

Antworte NUR mit einem JSON-Array, kein anderer Text.
```

### AI Response Processing

1. Parse JSON-Array aus AI-Response
2. **"In deiner Library":** Match `title` + `platform` gegen DB (case-insensitive, fuzzy). Nur Games die matchen werden angezeigt.
3. **"Fehlt dir noch":** Fuer jedes empfohlene Game: IGDB-Suche nach Titel + Platform, lade Cover + Score + Genres + Summary. Filtere Games raus die der User doch schon hat.
4. Ergebnisse werden als JSON gespeichert und an den Client gestreamt.

### OpenRouter Request

- Nutzt bestehenden `openrouterKey` aus Settings
- Nutzt bestehenden `OPENROUTER_MODEL` (oder Settings-Modell)
- Gleicher Request-Pattern wie `src/lib/openrouter.ts`
- Temperature: 0.8 (etwas kreativer als Standard)

## API Routes

### `POST /api/discover`

**Request:**
```json
{
  "platforms": ["snes", "psx"],
  "genres": ["RPG", "Action"],
  "themes": ["Fantasy"],
  "tab": "library" | "wishlist"
}
```

**Response:** SSE Stream

**SSE Events:**
```
data: {"type":"generating","tab":"library","message":"Analysiere deine Library..."}
data: {"type":"recommendations","tab":"library","games":[
  {
    "title":"Chrono Trigger",
    "platform":"snes",
    "reason":"Als RPG-Fan wirst du...",
    "vibeTag":"Hidden Gem",
    "dbId": 42,
    "coverUrl":"https://...",
    "igdbScore": 96,
    "metacriticScore": 92,
    "genres": ["RPG"],
    "artworkUrl": "https://...",
    "videoId": "abc123"
  }
]}
data: {"type":"generating","tab":"wishlist","message":"Suche fehlende Perlen via IGDB..."}
data: {"type":"recommendations","tab":"wishlist","games":[
  {
    "title":"Terranigma",
    "platform":"snes",
    "reason":"Ein Action-RPG Meisterwerk...",
    "vibeTag":"Fehlt dir!",
    "igdbCoverUrl":"https://...",
    "igdbScore": 88,
    "genres": ["Action RPG"],
    "summary": "..."
  }
]}
data: {"type":"done"}
```

**Library-Tab Games** haben `dbId` (Link zur Game Detail Page) + alle DB-Felder.
**Wishlist-Tab Games** haben IGDB-Daten (Cover, Score, Summary) aber kein `dbId`.

### `GET /api/discover/genres?platforms=snes,psx`

Gibt alle distinct Genres und Themes der gewaehlten Plattformen zurueck.

**Response:**
```json
{
  "genres": ["RPG", "Action", "Adventure", "Puzzle", "Platformer"],
  "themes": ["Fantasy", "Sci-Fi", "Horror", "Open World"]
}
```

## UI: `/discover` Page

### Wizard Phase

- Breadcrumbs: `Home > Discover`
- Step-Indicator: Zwei Kreise mit Linie (1 amber active, 2 grau)
- Step 1: Platform-Chips (Multi-Select)
- Step 2: Genre-Chips + Theme-Chips (Multi-Select, dynamisch geladen)
- "Generate Recommendations" Button (amber, full-width)

### Loading Phase

- Animated Puls-Dot + "AI analysiert deine Library..." Text
- SSE-Stream Updates werden als Status-Text angezeigt

### Results Phase

**Tab-Bar:** "In deiner Library" | "Fehlt dir noch" — Amber underline fuer aktiven Tab

**Library-Tab (Cinematic Cards):**
- Top-Empfehlung: Artwork-Hero Banner (falls vorhanden), Cover links, Titel + Platform + Score rechts, Vibe-Tag als Badge
- "Warum du das feiern wirst:" — AI-Begruendung darunter
- Restliche Empfehlungen: Kompakte Cards mit Cover, Titel, Platform, Score, Vibe-Tag, kurze Begruendung
- Jede Card ist Link zur `/game/[dbId]` Detail Page

**Wishlist-Tab (Cinematic Cards):**
- Gleiches Layout, aber Cover/Score von IGDB (nicht aus DB)
- Kein Link zur Detail Page (Game existiert nicht in der Library)
- Optional: "Auf IGDB ansehen" Link

### Surprise Me Integration

- URL: `/discover?platforms=snes&surprise=true`
- Ueberspringt Wizard, startet sofort mit allen Genres der Plattform
- Ergebnisse werden normal angezeigt

## Seite auf Platform Page

### "Surprise Me" Button

- Position: Neben dem Sort-Select in der Platform-Page Header-Zeile
- Style: `bg-vault-amber/20 text-vault-amber border border-vault-amber/30 hover:bg-vault-amber/30` (subtiler als voller Amber-Button)
- Text: "Surprise Me"
- Navigiert zu: `/discover?platforms=[platformId]&surprise=true`

## File Structure

```
src/
├── app/
│   ├── discover/page.tsx              # Discovery Page (Wizard + Results)
│   └── api/
│       └── discover/
│           ├── route.ts               # POST: AI Recommendations (SSE)
│           └── genres/route.ts        # GET: Available genres for platforms
├── lib/
│   └── recommender.ts                 # AI prompt builder + response parser
└── components/
    ├── discover-wizard.tsx            # 2-Step Wizard UI
    ├── discover-results.tsx           # Tab-View mit Cinematic Cards
    └── recommendation-card.tsx        # Single Recommendation Card
```

## Error Handling

- **OpenRouter nicht konfiguriert:** Freundliche Meldung "AI API Key nicht konfiguriert. Gehe zu Admin > Settings."
- **AI gibt ungültiges JSON:** Retry einmal, dann Fehlermeldung
- **Kein Game matched:** "Die AI hat Games empfohlen die wir nicht in deiner Library finden konnten. Versuch's nochmal!"
- **IGDB Rate Limit (Wishlist):** Delay zwischen Requests, Fallback auf weniger Empfehlungen
- **Keine Games auf Plattform:** Platform-Chip deaktiviert (disabled wenn gameCount === 0)

## Nicht im Scope

- Persistierung der Empfehlungen (jede Generierung ist frisch)
- User-Ratings / Feedback auf Empfehlungen
- Collaborative Filtering (braucht mehrere User)
- Game-spezifische Empfehlungen ("Mehr wie dieses Game")
