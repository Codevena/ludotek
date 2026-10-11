# Scanner-Vollständigkeit und SSH-Fehler (A-03, A-06)

Teilauftrag des vollständigen Plans `2026-10-12-local-roadmap.md`. Private eigene Geräte, keine realen Geräteoperationen in Tests. Noch keine Implementierung dieses Teilplans.

## Betroffene Dateien und Verträge

- `src/lib/connection.ts`: bestehende `DeviceConnection.listDir(path)` bleibt für Browser-Aufrufe kompatibel. Neuer optionaler Parameter `{ requireComplete?: boolean }`. Scanner verwenden ausschließlich `requireComplete: true`.
- `src/lib/scanner.ts`: `scanDevice()` liefert weiterhin `{ games, reliable }`; vorhandene Nutzeränderungen in `__tests__/lib/scanner.test.ts` bleiben erhalten. Neue Tests in `__tests__/lib/scan-device.test.ts` und `__tests__/lib/ssh-exec.test.ts`/`connection-listing.test.ts`.
- `src/lib/scan-runner.ts`: Tests in `__tests__/lib/scan-runner.test.ts` beweisen, dass unzuverlässige Scans keine GameDevice-/SyncQueue-Bestandsbereinigung auslösen. Orphan-Cleanup darf bei einem unzuverlässigen Scan ebenfalls keine aus diesem Teilresultat abgeleiteten Löschungen auslösen.

## Ausführbare Änderung

1. `listDir` mit vollständiger Anforderung verarbeitet das vollständige SFTP-, FTP- oder lokale Listing bis maximal 100.000 Einträge pro Verzeichnis. Darüber expliziter Fehler, niemals stille Kürzung. Standard-Browserlisting behält die bisherige Grenze von 500 Einträgen. Scanner mit 501 zulässigen ROMs liefert 501 statt 500 Spiele.
2. Ein SFTP-Fehler bei vollständiger Anforderung wird weitergereicht. Kein Fallback auf das bestehende `ls | head`, dessen Pipeline Fehler und fehlende Einträge versteckt. Der vorhandene Root-`stat()` benötigt ohnehin SFTP; vollständiges Browsing für SSH-Geräte ohne SFTP wird hier nicht neu versprochen.
3. Leere Scanpfade sind unzuverlässig und starten keine Verbindung. Pfade müssen absolute, nichtleere Zeichenketten und Typ rom/steam besitzen. Jeder Root muss mit `stat().isDirectory` bestätigt sein. Nicht erkannte Plattformverzeichnisse werden ignoriert; fehlgeschlagene bekannte Plattform-/Regionsordner machen das Gesamtergebnis unzuverlässig. Erfolgreich gelesene Spiele können übernommen werden; keine Bestandsbereinigung.
4. `sshExec()` erfüllt einen genau einmal entschiedenen Promise-Vertrag: nur erfolgreicher Exit-Code 0 ohne Signal löst auf. Execfehler, Channel-/stderr-Streamfehler, Nonzero-/fehlender Exitstatus, Signal, Timeout nach 15.000 ms oder mehr als 4 MiB Gesamtausgabe lehnen ab. Bei Timeout/Überschreitung Channel schließen; verspätet gelieferte Channels ebenfalls schließen. Alle Timer auf Erfolg/Fehler entfernen.
5. Pfade in SSH-Shell-Kommandos werden POSIX-konform als einzelnes Argument gequotet statt Zeichen zu entfernen; NUL ablehnen. Das gilt insbesondere für Remove und bestehendes Browserfallback. Kein Remote-Kommando oder Passwort wird neu im Fehlertext ausgegeben. Andere lokale Dateigrenzen gehören zum folgenden A-01-Teilplan.

## RED/GREEN und Review

- [ ] Vollständigkeit: 501 Dateien kommen vollständig an; Legacy-Browseraufruf bleibt auf 500 begrenzt; explizite Vollständigkeit mit zu großem Listing oder SFTP-Fehler lehnt ab.
- [ ] Scanner: leere Pfade, Root als Datei, Ausfall eines bekannten Plattformordners, Ausfall eines Regionsordners, Connectionfehler und mehr als 500 ROMs. Bei unzuverlässigen Scans bleiben vorhandene DB-Verknüpfungen bestehen; vollständiger leerer Scan erlaubt die bestehende Bereinigung.
- [ ] SSH: Exit 0/1, Signal, fehlender Status, Exec-/Streamfehler, Timeout mit Fake Timers, spätes Exec-Callback und Ausgabegrenze. Durch Entfernung des Exitguards wird Nonzero als Erfolg erkannt und der Guardtest rot.
- [ ] Shellargumente: Apostroph, Dollarzeichen, Backtick und Leerzeichen bleiben der exakt übergebene Dateiname, ohne Ausführung von Substitution; Tests verwenden kontrollierten lokalen printf statt rm.
- [ ] Unabhängiger Planreview vor Mutation; fokussierte kausale RED/GREEN; danach rootseitig Typprüfung, Tests und unabhängiger Implementierungsreview. Mutation nur für die Pruning-/Remote-Erfolg-Invariante, in einer getrennten Task-Kopie, falls die kausalen REDs die entscheidenden fehlenden Guards nicht bereits zeigen.

Es werden keine realen Geräte verbunden oder entfernt, keine Nutzerbestände migriert und keine Credentials gelesen. Keine neuen Abhängigkeiten oder Prisma-Migrationen in diesem Teil.

## Review-Nachweise

Unabhängiger ausführender PRE-Review: PASS mit INFO, 0 CRITICAL/0 WARN. Aktueller Code reproduziert Exit 1/fehlenden Status als Erfolg, schließt spät gelieferten Timeout-Channel 0-mal und meldet leere Scanpfade reliable=true. SSH2-1.17.0-Eventvertrag anhand lokaler Quellen geprüft; keine Netzwerk-/DB-/Dateiaufrufe.

INFO in Umsetzung übernehmen: Exitstatus bei exit speichern und Erfolg erst bei close entscheiden, damit nachlaufende Ausgabe erhalten bleibt. Runner-Tests verlangen bei unzuverlässigem Scan für GameDevice.deleteMany, SyncQueue.deleteMany, game.deleteMany und deleteGameFiles jeweils exakt 0 Aufrufe; vollständig leerer Scan bleibt bereinigbar. Mapping R1: keine blockierenden Befunde.
