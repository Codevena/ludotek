# Ludotek 2.0.0-rc.2 — lokaler Releasekandidat

Ludotek bleibt eine private, lokal oder im eigenen LAN genutzte Open-Source-Spielebibliothek unter MIT. Dieser Kandidat ist lokal vorbereitet; Tag, GitHub-Release und Containerveröffentlichung sind noch nicht erfolgt.

## Korrekturen gegenüber rc.1

Die erste externe Linux-CI fand SQLite-Pool-Blockaden bei wenigen CPU-Threads und Verzögerungen im SSH-Testserver. rc.2 begrenzt SQLite-Clients auf eine Verbindung und verwendet den App-Client auch in Produktion pro Prozess wieder. DB-Budgets, Besitzer-/Expiry-Prüfung und Transaktionen bleiben unverändert maßgeblich. Das SSH-Wire-Fixture verwendet TCP_NODELAY; seine Assertions und Produktfristen bleiben bestehen. Nur der funktionale Test mit16 getrennten Prisma-CLI-Prozessen bekommt einen angemessenen Testdeckel.

## Änderungen seit 1.2.0

- Gemeinsames Dateimanifest mit tatsächlichen Discs/Tracks/Revisionen, gespeicherter Vorschau, Hashprüfung, Quarantäne, Undo und Recovery.
- Geräte-Doctor, editierbare ROM-/Save-Profile, Push/Pull/Zweiweg-Sync, immutable Save-Versionen und Restore.
- Lokaler DAT-/Hash-Abgleich und ausdrücklich begrenzte LAN-Geräteerkennung mit manueller Übernahme.
- Lokaler Startmodus mit Cookie und bewusster Dateiwurzelauswahl; Containerzugriff mit Admin-Token und geprüftem Browser-Origin.
- Aktualisierte Abhängigkeiten, gemeinsame SQLite-Jobgrenzen und Besitzerprüfung vor Journal-/Katalogschreibvorgängen.
- Wiederhergestellte Remote-Dateiaktionen über nachweislich geeignete SSH/SFTP-Verbindungen und normales FTP/FTPS mit den unten genannten Grenzen.

## Protokollgrenzen

| Verbindung | Dateipläne | Besitz/Dauerhaftigkeit | Freier Platz |
|---|---|---|---|
| LOCAL | Unterstützte lokale Dateisysteme | Native Identität, exklusives Staging, No-Replace und Flush | Tatsächlich abgefragt |
| SSH/SFTP | Linux/OpenSSH mit belegten Hardlink-/fsync-Erweiterungen und passender SSH-Metadatenansicht | Native Identität, exklusives Staging, Hardlink-Publikation, Datei-/Ordner-Flush | statvfs, sofern unterstützt |
| FTP/FTPS | Hashgeprüfte, vom Server bestätigte Aktionen | Kein portabler atomarer No-Replace oder fsync; keine dauerhafte native Identität | Unbekannt; Übertragung nur bei Profilreserve0 |

FTP-Undo setzt voraus, dass kein anderes Programm parallel dieselben Pfade verändert. Fremde Dateien mit identischem Inhalt können nicht zuverlässig unterschieden werden. Verlorene Antworten oder nicht im Journal bestätigte öffentliche Effekte werden als Recoverykonflikt erhalten. Eine Serverantwort beweist keinen Schutz nach Stromausfall. Quarantäne und private Reservierungsordner bleiben für die Prüfung erhalten; keine automatische Retention.

Fehlende SSH-Schreibfähigkeiten stoppen den konkreten Schreibplan vor Mutation. Solche Geräte können weiterhin als nur lesende Kopierquelle dienen. FTPS-Zertifikate werden geprüft; eine eigene CA muss im Betreiber-Truststore eingerichtet werden.

## Upgrade und Rückkehr

Vor dem Upgrade Ludotek und alle Datei-/Syncjobs stoppen. SQLite-Datei **einschließlich eventuell vorhandener WAL/SHM-Dateien**, den gesamten `data`-Ordner mit Verschlüsselungsschlüssel, Umgebungswerte und das bisherige Image beziehungsweise den bisherigen Sourcecommit gemeinsam sichern. Datenbank und Schlüssel gehören zusammen; kein neuer Schlüssel beim Wiederanlauf.

Der Container läuft als UID1000. Eigene `db`-/`data`-Bindordner müssen für diesen Benutzer schreibbar sein. `ADMIN_TOKEN`, `APP_ORIGIN`, `DATABASE_URL` und die erlaubten LOCAL-Dateiwurzeln anhand [Upgradeanleitung](upgrading-local.md) konfigurieren. Schemaänderungen betreffen die lokale SQLite-Bibliothek; der Container führt die mitgelieferten Migrationen beim Start aus.

Nach dem Start vorhandene Geräte/Spiele prüfen und zunächst einen Scan sowie eine einzelne Vorschau durchführen. Erst danach Dateiaktionen ausdrücklich anwenden. Ältere gespeicherte Vorschauen bei geändertem Geräte-/Protokollzustand neu erstellen.

Für eine Rückkehr die App stoppen und die **zusammengehörige Sicherung von Datenbank, Datenordner, Schlüssel und vorherigem Image/Source** wiederherstellen. Ein älteres Binary über einer bereits migrierten Datenbank ist kein geprüfter Rollback. Bereits ausgeführte Geräte-Dateiaktionen werden durch einen DB-Rollback nicht rückgängig gemacht: zuerst deren Journal/Quarantäne prüfen und bei unklarem Besitz Dateien erhalten. Details: [Datei-Recovery](file-recovery.md).

## Abnahme

Die ausgeführten Gates, Review-Ergebnisse und genauen Grenzen stehen in [Remote-Release-Review](dev/2026-10-12-remote-release-review.md). Protokollprüfungen verwenden eigene Dateien und echte SSH/SFTP-/FTP-/FTPS-Verbindungen; Docker und Chrome verwenden eine eigene migrierte SQLite-Bibliothek. Der lokale Dockerlauf prüft ARM64. Reale Gerätebestände, AMD64-Laufzeit und externe GitHub-CI wurden noch nicht abgenommen.
