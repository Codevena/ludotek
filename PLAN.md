# Game Vault — Feature Roadmap

## Feature 1: Smart Upload — Auto-Erkennung der Systeme (DONE)

### Problem
Aktuell muss man beim Upload erst manuell ein System auswählen, bevor man Dateien hochladen kann. Wenn man 4 Ordner mit ROMs reinzieht (z.B. `snes/`, `gba/`, `megadrive/`, `n64/`), muss man das für jedes System einzeln machen.

### Lösung
Ordner-basierte Auto-Erkennung: Beim Drag & Drop von Ordnern wird das System automatisch anhand der Ordnernamen erkannt. Die `PLATFORM_CONFIG.dirs`-Mappings sind bereits vorhanden.

### Design

**Neuer Flow:**
1. User zieht Ordner/Dateien in die Dropzone (kein System-Auswahl-Schritt mehr nötig)
2. System analysiert die Ordnerstruktur:
   - Ordnername matchen gegen `PLATFORM_CONFIG.dirs` (exakt + fuzzy)
   - Fuzzy-Matching für Varianten: `mega-drive`, `genesis`, `SNES`, `super-nintendo` etc.
   - File Extensions als Fallback: `.gba` → GBA, `.sfc`/`.smc` → SNES, `.n64`/`.z64` → N64
3. Preview zeigt pro Ordner das erkannte System mit Confidence-Indikator
4. User kann System per Dropdown overriden falls falsch erkannt
5. "Upload All" startet Batch-Upload über alle Systeme

**Erweiterung `PLATFORM_CONFIG`:**
- Mehr `dirs`-Aliase hinzufügen: `genesis`, `mega-drive`, `super-nintendo`, `super-famicom`, `gameboy`, `gameboy-advance`, etc.
- Neues Feld `extensions: string[]` pro Platform für Extension-basierte Erkennung

**Neue Datei `src/lib/platform-detector.ts`:**
- `detectPlatformFromPath(path: string): { platform: PlatformDef; confidence: 'high' | 'medium' | 'low' } | null`
- Hierarchie: Exakter Ordnername-Match (high) → Fuzzy-Match (medium) → Extension-Match (low)

**UI-Änderungen `src/app/admin/upload/page.tsx`:**
- Phase "select" wird optional — wenn Ordner mit erkennbaren Namen reingezogen werden, direkt zur grouped Preview
- Neue "grouped preview" Phase: Zeigt Gruppen nach erkanntem System, mit Edit-Möglichkeit
- Batch-Upload sendet mehrere `/api/upload/process`-Calls parallel oder sequentiell

**API-Änderung `src/app/api/upload/detect/route.ts`:**
- Akzeptiert optional `platform: "auto"` → erkennt pro File/Ordner das System

### Files to Create/Modify
| File | Action |
|------|--------|
| `src/lib/platforms.ts` | Modify — mehr dir-Aliase + `extensions` Feld |
| `src/lib/platform-detector.ts` | Create — Ordnername + Extension Erkennung |
| `src/app/admin/upload/page.tsx` | Modify — neuer grouped-preview Flow |
| `src/components/upload-dropzone.tsx` | Modify — Ordnernamen an Callback übergeben |
| `src/components/upload-group-preview.tsx` | Create — grouped preview mit System-Override |
| `src/app/api/upload/detect/route.ts` | Modify — auto-detect Support |

---

## Feature 2: Spielestatistiken auf der Home-Seite

### Problem
Die Home-Seite zeigt nur die Spiele-Liste. Es fehlt ein Überblick über die Collection.

### Lösung
Stats-Dashboard oben auf der Home-Seite: Total Games, Games per Platform, Enrichment-Coverage (Cover, AI-Content, Scores), zuletzt hinzugefügt.

---

## Feature 3: Favoriten & Bewertungssystem

### Problem
Keine Möglichkeit, eigene Spiele zu markieren oder zu bewerten.

### Lösung
- Herz-Icon auf Game Cards und Detail-Seite zum Favorisieren
- 5-Sterne-Bewertung auf der Detail-Seite
- Neuer DB-Felder: `isFavorite`, `userRating`
- Filter/Sortierung nach Favoriten und Bewertung

---

## Feature 4: Collection-Vergleich

### Problem
Man weiß nicht, wie vollständig die eigene Sammlung ist.

### Lösung
Pro Platform anzeigen: "Du hast X von Y bekannten Spielen" basierend auf IGDB-Daten. Vorschläge welche Klassiker noch fehlen.

---

## Feature 5: Dark/Light Theme Toggle

### Problem
Nur Dark Mode verfügbar.

### Lösung
Theme-Toggle im Header. CSS-Variablen für beide Themes. Preference in localStorage speichern.

---

## Feature 6: Export/Backup

### Problem
Keine Möglichkeit, die Collection zu sichern oder zu migrieren.

### Lösung
- Export als JSON (alle Spiele + Metadaten)
- Import-Funktion zum Wiederherstellen
- Optional: CSV-Export für Spreadsheets

---

## Completed (this session)

- Smart Upload — Auto-Erkennung der Systeme
- Search mit Cover-Thumbnails + Platform-Badges (Autocomplete-Dropdown)
- AI Content Sprache wählbar (Deutsch/Englisch) in Admin Settings
- Fun Facts & Story Formatierung (prose-vault Typography, amber/indigo sub-headings)
- Home Link im Header
- Spielestatistiken Dashboard (Recharts: Bar Chart, Donut, 5 Stats-Karten)
- Favoriten (Herz-Icon auf Cards + Detail-Seite, Sidebar-Filter, Toggle-API)
- Collection-Vergleich (Platform Stats + IGDB Top Rated Missing)

## Execution Order (remaining)

1. ~~Favoriten & Bewertung~~ Done
2. ~~Collection-Vergleich~~ Done
3. Theme Toggle
4. Export/Backup
