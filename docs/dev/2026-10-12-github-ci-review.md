# GitHub/Linux-Abnahme und Veröffentlichung

Markus hat Push und GitHub-Veröffentlichung ausdrücklich genehmigt. [Vorabversion v2.0.0-rc.3](https://github.com/Codevena/ludotek/releases/tag/v2.0.0-rc.3) ist mit vollständig grüner CI und veröffentlichtem AMD64-/ARM64-Image abgeschlossen. Die folgenden früheren RC1-/RC2-Nachweise dokumentieren die kausalen Korrekturen; deren immutable Tags bleiben erhalten.

## Abschließende externe RC3-Abnahme und Veröffentlichung

- Source-/Tagziel: `c7b9b4ce29c686b484e101e5323512b96f7d7ef4`; remote peeled Tag `v2.0.0-rc.3` und veröffentlichte Releasefelder unabhängig geprüft. Release-ID 410521096, veröffentlicht am 12.10.2026 um 16:02:19 UTC, draft=false/prerelease=true. Stabile letzte Release weiterhin v1.2.0.
- [CI38270421347](https://github.com/Codevena/ludotek/actions/runs/38270421347) auf exakt diesem Source: correctness / verify, verify-image und build-and-push jeweils SUCCESS. Vollständige externe Suite 963/963 in 94 Dateien, 120,96s; Typ/Lint ebenfalls bestanden.
- Tatsächlich frisches natives AMD64-Image gebaut und isolierten Container-Smoke ausgeführt: UID1000, eigener Legacy-Upgrade, Auth/Origin, LOCAL-Wurzelschutz, Scan/Profile/Savebackup, persistenter Neustart, Restore/Apply/Undo. Original-Joblog bestätigt `PASS Docker`; private Produktrechte bleiben unverändert.
- OCI-Index `ghcr.io/codevena/ludotek:2.0.0-rc.3`, Digest `sha256:00f71d955e007b1f8e8aa77f66f741192a94e5a931bd0ef7c94d9088a06b6f99` daemonlos abgefragt: linux/amd64 (`62bc44b9…`) und linux/arm64 (`8dc82366…`); zwei unknown/unknown-Einträge explizit als Attestationen gekennzeichnet. Publisher setzt nur `2.0.0-rc.3` und `c7b9b4c`, Revision exaktc7b9b4c; kein latest-/major-/minor-Tag.
- ARM64-Laufzeit vorher lokal abgenommen; der veröffentlichte ARM64-Build erhält keinen zusätzlichen Runtime-Smoke. Reale Hardware/Nutzerbibliotheken weiterhin ungeprüft. Kein Main-Merge/Live-App-Deploy; main unverändert7dc14cee. Eigene lokale Testobjekte entfernt, Docker Desktop gestoppt; Nutzercheckout und Bestandsimages/-Volumes bewahrt.

## Erste externe RC1-Abnahme

Branch und immutable Tagv2.0.0-rc.1 wurden aufd046efe gepusht; Release damals nur als eigener Draft. Erster CI-Lauf38241346849 scheiterte mit945/955 Tests, Containerprüfung/Publisher wurden übersprungen. RC1-Tag bleibt unverändert; anschließend korrigierter Kandidat2.0.0-rc.2.

## Kausale Controller-Nachweise

- Unveränderte Provider-Races mit zwei Tokio-Threads reproduzieren native SQLite-BEGIN-Blockade und nachfolgenden Test-Sperren. Tatsächliche zwei Clients mit Pool1:4 Erlaubnisse/1 korrekte429 sowie acht Warteslots; Root selbst24ms. Root/Reviewer zählen tatsächliche Ergebnisse, nicht allein Exit0 des Diagnoseprogramms.
- App-SQLite-Pool auf1 und Produktionssingleton; DB-Pfad und andere Parameter erhalten. Datenbanktransaktionen/Budget-/Owner-/Expiry-Regeln und Produktfristen bleiben unverändert; keine Queue-/Retry-/Lock-Fallbacklogik.
- Linux-Wire-baseline: owned SFTP-mkdir überschreitet5s. Server-TCP_NODELAY allein reicht nicht; tatsächlicher Client-Preload auf unverändertem Produkt macht mkdir135ms und Rename/Undo628ms grün. Produkt setzt nun die dokumentierte Socketoption nach ready/vor Factoryresolve; gleiche Assertions/Fristen.
- Funktionaler Legacytest startet16 echte Prisma-CLI-Prozesse. Linux-CI überschritt20s, isolierte Linuxprobe8,49s. Testdeckel60s; alle Schema-/Backup-/Credentialassertions gleich, Produktfristen unverändert.
- Voller Linuxlauf fand den CPU-iterationsabhängigen Fake-Timer-Testhelper:10k setImmediate-Schritte können vor echtem SQLite-I/O ablaufen. Isolierter Fall53ms grün, Gesamtlauf drei Pollfehler plus Spätaufrufkaskade. Testhelper wartet auf native I/O mit1ms und2s-Monotoniegrenze; Produkttimer bleiben gefakt, sämtliche Assertions unverändert. Fehlender Script-Bind im eigenen Debugharness separat korrigiert, kein Produktfehler.
- Eigener lokaler Linux-Node22-Container mit2 CPUs/Tokio2, readonly Source-Binds und ausschließlich temporärer SQLite/FS: finale vollständige Suite963/963 in94 Dateien,141,06s, Exit0. Debugimage nutzte wegen blockiertem Binärdownload vorhandenen generierten Client und direkt vom offiziellen, commitgepinnnten Prisma-Endpunkt geladenen Linux-Schemaengine; Produktionsinstaller und CI benutzen weiterhin den unveränderten frozen-Lock/normalen Installer.

Damals geprüfter Delta-Source14 Dateien/SHA256`46d82c65a07decfd8078f38879e3054c872bd4d7945175c3a41364060c0876b9`, Basisd046efe. Ausgeschlossen nur generierte Reviewnachweise und Handoff. Finale Mac-Suite mit Tokio2:963/963 in94 Dateien,48,48s, Exit0; Typprüfung und Lint ebenfalls Exit0. Unveränderter Source nach diesen Gates bestätigt. Die anschließenden externen RC2- und erfolgreichen RC3-Gates sind gesondert in diesem Bericht dokumentiert.

## Externe RC2-Abnahme und kleiner Smoke-Delta

CI38268919901 auf2905c04 bestätigt correctness einschließlich vollständiger Suite/Typ/Lint. Das frische AMD64-Image baut und die App absolviert Scan/Save/Neustart/Restore bis zum erfolgreichen Apply. Danach scheitert allein der Host-Testzugriff mit EACCES: korrekte private Dateien gehören UID1000, GitHub-Runner hatUID1001; auch Hostcleanup kann0700-Backupordner nicht betreten. Publisher bleibt übersprungen, Release weiter Draft.

Korrigierter RC3-Smoke liest die neue Save-Datei per dockerexec als App-UID1000 und bereinigt ausschließlich die drei bekannten Unterbäume seines eigenen mkdtemp-Binds über einen begrenzten, kurzlebigen Cleanup-Prozess. Produktrechte/UID/Speichercode unverändert. Syntaxprüfung/gezieltes ESLint/Diffcheck grün; keine neue Appänderung, keine Wiederholung bereits bestandener Produktsuites erforderlich. RC1/RC2-Tags bleiben immutable, neue Veröffentlichungsversion2.0.0-rc.3.

## Vollständige unabhängige Berichte (PRE R1, POST R1, POST R2)

# CI SQLite pool delta — PRE round 1

## Scope

Independent executable review of `docs/dev/2026-10-12-github-ci-plan.md:7–8,14,19` before product mutation. Reviewed the SQLite URL/pool and production-client singleton proposal, the isolated database fixture, and the unchanged admission transaction/race contracts. SSH fixture timing, Legacy CLI timeout, publishing, and the complete Linux gate are controller-owned and outside this verdict.

Applied the active AGENTS risk/severity policy and `review-gates` PRE mechanics. `CLAUDE.md` is absent in this worktree; no private Brain context was read. No product file, test assertion, stage, commit, push, or production database was changed by this review.

## FINDINGS

Keine CRITICAL- oder WARN-Befunde. The plan is executable within its stated ownership and boundaries:

- `src/lib/prisma.ts:5–7` currently creates the application client in one module and only caches it outside production. Writing that same client to `globalThis` in production provides one client per process without introducing an admission/authorization fallback or cross-process state claim.
- `src/lib/local-paths.ts:54–60` derives the protected database filename from the environment URL's literal `file:` prefix and pre-query path. Preserving that path while adjusting only the connection-limit query parameter keeps this protected-path contract aligned; non-SQLite URLs must remain unchanged as the plan requires.
- `src/lib/job-admission.ts:46–62` obtains the durable SQLite writer lock before reading/updating admission state and preserves the owner, expiry, monotone clock, and fail-closed behavior. The proposed pool setting changes connection scheduling rather than these rules.
- `__tests__/helpers/temp-database.ts` owns a migrated temporary SQLite file and supplies its URL to genuine second clients. Applying the same URL contract to that fixture retains cross-client contention; it does not collapse the tests to one mocked client or reduce the five concurrent reservations/eight waiters.

The required POST/final gates already cover URL preservation, existing-parameter override, production singleton, and unchanged owner/provider assertions. Implementation details that emerge while coding are not blocking PRE findings.

## EVIDENCE

Read the exact plan, application Prisma construction, local-path URL handling, isolated fixture, `AdmissionStore` transaction/reservation/waiter code, and the existing provider-budget/job-admission tests. Read the installed `package.json`: Prisma and `@prisma/client` are both `6.19.3`.

Executed the existing `.review/ci-sqlite-probe.ts` independently against only its migrated temporary databases on this host:

1. `TOKIO_WORKER_THREADS=2 node_modules/.bin/tsx .review/ci-sqlite-probe.ts '?connection_limit=1'` — exit 0. Two distinct Prisma clients; five transaction callbacks, zero raw transaction errors; four allowed provider reservations and one `Provider short-term rate exhausted` denial after 83 ms. All eight waiters allowed; total elapsed 124 ms. The inspected unchanged `reserveProvider` maps this denial to status 429.
2. `TOKIO_WORKER_THREADS=2 node_modules/.bin/tsx .review/ci-sqlite-probe.ts` — exit 0 from the diagnostic script, with causal error output. Five reservations all rejected as `Admission store unavailable` after 10,485 ms; raw P1008/P2028 errors. Seven of eight waiter requests then rejected; cumulative 12 raw transaction errors, total elapsed 26,092 ms. Thus the probe's exit status alone is not a passing test; its measured assertions distinguish the two URL variants.

The two commands differ only in the URL suffix. These observations reproduce the pool-dependent starvation symptom and demonstrate that the proposed setting admits the exact intended concurrent claims. They do not independently prove native Rust scheduler internals or Linux completion; the controller's unchanged Linux/Tokio2 tests and subsequent POST remain required.

Confirmed immediately before writing this verdict that `git diff` for `src/lib/prisma.ts`, `src/lib/local-paths.ts`, `src/lib/job-admission.ts`, and `__tests__/helpers/temp-database.ts` was empty.

## VERDICT

PASS — 0 CRITICAL, 0 WARN, 0 INFO.

The concrete SQLite pool/singleton plan may proceed to implementation. This is a PRE verdict, not a completion or publication verdict.
# GitHub CI delta — independent executing POST round 1

Scope: only the complete 13-file `d046efe` delta in `.review/ci-payload.diff`, including the new files recorded by `.review/ci-files.json`. Source binding: `ea56f58f05294f615e6e0e4d9e0ebd9968bba7800765bfc39ce33e9d2b501a66`. Generated review/continuation state is explicitly omitted by the controller's payload builder. Applied the active AGENTS severity policy and `review-gates` POST mechanics.

## FINDINGS

Keine Befunde — 0 CRITICAL, 0 WARN, 0 INFO.

- The SQLite normalizer preserves the complete pre-query database path and all nonempty, unrelated query parameters literally. It removes all existing literal `connection_limit` parameters, appends one `connection_limit=1`, and leaves non-SQLite URLs unchanged. The application passes the normalized URL into Prisma without changing `process.env.DATABASE_URL`, preserving the protected-path code's view of the database.
- The application client is now stored on `globalThis` in production as well. The singleton is scoped to the process; no application lock, authorization decision, or provider budget is replaced with process-local state. Genuine independent clients remain in the race tests.
- The shared test fixture migrates its own temporary SQLite file with the same URL policy used by the application. The new real-client regression tests five simultaneous reservations across the production application client and another actual client, demands exactly four winners and one status-429 short-rate denial, and checks all three persisted counters equal four. Existing owner/expiry/restart/failure assertions remain unchanged.
- `connectSsh` calls the installed public `Client.setNoDelay(true)` API after `ready` and before resolving the connection factory. The corresponding server-side test fixture uses the installed `Connection.setNoDelay` implementation. These calls affect socket scheduling; SFTP operations, mutation/ownership checks, HTTP/authentication logic, retries, budgets, and product deadlines are unchanged. The added mock method matches the public API instead of relaxing assertions.
- Only the legacy baseline integration test's functional test ceiling changes from 20 to 60 seconds. The test still executes the fixed sixteen-migration baseline and preserves its schema, library, credentials, backup, and admission checks. This does not change a product deadline.

## EVIDENCE

- Read the immutable complete payload, file list, approved plan including its client/server TCP_NODELAY causal brief, actual Prisma URL/singleton source, connection factory, relevant tests, and installed ssh2 implementations/types. `node_modules/ssh2/lib/client.js:1635` and `lib/server.js:1326` delegate `setNoDelay` to the underlying socket and return the client/connection. The existing local launcher loads Next's environment implementation before launching the application.
- Ran `node .review/ci-payload.mjs --check` before reviewing and after all executed tests: both exit 0, 13 files, identical source SHA-256 shown above. This check rebuilds the current source-file binding; it does not merely checksum the saved payload.
- Ran `TOKIO_WORKER_THREADS=2 node_modules/.bin/vitest run __tests__/lib/sqlite-pool.test.ts __tests__/lib/sqlite-pool-race.test.ts __tests__/lib/provider-budget.test.ts __tests__/lib/job-admission.test.ts __tests__/lib/connection-listing.test.ts --maxWorkers=1`: exit 0, five files passed, **40/40 tests passed**, duration 2.48 seconds. Includes seven pool/default/singleton unit cases, the genuine production-plus-second-client race, and unchanged provider/job owner and fail-closed cases.
- Ran `TOKIO_WORKER_THREADS=2 node_modules/.bin/vitest run __tests__/lib/sftp-wire.test.ts __tests__/lib/remote-file-plans.test.ts -t 'creates one owned nonrecursive directory|renames an actual sftp file through quarantine' --maxWorkers=1 --reporter=verbose`: exit 0, two selected actual SSH/SFTP tests passed, 51 intentionally unselected tests skipped. Owned directory create/remove took **143 ms**; SFTP quarantine rename plus exact-byte Undo took **474 ms**. Original assertions and test deadlines were retained. Total command duration 1.91 seconds.
- Inspected `.review/linux-both-nodelay-probe.log`: the controller's pre-implementation Linux probe reports the same two selected cases passed in 135 ms and 628 ms. This is supporting controller evidence, not an independently executed Linux suite in this review.
- Confirmed no delta from `d046efe` in `src/lib/job-admission.ts`, `src/lib/provider-budget.ts`, or `src/lib/local-paths.ts`.
- The first selected-test command was rejected before start by the Bash guard because free space was below its 8-GB threshold. After controller-owned disposable cleanup, `df -h /` reported 8.2 GiB free. The identical command then ran normally and passed; no guard bypass or reviewer cleanup occurred.
- No product edits, staging, commits, push, Docker invocation, full suite/build/lint, private Brain access, user database access, or live provider calls were performed by this reviewer. Full Linux/local/static gates, legacy integration duration, and publication remain controller-owned completion conditions.

## VERDICT

PASS — 0 CRITICAL, 0 WARN, 0 INFO.

This verdict covers the reviewed and executed CI delta at the bound source state. It does not claim completion of the controller's full Linux/static gates or authorize publication independently of the user's existing authorization.
# GitHub CI delta — independent executing POST round 2

Delta-only review of `__tests__/lib/provider-budget.test.ts` against the passed round-1 state. Complete current candidate: 14 files, source binding `46d82c65a07decfd8078f38879e3054c872bd4d7945175c3a41364060c0876b9`. The round-1 report is preserved; previously passed areas were not re-reviewed.

## FINDINGS

Keine Befunde — 0 CRITICAL, 0 WARN, 0 INFO.

The changed helper waits for real fixture SQLite I/O using imported native `node:timers/promises` polling, while the existing provider delays remain on explicitly selected fake timers. Imported `node:perf_hooks` performance supplies a real monotonic two-second settling bound. This replaces a CPU/load-dependent iteration count with a bounded I/O settling window and follows the existing native-I/O polling approach in `provider-dispatch.test.ts`.

The exact delta contains only these imports and the helper body. All provider assertions, clock values, fake-timer selections/advancements, request counts, budget limits, owner checks, and product files are unchanged. Successful settling still requires the original predicate; no result assertion or admission failure is suppressed.

## EVIDENCE

- Ran `node .review/ci-payload.mjs --check` before and after selected execution: exit 0, 14 files, source binding `46d82c65a07decfd8078f38879e3054c872bd4d7945175c3a41364060c0876b9`.
- Independently recomputed the current per-file SHA-256 tree over the 13 paths after excluding only the added review subject `__tests__/lib/provider-budget.test.ts`. Result: 13 files, `ea56f58f05294f615e6e0e4d9e0ebd9968bba7800765bfc39ce33e9d2b501a66`, exactly matching round 1. The already passed files are byte-unchanged.
- Read the exact provider-test delta from the complete payload and verified `git diff d046efe -- __tests__/lib/provider-budget.test.ts` contains only the native-I/O helper change. Read the existing `provider-dispatch.test.ts` polling pattern.
- Ran `TOKIO_WORKER_THREADS=2 node_modules/.bin/vitest run __tests__/lib/provider-budget.test.ts --maxWorkers=1 --reporter=verbose`: exit 0, **14/14 tests passed**, duration 1.22 seconds. The three fake-clock cases involved in the Linux settling failures passed in 11 ms, 8 ms, and 4 ms; the lease-loss zero-dispatch assertion also passed. No unhandled error was reported.
- Read controller evidence `.review/linux-full-rc2.log`: the prior full run shows three primary `SQLite work did not settle` failures in the old iteration-based helper, a later unexpected-call failure, and related unhandled rejections. Read `.review/linux-provider-settle-baseline.log`: the isolated original short-rate/abort case passed in 53 ms. These observations support a load-sensitive settling harness; this review does not substitute its focused execution for the controller's final Linux run.
- No product mutation, staging, commit, push, Docker invocation, full suite/build/lint, user database, private Brain, or live provider access occurred. The controller's test-container script bind is generated harness state outside the product payload.

## VERDICT

PASS — 0 CRITICAL, 0 WARN, 0 INFO.

The one-file test-only delta passes the focused executing POST. The controller's final full Linux/Mac/static gates and external publication checks remain separate completion conditions.
