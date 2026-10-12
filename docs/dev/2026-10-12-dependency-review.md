# Gepatchte Abhängigkeiten — lokale Abnahme

Paket auf Basis `5ebedaf`: Next 15.5.27, React 19.3.0, basic-ftp 6.2.1, Prisma 6.19.3 und gezielte transitive Patches. pnpm 11.21.0 ist die einzige Installerlinie; begrenzte Nativebuild-Freigaben gelten nur ohne eigene Betreiberliste. Keine echten Nutzer-DBs, Geräte, Provider, LAN-Scans oder Container verwendet; kein Push.

## Ergebnisse und Grenzen

- Produktionsaudit: zuvor 35 Meldungen (2 critical/18 high/13 moderate/2 low), jetzt 0 bekannte Meldungen. Ein Paketadvisory ist kein pauschaler Nachweis der Ausnutzbarkeit; der Audit ist kein vollständiger Sicherheitsnachweis.
- Kausaler FTP-Parser-RED: tatsächlich alter Parser überschreitet 1000 ms im killbaren Node-Child. Identische 64-KiB-Fixture nach Update 32 ms inklusive Prozessstart; unabhängige Wiederholung 24 ms. Kein FTP-Serverkontakt.
- 577/577 Tests in 46 Dateien; Typprüfung, Lint und sauberer isolierter Next-15-Produktionsbuild mit 42 Routen bestanden. Kein paralleler Build/Suite/Browser.
- Echte classic-Prisma-Konfiguration über gepatchtes deepmerge-ts 8 und eigene SQLite-Migrations-/Legacy-Baseline-Fixtures bestanden. Synthetische Datensätze unverändert; abweichende Legacy-Schemata werden abgelehnt.
- Saubere pnpm-11.21.0-frozen-Neuinstallation ohne Nutzer-Workspace, mit bytegleichem Lockfile und tatsächlichen CPU-/SSH-/Prisma-/Resolver-/esbuild-Lifecycle-Builds bestanden. Eigene Kopie anschließend entfernt.
- Tatsächliche Chrome-/HTTP-/RSC-Smokes auf eigenen Tempdaten: Produktionsanmeldung, Setup/Rootwahl, Fremdpfad-Ablehnung, sichtbarer Budgetstop mit Teilzählern; tokenloser Dev-Launcher weist fremden raw Host und falschen Origin ab. Keine Live-Provideraufrufe.
- Unabhängiger POST R1 PASS: 0 CRITICAL/0 WARN/1 INFO. Vollständiger 11-Dateien-Payload SHA256 `7b223f7c89055dfc7e78f94ffe002464c87693aaee8828547b84fda933c55227`; alle 11 Quelldateien vor/nach Review bytegleich.
- Reale Docker-/Node-24- und FTP-Geräte-/NAT-Kompatibilität ungeprüft. basic-ftp 6 weist abweichende PASV-Adressen standardmäßig zurück; keine globale Lockerung dieser Sicherheitsgrenze. Bei getrenntem FTP-Datenhost die konkrete Gerätekonfiguration prüfen. SSH oder unverändert gleicher Kontroll-/Datenhost vermeiden diese spezielle PASV-Grenze.
- Devtool-Vite verwendet weiterhin PostCSS 8.5.9; dieser Pfad gehört nicht zum geprüften Produktionsaudit. Keine Behauptung allgemeiner Advisoryfreiheit des gesamten Entwicklungswerkzeugs.

## Findings-Mapping

PRE R1 DEP-PRE-01 CRITICAL bestätigt: pnpm 9/11 verwenden inkompatible Hookchecksummen. Minimalfix eine Linie 11.21.0 in Lockgenerierung/packageManager/Docker/clean frozen und sieben Standardfreigaben nur bei fehlender Betreiberpolicy. PRE R2 schließt das Delta mit echten Offline-Fixtures und versionierter Policyausführung.

PRE R1 DEP-PRE-02 INFO durch tatsächliche classic-Prisma-config-Fixture auf gepatchter Mergerkante verifiziert. POST DEP-POST-01 INFO als konkrete PASV-Kompatibilitätsgrenze aufgenommen, kein pauschales allowSeparateTransferHost.

Gesamtauftrag bleibt aktiv: A-05/A-12 und alle sechs vollständigen Nutzerfunktionen offen. Dieses Paket aktualisiert die Laufzeit vor der gemeinsamen Dateigrundlage.

## Vollständige unabhängige Reports

# Dependency PRE — Runde 1

Review-Gegenstand: `docs/dev/2026-10-12-dependency-plan.md`, Stand vor Dependency-Mutation auf Basis `5ebedaf`. Begrenzte unabhängige Prüfung; keine Produktänderungen, kein Staging, keine Nutzer-DB, Geräte, Provider, Netzwerk- oder Containeraufrufe.

## FINDINGS

- **DEP-PRE-01 — CRITICAL — `docs/dev/2026-10-12-dependency-plan.md:9` (zusammen mit Zeile 8 und 17):** Der neue CJS-Hook macht den Hook-Checksum-Vertrag relevant, während der Plan die lokal vorhandene pnpm-11-Linie für die frische Auflösung nicht mit dem Docker-Installer pnpm 9.15.9 zusammenführt. Tatsächlich erzeugt pnpm 11.21.0 einen SHA256-Hook-Checksum, während die ausführbare pnpm-9-Probe MD5/Base32 erwartet; mit identischem Hook und Graph scheitert ein eingefrorener Wechsel in beide Richtungen sofort mit `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`. Eine unter lokalem pnpm 11 neu aufgelöste Lockdatei kann daher nicht durch bloßes Docker-Copy des Hooks mit pnpm 9 installiert werden. **Minimaler Fix:** Eine Installerlinie für Lockgenerierung, lokale frozen-Neuinstallation und Docker ausdrücklich pinnen und die gewählte Kombination offline/frozen prüfen; dabei die vorhandene Nutzer-Workspace-Datei unverändert lassen. Alternativ den Hook durch einen nachweislich kompatiblen begrenzten Mechanismus ersetzen. Exakte pnpm 9.15.9 war in diesem eingeschränkten Review nicht lokal verfügbar; die kausale Probe lief mit 9.15.0, die exakte geplante Patchversion bleibt durch den Controller zu bestätigen.

- **DEP-PRE-02 — INFO — `docs/dev/2026-10-12-dependency-plan.md:17`:** Die echte Prisma-config-Probe ist wesentlich: `@prisma/config` 6.19.3 importiert `deepmerge-ts` dynamisch innerhalb des Config-Laders und übergibt `deepmerge` an c12. Eine Probe ohne vorhandene `prisma.config.*` würde diesen Codepfad nicht belegen. Der Plan verlangt bereits eine echte Config-Ausführung und anschließend eigene SQLite-Migrations-/Baseline-Fixtures; deshalb kein zusätzlicher Blocker. Beim späteren Nachweis die tatsächlich aufgelöste deepmerge-Version und den ausgeführten Config-Pfad ausweisen.

## EVIDENCE

- Lokal gelesen: Plandatei, `package.json`, `pnpm-lock.yaml`, `Dockerfile`, `.dockerignore`, `next.config.mjs`, Projekt-`CLAUDE.md`, `docker-entrypoint.sh`; keine Nutzereinstellungen oder Geheimnisse gelesen.
- Installierter Ausgangsgraph unabhängig verifiziert: Next 14.2.35, React/react-dom 18.3.1, basic-ftp 5.2.2, Prisma und `@prisma/config` 6.19.3, deepmerge-ts 7.1.5, direktes PostCSS 8.5.9; lokales Node 22.23.1 und pnpm 11.21.0. Zielversionen und Primärquellen wurden gemäß Review-Auftrag vom Controller geprüft; sie sind hier keine eigene Registrymessung. Gepatchte Zielpakete sind noch nicht installiert, daher wird ihre reale Runtime-Kompatibilität nicht vorweggenommen.
- Eigene vollständig lokale Temp-Fixture, danach gelöscht: ein CJS-`readPackage`-Hook ersetzt eine lokale file-Dependency. pnpm 11.21.0 und pnpm 9.15.0 lösen je eine frische Fixture offline erfolgreich auf (`downloaded 0`). Anschließende `--offline --ignore-scripts --ignore-workspace --frozen-lockfile`-Installationen mit der jeweils anderen Installerlinie ergeben beide Exit 1 und `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`, Schlüssel `pnpmfileChecksum`. pnpm 11 schreibt `sha256-*`; pnpm 9 einen 26-stelligen Base32-Wert. Kein Repo-Lockfile oder Nutzer-Workspace wurde geändert.
- Lokales versioniertes pnpm-Source belegt den Mechanismus zusätzlich: pnpm 9.15.0 `dist/pnpm.cjs:8800`/`:10515` verwendet MD5/Base32 normalisierter Hookbytes; pnpm 11.21.0 `dist/pnpm.mjs:99010`/`:217072` verwendet SHA256/Base64 auch für genau eine Hookdatei. Beide Installer laden `.pnpmfile.cjs`; pnpm 11 kann außerdem eine vorhandene `.pnpmfile.mjs` bevorzugen. Der Docker-Kontext schließt aktuell `pnpm-workspace.yaml` aus, den neuen CJS-Hook aber nicht; Copy muss vor dem Install stattfinden, wie bereits geplant.
- Unabhängige FTP-Altprobe ausschließlich mit synthetischen Bytes und outputbegrenzten Node-Childs: `basic-ftp/dist/parseListUnix.js.testLine`, Fixture `'-rw-r--r-- 1 ' + 'owner '.repeat(n) + 'broken'`. `n=8`: 0 ms; `n=256`: 1 ms; `n=2048`: 35 ms; `n=32768`: hartes 800-ms-Timeout, `SIGKILL`, `ETIMEDOUT`, keine Ausgabe. Eine gültige synthetische Zeile liefert `fixture.rom`, Größe 42, owner/group. Das demonstriert den tatsächlich installierten verwundbaren Parser und kontrollierten Abbruch; die identische gepatchte Bibliotheksprobe bleibt gemäß Plan nach Installation erforderlich.
- Sicherheitsvertrag gezielt gelesen: `src/lib/auth-policy.ts`, `src/lib/auth.ts`, `src/middleware.ts`, `scripts/local-server.mjs` und benannte Auth-/Launcher-Testfälle. Die vorhandenen Verträge verlangen Runtime-Konfiguration, exakten rohen Loopback-Host, URL-Authority und geeigneten Origin; Forwarded-Header geben keine Autorität. Der Dependency-Plan fordert deren Erhalt und echte Next-15-HTTP/RSC-Abnahme. Zusätzlich eigener einzelner Lauf `node node_modules/vitest/vitest.mjs run __tests__/lib/auth.test.ts`: **1 Testdatei, 33 Tests bestanden**. Das ist Ausgangsevidenz, kein Nachweis für Next 15.
- `.review/local-runtime-smoke.ts` gelesen: eigene temporäre SQLite-Datei und ROMroot, synthetischer Runtime-Token, raw HTTP für fremden Host, Login/Cookie/Setup/virtuelle Root/Outside-Rejection, abgefangene Budgetstop-SSE. Nicht ausgeführt und kein alter Gesamt-A01-Review wiederholt.
- Vorhandene Root-/Budget-/Batch-/EOF-Verträge werden durch den Plan weiterhin getestet. Die konkrete Library-/React-19-/Next-15-/Prisma-8-Override-Kompatibilität und exakte installierte Advisoryfreiheit gehören zur ausdrücklich erforderlichen seriellen Implementierungsabnahme, keine behaupteten PRE-Erfolge.

## VERDICT

FAIL — 1 CRITICAL, 0 WARN, 1 INFO. Der reproduzierte Installer-/Hook-Checksum-Konflikt muss im Plan aufgelöst werden. PASS erfordert 0 CRITICAL und 0 WARN; INFO ist beratend.


# Dependency PRE — Runde 2, Installer-Delta

Review-Gegenstand: ausschließlich die R1-Korrektur in `docs/dev/2026-10-12-dependency-plan.md:9` und die direkt ergänzte Buildfreigaben-Konfiguration in Zeile 10. Keine erneute Framework-/A01-Prüfung, Produktänderungen oder Staging.

## FINDINGS

Keine neuen CRITICAL-, WARN- oder INFO-Befunde.

**DEP-PRE-01 aus R1 ist im Plan geschlossen:** Lockgenerierung, lokale/CI-frozen-install und Docker verwenden jetzt ausdrücklich exakt pnpm 11.21.0; `packageManager` und Docker werden entsprechend gepinnt. Der bisherige 9/11-Mischbetrieb entfällt. Der Hook wird vor dem Docker-Install kopiert, und eine saubere Neuinstallation ohne untracked Nutzer-Workspace ist zur echten Graph-/Buildabnahme vorgeschrieben.

Die Buildfreigaben-Korrektur erweitert nur eine fehlende `allowBuilds`-Konfiguration um die benannten sieben Pakete. Eine vorhandene Liste einschließlich `false` und `{}` bleibt unangetastet. Der Plan entfernt die von pnpm 11 ignorierte alte package.json-Konfiguration und erlaubt weder alle Builds noch Änderungen an Registry, Credentials oder Maschinenkonfiguration.

## EVIDENCE

- Aktuelle Plandatei gelesen; Delta auf Installerlinie und direkt notwendige Buildfreigaben begrenzt. Exakte lokale ausführbare pnpm-Version: 11.21.0; Node 22.23.1 erfüllt deren lokal gelesenes Enginefeld `>=22.13`. Node 24 im Dockerplan ist damit vereinbar; ein tatsächlicher Containerstart wird weiterhin nicht behauptet.
- Tatsächlicher pnpm-11-Source gezielt gelesen: `dist/pnpm.mjs:314942` lädt die Hooks und führt `updateConfig` auf der eingelesenen Konfiguration aus; `:217111` registriert den Hook und verlangt einen Konfigurations-Rückgabewert. Die Buildpolicy `createAllowBuildFunction` liegt ab `:174013` und berücksichtigt ausdrückliche Verbote vor namensbasierten Freigaben.
- Eigene kleine Offline-Fixtures mit dem echten pnpm 11.21.0, eigenem temporären Store, leerer eigener npmrc und ohne Lifecycle-Ausführung: frischer Install Exit 0; zweite saubere Fixture mit identischem Hook und übernommenem Lockfile, ohne `pnpm-workspace.yaml`, `--offline --ignore-scripts --frozen-lockfile` Exit 0. Beide enthalten denselben SHA256-Hook-Checksum; das Lockfile bleibt beim frozen-Lauf bytegleich. Keine Paketdownloads aus dem Netz, Nutzerdateien oder bestehenden Stores verwendet; eigene Fixtures danach gelöscht.
- Derselbe tatsächliche `updateConfig`-Lauf beobachtet bei fehlender Liste `before=null` und danach exakt `@prisma/client`, `@prisma/engines`, `cpu-features`, `esbuild`, `prisma`, `ssh2`, `unrs-resolver`, jeweils `true`. Fixture mit `cpu-features:false` und `fixture-blocked:true` bewahrt beide Werte exakt; Fixture mit `allowBuilds:{}` bewahrt `{}` exakt. Beide Workspace-Fixturedateien bleiben bytegleich, Installationen Exit 0.
- Zusätzlich gezielte Ausführung der unveränderten lokalen pnpm-11-Buildpolicy-Funktionen und ihrer benötigten lokalen Parserhelfer im VM: die sieben normalen Semver-Paketidentitäten werden zugelassen; ein unbenanntes Paket bleibt ohne Freigabe; ausdrückliches `false` wird als `false`, benutzerdefiniertes `true` als `true` behandelt; eine leere Liste gibt keine Freigabe. Diese Probe bestätigt die konfigurative Entscheidung und ist kein Nachweis für die echten nativen Pakete.
- Explorative ausschließlich eigene lokale Tarball-Fixtures wurden von pnpm erwartungsgemäß nicht durch einen Paketnamen allein freigegeben; eine synthetische Registry-Paketidentität mit lokaler Tarball-Resolution wurde vom tatsächlichen Resolution-Shape-Schutz abgewiesen. Kein Schutz wurde umgangen oder abgeschaltet. Diese Fixtures liefern folglich keine Aussage über Lifecycle-Erfolg normaler Registry-Pakete. Die echte saubere Graph-/Buildinstallation bleibt ausdrücklich im Plan und wird hier nicht vorweggenommen.
- R1-INFO zur echten Prisma-config-/deepmerge-Ausführung bleibt durch die unveränderte notwendige Implementierungsabnahme abgedeckt. Keine weitere Ausweitung der Prüfung.

## VERDICT

PASS — 0 CRITICAL, 0 WARN, 0 INFO. DEP-PRE-01 ist durch die einheitliche Installerlinie und die ausführbaren begrenzten Konfigurations-/frozen-Fixtures aufgelöst. Die produktive Dependency-Kompatibilität und echten Paketbuilds bleiben Gegenstand der bereits verlangten lokalen Implementierungsabnahme und POST.


# Dependency POST — Runde 1

Gegenstand ist ausschließlich der vollständige 11-Dateien-Payload `.review/dependency-payload.diff` gegen `5ebedaf`, einschließlich neuem CJS-Hook und drei neuen Tests. SHA256 vor und nach Prüfung: `7b223f7c89055dfc7e78f94ffe002464c87693aaee8828547b84fda933c55227`. Der Payload wurde gelesen, nicht aus Git rekonstruiert. Nutzer-Workspace, Workflowkonfiguration, Brain, `.env`, echte Geräte/DBs/Provider und Container waren außerhalb der Prüfung.

## FINDINGS

- [INFO] **DEP-POST-01 — `package.json:18`, direkter Laufzeiteffekt auf `src/lib/connection.ts:735`:** basic-ftp 6.2.1 setzt `allowSeparateTransferHost` standardmäßig auf `false` und weist eine abweichende PASV-Adresse zurück. basic-ftp 5.2.2 verwendete standardmäßig `true` und korrigierte eine private PASV-Adresse bei öffentlicher Kontrolladresse auf den Kontrollhost. Die eigene synthetische Probe mit nicht unterstütztem EPSV, Kontrolladresse `203.0.113.10` und PASV-Adresse `10.0.0.5` gelingt unter 5.2.2 und wird unter 6.2.1 vor jeder Datenverbindung abgewiesen. Das ist die bewusste Sicherheitsverschärfung der neuen Bibliothek; ein Vertrag für separate Transferhosts/NAT ist im geprüften Delta nicht zugesagt. Reale Geräte- und NAT-Kompatibilität bleibt ungeprüft. Die konkrete Grenze sollte im Upgradehinweis genannt werden; keine pauschale Freigabe separater Transferhosts ableiten.

Keine CRITICAL- oder WARN-Befunde.

## EVIDENCE

- `node node_modules/vitest/vitest.mjs run __tests__/lib/dependency-hook.test.ts __tests__/lib/ftp-parser-limits.test.ts __tests__/lib/prisma-config-compat.test.ts --maxWorkers=1` → **3 Dateien, 4 Tests bestanden**, 993 ms. Die Prisma-Fixture erstellt und migriert ausschließlich ihre eigene temporäre SQLite-Datei. Die echte CLI lädt eine vorhandene classic-Konfiguration, meldet den aktuellen Migrationsstand, erhält den synthetischen Datensatz und erstellt die absichtlich ignorierte Datasource nicht.
- Eigene direkte `spawnSync`-Probe mit demselben malformed-64-KiB-Input und einer gültigen Abschlusszeile, jeweils `timeout:1000` und `maxBuffer:4096`: tatsächlicher alter basic-ftp-5.2.2-Parser → **1004 ms, ETIMEDOUT, SIGTERM, keine Ausgabe**; installierter 6.2.1-Parser → **24 ms einschließlich Childstart, Exit 0, gültige Zeile erhalten**. Kein FTP-Serverkontakt. Die neue Unix-Regel ist in der installierten Quelle verankert und begrenzt beide Owner-/Group-Wiederholungen.
- Eigene Graph-Probe mit `createRequire`, realen aufgelösten Pfaden und geparstem Lockfile: Next **15.5.27**, React/react-dom und Types **19.3.0**, basic-ftp **6.2.1**, Prisma/client/config **6.19.3**. Der Next-Aufrufer löst PostCSS **8.5.23** auf, PostCSS löst Nanoid **3.3.18** und source-map-js **1.2.2** auf, der Prisma-config-Aufrufer löst deepmerge-ts **8.0.0** auf. Importer-Specifier stimmen für jede direkte Dependency/DevDependency mit package.json überein; Lock-Snapshots binden dieselben gepatchten Kanten. Die alten Next/React/basic-ftp/deepmerge/Nanoid/source-map-js/Next-PostCSS-Versionen sind im Lock nicht mehr vorhanden. Das verbliebene PostCSS 8.5.9 gehört zur unveränderten Vite-Testtool-Kante, nicht zum geprüften Produktionspfad.
- Die tatsächlichen Package-Engine-/Peerfelder sind mit lokalem **Node 22.23.1** und **pnpm 11.21.0** vereinbar. Next erlaubt React 19, react-dom verlangt die passende 19.3-Linie; Prisma bleibt in 6.x. deepmerge-ts 8 liefert CJS- und ESM-Exports. In `@prisma/config/dist/index.js:894` wird der tatsächliche dynamische Mergerimport an c12 übergeben; die ausgeführte Config-Fixture belegt diesen Pfad.
- Eigene Hook-Probe: exakt sieben `true`-Standardschlüssel; vorhandene kombinierte true/false-, leere und explizite paketversionsbezogene Verbotslisten bleiben mit ihrer ursprünglichen Objektidentität erhalten. `ignoreScripts` und synthetische Registryfelder bleiben unverändert, kein `dangerouslyAllowAllBuilds` wird ergänzt. `dependencies` und `optionalDependencies` werden gezielt gepatcht; Next 16, Prisma-config 7 und Nanoid/source-map-js anderer Majorlinien bleiben unverändert.
- Zusätzlich im VM gezielt ausgeführt: unveränderte tatsächliche **pnpm-11.21.0**-Funktion `createAllowBuildFunction` und 16 erforderliche Parser-/Policyhelfer aus `dist/pnpm.mjs:174013` sowie deren benannten Definitionen, mit lokaler Semver-API. Alle sieben normalen Registryidentitäten werden freigegeben; ein unbenanntes Paket bleibt ohne Freigabe. `ssh2:false` ergibt `false`, `prisma:true` ergibt `true`, eine leere Liste wird nicht ergänzt. Die reale Hookregistrierung und deren Anwendung auf bereits eingelesene Konfiguration sind in `:217111` und `:314942` vorhanden. Diese Probe prüft Policysemantik, nicht native Linux-Builds.
- Der selbst berechnete Hook-Checksum `sha256-hxtyRtXWw0M5Rw0vV6LlbKto7FF3974OKTi7mZEPDec=` stimmt mit dem Lockfile überein. PackageManager und Docker pinnen beide **11.21.0**; Docker kopiert `.pnpmfile.cjs` vor dem frozen-Install. Der pnpm-11-Source verwendet für eine einzelne Datei SHA256/Base64 normalisierter Hookbytes (`:99010`). Der PRE-R1-Installerkonflikt wird durch das konkrete Delta nicht wieder eingeführt.
- Direktes Delta gelesen: Next-Konfiguration behält Standalone, dieselben drei externen Pakete und dieselben Image-Hosts; nur der nun stabile Konfigurationsschlüssel ändert sich. Das Setup-Linkziel bleibt `/?skipSetup=1`, die vorhandene Querybehandlung passt dazu. TS-target ES2017 ist die konkrete Frameworkanpassung. Docker-Non-root-, Datenpfad-, Volume-/Token-/Origin- und Entry-Point-Verträge werden im Payload nicht verändert. Keine Auth-, Cookie-, Admission-, Provider-, Root- oder API-Handleränderung ist enthalten.
- Gelesener Produktionsaudit `.review/ludotek-production-advisories-patched.json`: leere Advisories, **0 bekannte Produktionsmeldungen**, 245 einschließlich optionaler Dependencies. Das ist ein vom Controller erzeugtes Registryergebnis, kein eigener erneuter Netzaufruf und kein pauschaler Sicherheitsnachweis.
- Der Controller berichtet auf diesem Ergebnis **577/577 Tests**, Typ/Lint, isolierten Next-15-Build mit 42 Routen, tatsächliche Chrome-/HTTP-/RSC-Smokes für Produktion und tokenlosen Dev-Launcher sowie echte saubere frozen-Neuinstallation ohne Nutzer-Workspace mit bytegleichem Lock und erfolgreichen relevanten nativen Builds. Diese breiten Prüfungen wurden ausdrücklich nicht erneut ausgeführt. Der tatsächliche Docker-/Node-24-Start und echte FTP-Geräte sind weiterhin keine belegten Prüfungen; der Patch behauptet sie nicht.
- SHA256 aller 11 Quelldateien vor und nach der eigenen Prüfung einzeln verglichen: **11/11 bytegleich**. SHA256 des kanonischen JSON-Maps aus relativen Dateipfaden und ihren SHA256-Werten (`sort_keys=True`, `separators=(',',':')`) vor/nach jeweils `5a08f02b7bbbbf781b76ca011e220d2e7d0f22965a58ca44b8f0f73d2ce313fd`. Produktdateien, Lockfile und Payload unverändert; ausschließlich diese Reviewdatei hinzugefügt.

## VERDICT

PASS — **0 CRITICAL, 0 WARN, 1 INFO**. Installer-/Hookvertrag, gepatchter tatsächlicher Graph, fokussierte ReDoS-/Prisma-Kompatibilität und Erhalt expliziter Buildverbote sind im abgegrenzten Delta belegt. Der PASV-Kompatibilitätshinweis ist beratend; er rechtfertigt keine globale Lockerung der neuen Bibliotheksgrenze.
