# I/O-Fehler und lokale Integritäts-Engine: Verifikation

## Umfang

- A-02: bekannte Plattform und sichere Eingaben vor Uploadarbeit, Pfadhelper ebenfalls geschützt.
- A-03: vollständige Listings, Konfigurations-/Root-/Unterordnerfehler unzuverlässig; keine Verknüpfungs-, Queue- oder Orphan-Löschungen aus Teilresultaten.
- A-04: gemeinsame referenzbewusste Detect-/Process-Gruppen, begrenzte CUE/GDI-Lektüre und nur tatsächlich konsumierte Tracks überspringen. Unabhängige BIN bleibt übertragbar; null Dateien/Kollisionen kein falscher Erfolg.
- A-06: SSH-Erfolg nur nach Exit 0/close, Fehler/Signal/fehlender Status/Timeout/Ausgabegrenze ablehnen, Channels schließen, Dateinamen unverändert quoten. Deprecated Steam-Deck-Helper verwendet denselben Vertrag.
- Feature 4, ausschließlich Backendkern: Logiqx/clrmamepro und Streaming-Fingerprints/Zuordnung. UI, API, persistente Geräteprüfungen und deren Zulassung noch nicht umgesetzt.

## Kausale RED/GREENs

- Scanner/SSH: 43 Tests vor Produktänderung, 36 kausale Fehler/7 bestanden. Zusätzlicher Legacy-RED: 2/2 Fehler (Nonzero als leerer Erfolg, Sonderzeichen verändert). Endstand 45/45 grün.
- Upload: initial 46 Fehler/15 bestanden plus 21 Descriptor-REDs; zusätzliche Parser-/Convertergrenzen und kanonische Aliase kausal reproduziert. Endstand 113/113 inklusive 20 vorhandener unveränderter Detector-/Uploader-Tests.
- Integrität: DAT 50/50 RED, Hash 33/36 RED gegen fehlenden Backendkern; weitere Parser-/Streamcleanup-Regressionen kausal RED/GREEN. Endstand 90/90.
- Root: `pnpm test` 338/338 in 22 Dateien bestanden; `pnpm exec tsc --noEmit` Exit 0; `pnpm lint` ohne Warnungen/Fehler; diff-check sauber.
- Isolierter Produktionsbuild erfolgreich, 44 statische Seiten; 16 bestehende Migrationen ausschließlich auf eigener temporärer SQLite-DB. Eigene Build-/Testdatenbankartefakte entfernt. Keine echte Nutzer-DB oder Geräteoperation.

## Reales Converter-Smoke

Lokal installiertes chdman 0.289. `pnpm exec tsx .review/chdman-smoke.ts`: je eine eigene CUE-/GDI-Sitzung mit 32 synthetischen CD-Frames. Gemeinsamer Sessionhelper liefert genau ein Spiel und den richtigen Track; echte createcd-Konvertierung und anschließend `chdman verify` bestanden. Task-Sitzungen danach entfernt. Keine echten Spiele oder Remote-Transfers.

Tokenizer und 510-Byte-fgets-Grenze gegen [MAME-Revision c9e87a6](https://github.com/mamedev/mame/blob/c9e87a6b7e00cbd8e54fbbabad07640c8df882a7/src/lib/util/cdrom.cpp) und [MAME 0.289](https://github.com/mamedev/mame/blob/mame0289/src/lib/util/cdrom.cpp) geprüft. Disc-/Audio-Semantik bleibt Aufgabe des Converters. Tatsächliche Toolversion einer späteren Nutzerinstallation nicht behauptet.

## PRE-Reviews

- Scanner/SSH: ausführender unabhängiger Planreview PASS mit INFO, 0 CRITICAL/WARN. Exit 1, fehlender Status, verspäteter Timeoutchannel und leere Konfiguration kausal demonstriert. INFO Exit/close und vier Null-Löschwirkungen umgesetzt.
- Upload: unabhängiger Quellenreview PASS, 0 CRITICAL/WARN; wegen damaligem Disk-Hook keine Ausführung. Vor Implementierung eigene kausale REDs durchgeführt. INFO gruppenübergreifende Tracks und echte Lektüregrenze umgesetzt.

## Unabhängiger POST R1

### FINDINGS

Keine Befunde: 0 CRITICAL, 0 WARN, 0 INFO im beauftragten Payload.

### EVIDENCE

- Payload-SHA256 bestätigt: `6c37f5b8f9753408db650dd17d8232ed7dbce4eaa083468ae715cf54ea48d573`, alle 18 Task-Dateien einschließlich neun neuer Tests und drei neuer Bibliotheksdateien enthalten.
- Nach bestätigtem Buildende ausgeführt:

```text
pnpm exec vitest run __tests__/lib/connection-listing.test.ts __tests__/lib/ssh-exec.test.ts __tests__/lib/scan-device.test.ts __tests__/lib/scan-runner.test.ts __tests__/lib/upload-process.test.ts __tests__/lib/disc-inputs.test.ts __tests__/lib/upload-validation.test.ts __tests__/lib/dat.test.ts __tests__/lib/integrity.test.ts
```

- Ergebnis 9 Dateien, 228/228 Tests bestanden. Nichtvakuose Prüfungen erfassen vollständige Listings, exakt null destruktive Aufrufe bei unzuverlässigem Scan, SSH-Fehler/Timeout/Quoting, Descriptorgrenzen, Trackzuordnung, BIN-Erhalt, Kollisionen und DB-Schreiben nach erfolgreichen Transfers.
- Eigene tsx-Proben gegen Produktfunktionen bestanden: echte 65.537-Byte-Datei in 511-Byte-Streamchunks, MD5/SHA1/SHA256 gegen unabhängige Referenz, unbekannt/konkrete Abweichung, XML/CMP-Tiefengrenze 64, Entitäten-/Kontrollzeichenablehnung, Abbruch im Progresscallback, relative einfach zitierte CUE-Referenz, eigenständige BIN und stabile IDs.
- Erster Prüfharness scheiterte vor Ausführung an CJS/ESM-Importinterop; korrigierter Harness bestand. Kein daraus abgeleiteter Produkt-RED.
- Abschließender diff-check bestand, Payload unverändert. Keine Produktänderungen oder echten Geräte-/DB-/Netzwerk-/Provideraufrufe durch Reviewer; eigene temporäre Probedaten entfernt.

### VERDICT

PASS — 0 CRITICAL / 0 WARN, ausschließlich beauftragter I/O- und Backendkern.

Findings-Mapping R1: keine Befunde. Tree-Bindung durch Neubauen aus den aktuellen Task-Dateien, nicht nur Prüfen der gespeicherten Payloaddatei. Nutzeränderungen und Workflowkonfigurationen explizit ausgeschlossen.

## Verbleibender Auftrag

A-01/A-05/A-10/A-11/A-12 sowie alle sechs vollständigen UI-/API-Funktionen bleiben offen. Integritäts-Backend ist eine Grundlage, keine fertige Nutzerfunktion. Auth-/Admission-Delta und aktuelles API-Inventar liegen vor; PRE-Review läuft. Keine Veröffentlichung, Deployment oder Nutzerdatenmigration.
