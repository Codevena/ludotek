# GitHub/Linux-Abnahme vor Veröffentlichung

Markus hat Push und GitHub-Veröffentlichung ausdrücklich freigegeben. Branch und immutable Tagv2.0.0-rc.1 zeigen aufd046efe; Release ist nur ein eigener Draft. CI38241346849 scheitert an10 Timing-/Sperrfällen, Publisher übersprungen. Keine Retag-/Force-Push-Aktion: korrigierter Kandidat wird2.0.0-rc.2.

## Kausale Befunde und kleiner Delta

1. Prisma6.19.3/SQLite: unveränderte Provider-Racetests sind bei TOKIO_WORKER_THREADS=2 reproduzierbar rot. Busy-BEGINs blockieren native Tokio-Threads und verhindern Fortschritt der aktiven Transaktion. Mit connection_limit=1 pro Client bleiben zwei wirkliche Clients korrekt:4 Reservierungen/1 korrekte429, acht Warteslots. Begrenze ausschließlich SQLite-Pools auf1, erhalte Datenbankpfad und alle anderen URL-Parameter. Cache den App-Prisma-Client auch in Produktion pro Prozess; DB-Transaktionen/Owner-/Expiry-/Budgetprüfung bleiben unverändert maßgeblich. Keine neue process-local Autorisierungs-/Lock-Fallbacklogik, keine Retry- oder Deadlineänderung.
2. Unabhängiges Testfixture übernimmt dieselbe Pool-URL, damit Zweitclients echte Datenbankkonkurrenz mit dem produktiven Poolvertrag prüfen. Regression für URL-Erhalt, Parameterüberschreibung, Produktionssingleton und Zwei-Tokio-Thread-Races; keine Verringerung der konkurrierenden Claims oder gelockerte Ergebnisassertion.
3. SSH-Wirefixture: Linux zeigt systematische mehrsekündige Latenz bei kleinen EXEC-Statuspaketen; installed ssh2 bietet setNoDelay. Lokale Baseline ist rot nach5s; serverseitig allein bleiben17s-Verzeichnispläne und weitere Timeouts. Die zusätzliche clientseitige Vorabprobe auf unverändertem Produkt macht dieselben zwei Fälle in1,57s grün. Setze deshalb TCP_NODELAY im Testserver und im produktiven Client nach ready/vor Factoryresolve; nur einen realistischen Socketsetter im bestehenden Clientmock ergänzen. Sämtliche Assertions/Deadlines/Sicherheitschecks bleiben bestehen, Produkt-SFTP-Adapter unverändert.
4. Legacy-Upgradetest startet mindestens16 echte Prisma-CLI-Prozesse und überschreitet im CI den20s-Testdeckel. Erhöhe nur diesen funktionalen Integrationstest nach gemessener Linux-Laufzeit auf einen angemessenen begrenzten Testdeckel; jede Schema-/Backup-/Credentialassertion bleibt bestehen. Produktfristen unverändert.

## Eigentum und Gate

- SQLite-Worker: src/lib/prisma.ts, neue src/lib/sqlite-url.ts, __tests__/helpers/temp-database.ts, neuer Pool-/Singleton-Test. job-admission.ts bleibt unverändert.
- SSH-Worker: ausschließlich __tests__/helpers/ssh-wire-server.ts und nötige Kausaltestprobe; andere Tests/Adapter unverändert.
- Root: Legacy-Testdeadline, package/docs/CI-Orchestrierung/GitHub-Publikation, eigener begrenzter Linux-Node22-Container mit Source-Binds. Keine Produktionshosts, Nutzerbibliotheken, echten Provider oder SMB-Pfade.
- Sharedworktree: keine fremden Änderungen zurücksetzen, Controller staged/committed allein.

Vor Änderung des App-Poolvertrags unabhängige schmale Prüfung dieses konkreten Deltas. Danach unveränderte Race-/Owner-/Provider-Tests mit Tokio2, echte Linux-Wirefälle und vollständige lokale/Linux-Suite plus Typ/Lint. Ein unabhängiger Delta-POST prüft Pool/Singleton und Assertions; keine breite Neuprüfung bereits bestandener Remote-Features. Dann lokaler Commit mit Gitleaks, autorisierter Branchpush/neuerRC2-Tag, GitHub-CI/AMD64-Smoke/ARM64+AMD64-Publisher prüfen und erst danach eigenen Draft veröffentlichen. Eigenes RC1-Draft ohne Taglöschung durch den erfolgreichenRC2-Draft ersetzen/entfernen; Sourcearchivtag bleibt unverändert.
