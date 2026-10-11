# Ludotek: laufender Auftrag

Ziel bleibt vollständig: alle zwölf Bugs/Befunde A-01 bis A-12 beheben und alle sechs Feature-Ideen aus `review-todo.md` umsetzen. Private lokale/Own-LAN-Open-Source-Nutzung ist der Maßstab, keine SaaS-/Monetarisierungsannahme.

## Quellen und Arbeitsbaum

- Vollständiger Plan: `docs/dev/2026-10-12-local-roadmap.md`.
- Brain-Projektnotiz wurde bei Wiederaufnahme von Archiv nach Aktiv verschoben, ohne historische Updateblöcke zu ändern: `/Users/markus/Documents/Brain/02 Projekte/Aktiv/Ludotek.md`.
- Branch: `codex/ludotek-local-roadmap`; Basis `14c964c`; noch keine Task-Commits oder Pushes.
- Vorhandene Nutzeränderungen bewahren: `.gitignore`, `__tests__/lib/scanner.test.ts`, gelöschte `docker-compose.yml`; untracked `.claude/`, `.reviewgate/`, `pnpm-workspace.yaml`, `reviewgate.config.ts`. Reviewgate-POLICY_CHANGE betrifft fremde noch nicht genehmigte Providerkonfiguration: nicht ändern oder genehmigen.

## Ergebnisse und nächste Schritte

- Dependencies unverändert vom Lockfile installiert; Ausgangssuite 57/57 grün.
- Erstes Fehlerpaket A-07/A-08/A-09 implementiert, sämtliche Schreibworker abgeschlossen. Kausale RED/GREENs, 110/110 Gesamttests, tsc, lint und isolierter Produktionsbuild (44 Seiten) grün. Unabhängiger Implementierungsreview PASS 0 CRITICAL/WARN. Vollständige Evidenz: `docs/dev/2026-10-12-catalog-review.md`. Noch kein Push.
- Aktueller nächster Teilplan: `docs/dev/2026-10-12-scanner-ssh-plan.md` für A-03/A-06, vor Mutation unabhängigen PRE-Review abschließen; `/root/local_security` prüft ihn. Live-Agentzustände beim Wiederbeginn revalidieren.
- Erstes Paket exakt lokal sichern, dann Scanner/Upload/SSH/Sync und alle übrigen geplanten Funktionen ausführen. Gesamtziel nicht nach erstem Paket als erledigt markieren.

## Speicher

- Erster Installer vom bash-guard bei 7,7 GiB frei blockiert, bei erneut gemessenen 9,8 GiB regulär erfolgreich; keine Umgehung.
- Markus genehmigte ausschließlich `uv cache clean --cache-dir /Users/markus/.cache/uv` (1,9 GiB). Session `71912` ist nach 300 Sekunden an aktiver uv-Sperre gescheitert, ohne Löschung. Kein laufender Cleanuphandle mehr; kein `--force` und keine andere Bereinigung genehmigt.
- Whisper-Modelle zur installierten CLI gehören; lsof meldet keinen offenen Zugriff, bereits in RAM geladene Modelle nicht ausgeschlossen. Markus fragte nach Nutzung und erteilte keine Whisper-Löschfreigabe; Modelle bleiben erhalten.
- Keine großen Builds oder Downloads ohne erneutes `df -h`; niemals auf `/Volumes/*` ausweichen.

## Noch offen

A-07/A-08/A-09 verifiziert; A-01 bis A-06 und A-10 bis A-12 bleiben offen. Alle sechs neuen Funktionen, Dependency-/Betriebsdoku und gesamte UI-/Security-/Integrationsprüfung noch umzusetzen. Keine Live-Provideraufrufe, realen Geräteoperationen, Nutzerdatenmigrationen, Pushes oder Deployments genehmigt.
