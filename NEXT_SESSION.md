# Ludotek: laufender Auftrag

Ziel bleibt vollständig: alle zwölf Bugs/Befunde A-01 bis A-12 beheben und alle sechs Feature-Ideen aus `review-todo.md` umsetzen. Private lokale/Own-LAN-Open-Source-Nutzung ist der Maßstab, keine SaaS-/Monetarisierungsannahme.

## Quellen und Arbeitsbaum

- Vollständiger Plan: `docs/dev/2026-10-12-local-roadmap.md`.
- Brain-Projektnotiz wurde bei Wiederaufnahme von Archiv nach Aktiv verschoben, ohne historische Updateblöcke zu ändern: `/Users/markus/Documents/Brain/02 Projekte/Aktiv/Ludotek.md`.
- Branch: `codex/ludotek-local-roadmap`; Basis `14c964c`; lokale Task-Commits `90836cc` (A-07/A-08/A-09), `ad1774d` (A-02/A-03/A-04/A-06). Dritter Milestone A-01/A-10/A-11 wird nach unten dokumentiertem PASS gesichert; exakter Hash per `git log`. Kein Push.
- Vorhandene Nutzeränderungen bewahren: `.gitignore`, `__tests__/lib/scanner.test.ts`, gelöschte `docker-compose.yml`; untracked `.claude/`, `.reviewgate/`, `pnpm-workspace.yaml`, `reviewgate.config.ts`. Reviewgate-POLICY_CHANGE betrifft fremde noch nicht genehmigte Providerkonfiguration: nicht ändern oder genehmigen.

## Ergebnisse und nächste Schritte

- Dependencies unverändert vom Lockfile installiert; Ausgangssuite 57/57 grün.
- Erstes Fehlerpaket A-07/A-08/A-09 implementiert, sämtliche Schreibworker abgeschlossen. Kausale RED/GREENs, 110/110 Gesamttests, tsc, lint und isolierter Produktionsbuild (44 Seiten) grün. Unabhängiger Implementierungsreview PASS 0 CRITICAL/WARN. Vollständige Evidenz: `docs/dev/2026-10-12-catalog-review.md`. Noch kein Push.
- A-02/A-03/A-04/A-06 vollständig umgesetzt/verifiziert: alle Worker terminal abgeschlossen, Root führte zusätzliche Legacy-REDs durch und stellte scanSteamDeck auf gemeinsamen gehärteten Helper um. 45 Scanner/SSH-Tests, 113 Upload-Tests sowie 90 neue DAT/Hash-Kern-Tests grün. Gesamtsuite 338/338, tsc/lint/isolierter Build und echter chdman-CUE/GDI-Smoke bestanden. Unabhängiger POST PASS (228/228 fokussierte Tests, eigene echte I/O-Proben); Evidenz `docs/dev/2026-10-12-io-integrity-review.md`. Zweiter lokaler Milestone wird jetzt gesichert.
- Integritäts-Backend nur Grundlage: neue dat.ts/integrity.ts implementiert; sämtliche UI/API/Persistenz/Jobzulassung für Feature4 noch offen. parseDat, hashReadable, classifyDump als vereinbarte Integrationsschnittstellen; keine externen XML-Resolver/Downloads.
- A-01/A-10/A-11 implementiert: Auth/Loopback-/Authority-/Origin-Vertrag, virtuelle erlaubte LOCAL-Wurzeln, Non-root-Konfiguration, atomare SQLite-Leases/monotone Uhr/rolling Providerbudgets und Missing-Cache. Alle Worker terminal. POST R1 bestätigte drei WARN (Batchfortsetzung, fehlende UI-Ereignisse, db-push-Upgrade), R2 nur noch ein aktueller-Batch-Zählerverlust bei fatalem EOF; sämtliche Deltas korrigiert. POST R3 PASS 0 CRITICAL/WARN/INFO, finale Bindung 72 Task-Dateien SHA256 `15aa92d6b90abd778d31b2cf9c4e58fe1a9ff1a92b9d5803c97bb68a4384057a`. Vollständige Reports/Mapping in `docs/dev/2026-10-12-local-admission-review.md`.
- Finaler Paketstand 573/573 Tests (43 Dateien), Typ/Lint/sauberer isolierter Build42 grün. Reale lokale Chrome-Smokes Produktion/Dev: Login/Setup, Rootauswahl und gespeicherter Nachkomme, fremder raw Host bei HTTP/RSC403. Finale Standalone-Ausgabe zeigt synthetischen Budgetstop mit tatsächlichem1/3/Grund, ohne Providercall/Pageerror. Eigene Legacy-db-push-WAL-DB gesichert, schema-geprüft baseliniert und additiv migriert; Daten unverändert, divergenter Bestand abgelehnt. Echte Container/Volumerechte nicht ausgeführt.
- Nach drittem Fixes-Commit pd erneut prüfen. A-05/A-12 und alle sechs vollständigen Nutzerfunktionen bleiben offen. Gesamtziel aktiv.
- Nächster gemeinsamer Datei-/Featureplan `docs/dev/2026-10-12-file-foundation-plan.md`: PRE R1 ein bestätigter Descriptor-WARN, korrigiert; R2 PASS. Vorgesehen sind vollständiges DeviceFile-Manifest vor Deduplizierung, echte Stream-/Protokollfähigkeiten, journalisierte Datei-/Undo-/Recoverypläne samt CUE/GDI/M3U-Abhängigkeiten, alle Schreiber auf files:<deviceId>, Doctor/Integrität/Profile/Saves/LAN durchgängig. Noch keine Produktmutation hierfür. Vorher aktuellen Dependency-Audit reparieren, damit die I/O-Implementierung die gepatchte FTP-Schnittstelle nutzt.
- Frischer `pnpm audit --prod` Snapshot `.review/ludotek-production-advisories-20261012.json`:35 Advisories (2critical/18high/13moderate/2low). Primärquellen geprüft: Next>=15.5.24 oder>=16.3.3 für die zwei Critical (Windows-Hosting-RCE bzw. AVIF-Optimizer; konkrete Anwendbarkeit nicht pauschal behaupten), basic-ftp>=6.2.1 für aktuellen Listing-ReDoS. Weitere transitive Updates nötig; Prisma6 beibehalten. Noch keine Dependencyänderung. Kein Live-Provider-/Geräte-/Nutzer-DB-/Containeraufruf.

## Speicher

- Erster Installer vom bash-guard bei 7,7 GiB frei blockiert, bei erneut gemessenen 9,8 GiB regulär erfolgreich; keine Umgehung.
- Markus genehmigte ausschließlich `uv cache clean --cache-dir /Users/markus/.cache/uv` (1,9 GiB). Session `71912` ist nach 300 Sekunden an aktiver uv-Sperre gescheitert, ohne Löschung. Kein laufender Cleanuphandle mehr; kein `--force` und keine andere Bereinigung genehmigt.
- Whisper-Modelle zur installierten CLI gehören; lsof meldet keinen offenen Zugriff, bereits in RAM geladene Modelle nicht ausgeschlossen. Markus fragte nach Nutzung und erteilte keine Whisper-Löschfreigabe; Modelle bleiben erhalten.
- Weitere Nutzer-Cleanup-Kandidaten unverändert: nur `/Users/markus/Library/Caches/pnpm` (1,4 GiB Registry-Metadaten) vorgelegt, KEINE Freigabe erhalten, nicht löschen. Raum durch Entfernen ausschließlich eigener abgeschlossener Next-Artefakte zurückgewonnen; letzte8,4GiB bei noch vorhandenem finalem eigenen Standalonebundle. Keine laufenden Helper-/Test-/Browserprozesse. Vor Dependencyinstall dieses eigene `.review/ludotek-final-standalone` nach Markerprüfung entfernen; Build-DB `/tmp/ludotek-build-s2Aayf/verify.db` ebenfalls ausschließlich eigene Fixture.
- Keine großen Builds oder Downloads ohne erneutes `df -h`; niemals auf `/Volumes/*` ausweichen.

## Noch offen

A-01/A-02/A-03/A-04/A-06/A-07/A-08/A-09/A-10/A-11 verifiziert; A-05/A-12 und alle sechs vollständigen Nutzerfunktionen offen, davon Feature4-Backendkern vorhanden. Dependency-/Betriebsdoku und gesamte Feature-/Integrationsprüfung weiter erforderlich. Keine Live-Provideraufrufe, realen Geräteoperationen, Nutzerdatenmigrationen, Pushes oder Deployments genehmigt.
