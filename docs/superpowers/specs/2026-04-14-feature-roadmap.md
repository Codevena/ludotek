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

### 3.1 Epoch-Navigation (Timeline) — COMPLETE (2026-04-14)

**Status:** Implementiert und committed. Spec: `docs/superpowers/specs/2026-04-14-epoch-navigation-design.md`

**Was gebaut wurde:**
- Shared `src/lib/eras.ts` mit ERA_BUCKETS (7 Ären, Slug, Farbe, Jahresbereich)
- `/api/games?era=` Filter (releaseDate-Range, 400 bei ungültigem Slug)
- `/api/timeline/counts` — Leichtgewichtiger Endpoint für Ära-Counts (parallel DB-Queries)
- `/timeline` Seite: Sticky Ära-Pills (EraBar) + Ära-Header + InfiniteGameGrid
- Subtiler Ära-Farbgradient auf dem Hintergrund (500ms Transition)
- AbortController für Race-Condition-Schutz bei schnellem Ära-Wechsel
- Error-States mit Retry für beide Fetch-Pfade (Counts + Games)
- Sidebar: Timeline-Link mit Clock-Icon nach Insights
- Loading-Skeletons, aria-pressed für Accessibility
- 4-Agent-Review bestanden (2x Codex, 2x Claude, 2 Runden)

**Nicht gebaut (bewusst entschieden):**
- Scanlines, Retro-Texturen, Ära-spezifische Fonts (YAGNI, ggf. späteres Enhancement)
- Plattform-Swimlanes Toggle
- "Unknown Era" Bucket (Spiele ohne releaseDate nur auf Home/Platform sichtbar)

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
| ~~3.1~~ | ~~Epoch-Navigation~~ | ~~2.1 (Ären-Daten, Release-Dates)~~ | ~~DONE~~ |
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
