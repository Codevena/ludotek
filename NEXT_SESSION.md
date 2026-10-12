# Ludotek: laufender Auftrag

Ziel bleibt vollständig: alle zwölf Bugs/Befunde A-01 bis A-12 beheben und alle sechs Feature-Ideen aus `review-todo.md` umsetzen. Private lokale/Own-LAN-Open-Source-Nutzung ist der Maßstab, keine SaaS-/Monetarisierungsannahme.

## Quellen und Arbeitsbaum

- Vollständiger Plan: `docs/dev/2026-10-12-local-roadmap.md`.
- Brain-Projektnotiz wurde bei Wiederaufnahme von Archiv nach Aktiv verschoben, ohne historische Updateblöcke zu ändern: `/Users/markus/Documents/Brain/02 Projekte/Aktiv/Ludotek.md`.
- Branch: `codex/ludotek-local-roadmap`; Basis `14c964c`; erster lokaler Task-Commit `90836cc` (A-07/A-08/A-09), kein Push.
- Vorhandene Nutzeränderungen bewahren: `.gitignore`, `__tests__/lib/scanner.test.ts`, gelöschte `docker-compose.yml`; untracked `.claude/`, `.reviewgate/`, `pnpm-workspace.yaml`, `reviewgate.config.ts`. Reviewgate-POLICY_CHANGE betrifft fremde noch nicht genehmigte Providerkonfiguration: nicht ändern oder genehmigen.

## Ergebnisse und nächste Schritte

- Dependencies unverändert vom Lockfile installiert; Ausgangssuite 57/57 grün.
- Erstes Fehlerpaket A-07/A-08/A-09 implementiert, sämtliche Schreibworker abgeschlossen. Kausale RED/GREENs, 110/110 Gesamttests, tsc, lint und isolierter Produktionsbuild (44 Seiten) grün. Unabhängiger Implementierungsreview PASS 0 CRITICAL/WARN. Vollständige Evidenz: `docs/dev/2026-10-12-catalog-review.md`. Noch kein Push.
- A-02/A-03/A-04/A-06 vollständig umgesetzt/verifiziert: alle Worker terminal abgeschlossen, Root führte zusätzliche Legacy-REDs durch und stellte scanSteamDeck auf gemeinsamen gehärteten Helper um. 45 Scanner/SSH-Tests, 113 Upload-Tests sowie 90 neue DAT/Hash-Kern-Tests grün. Gesamtsuite 338/338, tsc/lint/isolierter Build und echter chdman-CUE/GDI-Smoke bestanden. Unabhängiger POST PASS (228/228 fokussierte Tests, eigene echte I/O-Proben); Evidenz `docs/dev/2026-10-12-io-integrity-review.md`. Zweiter lokaler Milestone wird jetzt gesichert.
- Integritäts-Backend nur Grundlage: neue dat.ts/integrity.ts implementiert; sämtliche UI/API/Persistenz/Jobzulassung für Feature4 noch offen. parseDat, hashReadable, classifyDump als vereinbarte Integrationsschnittstellen; keine externen XML-Resolver/Downloads.
- Nächster Teilplan `docs/dev/2026-10-12-local-admission-plan.md` (A-01/A-10/A-11), API-Inventar 62 Handler/53 Dateien. PRE R1 FAIL vier echte Vertragslücken, korrigiert; R2 Delta PASS 0 CRITICAL/WARN. FilePanel als zweiter virtueller Root-Browse-Consumer explizit enthalten. Noch keine Auth-/Schema-/Providerbudgetmutation. Nächster Schritt kausale Root-/Auth-REDs und atomare SQLite-Admission mit echten isolierten Clients.
- Nach zweitem lokalen Commit pd per Fixes-Trailer erneut prüfen; A-01/A-05/A-10/A-11/A-12 und alle sechs vollständigen Nutzerfunktionen bleiben offen. Gesamtziel bleibt aktiv.

## Speicher

- Erster Installer vom bash-guard bei 7,7 GiB frei blockiert, bei erneut gemessenen 9,8 GiB regulär erfolgreich; keine Umgehung.
- Markus genehmigte ausschließlich `uv cache clean --cache-dir /Users/markus/.cache/uv` (1,9 GiB). Session `71912` ist nach 300 Sekunden an aktiver uv-Sperre gescheitert, ohne Löschung. Kein laufender Cleanuphandle mehr; kein `--force` und keine andere Bereinigung genehmigt.
- Whisper-Modelle zur installierten CLI gehören; lsof meldet keinen offenen Zugriff, bereits in RAM geladene Modelle nicht ausgeschlossen. Markus fragte nach Nutzung und erteilte keine Whisper-Löschfreigabe; Modelle bleiben erhalten.
- Bei Scanner-GREEN zunächst 7,5 GiB, später ohne zusätzliche Taskbereinigung wieder 9,5 GiB frei; Tests regulär erfolgreich. Zweiter eigener Build anschließend entfernt, letzter Stand 8,9 GiB. Neues Cleanup zur Freigabe vorgelegt: nur `/Users/markus/Library/Caches/pnpm` (1,4 GiB Registry-Metadaten). KEINE Freigabe erhalten, nicht löschen; aktuell kein Blocker, keine laufenden Helper-/Testprozesse.
- Keine großen Builds oder Downloads ohne erneutes `df -h`; niemals auf `/Volumes/*` ausweichen.

## Noch offen

A-02/A-03/A-04/A-06/A-07/A-08/A-09 verifiziert; A-01/A-05/A-10/A-11/A-12 offen. Alle sechs vollständigen Nutzerfunktionen offen, davon Feature4-Backendkern vorhanden. Dependency-/Betriebsdoku und gesamte UI-/Security-/Integrationsprüfung weiter erforderlich. Keine Live-Provideraufrufe, realen Geräteoperationen, Nutzerdatenmigrationen, Pushes oder Deployments genehmigt.
