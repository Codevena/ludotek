# Remote-Dateiaktionen und Release: Nachweise

Basis `fa21ea6`, isolierter Branch `codex/ludotek-remote-release`. Private lokale/LAN-Nutzung; normales FTP gemäß ausdrücklich gewählter Hash-/Quarantänegrenze. Keine Veröffentlichung. Dieser Bericht enthält konkrete Ergebnisse, keine vorweggenommene Gesamtabnahme.

## PRE R1: vollständiger unabhängiger Report

## FINDINGS

CRITICAL: 0. WARN: 0.

INFO RPRE-1 — `src/lib/upload-journal.ts:236`, `:320`, `:349`; `src/lib/device-profile-sync.ts:168`, `:192`, `:245`: these consumers repeat their own strict capability/known-space checks outside the common journal. Runtime-contract item 5 and the assigned consumer ownership correctly cover them; update all repeated checks, including the checks after conversion/descriptor expansion, to use the same truthful checked-FTP policy. This is implementation guidance, not a missing planned requirement.

INFO RPRE-2 — `src/components/file-plan-panel.tsx` final ownership notice currently says foreign changes stop recovery. Runtime-contract item 5 correctly requires normal UI visibility; make the checked-FTP notice expressly state that equal-content foreign replacements cannot be distinguished and that Undo assumes no concurrent external writer. Keep the stronger LOCAL/SFTP ownership promise scoped to those transports. This is an implementation detail already covered by the planned warning.

No blocking contradiction was found. Ordinary FTP is evaluated under the expressly approved content checks/quarantine/no-concurrent-external-writer/power-loss boundary, rather than an impossible atomic no-replace/native-fsync contract. Strict methods must remain unsupported for FTP; the planned separately named checked methods are the executable route.

## EVIDENCE

Reviewed base: `git rev-parse HEAD` returned `fa21ea6015d63bda784fb00fbf9376d011dd66c7`. Initial `git status --short` was empty. Review scope: `docs/dev/2026-10-12-remote-release-plan.md`, exact FileIo/connection methods, file/directory plan validation/staging/publication/recovery, upload/profile/save consumers, the file-plan routes and panel, Dockerfile/context exclusions and the existing publish workflow. `CLAUDE.md` was absent, so no project-command claims were inferred from that document. No Brain, user database, private environment contents, device, provider, LAN, Docker, browser, build or full suite was used.

Static code findings supporting the planned approach:

- `src/lib/file-io.ts` currently refuses every SFTP/FTP mutation, while bounded reads already exist; `src/lib/file-plans.ts:405`, `:538`, `:679`, `:933` currently impose strict mutation capabilities on all devices, including copy-only sources. Operation-specific requirements address an actual cause of the regression.
- File-plan metadata and descriptor fingerprints currently require native identity. The plan expressly carries weaker source/FTP strength through stored specs and graph snapshots rather than converting missing identities into invented strict evidence.
- Recovery currently adopts strict targets by the durably recorded staged identity (`file-plans.ts:814–870`). Checked FTP cannot reuse this ownership inference from a hash alone; the plan explicitly requires acknowledgement records and leaves lost/unrecorded public effects as conflicts.
- File-plan POST/apply/undo/reconcile routes require authentication before calling journal code. Journals acquire the shared device-files/files:id leases before opening connections and fence journal/manifest transactions by active ownership. The plan preserves these interfaces and requires zero side effects on admission denial.
- Installed `ssh2` is 1.17.0. Its documented OPEN/FSTAT and negotiated `ext_openssh_fsync`/`ext_openssh_hardlink` APIs exist. A READ OPEN file handle is distinct from OPENDIR, matching the planned Linux directory-fsync route. The PRE probe verifies client packet construction only; real OpenSSH/filesystem support remains the explicitly required implementation/wire acceptance gate.
- Installed `basic-ftp` is 6.2.1. RNFR/RNTO has no no-replace argument; `ensureDir` ignores MKD errors and `removeDir` recursively clears contents. The plan correctly excludes these convenience methods for private workspace ownership and empty-only cleanup. MLSD uniqueID is optional and is evidence with weaker validity, not a native durable identity.
- Current Docker context exclusions omit several private/cache/data classes. Plan line 36 explicitly replaces this with a positively selected clean context and isolated own fixtures; current workflow publication behavior is not authorized for execution by this task.

Executed commands and results (all from the isolated worktree):

1. `pnpm exec vitest run __tests__/lib/file-io.test.ts -t 'keeps SSH extension|rejects FTP mutation|preserves a native replacement|preserves the original source|drains FTP streams|closes stalled FTP|uses an actual successful SFTP statvfs'` — could not run through pnpm: `ERR_PNPM_UNSAFE_MODULES_DIR` because this worktree links the existing modules directory. No install/reset workaround was attempted. The same selected tests were then executed directly.
2. `node node_modules/vitest/vitest.mjs run __tests__/lib/file-io.test.ts -t 'keeps SSH extension|rejects FTP mutation|preserves a native replacement|preserves the original source|drains FTP streams|closes stalled FTP|uses an actual successful SFTP statvfs'` — PASS, 7 passed / 19 skipped; confirms current remote refusals, actual statvfs handling, drain/deadline behavior and LOCAL foreign-entry preservation.
3. `node node_modules/vitest/vitest.mjs run __tests__/lib/file-plans.test.ts -t 'refuses undo/reconcile ownership of an identical foreign replacement|fences a journal write when another real SQLite client'` — PASS, 2 passed / 27 skipped. Fixture helper creates/migrates a unique temporary SQLite database and explicitly replaces DATABASE_URL. The identical-content/same-visible-mtime replacement remains a conflict; stolen lease leaves publication intent without a false manifest commit.
4. `node node_modules/vitest/vitest.mjs run __tests__/lib/file-plan-descriptor-snapshot.test.ts -t 'rejects a same-inode/same-size/fixed-mtime edit|rejects a formerly unselected descriptor'` — PASS, 2 passed / 3 skipped, on a unique owned SQLite/files fixture; byte-exact descriptor and whole-graph preconditions reject the stated counterexamples before temp writes.
5. `node .review/remote-pre-probes.mjs` — PASS. Installed ssh2 constructs READ OPEN, FSTAT, handle FSYNC and negotiated hardlink requests; missing hardlink sends zero packets. Installed basic-ftp emits exactly RNFR/RNTO; raw MKD collision propagates; MLSD unique is present only when supplied. Synthetic client transport capture only, no network connection or server-side effect.

PRE evidence establishes executable APIs and existing invariant baselines, not completed remote support. Successful real wire transfers, acknowledgement-loss/store-failure conflicts, unknown-space/zero-reserve behavior, UI visibility and the single authorized Docker runtime test remain required by the plan's final implementation gates.

## VERDICT

PASS — 0 CRITICAL, 0 WARN. Proceed with implementation under the approved ordinary-FTP boundary and the existing strict LOCAL/SFTP invariants. No publishing, pushing, tagging, merging, real user data or external-provider operation is authorized by this verdict.

## Findings-Mapping

- RPRE-1 INFO: gemeinsame Capability-/Platzprüfung für Upload und Profile; Umsetzung und finale Tests noch in Arbeit.
- RPRE-2 INFO: normale FTP-Vorschau zeigt Grenze bei gleichen Fremdbytes und parallelen Schreibern; Umsetzung und Browserprüfung noch in Arbeit.

## Finale Abnahme

Root verifiziert am eingefrorenen ersten Kandidaten32 Dateien/SHA25642819185236f3b64eb228f1a6be5fc40ff236560ba88976baede4a0126f573b2:953/953 Tests in92 Dateien, Typ/Lint, frischer ARM64-Produktionscontainer mit42 erzeugten Seiten sowie tatsächlicher Linux/OpenSSH-, Docker-/Chrome-Smoke. Container UID1000, eigene Legacy-Migration, Auth/Origin/Rootgrenzen, Scan/Profile/Savebackup, persistenter Neustart, Restore/Apply/Undo bestehen. Echter Chrome auf Desktop und390px prüft gespeicherte FTP-Warnung und tatsächliche Wire-Apply-/Undo-Dateieffekte ohne Pageerrors oder Überlauf. Noch kein Push, externes CI oder reale Nutzerbibliothek.

POST R1 bestätigt einen WARN: gewöhnliche ROM-Dateipläne ignorieren die eingestellte Zielreserve. Root reproduziert denselben Fehler mit tatsächlichen3 Remote-Mutationen an eigener SQLite/FTP-Fixture. Minimaler Reservefix und finale Deltaabnahme folgen; erster Kandidat wird ausdrücklich nicht committed.

## POST R1: vollständiger unabhängiger Report

## FINDINGS

- **WARN R1-W1 — Ordinary ROM file plans ignore a configured target storage reserve.** `src/lib/file-plans.ts:570` queries the target profile only in `save`/`upload` scope and substitutes reserve0 for ordinary File Manager copy/move/rename operations. An actual LOCAL→FTP copy with `DeviceProfile.reserveBytes=1` and unknown FTP capacity produces a ready preview, performs MKD/STOR/RNTO and finishes applied, although the same adapter passed directly to `assertFilePlanSpace(..., 1n, "ftp")` correctly rejects with `SPACE_UNKNOWN`. This violates the approved requirement that an unprovable nonzero configured reserve refuse transfer and the public profile-reserve0 limitation. **Minimal fix:** read and enforce the target profile reserve for ordinary ROM transfer plans as well, and add a focused actual-wire regression proving refusal before mutation.

No CRITICAL findings. The approved equal-content foreign-replacement, concurrent-external-writer and power-loss FTP limitations are intentional, visible limitations rather than findings. No further WARN or speculative improvements were identified.

## EVIDENCE

All commands below used `/Users/markus/.codex/worktrees/1b49/ludotek` as explicit working directory unless another directory is stated. No product file was edited, no staging/commit was performed, and no real device/user database/provider was contacted.

1. Read the complete immutable `.review/payload.diff` (3795 lines), `.review/source-files.json` (32 files), `.review/source.sha`, task plan/release/recovery documents, and narrow surrounding implementation paths. Ran `node .review/source-payload.mjs --check` both before execution and at review completion: **32 files; SHA256 42819185236f3b64eb228f1a6be5fc40ff236560ba88976baede4a0126f573b2**, matching the dispatched candidate. Exclusions were generated `.review`, `NEXT_SESSION.md` and the generated review document only. Repository `CLAUDE.md` was absent; no Brain/original-checkout/private-env access was attempted.

2. Ran `node /Users/markus/Developer/ludotek/node_modules/vitest/vitest.mjs run __tests__/lib/remote-file-plans.test.ts --maxWorkers=1`: **36/36 PASS**, one test file, 6.07s. Executed actual loopback FTP, trusted FTPS and SSH/SFTP adapters with own SQLite/FS fixtures, successful transfers/rename/delete/mkdir/Undo/profile/upload/save restore, read-only sources, same-size source/raw-descriptor edits, missing native metadata, root escapes, unknown reserve, quota failure, admission denial, lost public acknowledgement and SQLite receipt failure after actual publication.

3. Ran `node /Users/markus/Developer/ludotek/node_modules/vitest/vitest.mjs run __tests__/lib/ftp-wire.test.ts __tests__/lib/sftp-wire.test.ts --maxWorkers=1`: **39/39 PASS**, two test files, 1.42s. Covered truthful strict-vs-checked capabilities, verified TLS, raw MKD reservation collision, quota/partial transfer, lost STOR/RNTO/MKD/RMD replies, no-known-overwrite, explicit permitted RNTO race, native replacement after hardlink, missing/failed extensions, nonrecursive directory removal, namespace and symlink guards, bounded streams, real abort/drain and a fake timeout.

4. Decisive R1-W1 reproduction: `node /Users/markus/Developer/ludotek/node_modules/tsx/dist/cli.mjs --tsconfig /Users/markus/.codex/worktrees/1b49/ludotek/tsconfig.json /tmp/ludotek-post-review.LdH4Py/probe.ts`. This isolated probe creates/removes its own migrated SQLite, LOCAL directory and loopback FTP server; it creates an FTP target profile with reserve1, proves direct reserve refusal, then calls the real ordinary `createFilePlan`/`applyFilePlan`. **Exit0; measured output:** `Direct reserve gate: SPACE_UNKNOWN` and `{"configuredReserve":"1","plan":"ready","result":"applied","remoteBytes":"OWN","mutations":3}`. The source fixture remained content-bound, and this result is independent of protocol-named LOCAL doubles.

5. Critical false-green check, solely in an owned temporary source COPY at `/tmp/ludotek-post-review.LdH4Py/mutation`: copied source, relevant test/helpers, Prisma migrations and configs; no env/data/build directory. Removed only the catch-path reload of committed journal specifications (`src/lib/file-plans.ts`, original lines1054–1055), reproducing unsafe reliance on the in-memory publication receipt after its SQLite update fails. Ran `node /Users/markus/Developer/ludotek/node_modules/vitest/vitest.mjs run __tests__/lib/remote-file-plans.test.ts --maxWorkers=1 --testNamePattern 'does not adopt FTP publication when SQLite rejects the receipt'` from that COPY. **Exit1; one targeted test failed, 35 skipped, 2.28s**, specifically `expected status recovery_needed; received ready` at test line192. The unchanged candidate's same test was green in item2. The live source hash stayed unchanged. This demonstrates that the durable-receipt regression oracle detects the unsafe recovery behavior.

6. Read-only corroboration of root-orchestrated gates: `.review/full-test-final2.log` records **953/953 PASS in92 files**; `.review/openssh-smoke-final-r3.log` records actual Linux/OpenSSH capability, stream, native-replacement, directory and root-escape PASS; `.review/docker-runtime-final.log` records actual Chrome desktop/390px persisted FTP warning, wire Apply/Undo, no page errors/overflow and Docker UID1000, own legacy upgrade, auth/origin/root guard, scan/profile/save, persistent restart, restore/apply/Undo PASS. Independently inspected Docker positive build projection, nonroot entrypoint, reusable correctness workflow and publisher prerequisite, and matched release upgrade/rollback claims against the existing checked upgrade procedure.

Could-not-run / deliberately outside reviewer scope: full suite, build, lint/typecheck, browser and Docker were not rerun by this reviewer because the controller owns their serial orchestration. Root evidence is explicitly corroboration, not independently executed acceptance. Hardware, productive libraries, externally executed GitHub CI, push/tag/publication and user-data migration remain outside this local review.

## VERDICT

**FAIL — 0 CRITICAL, 1 WARN, 0 INFO.** R1-W1 must be fixed and verified on a refreshed immutable candidate. Subsequent review is delta-only; the approved weaker FTP policy and the passed areas above need not be re-litigated. The live product source was unchanged throughout this review.

## R1-Mapping und Folgedelta

- R1-W1 WARN reproduziert und geschlossen. Zielprofilreserve wird für normale ROM-Dateipläne ebenfalls geprüft; derselbe Guard gilt für den36-Byte-Marker von checked-FTP mkdir. Native mkdir/Undo erhalten keinen neuen Platzvertrag. Zwei echte Wire-Regressionen kausal RED/GREEN, POST R2 PASS.
- PRE RPRE-1 INFO umgesetzt: gemeinsame Mutation-/Platzprüfung in Upload und Profile, tatsächliche Consumer-Wire-Fälle bestanden. RPRE-2 INFO umgesetzt: gespeicherte Stärke/normal sichtbare FTP-Warnung, actualChrome-Apply/Undo geprüft.
- Wirkliche OpenSSH-Abweichung kausal reproduziert: fehlendes LSTAT liefert2, REALPATH trotzdem einen Pfad, GNU realpath-e scheitert. Fehlende Ziele prüfen jetzt den vorhandenen Elternnamensraum; bestehende Ziele behalten vollständige native/SFTP-Übereinstimmung. Wire-RED/GREEN und echte Linux-GREEN-Abnahme; keine gelockerte Besitzprüfung.

## POST R2: vollständiger unabhängiger Report

## FINDINGS

Keine neuen CRITICAL/WARN/INFO-Befunde. **R1-W1 ist behoben:** `src/lib/file-plans.ts:570` lädt die Zielprofilreserve jetzt für jeden Transfer-Scope. Gewöhnliche ROM-Dateipläne können damit die positive FTP-Reserve nicht mehr durch implizite reserve0 umgehen. Der direkte Folgepfad für den 36-Byte-Beleg eines checked-FTP-mkdir prüft dieselbe Reserve vor Vorschau und Apply; native mkdir und Undo/Reconcile erhalten dadurch keine zusätzliche Platzvorbedingung.

Die neue Abnahmeformulierung nennt die lokal geprüfte ARM64-Laufzeit und schließt reale Gerätebestände, AMD64-Laufzeit und externe GitHub-CI ausdrücklich aus. Die in R1 geprüften und genehmigten FTP-Grenzen wurden nicht neu verhandelt.

## EVIDENCE

Alle folgenden Befehle wurden mit dem expliziten Workdir `/Users/markus/.codex/worktrees/1b49/ludotek` ausgeführt. Prüfung ausschließlich des Finding-Deltas und seiner direkten Folgen; keine Produktänderung, kein Staging/Commit und kein Zugriff auf echte Geräte, Benutzerdaten, private Umgebungsdateien oder Brain.

1. `diff -u .review/payload-r1.diff .review/payload.diff` gelesen: Runtime-Delta ausschließlich Zielprofilreserve in `checkSpace` sowie checked-FTP-Verzeichnisbeleg-Platzprüfung in `file-plans-directory.ts`; dazu zwei reale Wire-Regressionen und präzisierte Release-Abnahme. Vollständiger R1-Payload und R1-Befund bleiben in ihren eigenen Artefakten erhalten.

2. `node .review/source-payload.mjs --check` vor und nach Ausführung: **32 Dateien; SHA256 c62ac413c3f80656d785660ec7ecfe69ea8d7e3fa880bdb01d30181936443381**, exakt der zur R2-Prüfung übergebene unveränderte Kandidat.

3. `node /Users/markus/Developer/ludotek/node_modules/vitest/vitest.mjs run __tests__/lib/remote-file-plans.test.ts --maxWorkers=1`: **38/38 PASS, eine Datei, 6.28s**. Die beiden neuen kausalen Prüfungen erstellen eigene SQLite-Profile mit reserve1 und tatsächliche Loopback-FTP-Verbindungen: gewöhnliche ROM-Kopie und checked-mkdir verweigern unbekannten Zielplatz vor jedem MKD/STOR/RNTO, behalten die Quelldaten und lassen das Zielverzeichnis leer. Bestehende reserve0-Transfers, Verzeichniserstellung und Undo sowie die betroffenen Upload-/Profile-/Save-Verbraucher bleiben grün.

4. Ursprüngliche unabhängige R1-Reproduktion erneut ausgeführt: `node /Users/markus/Developer/ludotek/node_modules/tsx/dist/cli.mjs --tsconfig /Users/markus/.codex/worktrees/1b49/ludotek/tsconfig.json /tmp/ludotek-post-review.LdH4Py/probe.ts`. **Exit1 mit der jetzt erwarteten fachlichen Verweigerung:** zuerst direkte `SPACE_UNKNOWN`-Prüfung, danach `FilePlanError`, `status:422`, `code:SPACE_UNKNOWN`, `Target space is unknown; a nonzero reserve cannot be proven`, über `assertFilePlanSpace → checkSpace → createFilePlan`. R1 hatte mit demselben Probe-Code noch `ready → applied`, fremd nicht vorhandene Zieldatei `OWN` und drei Remote-Mutationen gemessen. Die neue Testausführung aus Punkt3 prüft zusätzlich ausdrücklich null Mutationen, unabhängig vom Probe-Fehlertext.

5. Schmale Quellprüfung der direkten Folgen: jede Transfer-Platzprüfung verwendet weiterhin den unveränderten gemeinsamen `assertFilePlanSpace`; die native Known-Space-Prüfung behält `bytes+reserve`, unbekanntes FTP bleibt ausschließlich bei reserve0 zulässig. checked-mkdir übergibt während Vorschau36 und während Apply die gespeicherte UUID-Beleglänge; der Guard liegt vor Claim und MKD. Undo/Reconcile übergeben keine Beleg-Platzanforderung, und der native Capability-Zweig ignoriert sie. Konfigurationssnapshot und Besitzer-/Recovery-Grenzen bleiben unverändert.

6. Nur als Controller-Korroboration gelesen: `.review/full-test-final3.log` meldet **955/955 PASS in92 Dateien**. TSC/Lint wurden vom Controller als PASS berichtet. Der abschließende Docker-Neubau/Runtime-Test auf dem korrigierten Source war bei Review-Übergabe noch Controller-Arbeit; dieser Bericht behauptet dazu keinen eigenen Abschluss.

Could-not-run / außerhalb des Review-Auftrags: kein Vollsuite-/Build-/Lint-/Typecheck-/Browser-/Docker-Lauf durch den Reviewer, um die serielle Controller-Orchestrierung einzuhalten. Frühere R1-Gates bleiben als damalige Evidenz erhalten. Kein Hardware-, AMD64-, produktiver Daten- oder externer CI-Nachweis. Nach Speicherung dieses Berichts wurde ausschließlich der vom Reviewer angelegte temporäre Probe-/Mutationsbaum `/tmp/ludotek-post-review.LdH4Py` entfernt; R1/R2-Berichte und Payloads bleiben erhalten.

## VERDICT

**PASS — 0 CRITICAL, 0 WARN, 0 INFO.** R1-W1 ist reproduzierbar geschlossen; der unveränderte R2-Kandidat erfüllt das geprüfte Delta. Dieses unabhängige Review ersetzt keinen noch offenen finalen Controller-Docker-/Release-Gate und autorisiert keine Veröffentlichung.

## Endgültiger Controller-Gate

Unveränderter geänderter Sourcekandidat32 Dateien/SHA256`c62ac413c3f80656d785660ec7ecfe69ea8d7e3fa880bdb01d30181936443381`, Basis `fa21ea6`. Ausgenommen ausschließlich generierte Reviewnachweise und `NEXT_SESSION.md`; deren Inhalt ist keine Laufzeitquelle.

| Gate | Ausgeführtes Ergebnis |
|---|---|
| Vollständige Suite | `node .../vitest.mjs run --maxWorkers=2`:955/955 Tests in92 Dateien,53,74s, Exit0 |
| Typ/Lint | `tsc --noEmit --incremental false`; ESLint auf src/scripts und allen geänderten Tests, max-warnings0: Exit0 |
| Reale Protokolle | TCP/TLS FTP/FTPS und SSH/SFTP plus tatsächlicher Linux/OpenSSH-Container: Stream/Hash/No-Clobber/native Ersetzung/mkdir/Undo/Rootgrenzen bestanden |
| Fresh Dockerbuild | Positiver Kontext, eigener begrenzter Builder; Next-Produktion mit42 erzeugten Seiten. ARM64-Image SHA256`4d6133bdd0cf61e88971c1b20473121121b5fcb24df6ccb14a23b59c07d562f4` |
| Dockerlaufzeit | UID1000, eigene Legacy-Gerätedaten nach Migration erhalten, Auth/Origin/LOCAL-Root, tatsächlicher Scan/Profil/immutableSave, persistenter Neustart, Restore/Apply/Undo bestanden |
| Echter Chrome | Desktop1360 und390px; normale gespeicherte FTP-Warnung sichtbar, tatsächliche Wire-Apply-/Undo-Dateibytes, keine Pageerrors/Überläufe. Mobile Ansicht nach Layoutsettling als Viewportscreenshot visuell geprüft |
| Reserve über HTTP | Eigene FTP-Profilreserve1: Vorschau HTTP422 vor MKD/STOR/RNTO; reserve0: erfolgreiche Browser-Apply/Undo. Damit auch der korrigierte kompilierte Kandidat geprüft |
| Unabhängige Invariante | Eigene Kopie ohne Reload der dauerhaft committed Journalquittung wird durch Receipt-Storefehler-Test kausal rot; Original unverändert grün |
| CI/Sourcebindung | Beide YAMLs lokal geparst, correctness→verify-image→publisher-Abhängigkeit geprüft; Sourcehash vor/nach Rootlauf unverändert |

Kein reales Gerät, echte Nutzerbibliothek, Provider, externe GitHub-CI oder AMD64-Laufzeit geprüft. Kein Push/Tag/Release/Merge/Deploy. Lokal vorbereitet:2.0.0-rc.1, MIT, Protokollmatrix/Upgrade/Rollback sowie isolierte Smoke-Werkzeuge und CI-Vorbedingungen. Eigene Container/Testdaten/Browser, beide Testimages, Buildkitimage und isolierter Builder samt Cache/Statevolume geschlossen beziehungsweise entfernt; die ursprünglichen acht Images/Container/Volumes erhalten. Docker Desktop wieder im gestoppten Ausgangszustand. Kein weiterer Controller-Test offen; lokaler Commit wird im Handoff festgehalten.
