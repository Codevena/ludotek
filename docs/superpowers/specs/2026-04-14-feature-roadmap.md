# Game Vault — Feature Roadmap

> Priorisierte Roadmap für alle geplanten Features. Jedes Feature bekommt einen eigenen Spec → Plan → Implementation Zyklus.

---

## Phase 1: Fundament

### 1.1 Offline-First / Metadata Cache — COMPLETE (2026-04-14)

**Status:** Implementiert und committed. Spec: `docs/superpowers/specs/2026-04-14-offline-first-cache-design.md`

**Was gebaut wurde:**
- `CacheEntry` + `ApiCache` Prisma-Models, Game-Felder für lokale Pfade
- Image-Cache: Covers/Screenshots/Artwork in `data/` speichern, via `/api/cache/` ausliefern
- API-Response-Cache: IGDB-Suchen (24h TTL), Game-Details (7d TTL)
- Auto-Caching nach Enrichment (initial + refresh)
- Alle Components nutzen lokale Pfade mit Remote-URL-Fallback
- Admin-UI: Cache-Statistiken, Batch-Download, Clear-Buttons
- Game-Detail: "Refresh Metadata"-Button
- Platform-Seite: "Refresh All Metadata"-Button

---

### ~~1.2 Duplicate Detection~~ — SKIPPED

**Entscheidung (2026-04-14):** Übersprungen. Der bestehende `cleanFilename()` + `deduplicateGames()` fängt bereits die meisten echten Duplikate ab (Region-Varianten, Format-Varianten, Multi-Disc). Fuzzy Matching (Schreibvarianten) tritt in der Praxis selten auf bei konsistenten ROM-Sets. Cross-Platform-Info fließt stattdessen als Insight-Typ in Phase 2.1 ein.

---

## Phase 2: Intelligenz

### 2.1 Sammlung-Insights — COMPLETE (2026-04-14)

**Status:** Implementiert und committed. Spec: `docs/superpowers/specs/2026-04-14-sammlung-insights-design.md`

**Was gebaut wurde:**
- `GET /api/insights` — Server-Side-Aggregation aus bestehenden Game-Feldern (genres, releaseDate, franchise, developer, publisher)
- `/insights` Seite mit Recharts:
  - Genre-Verteilung (Donut Chart, Top 10 + "Other", Tooltip mit Count + %)
  - Ären-Verteilung (Horizontal Bar Chart, 7 Ära-Buckets + Unknown, era-spezifische Farben)
  - Top 10 Franchises, Developers, Publishers (Ranked Cards)
  - Cross-Platform Games (kompakte Liste)
- Loading-Skeletons, Error-State, Empty-States (keine Games / keine enriched Games)
- Sidebar-Navigation: "Insights" Link mit Bar-Chart-Icon
- Kein neues Prisma-Model, keine API-Calls, on-the-fly Aggregation
- 4-Agent-Review bestanden

---

### ~~2.2 Smart Recommendations~~ — SKIPPED

**Entscheidung (2026-04-14):** Übersprungen. Die bestehende Discover-Page (`/discover`) deckt alle geplanten Use-Cases bereits ab: Genre-Exploration (Wizard mit Plattform + Genre-Auswahl), Hidden Gems (Library-Tab mit "Focus on hidden gems" Prompt + VibeTags), Cross-Platform (Wishlist-Tab empfiehlt fehlende Spiele). Die AI-gestützte Lösung via OpenRouter liefert bessere Ergebnisse als rein datengetriebene Logik. Insights zeigt Cross-Platform-Games bereits an.

---

## Phase 3: Erlebnis

### 3.1 Epoch-Navigation (Timeline)

**Warum jetzt:** Das ist das Feature das Game Vault visuell von allen anderen ROM-Managern unterscheidet. Es bringt das "Zeitreise"-Gefühl.

**Scope:**
- **Timeline-View** (`/timeline`): Horizontaler Zeitstrahl von 1977 bis heute.
  - Jede Gaming-Ära ist eine visuell distinkte Zone mit eigenem Farbschema:
    - **1977–1983** "Dawn of Gaming" — Atari-braun, Woodgrain-Textur, grobe Pixel
    - **1983–1989** "8-Bit Era" — NES-Grau/Rot, Pixel-Art-Borders
    - **1989–1994** "16-Bit Golden Age" — SNES-Lila/Mega-Drive-Blau, lebhaftere Farben
    - **1994–1998** "The 3D Revolution" — PS1-Grau, N64-Bunt, Low-Poly-Ästhetik
    - **1998–2005** "The Golden Era" — Dreamcast-Orange, PS2-Blau, GBA-Lila
    - **2005–2012** "HD Generation" — Xbox360-Grün, Wii-Weiß, clean & modern
    - **2012–heute** "Modern Era" — Switch-Neon, PS4-Blau, flaches Design
  - Jede Ära zeigt:
    - Konsolen-Icons die in diese Ära fallen
    - Anzahl der Spiele die der User aus dieser Ära besitzt
    - Top 3 Spiele (nach Score) als Mini-Cover
    - Click → Expanded View mit allen Spielen dieser Ära als Grid
  - **Scroll-Interaktion**: Horizontales Scrollen (oder Drag) durch die Zeitleiste. Beim Scrollen verändert sich subtil der Hintergrund/die Farbtemperatur der gesamten Seite.
  - **Plattform-Swimlanes** (optional toggle): Statt Ären kann man auf Plattform-Lanes umschalten — jede Konsole als horizontale Lane mit ihren Spielen chronologisch aufgereiht.
- **Datenquelle**: `releaseDate` aus IGDB (bereits in DB). Spiele ohne Release-Date werden in "Unknown Era" gruppiert.
- **Retro-Touches**:
  - Ära-spezifische CSS: Scanline-Overlay für 8-Bit, Gradient-Glow für 16-Bit, Glossy-Buttons für PS2-Ära
  - Hover über ein Spiel zeigt einen Tooltip im Stil der jeweiligen Ära
  - Transition-Animationen beim Ära-Wechsel (Farben morphen, nicht springen)

---

### 3.2 Auto-Organization

**Warum jetzt:** Ergänzt die Duplicate Detection und nutzt die SyncQueue-Infrastruktur die schon existiert.

**Scope:**
- **Naming Convention Engine**: Der User wählt eine Konvention:
  - **No-Intro**: `Title (Region) (Rev X).ext`
  - **TOSEC**: `Title (Year)(Publisher)(Region).ext`
  - **Clean**: `Title.ext` (simpelste Form, Region/Tags entfernt)
  - **Custom**: User definiert ein Pattern mit Platzhaltern `{title}`, `{region}`, `{year}`, `{rev}`
- **Rename Preview**: Zeigt eine Vorschau aller Umbenennungen bevor sie passieren:
  - `Super_Mario_World_(U)_[!].smc` → `Super Mario World (USA).smc`
  - Conflicts werden hervorgehoben (wenn zwei Files zum gleichen Namen konvergieren)
- **Batch-Rename via SyncQueue**: Alle Umbenennungen werden in die bestehende SyncQueue gestaged → User reviewed im SyncPanel → Apply.
- **Ordnerstruktur-Vorschläge**: Falls ROMs nicht in den erwarteten Plattform-Ordnern liegen, schlägt das Tool Verschiebungen vor.
- **Nicht im Scope:** Automatisches Umbenennen ohne Preview. Immer Queue → Review → Apply.

---

## Phase 4: Polish

### 4.1 Onboarding & DX

**Scope:**
- **Setup-Wizard** (First-Run):
  - Schritt 1: "Willkommen bei Game Vault" — Sprache wählen (DE/EN)
  - Schritt 2: API-Keys eingeben (IGDB Client ID/Secret, optional OpenRouter, optional SteamGridDB) — mit "Skip" Option und Erklärung was ohne Keys fehlt
  - Schritt 3: Erstes Device hinzufügen (SSH/FTP/Local mit Test-Connection-Button)
  - Schritt 4: Scan-Paths konfigurieren (mit "Auto-Detect" für bekannte Pfade: ES-DE Default, RetroArch Default)
  - Schritt 5: Ersten Scan starten → Redirect zu Home mit ScanBar
  - Wizard erscheint nur wenn Settings leer sind UND keine Games in der DB
- **One-Click Deploy**:
  - `docker-compose.yml` überarbeiten: Single-Container mit Volume-Mounts für `data/` und `prisma/dev.db`
  - `docker-compose up` startet alles (DB-Migration automatisch beim Start)
  - Unraid Community App Template (großer Teil der Zielgruppe nutzt Unraid)
- **README Overhaul**:
  - Hero-Screenshot (Home-Page mit Spielen)
  - Feature-Übersicht mit GIFs (Scan, Enrich, Upload, File Manager)
  - Quick-Start (Docker + Manual)
  - Tech-Stack Badge-Row
  - Contributing Guide (Arch-Übersicht, PR-Workflow, Code-Conventions)
- **Contributor Docs**:
  - `CONTRIBUTING.md`: Setup, Code-Conventions, PR-Template
  - `docs/architecture.md`: High-Level-Arch-Diagramm, Datenfluss, API-Übersicht

---

### 4.2 Offline-First Erweiterung: PWA

**Scope (optional, nach 4.1):**
- Service Worker für statische Assets
- Manifest.json für "Add to Home Screen"
- Offline-Fallback-Page wenn Server nicht erreichbar
- Cache-First-Strategie für Cover-Bilder und Game-Detail-Pages

---

## Zusammenfassung & Reihenfolge

| Phase | Feature | Abhängigkeiten | Aufwand |
|-------|---------|----------------|---------|
| ~~1.1~~ | ~~Offline-First / Metadata Cache~~ | ~~—~~ | ~~DONE~~ |
| ~~1.2~~ | ~~Duplicate Detection~~ | ~~—~~ | ~~SKIPPED~~ |
| ~~2.1~~ | ~~Sammlung-Insights~~ | ~~1.1 (cached data)~~ | ~~DONE~~ |
| ~~2.2~~ | ~~Smart Recommendations~~ | ~~2.1 (Insights-Daten)~~ | ~~SKIPPED~~ |
| 3.1 | Epoch-Navigation | 2.1 (Ären-Daten, Release-Dates) | Hoch |
| 3.2 | Auto-Organization | — | Mittel |
| 4.1 | Onboarding & DX | Alle Features stehen | Mittel |
| 4.2 | PWA (optional) | 1.1 (Offline-Cache) | Niedrig |

### Bestehendes Backlog (aus NEXT_SESSION.md)

Diese Items werden **parallel** zu den Phasen abgearbeitet wenn sie Berührungspunkte haben:

- [ ] Scanner ES-DE Parity (Priority 0 — in Progress)
- [ ] Theme Toggle (Dark/Light)
- [ ] Export/Backup (JSON/CSV)
- [ ] Platform Icons vervollständigen
- [ ] Plaintext Device-Passwörter verschlüsseln
- [ ] Progress-Bar Overlap fixen (ScanBar/EnrichmentBar/TransferBar)
- [ ] Buffer-basierter File-Transfer (2GB Limit)
- [ ] Concurrent Transfer Queue statt 409
- [ ] Sync-Apply Race Condition fixen
