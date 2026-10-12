# Ludotek: Remote-Dateiaktionen und lokaler Releasekandidat abgenommen

Markus beauftragt die Wiederherstellung der blockierten SSH-/SFTP- und FTP-/FTPS-Schreiber, tatsächliche Dockerprüfung und Releasevorbereitung. Er wählt ausdrücklich normales FTP mit Hashprüfung/Quarantäne und dokumentierter Grenze bei Fremdänderungen. Docker Desktop auf diesem Mac ist für den begrenzten isolierten Testlauf freigegeben. Kein Push/Tag/GitHub-Release/Merge/Deploy freigegeben.

## Arbeitsort und Stand

- Aktiver isolierter Worktree: `/Users/markus/.codex/worktrees/1b49/ludotek`, Branch `codex/ludotek-remote-release`, Basis `fa21ea6`. Alle Befehle mit diesem expliziten Arbeitsverzeichnis.
- Ursprünglicher Branch `codex/ludotek-local-roadmap` enthält sechs lokale Code-/Dokumentationspakete bis `fa21ea6`; dortige Nutzeränderungen nicht übernehmen oder bereinigen.
- Bisherige LOCAL-Abnahme in `e605b23`:878 Tests/89 Dateien. Neue finale Abnahme:955/955 Tests in92 Dateien, Typ/Lint, frischer ARM64-Produktionscontainer mit42 erzeugten Seiten und tatsächlicher Chrome auf Desktop/390px.
- Neuer Plan: `docs/dev/2026-10-12-remote-release-plan.md`; unabhängiges PRE R1 PASS0CRITICAL/0WARN, vollständiger Report und Mapping in `docs/dev/2026-10-12-remote-release-review.md`.
- SSH-/SFTP- und FTP-/FTPS-Schreiber samt Journal/Upload/Profil/Save-Restore/mkdir/Undo bestehen echte Protokolltests. Zusätzlich tatsächlicher Linux/OpenSSH-Smoke und Docker-HTTP/Chrome: eigener Legacy-Upgrade, UID1000, Auth/Origin/Rootgrenzen, Scan/Profile/Savebackup, persistenter Neustart und Restore/Apply/Undo. Reale Hardware und AMD64-Laufzeit bleiben ungeprüft.
- PRE R1 PASS. POST R1 WARN zur ignorierten ROM-Zielreserve von Root reproduziert und mit zwei kausalen Wire-Regressionen geschlossen; POST R2 PASS0CRITICAL/0WARN. OpenSSH fehlende-REALPATH-Semantik ebenfalls kausal korrigiert. Alle vollständigen Reports/Mapping im Reviewdokument.
- Lokaler Code-/Releasecommit `599cf93f3473630159a36ac5ae769d301fc5aa2f`, Basis `fa21ea6`. Unveränderter geänderter Sourcekandidat32 Dateien/SHA256`c62ac413c3f80656d785660ec7ecfe69ea8d7e3fa880bdb01d30181936443381` vor/nach Commit bestätigt; Gitleaks regulär bestanden. Kein Push.
- Releaseversion lokal `2.0.0-rc.1`; Release-/Upgradeentwurf `docs/release-2.0.0-rc.1.md`. Keine Veröffentlichung.

## Ausführung und Sicherheit

- Abhängigkeiten sind aus `/Users/markus/Developer/ludotek/node_modules` verlinkt. `pnpm exec` kann deshalb UNSAFE_MODULES_DIR werfen. Direkte Node-Binaries für Vitest/tsc/ESLint nutzen; nicht neu installieren oder den Link löschen.
- Eigene temporäre SQLite/Dateibäume und Loopback SSH/FTP/FTPS. Keine realen Nutzerbibliotheken, echten Geräte, LAN-Scans oder Provideraufrufe.
- LOCAL/SFTP behalten native Besitz-/Flushbedingungen. Normales FTP wird ausdrücklich schwächer behandelt: ACK/Hashprüfung, keine dauerhafte native Identität, kein atomarer No-Replace/fsync. Verlorene öffentliche ACKs oder Storefehler nach Effekt bleiben Recoverykonflikte; gleiche Bytes beweisen keinen Besitz.
- Unbekannter FTP-Platz nur mit Reserve0; keine erfundenen Kapazitäten. Read-only-Kopierquellen brauchen keine Schreibfähigkeiten.
- Docker nur `desktop-linux`; eigene benannte Build-/Testobjekte, begrenzte Ressourcen, explizite eigene Bindordner, `--rm`. `dedicated`/`docker-host` bleiben Produktionssysteme. Vor großen Schritten freien Platz messen. Niemals `/Volumes`.
- Docker Desktop nach begrenztem Test wieder gestoppt. Eigene Container, temporäre Daten, beide Testimages, Buildkitimage und isolierter Builder samt Cache/Statevolume entfernt; ursprüngliche acht Images/Container/Volumes erhalten. Kein eigener Server/Browser/Test mehr aktiv. Eigene Smoke-Werkzeuge `scripts/docker-smoke.mjs` und `scripts/openssh-smoke.ts`, positiver `.dockerignore` und CI-Korrektheitsgate vor Publisher vorhanden. Externe GitHub-CI nicht ausgeführt.
- Originale Nutzeränderungen: `.gitignore`, Scanner-Test, gelöschte docker-compose.yml; untracked `.claude/`, `.reviewgate/`, pnpm-workspace.yaml, reviewgate.config.ts. Nicht stagen. Keine weitere Cachelöschung freigegeben; Whisper erhalten.

## Nächster Schritt

Brain und Daily Note12.10.2026 halten Codecommit und Ergebnis fest. Offen bleibt ausschließlich die gesonderte Freigabe für Push/Tag/GitHub-Release beziehungsweise Imageveröffentlichung. Kein weiteres Implementierungs- oder Testgate aus diesem Auftrag offen; alle Worker und Reviewer abgeschlossen. Weitere Hardware-/Nutzerbibliotheksprüfung wäre ein eigener konkret begrenzter Auftrag.
