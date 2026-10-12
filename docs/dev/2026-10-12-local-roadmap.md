# Ludotek: Fehlerbehebung und lokale Gerätefunktionen

## Auftrag und Maßstab

Alle zwölf Befunde A-01 bis A-12 aus `review-todo.md` beheben und sämtliche sechs dort genannten Feature-Ideen implementieren. Ludotek ist ein privates, lokal beziehungsweise im eigenen LAN betriebenes Open-Source-Werkzeug. Eine kommerzielle SaaS-Plattform ist kein Ziel. Die tatsächlichen Sicherheitsgrenzen sind Browserzugriff, ausdrücklich konfigurierte lokale Verzeichnisse, eigene Geräte, Dateiintegrität und optionale Providerkosten.

Keine Veröffentlichung, kein Push, kein Deployment, keine Live-Provideraufrufe, keine Änderungen an Nutzerdatenbanken oder realen Gerätebeständen. Tests verwenden temporäre Verzeichnisse, isolierte SQLite-Dateien und kontrollierte Netzwerk-Doubles. Prisma bleibt bei 6.x. Bestehende Nutzeränderungen werden erhalten; insbesondere `.gitignore`, `__tests__/lib/scanner.test.ts`, die gelöschte `docker-compose.yml` und untracked Workflow-Konfigurationen gehören nicht diesem Auftrag.

## Umsetzung und Abnahmekriterien

### 1. Katalog, Bildcache und Metadaten (A-07, A-08, A-09)

Dateien: `src/lib/image-cache.ts`, `src/lib/api-cache.ts`, `src/lib/igdb.ts`, `src/app/api/games/route.ts`, `src/app/api/games/[id]/enrich/route.ts`, `src/components/refresh-metadata-button.tsx`.

- Bilddateinamen enthalten die Quell-URL-Identität, pro Spiel und Bildart. Wechsel A → B → A sowie vertauschte Screenshot-Reihenfolge liefern die richtigen Bytes. Alte nicht eindeutig zuordenbare Cachepfade werden neu befüllt. Spielbezogene Löschung entfernt alte und neue Formate.
- Katalog-Deduplizierung findet vor Pagination statt, mit stabiler Sortierung. Gleiche IGDB-ID auf unterschiedlichen Plattformen bleibt als eigene Plattformversion erhalten. Gleiche Plattform/IGDB-ID oder Titel/Plattform werden zusammengeführt und alle Geräte übernommen. Total und Seiten verwenden dieselbe Gruppierung. Geräteseiten behalten ihre bestehenden Datensätze.
- Explizites „Refresh Metadata“ liest frische IGDB-Daten und ersetzt den persistenten Cache. Andere Enrichment-Aufrufe behalten ihre TTL. Refresh gilt auch bei Auswahl eines Suchtreffers. Fehler melden keinen Erfolg. Gecachte Datumswerte werden korrekt als Dates rekonstruiert.
- RED/GREEN: A/B/A mit zwei verschiedenen Buffern; zwei Duplikate plus zwei eindeutige Spiele bei Seitengröße zwei ergeben zwei volle, überschneidungsfreie Seiten; frische Providerantwort statt altem Cache. Keine echten Netzwerkaufrufe.

### 2. Verlässliche Scanner-, Upload- und Sync-Verträge (A-02 bis A-06)

Dateien: `src/lib/connection.ts`, `src/lib/scanner.ts`, `src/lib/scan-runner.ts`, `src/lib/uploader.ts`, `src/app/api/upload/process/route.ts`, `src/app/api/sync/queue/route.ts`, `src/app/api/sync/apply/route.ts`.

- Nicht konfigurierte, unlesbare, abgeschnittene oder teilweise fehlgeschlagene Scanbereiche dürfen keine Bestandsverknüpfungen entfernen. Vollständiger leerer Scan darf entfernen. Fehlerhafte SSH-Exit-Codes sind Fehler und dürfen keine erfolgreiche Mutation vortäuschen.
- Ein vollständiges Geräte-Dateimanifest bewahrt den tatsächlichen Scanroot, Plattformalias und sämtliche Disc-/Revisionsdateien. Der Katalog darf weiterhin Spiele gruppieren; Integritätsprüfung und Dateipläne arbeiten auf eindeutigem `deviceId + fullPath`. Aktuell gehen diese Informationen in `ScannedGame`/`GameDevice` verloren. Vorhandene Verknüpfungen ohne belegten Dateipfad werden als ungeklärt behandelt und vor Mutation neu inventarisiert.
- Plattform-IDs werden vor Arbeit/DB-Schreiben gegen die bestehende Plattformliste geprüft. Transferziele stammen aus dem Zielgerät und seinen konfigurierten Wurzeln; keine vom Client frei zusammengebauten Ziele.
- BIN wird nur übersprungen, wenn eine tatsächlich verarbeitete CUE genau diese Datei referenziert. Einzelne BINs werden übertragen; kein erfolgreicher Datenbankeintrag nach null übertragenen Dateien.
- Queue und Apply prüfen Spiel, Geräteverknüpfung und tatsächlichen Dateipfad gemeinsam. Erneute Prüfung bei Apply verhindert veraltete Queues. Ein fehlerhaftes Remote-Kommando verändert keine Spielverknüpfung.
- RED/GREEN mit leeren Scanpfaden, abgeschnittenem Listing, fehlendem Plattformordner, Exit-Code 1, Traversal-Plattform, alleiniger BIN und Spiel-A-Pfad/Spiel-B-ID. Mutationschecks nur für Pruning- und Besitzgrenzen.

### 3. Lokaler Zugriff und begrenzte Jobs (A-01, A-10, A-11)

Dateien: `src/lib/auth.ts`, `src/app/api/auth/route.ts`, Provider-Routen unter `src/app/api/enrich/`, `src/app/api/platforms/[id]/missing/route.ts`, lokale Verbindungen, Dockerfile/README und neue zentrale Job-/Zugriffsmodule.

- Local-first-Setup bleibt nutzbar. Fehlender Token in Produktion wird vor jeder geschützten Nebenwirkung mit 503 abgelehnt; Development ohne Token startet ausschließlich auf Loopback und erhält Same-Origin-Prüfung. LAN-/Docker-Betrieb verlangt Admin-Token. Host/Origin/Forwarded-Header begründen allein keine lokale Peer-Identität. Ein Auth-Gate muss auch den Setup-Wizard erreichen; Cookie-Secure richtet sich nach explizitem TLS-Betriebsvertrag, nicht bloß NODE_ENV.
- Lokale Dateizugriffe sind auf konfigurierte Wurzeln begrenzt, einschließlich Symlink- und Root-Schutz. Docker läuft ohne root. Keine globale Cloudflare-Pflicht für Nutzerinstallationen.
- Jobzulassung erfolgt atomar in der lokalen SQLite-Datenbank vor Nebenwirkungen, geräte-/objektbezogen und global für Provider. Persistente Budgets/Leases sind über Neustarts und mehrere Prozesse belastbar. Ausfall lehnt teure Arbeit vor dem ersten Call ab; Ablauf, Heartbeat und Recovery verhindern parallele Zombie-Jobs.
- Enrichment-Lock umfasst `/api/enrich`, `/api/enrich/ai`, `/api/enrich/refresh`, `/api/enrich/metacritic` und `/api/games/[id]/enrich`, bereits vor Spielauswahl. Eigene Lease-Tabelle, keine ApiCache-Zeilen: Cache-Leeren darf keine Sperre löschen. Nur der Lease-Eigentümer darf erneuern/freigeben.
- Provider-GETs verlangen Autorisierung und verwenden Cache; keine unbeschränkten Credential-verbrauchenden anonymen Requests. Eingabe-, Laufzeit-, Ergebnis- und Providerbudgetgrenzen sind dokumentiert.
- Security-Inventar erfasst alle API-Eintrittspunkte; keine route-lokale Forwarded-IP-Auswertung. Cloudflare-Entscheidung: keine Edge-Regel für rein lokale Installationen; Nutzer, die öffentlich veröffentlichen, benötigen einen gesonderten Betriebsvertrag.
- Tests: kein Token im Netzwerkmodus, fremde Origin, manipulierte Header, Pfad-/Symlink-Ausbruch, zwei parallele Leasebewerber mit genau einem Gewinner, DB-Ausfall ohne Call, exakte Limits mit Fake Clock.

### 4. Datei-Pläne und Operationsjournal (A-12, Feature 5)

Neue Verantwortung: `src/lib/file-operations/` und zugehörige API; additive Prisma-Migrationen; bestehende SyncPanel-/Dateibrowser-Aktionen anbinden.

- Rename, Move, Delete und Copy werden als konkrete unveränderliche Pläne mit Quelle, Ziel, Geräte-ID, Dateityp, Größe/Hash und Vorbedingungen simuliert. Die Vorschau zeigt Auswirkungen und benötigten Platz vor ausdrücklicher Ausführung.
- Planer lehnt Pfadüberschreitungen, Selbstverschiebung, Kollisionen und unvollständige Bestände ab. Copy schreibt temporär, verifiziert und benennt um. Delete verschiebt in eine gerätebezogene Quarantäne; Undo stellt wieder her. Journal speichert begonnen/angewendet/kompensiert/fehlgeschlagen und Recovery nach Neustart.
- Ein Fehler kompensiert bereits ausgeführte Schritte rückwärts. Fehlgeschlagene Kompensation bleibt sichtbar und wiederaufnehmbar; kein falsches Atomizitätsversprechen für mehrere Remote-Dateisysteme. DB-Verknüpfungen werden erst nach erfolgreicher Dateioperation verändert.
- Aktuelle Queue-Claims ohne runId und Recovery nach `createdAt` werden durch Besitzer-/Leasebindung ersetzt. Fehlende Quelle und beliebiges vorhandenes Ziel gelten nicht als belegter Rename-Erfolg. Copy/Move ersetzen das vorhandene 2-GB-RAM-Puffern durch begrenzte Streams mit echter Cancellation.
- Tests mit realen temporären Dateien: Dry-run schreibt null Dateien; Fehler im zweiten Schritt restauriert den ersten; Quelle nach Planung verändert; Kollision; Undo; Prozessabbruch/Recovery; gesperrte Paralleloperation; Quarantänepfade und Budgetgrenzen.

### 5. Handheld Sync Doctor (Feature 1)

- Read-only-Vergleich zwischen Katalog und vollständigem Gerätebestand zeigt fehlende Dateien, unbekannte Dateien, andere Namen, doppelte Zuordnungen und unvollständige Scans.
- Reparaturvorschläge führen ausschließlich über explizit geprüfte Datei-/DB-Pläne. Keine automatische Löschung. Unvollständiger Scan liefert Diagnose und keine destruktive Reparatur.
- UI auf der Geräteseite beziehungsweise Geräte-Werkzeugseite mit Diagnose, Vorschau, Auswahl und Ergebnis. Tests beweisen read-only-Analyse und korrekte Zuordnung bei mehreren Geräten.

### 6. Geräteprofile und Zweiweg-Sync (Feature 2)

- Profile für Steam Deck, Retroid/Android, Miyoo/Onion und frei konfigurierte Geräte mit Plattformpfaden, unterstützten Formaten, Save-Pfaden und Speicherkapazität. Vorlagen sind editierbar; keine fest eingebauten Deck-Zielpfade in Transfers.
- Ein explizit ausgewählter Masterbestand wird mit einem Zielgerät verglichen; Push, Pull und Zweiweg-Sync planen fehlende oder geänderte Dateien. Konflikte werden ausgewiesen und verlangen eine Auswahl. Nichts synchronisiert ohne Nutzeraktion.
- Format-/Platzregeln filtern unzulässige Kopien und zeigen übersprungene Dateien mit Grund. Durchgängige UI zum Profilieren, Vergleichen, Planen, Ausführen und Ergebnislesen.
- Tests: beide Richtungen, Konflikt, gleichnamige Plattformdateien, Formatfilter, zu wenig Platz, Änderung nach Vorschau und Wiederholung ohne doppelte Arbeit.

### 7. Versionierte Savegame-/Savestate-Backups (Feature 3)

- Nutzer konfigurieren Save-Wurzeln je Geräteprofil. Backups speichern Inhalts-Hashes, Manifest, Version und Geräte-/Spielzuordnung in appverwaltetem Backupverzeichnis. Dateien werden gestreamt, Größen/Anzahl begrenzt und unveränderlich abgelegt.
- Backupversionen bleiben auch nach Entfernen eines Katalogspiels oder Geräteprofils erhalten; kein Cascade-Delete unwiederbringlicher Sicherungen.
- Wiederherstellung und geräteübergreifende Save-Synchronisierung verwenden denselben Plan-/Journalpfad. Divergente Änderungen seit dem letzten gemeinsamen Stand sind Konflikte; keine automatische Entscheidung per Zeitstempel. Vor Überschreiben aktuellen Zustand sichern.
- UI: Backup erstellen, Versionen prüfen, Restore-Vorschau, Konfliktentscheidung und Ergebnis. Tests: zwei Versionen, unveränderte Daten dedupliziert, Restore, unterbrochenes Backup, divergente Geräte, Symlink-Ausbruch und Speichermangel.

### 8. Hash-/DAT-Integritätsprüfung (Feature 4)

- Streaming-Hashes (SHA-256 für interne Identität; CRC32/MD5/SHA-1 für nutzerbereitgestellte DAT-Prüfsummen) ohne vollständige ROMs im RAM. DAT-Import unterstützt gängige Logiqx-XML- und clrmamepro-Formate, strikt begrenzte Größe/Einträge, keine externen Entitäten oder Netzwerkzugriffe.
- Ergebnis zeigt verifiziert, unbekannt, beschädigt/abweichend, Revisionen und Duplikatgruppen. DAT-Dateien und Prüfergebnisse bleiben lokal. Deduplizieren ist ein Vorschlag und führt erst über einen bestätigten Plan zu Änderungen.
- Ein unbekannter Hash ist kein Nachweis einer beschädigten ROM. „Abweichend“ erfordert eine konkrete zugeordnete erwartete Datei-/Revisionsidentität und prüft Größe sowie Hash.
- UI für DAT-Import, Geräte-/Plattformauswahl, Fortschritt und Ergebnisse. Tests mit bekannten Bytefolgen, falscher Größe/Hash, Duplikaten, mehreren Revisionen, XML-Entitäten, kaputtem DAT und abgebrochenem Hashlauf.

### 9. LAN-Geräteerkennung (Feature 6)

- Explizit gestartete, zeitlich und parallel begrenzte Erkennung auf ausgewählten privaten lokalen Subnetzen; nur unterstützte SSH/FTP-Dienste und bekannte Profilhinweise. Kein Internet-/beliebiger Hostscan, kein Anmelden mit Standardpasswörtern, kein automatisches Hinzufügen oder Dateischreiben.
- Ergebnisse werden mit Profilvorschlägen im bestehenden Geräteformular übernommen. Credentials gibt der Nutzer selbst ein; Verbindungstest ist eine getrennte bewusste Aktion.
- Tests mit simulierten Netzwerkschnittstellen/Diensten: Loopback/öffentliches Ziel ablehnen, IPv4/IPv6-Zielgrenzen, Timeout, Abbruch, Parallelitätslimit und keine Credential- oder DB-Nebenwirkungen.

## Ausführungsreihenfolge und Gates

- [x] Baseline: vorhandene Abhängigkeiten anhand Lockfile installieren, vorhandene Tests prüfen; vor großen Artefakten freien Speicher kontrollieren.
- [x] Schritt 1 mit fokussierten kausalen RED/GREEN-Tests implementieren; Verifikation/Review: `2026-10-12-catalog-review.md`.
- [ ] Schritt 2 nach Ursachenanalyse, fokussierten Tests und Plan-Review implementieren.
- [x] Schritt 3 mit unabhängiger Planprüfung, Security-Inventar, Sicherheits-RED/GREEN und POST R3 implementieren; Evidenz `2026-10-12-local-admission-review.md`.
- [ ] Schritt 4 als gemeinsame Grundlage für die Features mit isoliertem SQLite/Filesystem-Test und unabhängiger Prüfung implementieren.
- [ ] Schritte 5–9 jeweils backendseitig und in der bestehenden Oberfläche vollständig umsetzen; keine bloßen API-Stubs.
- [ ] Veraltete Produktionsabhängigkeiten anhand aktueller offizieller Advisories beheben; README/Quickstart, Backup/Recovery, SECURITY.md und proportionale Offline-CI aktualisieren. Bestehende gelöschte Docker-Datei nicht ungefragt wiederherstellen.
- [ ] Abschluss: unveränderten finalen Baum mit `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` seriell prüfen; UI am lokalen Testbestand prüfen; gesamte Anforderungsliste unabhängig prüfen.
- [ ] Auditstatus nur mit aktuellem konkretem Nachweis aktualisieren. Brain und Handoff bei materiellen Meilensteinen aktualisieren. Lokale zusammenhängende Commits mit exakter Pfadauswahl; kein Push.

Jeder Teilabschluss nennt verifizierte Ergebnisse und alle noch offenen Teile. Das Gesamtziel bleibt aktiv, bis sämtliche Befunde und Features nachweislich umgesetzt sind.

## Review-Nachweise

- Planreview Schritt 1: ausführender unabhängiger Reviewer, PASS, 0 CRITICAL/0 WARN. Reproduziert: A/B/A lieferte B-Bytes, Pagination sechs Rohdatensätze/vier Gruppen lieferte 1/1/2 statt 2/2, Cache-Date war String, force wurde nicht weitergereicht, kein IGDB-Treffer meldete trotzdem success. Nur In-Memory-Doubles, keine echten DB-/Netzwerkaufrufe.
- INFO berücksichtigt: Screenshot-/Artwork-Slots dürfen bei Teildownloads nicht komprimiert werden; Pagination-Fixture sind zwei Duplikatpaare und zwei Einzelspiele; AI-only-Verhalten beim gemeinsamen Enrichment-Endpunkt erhalten.
- Sicherheitskritische Schritte erhalten vor Mutation einen eigenen Delta-Plan mit konkreten Grenzen und Tests.

## Aktueller Arbeitsstand

- Vor Umsetzung bestätigte Codeuntersuchung alle zwölf Befunde. A-01/A-02/A-03/A-04/A-06/A-07/A-08/A-09/A-10/A-11 inzwischen verifiziert; A-05/A-12 sowie alle sechs vollständigen Nutzerfunktionen bleiben offen.
- `pnpm install --frozen-lockfile` wurde zunächst bei 7,7 GiB frei vom bash-guard abgewiesen. Nach erneuter Messung waren ohne Task-Bereinigung 9,8 GiB frei; unveränderte Installation erfolgreich, Baseline `pnpm test`: 57/57 grün. Keine Hook-Umgehung oder Verlagerung auf andere Volumes.
- Markus hat ausschließlich `uv cache clean --cache-dir /Users/markus/.cache/uv` (gemessen 1,9 GiB) genehmigt. Der Prozess ist nach 300 Sekunden an aktiver uv-Sperre gescheitert, ohne Löschung; kein `--force`, keine anderen Cachelöschungen. Whisper-Modelle gehören zur installierten Whisper-CLI; kein offener Zugriff in lsof, keine Löschfreigabe.
- A-07/A-08/A-09 vollständig implementiert: 110/110 Gesamttests, Typprüfung, Lint, isolierter Produktionsbuild (44 Seiten) und unabhängiger Implementierungsreview PASS. Ursächliche RED/GREENs und Reviewer-Evidenz in `2026-10-12-catalog-review.md`. Eigene Build-/Testdatenbankartefakte entfernt, Nutzerdaten unverändert.
- Worker-Schreibaufträge des ersten Pakets abgeschlossen. Lokaler Milestone `90836cc` auf `codex/ludotek-local-roadmap`, Gitleaks-Hook bestanden, kein Push. pd bestätigt 3 erledigte/9 offene Befunde. Delta-Plan A-03/A-06 PRE-Review PASS mit INFO; Worker `/root/scanner_ssh_fix` bearbeitet die drei Produktdateien und neue Tests, Nutzer-Scanner-Test bleibt erhalten.
- A-02/A-03/A-04/A-06 umgesetzt und verifiziert, dazu lokaler Feature-4-Backendkern. 338/338 Gesamttests, Typ/Lint/isolierter Build, eigener echter CHD-Smoke und unabhängiger POST PASS (228 fokussierte Tests). Evidenz `2026-10-12-io-integrity-review.md`. Alle sechs vollständigen Nutzerfunktionen bleiben offen; Integritäts-UI/API/Persistenz/Zulassung folgen.
- A-01/A-10/A-11-Delta implementiert: 573/573 Tests, Typ/Lint/isolierter Build42, tatsächlicher Produktions-/Dev-/Standalone-Smoke grün; POST R3 PASS mit geschlossenen bestätigten R1/R2-Befunden. Vollständige Evidenz `2026-10-12-local-admission-review.md`. pnpm-Metadatencache-Cleanup nur vorgelegt, weiterhin keine Freigabe.
- Gemeinsamer Datei-/Featureplan `2026-10-12-file-foundation-plan.md` PRE R2 PASS. Descriptor-Abhängigkeiten, gemeinsame files-Leases und interne immutable Backups explizit. Noch keine Manifest-/Journal-/Featuremutation. Aktueller Dependency-Audit35 Advisories; gepatchte Versionen vor neuem I/O-Paket übernehmen, Prisma6 beibehalten. Gesamtziel aktiv, kein Push.
