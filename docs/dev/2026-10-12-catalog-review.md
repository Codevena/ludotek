# Katalogfehler A-07, A-08 und A-09: Verifikation

## Änderung

- A-07: URL-bezogene Bilddateien pro Spiel/Bildart, sichere Legacy-Neubefüllung, positionsgetreue Teilfehler und vollständige spielbezogene Cachelöschung.
- A-08: plattformgebundene, transitive Titel-/IGDB-Gruppen vor Pagination; vollständige Gerätevereinigung, stabile Sortierung und Readsnapshot. Nur leichte Identitäten für den Gesamtkatalog, vollständige Metadaten für die Seitengruppen.
- A-09: expliziter Refresh umgeht und ersetzt den Cache; TTL unveränderter Aufrufer bleibt erhalten. IGDB-Daten hydratisieren Dates. UI fordert force an; Fehler/fehlende Konfiguration melden keinen Erfolg. AI-only bleibt ohne IGDB nutzbar.

## Kausales RED und GREEN

- Bildcache: 10 kausale Fehler vor Fix, danach 18/18 Cache-/URL-Tests grün; reale temporäre Dateien und In-Memory-Prisma/fetch-Doubles.
- Pagination: fünf kausale Fehler plus ein Bestandsfall vor Fix, danach 6/6 API-Tests grün.
- Metadaten: 10 Cache-/IGDB-Fehler und 21 Route-/UI-Fehler vor Fix, danach 37/37 fokussierte Tests grün.
- Root-Endstand: `pnpm test` 110/110 grün; `pnpm exec tsc --noEmit` Exit 0; `pnpm lint` ohne Warnungen/Fehler; `git diff --check` sauber.
- `pnpm build` erfolgreich, 44 statische Seiten. Alle 16 vorhandenen Migrationen ausschließlich auf eigener temporärer SQLite-DB ausgeführt; Build nutzt leere Task-DB und synthetischen Testschlüssel, keine realen Credentials/Spielbestände. Eigene Build-/Testdatenbankartefakte anschließend entfernt.
- Bekannte Toolhinweise: pnpm 11 ignoriert das alte package.json-onlyBuiltDependencies-Feld (bestehende Nutzer-Workspacekonfiguration greift); Prisma-6-Konfiguration deprecated für spätere Major; Browserslist-Daten veraltet. Keine Tool-/Dependencyupgrades in diesem Paket.

## Unabhängiger Planreview

PASS, 0 CRITICAL/0 WARN. Eigene Reproduktionen des Reviewers: A/B/A endet mit B-Bytes; sechs Rohdatensätze/vier Gruppen liefern 1/1/2 Spiele statt 2/2; Cache-Date bleibt String; force wird nicht durchgereicht; kein IGDB-Treffer meldet dennoch Erfolg. Alle Vorgänge speicherintern, keine echten Provider/DB.

INFO berücksichtigt: lokale Bildslots bei Teildownloads erhalten, sechs Rohdatensätze/vier Gruppen präzise benennen, Metadatenfehler und AI-only-Verhalten getrennt behandeln.

## Unabhängiger Implementierungsreview R1

### FINDINGS

Keine CRITICAL- oder WARN-Befunde im Umfang A-07/A-08/A-09. Tests und Implementierung erfüllen die geprüften Verträge.

### EVIDENCE

- Vollständigen Payload einschließlich sechs neuer Dateien gelesen. SHA-256 unverändert: `16f0791d7eaa1d3d5103e610dd86628c6992e8efdf8ee462ae6bb2fc482dbafc`.
- `pnpm exec vitest run __tests__/lib/image-cache.test.ts __tests__/lib/games-pagination.test.ts __tests__/lib/api-cache.test.ts __tests__/lib/igdb.test.ts __tests__/lib/metadata-refresh.test.ts __tests__/lib/image-url.test.ts`: 61/61 Tests bestanden, Exit 0. Tatsächliche A/B/A-Bildbytes, Reihenfolgewechsel, Fehlerslots und Legacy-Pfade werden geprüft.
- Eigene Ausführung der echten GET-Route mit In-Memory-Prisma-Double: stabile Titel-/Score-Sortierung einschließlich ID-Tiebreak, Sort-Fallback, Plattformtrennung, transitive Aliasbrücken, Gerätevereinigung und Gruppierung vor Pagination bestanden. Alle Datenbankzugriffe verwenden den Transaktionsclient; keine tatsächliche SQLite-Isolationsprüfung durchgeführt.
- Eigene integrierte Ausführung der echten POST-Route mit echter IGDB-/API-Cache-Implementierung und kontrollierten Doubles: frischer Cacheersatz, anschließende Wiederverwendung, Date-Übergabe, AI-only-Isolation sowie HTTP-Providerfehler/fehlende Treffer ohne Spielmutation bestanden.
- UI sendet bei Suchtrefferauswahl force=true. Unveränderte Aufrufer behalten ihre TTL.
- Keine Quelldateien verändert, keine echten Datenbanken oder Netzwerk-/Provideraufrufe verwendet. Vollsuite, Typprüfung, Lint und Build nicht erneut ausgeführt.

### VERDICT

PASS — 0 CRITICAL, 0 WARN.

Findings-Mapping R1: keine Befunde. Tree-Bindung wurde durch Neubauen des Payloads aus den aktuellen 14 Task-Dateien geprüft, nicht lediglich durch Hashen der gespeicherten Payloaddatei. Fremde Nutzeränderungen, Workflowkonfigurationen und generierte Artefakte sind explizit ausgeschlossen.

## Grenzen

Dies ist der Abschluss dieses Fehlerpakets, nicht des Gesamtauftrags. A-01 bis A-06 sowie A-10 bis A-12 und alle sechs Geräte-/Dateifunktionen sind noch offen. Keine Veröffentlichung, kein Deployment, keine realen Geräteoperationen oder Datenmigrationen.
