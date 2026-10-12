# Dateimanifest, Journal und sechs lokale Gerätefunktionen

## Finale Abnahme

Alle zwölf Auditbefunde und alle sechs beauftragten lokalen Funktionen sind im geprüften Kandidaten umgesetzt. Die letzten A-05/A-12 werden mit dem lokalen Fixes-Commit geschlossen. Private LOCAL-/Own-LAN-Nutzung und bestehende MIT-Lizenz bleiben der Maßstab.

- Finaler Sourcekandidat:143 Dateien, SHA256 `947873c5e1887d93d345dfe9ee7cead438b968390801a0b4c29d2d82ab718679`. Unveränderter letzter Lauf:878/878 Tests in89 Dateien, `pnpm exec tsc --noEmit`, `pnpm lint` und Diffprüfung PASS.
- Frischer isolierter Build mit identischem installiertem Next15:42 statische Seiten und vollständige neue API-Ausgabe einschließlich Standalone PASS. Appkopie und alle Schema-/Quellbytes gegen den finalen Baum geprüft; keine.env oder Nutzer-DB kopiert. Interner unveränderter Dependency-Hardlinkspiegel vermeidet pnpm-Neuinstallation/NFT-Ausbruch durch externe Modulsymlinks.
- Tatsächlicher Chromecheck auf Produktion und auf emittiertem Standalone jeweils PASS: Doctor, ROM-Profil/Vorschau/Apply/gepaarteBaseline, lokaler DAT-Import+Hashprüfung, immutable Savebackup/Restorevorschau/Apply/Undo exakter Bytes, persistente ROM-Rücknahme, globale Versionhistorie und LOCALUploadDetect/Process/Katalog/Manifest/Undo. Beide auch390px ohne horizontalen Überlauf und ohne Pageerrors. Screenshots tatsächlich angesehen.
- Nur die Intake-HTTP-Antwort war im Browser simuliert, damit kein allgemeiner Cleanup fremde reale Sessions durchsucht; dessen Streaming-/ZIP-/Platz-/Abbruchservice wurde mit eigenen tatsächlichen Dateien geprüft. LANantworten waren simuliert; reale Interfaces/Hosts, Credentials oder automatische Geräteanlage wurden nicht getestet/ausgelöst.
- Unabhängiger POST R1 fand1CRITICAL/2WARN, Root bestätigte den Byteverlust; konkreter Fix-PRE PASS, POST R2 PASS, letzter CSS-Delta-POST R3 PASS. Alle bestätigten Befunde geschlossen, keine offenen CRITICAL/WARN. Ausgeführte Gegenmutationen für Besitzer, Namespace, fremde Identität, Descriptorgraph, Quellenhash und erlaubte Profilwurzeln waren kausal rot und bytegenau restauriert.

| Beauftragte Funktion | Nachgewiesene lokale Abnahme |
| --- | --- |
| Sync Doctor | Vollständige/unvollständige read-only Inventare, native erlaubte Aliasse, persistenter Bericht und echte Geräteoberfläche |
| Profile und Zweiweg-ROM-Sync | Editierbare Vorlagen/Roots/Format/Reserve; echte Push/Pull/Zweiweg-Baselines, Konfliktentscheidung, gleiche Child-Pläne/Recovery; UI+Browser |
| Save-Versionen und Restore/Sync | Immutable Hashobjekte, Versionen ohne Cascade, persistentes Vorüberschreibungsbackup, echte Restore/Undo/Zweiweg-Fälle; globale Historie und UI |
| DAT-/Hash-Integrität | Beide Parserformate und alle Checksummen, begrenzter lokaler Import, persistenter Job/Abbruch/Owner-Fence, unbekannt versus erwartete Revision; echte Browserprüfung |
| Dateipläne/Journal/Undo | Tatsächliche Source-/Game-/Devicebindung, gesamte hashgebundene Descriptorgraphik, streams/Quarantäne/Kompensation/Crash-Recovery/Undo; Sync/Upload/Dateibrowser gemeinsam |
| LAN-Geräteerkennung | Explizite private NIC-Auswahl, feste SSH/FTP-Ports/Hosts/Fristen/Concurrency, Abbruch/Drain, kein Credentialversuch/Autoanlage; echte manuelle Formübernahme mit Netzwerkdoubles |

Reale SSH-/FTP-Schreibfähigkeiten, Container-/Volumerechte und Hardware bleiben ungeprüft. Dateipläne verlangen belegte Fähigkeiten und sind aktuell nur zwischen unterstützten LOCAL-Geräten ausführbar; unbekannte Remote-Garantien werden vor Mutation sichtbar abgelehnt. Keine globalen atomaren Dateisystem-/SQLite-Transaktionen, automatische Retention, Veröffentlichung, Providerkosten oder Nutzer-Datenmigration behauptet. Die CI ist lokal geparst und ihre Befehle lokal geprüft; sie wurde nicht extern veröffentlicht/ausgeführt.

## Vollständiges Reviewprotokoll

### Vollständiger unabhängiger POST R3

## FINDINGS

No CRITICAL or WARN finding in the CSS-only R3 delta.

The two existing declared-save-root paragraphs gain `break-all`. Their text, displayed paths, controls and request behavior are unchanged. The accepted R2 backend/alias/descriptor fixes and all other source sections remain byte-identical.

## EVIDENCE

- Read the complete immutable `.review/feature-r3-delta.diff`; SHA256 `6a198b1b3fafb085d2421fba72a6dd0a8f382bb5b80f00322fb8e504cb838b58`.
- Parsed saved R2 and R3 payload sections and compared all 143 sections. Exactly `src/components/device-saves.tsx` and `src/components/saved-versions.tsx` differ; the other 141 sections are byte-identical. In each changed section, replacing its single `text-xs text-vault-muted break-all` with the R2 class string restores the section byte-for-byte. This proves exactly two class additions, with no further behavior or backend changes. Saved the independent immutable comparison as `.review/post-r3-agent-comparison.diff`.
- Full R3 artifact is 1,081,992 bytes, SHA256 `947873c5e1887d93d345dfe9ee7cead438b968390801a0b4c29d2d82ab718679`.
- Ran `pnpm exec vitest run __tests__/lib/device-saves-ui.test.ts __tests__/lib/device-saves-global-ui.test.ts --maxWorkers=1` → exit 0, 7/7 affected Save UI tests in two files. These preserve the existing backup/restore/sync and retained-global-version interaction contracts; they do not claim measured CSS layout.
- Inspected the installed Tailwind implementation: `node_modules/tailwindcss/lib/corePlugins.js:2402` maps `.break-all` to `word-break: break-all`; the repository's configured content paths include both source components. The added utility allows unbroken native path tokens to wrap in the existing paragraph width.
- Actual 390px Chrome/render verification remains Root-owned; no duplicate browser/build/full-suite/lint was run by this reviewer. No live hardware/device/LAN/provider, user database/environment, product/test/Brain/index or other agent file was changed. No copied-source mutation is warranted for two reversible display-class additions. Accepted R2 areas were not re-opened.
- Final binding: `python3 .review/feature-payload.py --round=3 --check` → PASS reviewed tree, SHA256 `947873c5e1887d93d345dfe9ee7cead438b968390801a0b4c29d2d82ab718679`, run after writing this report.

## VERDICT

PASS

### Vollständiger unabhängiger POST R2

## FINDINGS

No CRITICAL or WARN finding in this R2 delta; the three confirmed R1 findings are resolved.

- FF-POST-R1-01 resolved: exact raw descriptor bytes now supply their captured SHA/size/identity/mtime; selected descriptors retain that fingerprint; the complete versioned graph and confirmed membership are verified before persistence and initial Apply writes. The original native-edit probe now rejects preview creation while preserving the edit and persisting no stale plan. Previously unselected/newly confirmed parents and missing legacy graphs are rejected before temporary writes. Undo/Reconcile continue to verify actual journaled effects and pass their focused regressions.
- FF-POST-R1-02 resolved: Doctor compares scanner-canonical paths with guarded canonical LOCAL roots. The original actual native-alias scan reports complete with zero unsafe findings.
- FF-POST-R1-03 resolved: LOCAL profile defaults, saved/raw profile reads, submitted paths and containment now agree on guarded canonical roots. Actual native-alias Save succeeds without device-row mutation; outside/protected paths and a wider operator root cannot widen the device's ROM roots.
- Header/Sidebar/operation-label delta: mobile-hidden Sidebar is paired with Header navigation to the global saved versions and former sidebar pages; existing header routes remain reachable, controls wrap, and directory/upload/save-restore operations have readable labels. No server mutation contract changes in these component deltas.

## EVIDENCE

- Immutable R2 source artifact: 143 files, 1,081,972 bytes, SHA256 `353aefe8ba7b0d2fc36cf616c9fec631f9bda2b5b14efc8bf7d503e73f40e31b`. Verified every section of `.review/feature-r2-delta.diff` exactly matches the corresponding saved R2 section. Its ten sections total 151,487 bytes, SHA256 `73521ca8deca3cbf1c15ab425d1e1eb30e0691882263b17831da7f6735d5b96c`. Parsed both immutable R1/R2 artifacts and read the complete bounded section-to-section comparison, saved as `.review/post-r2-agent-comparison.diff` (56,008 bytes), plus the relevant unchanged execution/consumer context. No git-diff reconstruction was substituted for the artifact.
- Ran `pnpm exec vitest run __tests__/lib/file-plan-descriptor-snapshot.test.ts __tests__/lib/local-profile-doctor-alias.test.ts __tests__/lib/file-plans.test.ts __tests__/lib/device-profile-sync-integration.test.ts __tests__/lib/file-plan-panel.test.ts __tests__/lib/sync-doctor.test.ts --maxWorkers=1` → exit 0, 59/59 tests in six files. This includes the new five snapshot and six alias tests, CUE/GDI/M3U transformation, actual Undo/compensation/DB-after-IO recovery, profile baselines and component response contracts.
- Adapted only the private reviewer probe's C1 oracle from the former stale Apply path to the correct reject-preview outcome; retained the original R1 probe unchanged. Ran `pnpm exec vitest run --config .review/post-r2-probe.config.ts --maxWorkers=1` → exit 0, 4/4 own probes. The three original actual SQLite/LOCAL/native-alias cases are now GREEN. The fourth probe injects graph version 2, an outside-root entry, and over-16-MiB graph metadata into its own stored plan; each is rejected before any connection is opened, with source bytes preserved. Own database and files are cleaned by the probe.
- Own copy `.review/post-r2-agent-clone` contains source/tests/schema/migrations/configuration and symlinked dependencies, excluding environments and databases. Removed only `await verifyDescriptorGraphs(ctx, snapshots, capturedDeviceIds);`; ran `pnpm exec vitest run __tests__/lib/file-plan-descriptor-snapshot.test.ts --maxWorkers=1 -t 'just after the real'` → causal RED: preview resolves with stale payload instead of rejecting. Restored copied bytes exactly; root source unchanged.
- In the same own copy, removed only the initial Apply `verifyDescriptorGraphs` call; ran `pnpm exec vitest run __tests__/lib/file-plan-descriptor-snapshot.test.ts --maxWorkers=1 -t 'formerly unselected'` → causal RED: Apply resolves with status applied after the previously unselected descriptor starts referencing the moved track. Restored bytes exactly.
- In the same own copy, removed only `result.sha256 !== expected.sha256 ||` from the ordinary expected-fingerprint comparison; ran `pnpm exec vitest run __tests__/lib/file-plan-descriptor-snapshot.test.ts --maxWorkers=1 -t 'just after the real|formerly unselected|rejects changed source bytes'` → causal RED in all three selected tests. The equal-metadata source-byte case observes one exclusive temporary write instead of zero despite later staged-hash rejection. This independently confirms the corrected oracle distinguishes the early source-SHA precondition. Restored bytes exactly; copied/root file-plans SHA256 `39ef808750bb97f45f162476ffdc839dc9a52bd951ebf322f306319c6cb309f1`.
- In the same own copy, removed only the ROM-root containment assertion in `parseDeviceProfile`; ran `pnpm exec vitest run __tests__/lib/local-profile-doctor-alias.test.ts --maxWorkers=1 -t 'keeps outside, protected'` → causal RED when a wider operator root allows an outside-device ROM profile to resolve. Restored copied bytes exactly; root source unchanged. Full mutation outputs are in `.review/post-r2-agent-mutations.json`.
- After restoring copied mutations, ran `pnpm exec vitest run __tests__/lib/file-plan-descriptor-snapshot.test.ts __tests__/lib/local-profile-doctor-alias.test.ts --maxWorkers=1` in the own copy → exit 0, 11/11 tests in two files. Byte comparison verifies copied `file-plans.ts` and `device-profiles.ts` equal the frozen root versions, with SHA256 `39ef808750bb97f45f162476ffdc839dc9a52bd951ebf322f306319c6cb309f1` and `32d5f2c2eefd658b3f4e606bf67300e515b5cbfe045b53756b684e90849e0e1c`.
- Read the complete current Header and the Sidebar navigation context; checked actual route files exist for Home, Discover, Devices, Files, Upload, Admin, saves, wishlist, insights and timeline. Reviewed the breakpoint/wrapping delta and the label mapping. Browser/layout evidence belongs to Root, so this reviewer does not claim an independently measured mobile visual PASS. Root separately reported a DeviceSaves path-wrapping issue for a later CSS-only R3 delta; that pending item is outside this frozen R2 backend/navigation review.
- Scope limits: delta review only; unchanged/passed areas were not re-litigated. No full suite/build/lint/browser, user DB/environment/device, provider, container or actual LAN operation was run. Root's broader 878-test/build/production/standalone/mobile evidence is not represented as this reviewer's own execution. Real hardware/remote safe-write capabilities remain unclaimed.
- Final binding: `python3 .review/feature-payload.py --round=2 --check` → PASS reviewed tree with SHA256 `353aefe8ba7b0d2fc36cf616c9fec631f9bda2b5b14efc8bf7d503e73f40e31b`; rerun after writing this report. No root product/test/Brain/index change was made by the reviewer.

## VERDICT

PASS

### Minimalfix PRE R1

## FINDINGS

- [INFO] Implementation detail for `file-plans.ts` snapshot parsing: represent an explicitly captured empty descriptor graph distinctly from absent legacy metadata, and validate bounds/entries before Apply can start writing; Undo/Reconcile must continue using the actual journaled effects rather than demanding the deliberately changed original graph. These details follow the proposed precondition and do not require another schema or public interface.

No CRITICAL or WARN finding in the reviewed plan delta.

## EVIDENCE

- Reviewed only `POST-R1-Minimalfix: Descriptor-Snapshot und kanonische LOCAL-Wurzeln` in `docs/dev/2026-10-12-file-foundation-plan.md` and its direct execution points. Delta size 2,320 bytes; SHA256 `23f30d9548301cde6ed24ce48661a527092e9169ac2599f4a6a3f9724ab753b0`.
- Read the existing descriptor capture/graph construction/source-fingerprint loop, `DeviceSnapshot` persistence/parsing, `Context` ownership/configuration checks, Apply `preflight`, and journal recovery entry points. The current JSON field can hold a bounded per-device graph without a schema migration or client-supplied preconditions. The plan's exact raw-byte hash plus size/identity/mtime binds the text used for graph expansion and rewrite output; whole-graph verification at creation and before initial Apply writes covers previously unselected parents. Keeping that verification out of Undo/Reconcile avoids rejecting their intentionally modified descriptors.
- Read the actual `resolveLocalPath` implementation and Doctor/profile consumers. The resolver validates the configured alias and then the canonical destination against the operator's authoritative roots/protected-area restrictions. Reusing it for LOCAL device/profile roots can make defaults, stored-profile reads, input normalization and containment agree without widening the allowlist or modifying the device row. Remote path semantics can remain unchanged.
- Ran `pnpm exec vitest run --config .review/post-r1-probe.config.ts --maxWorkers=1` → exit 1, all three intended product-defect oracles RED on the unchanged product: stale descriptor rewrite silently replaces the native edit; Doctor's reliable alias scan becomes unsafe/incomplete; canonical profile root is rejected against raw configured root. The functions execute against their own migrated SQLite database and real local files/leases, with no user/device/provider/LAN data.
- Ran a byte comparison against the reviewer-owned R1 clone → `file-plans.ts`, `sync-doctor.ts` and `device-profiles.ts` unchanged. SHA256 values respectively `36ccbb1d472383bbedeb4c99e15ec982d4d1890a00f0ef338d9cb05d2012a6fb`, `cbf1296007cc63e2316b8cc2273686ad02eb41e56bb3cd32b4bc51c69ea343e5`, `2a076f20fe2078ae2ededc5768035afc4562c473ce44cbe316979d853ef6f20f`. No product/test/Brain/index edits were made by this PRE reviewer.
- Implementation has not happened, so remediation GREEN evidence remains for POST R2. This is an executing plan review, not a claim that the original R1 findings are already fixed. No full suite/build/lint/browser was run. The R1 payload tree check is intentionally not reused after appending the plan delta; the original R1 report/verdict is unchanged.

## VERDICT

PASS

- Unveränderter Kandidat140Dateien, PayloadSHA256 `463260927bce01f5c0b81b12f48f5b514fdd3807e759b05d86742164da55767e`:867/867 Tests in87Dateien, tsc, Lint und frischer isolierter Next15-Produktions-/Standalonebuild bestanden. Build erzeugt42 statische Seiten und alle neuen API-Eintrittspunkte. pnpm verweigerte die Neuinstallation in der Symlinkkopie; die Prüfung verwendet stattdessen den identischen installierten Next mit eigener interner unveränderter Dependencykopie. Keine.env oder Nutzer-DB kopiert.
- Echter Chromeproduktionstest PASS: Doctor, Profil/ROM-Vorschau/Apply/gepaarteBaseline, DAT-Import+verifizierterHash, Savebackup/Restorevorschau ohneWrite/Apply/Undo exakter Bytes, persistentes ROMUndo, globale Savehistorie, tatsächliche LOCALUploadDetect/Process/Journal/Manifest/Katalog/Undo. IntakePOST allein simuliert, um fremde echte Uploadcache-Sessions nicht durch Cleanup anzusehen; dessen Streamingservice ist separat tatsächlich getestet. LANantwort simuliert, echtes Geräteformular ohne Autoanlage. Null Pageerrors, Screenshots geprüft.
- Die tatsächliche Standaloneausgabe besteht dieselben Funktionsabläufe. Zusätzliches390px-Orakel findet bestehenden Desktop-Shell-Überlauf1211/390; nicht als bestandene Mobilabnahme behauptet. Erstes Probe-EOF betraf einen versteckten Selectoption-Locator, danach auf echte sichtbare Restorebuttons korrigiert; kein Produktfix daraus.
- Unabhängiger ausführender POST R1 FAIL:1 CRITICAL/2 WARN. Root hat den Descriptor-Edit selbst kausal reproduziert: neue trackB-Bytes wurden bei Apply still durch alten renamed-Rewrite ersetzt. Alle drei Befunde werden behoben, Gesamtziel bleibt offen.

### R1 Findings-Mapping

- FF-POST-R1-01 (A CRITICAL), `file-plans.ts` Descriptoraufnahme/Graph/Quellenhash: Rewritebytes und aufgenommenes Original waren nicht hashgebunden. Bestätigte eigene SQLite/LOCAL-Probe; Minimalfix aufgenommene Rohbytes/Hash/Identität der ganzen Grafik persistieren und vor Plancommit/erstem Applywrite prüfen. Geschlossen: fünf permanente Regressionen, kausale Gegenmutationen, unabhängiger POST R2 PASS.
- FF-POST-R1-02 (A WARN), `sync-doctor.ts` Snapshotroots: kanonische Scannerpfade lagen lexikalisch außerhalb roher erlaubter LOCAL-Aliasse. Minimalfix geschützte Kanonisierung vor Vergleich. Geschlossen: tatsächliche native/erlaubte Symlink-Aliasregressionen, eigener Reviewerprobe und POST R2 PASS.
- FF-POST-R1-03 (A WARN), `device-profiles.ts` Defaults/Containment: kanonische erlaubte Profilwurzel scheiterte am rohen Scanroot, roher Alias an der Canonical-Regel. Minimalfix konsistente erlaubte LOCAL-Kanonisierung für Get/Save/Stored/Input ohne Geräte- oder Betreiberallowliständerung. Geschlossen: sechs permanente Alias-/Containmentfälle, Row-Unverändertheit, kausale Containmentmutation und POST R2 PASS.
- R1 Mutationsevidenz: globale Namespace-, Owner- und fremde-identische-Datei-Grenzen kausal rot und bytegleich restauriert. Vorhandenes Source-SHA-only-Orakel überlebt isolierten SHA-Vergleichsmutant; kein behaupteter Produktdefekt, aber Root ergänzt ein diskriminierendes Same-size/Same-mtime/No-Tempwrite-Orakel.

### Vollständiger unabhängiger POST R1

## FINDINGS

- [CRITICAL] FF-POST-R1-01 — `src/lib/file-plans.ts:425–430,499–512,553–556`: descriptor graph/payload bytes are captured before the source fingerprint, but their exact content is never bound to that fingerprint. A same-size CUE edit preserving its inode and visible mtime between those reads is accepted as the new source hash while the planned rewrite still contains old descriptor content. The actual SQLite/LOCAL probe changes `FILE "trackA.bin"` to `FILE "trackB.bin"` after descriptor capture; Apply reports `applied` and replaces that edit with `FILE "renamed.bin"`. This violates the immutable preview/source-precondition contract and silently overwrites an intervening native edit. Minimal fix: retain the exact captured descriptor hashes/identities for the entire dependency graph and reject or rebuild the preview whenever revalidation differs before persisting its graph and payload.
- [WARN] FF-POST-R1-02 — `src/lib/sync-doctor.ts:140–141`: Doctor compares scanner-canonical observed/manifest paths against raw configured LOCAL scan roots. An allowed native path alias, reproduced on this Mac with `/var/...` resolving to `/private/var/...`, makes the actual directory and ROM look outside the roots and persists `complete:false` with unsafe findings despite a complete reliable scan. This prevents useful diagnosis for an otherwise supported LOCAL device. Minimal fix: resolve permitted LOCAL Doctor roots through the same guarded canonical resolver used by the scanner before comparing the snapshot.
- [WARN] FF-POST-R1-03 — `src/lib/device-profiles.ts:43–47,54–61,78–80,90–92`: LOCAL profiles require canonical roots but validate their containment against raw device scan roots and return those raw roots as defaults. For the same supported native alias, a canonical profile root is rejected as outside the configured root, while the raw root is rejected as noncanonical; the device has no saveable ROM profile until its device configuration is manually rewritten. Actual `saveDeviceProfile` with own SQLite reproduces the canonical-root rejection. Minimal fix: canonicalize the permitted LOCAL device ROM roots consistently for profile defaults, stored-profile reading and containment validation while retaining the configured-root safety boundary.

## EVIDENCE

- Binding: parsed the immutable `.review/feature-r1-payload.diff`, including all 140 file section boundaries and the explicit exclusions; SHA256 `463260927bce01f5c0b81b12f48f5b514fdd3807e759b05d86742164da55767e`, 1,052,241 bytes. No reconstructed git diff was substituted. Read the approved full plan and the stored delta, then inspected bounded artifact/source sections covering journal guards, graph expansion, recovery/Undo, protected save/upload adapters, save/sync/profile paths, Doctor, integrity, LAN, schema boundaries, wrappers and UI consumers. Source inspections are on the frozen tree verified against the artifact; this is a focused review, not a claim that every line of the one-megabyte artifact was independently validated.
- Ran from root: `pnpm exec vitest run __tests__/lib/file-plans.test.ts __tests__/lib/file-io.test.ts __tests__/lib/device-jobs-fence.test.ts __tests__/lib/device-profile-sync-integration.test.ts __tests__/lib/device-saves.test.ts __tests__/lib/save-store.test.ts __tests__/lib/sync-journal.test.ts __tests__/lib/upload-journal.test.ts --maxWorkers=1` → exit 0, 100/100 tests, 8 files. Real temporary SQLite/LOCAL fixtures cover wrong game/device/path rejection, foreign identical targets, immutable source SHA, descriptor closure/rewrite, compensation, DB-after-publication recovery, persisted target-save backup, source revalidation, both-side ROM baselines, selected queue claims, legacy rejection and closed upload manifest/Undo after source release.
- Ran from root: `pnpm exec vitest run __tests__/lib/device-integrity.test.ts __tests__/lib/device-integrity-api.test.ts __tests__/lib/sync-doctor.test.ts __tests__/lib/sync-doctor-api.test.ts __tests__/lib/lan-discovery.test.ts __tests__/lib/lan-discovery-api.test.ts __tests__/lib/physical-manifest.test.ts __tests__/lib/upload-journal-intake.test.ts __tests__/lib/converter-cancel.test.ts --maxWorkers=1` → exit 0, 102/102 tests, 9 files. These include complete/incomplete inventory semantics, all-checksum DAT classification, persistent job ownership/expiry, private-NIC/bounded discovery, original upload preservation, intake/ZIP bounds and process drain. Network use is doubled; no real LAN/device/provider call was made.
- Independent FF-POST-R1-01 reproduction: `pnpm exec vitest run --config .review/post-r1-probe.config.ts --maxWorkers=1` → descriptor oracle RED. The probe uses the actual `createFilePlan`/`applyFilePlan`, a migrated disposable SQLite database, real `LocalFileIo`, and its own files. A read wrapper only schedules a native same-inode/same-size edit immediately after the actual descriptor read, restoring a fixed visible mtime. Observed `OWN_DESCRIPTOR_RACE`: status `applied`; before Apply `trackB.bin`; after Apply `renamed.bin`. Original product code was not mutated.
- Independent FF-POST-R1-02 reproduction: `pnpm exec vitest run --config .review/post-r1-probe.config.ts --maxWorkers=1 -t 'Doctor recognizes'` → exit 1, expected complete true but got false; actual scanner/LOCAL/SQLite/leases reported the canonical `nes` directory and `Own.nes` as unsafe solely because the configured root used the native alias.
- Independent FF-POST-R1-03 reproduction: `pnpm exec vitest run --config .review/post-r1-probe.config.ts --maxWorkers=1 -t 'LOCAL alias device'` → exit 1, actual `saveDeviceProfile` rejects the safe canonical path with `ROM-Profilwurzeln müssen innerhalb der konfigurierten ROM-Scanwurzeln liegen.` The raw-alias rejection follows the separately inspected resolver equality requirement at line 92.
- Mutation owner fence, own clone `.review/post-r1-agent-clone`: remove only `lease.owner !== job.owner` in `device-jobs.ts`; run `pnpm exec vitest run __tests__/lib/device-jobs-fence.test.ts --maxWorkers=1 -t 'fences a paused old owner'` → RED, stale owner transaction resolves instead of rejecting after a second real SQLite client takes its expired lease. Clone restored byte-for-byte; root SHA for that file remained `0232d4e23132f1ef29f377f562a07c24fc557f0f97fe0bf0984df1feb4dd1c0f`.
- Mutation LOCAL namespace, same own clone: remove only the leading `"device-files"` acquisition; run `pnpm exec vitest run __tests__/lib/device-jobs-fence.test.ts --maxWorkers=1 -t 'serializes authoritative file jobs'` → RED, second LOCAL device with the same native root acquires instead of returning 409. Clone/root byte restoration verified with the same SHA.
- Mutation identity ownership, same own clone: remove only `result.identity !== expected.identity` in the expected-fingerprint comparison; run `pnpm exec vitest run __tests__/lib/file-plans.test.ts --maxWorkers=1 -t 'refuses undo/reconcile ownership'` → RED, Undo accepts an identical foreign replacement and returns undone. Clone restored byte-for-byte; root SHA remained `36ccbb1d472383bbedeb4c99e15ec982d4d1890a00f0ef338d9cb05d2012a6fb`.
- Mutation limitation, same own clone: remove only `result.sha256 !== expected.sha256`; run `pnpm exec vitest run __tests__/lib/file-plans.test.ts --maxWorkers=1 -t 'rejects a changed source even when'` → GREEN on this Mac. This existing test therefore does not independently establish that particular SHA comparison; the production comparison is present, and no source-SHA product defect is inferred from the surviving mutant. Mutation details/results are preserved in `.review/post-r1-mutations.json`; all clone changes were restored.
- Verification after clone restoration: `pnpm exec vitest run __tests__/lib/device-jobs-fence.test.ts __tests__/lib/file-plans.test.ts --maxWorkers=1 -t 'fences a paused old owner|serializes authoritative file jobs|refuses undo/reconcile ownership'` in the restored clone → exit 0, 3/3 selected tests, 2 files. Both mutated clone files equal the frozen root bytes and the recorded SHA256 values. No root product/test/Brain file, index or commit was changed. Clone contents exclude environments, data and databases; node_modules is a symlink, and all execution databases/files are reviewer/test owned.
- Final independent reproduction: `pnpm exec vitest run --config .review/post-r1-probe.config.ts --maxWorkers=1` on the unchanged candidate → exit 1, 3/3 intended oracles RED for the three reported product defects; no setup/import failure. Temporary DB/files are removed by the probe's cleanup.
- Could-not-run / deliberate scope limits: no full test suite, build, lint or browser was rerun by this reviewer, as instructed. Root's stated production-browser/build/full-suite results are not claimed as independently executed evidence. Real SSH/FTP capabilities, hardware compatibility, user data, public hosting and live LAN discovery are outside the authorized probe boundary; unknown safe remote writes remain visibly rejected before mutation.
- Tree binding: `python3 .review/feature-payload.py --round=1 --check` → PASS reviewed tree with SHA256 `463260927bce01f5c0b81b12f48f5b514fdd3807e759b05d86742164da55767e`; repeated after writing the findings artifact at review completion.

## VERDICT

FAIL

Basis: `384ede7`, private lokale beziehungsweise Own-LAN-Open-Source-App. Nur eigene SQLite-/FS-Fixtures und Netzwerk-/Provider-Doubles; keine Nutzerdatenmigration, realen Geräteoperationen, Container, Veröffentlichung oder Live-Provideraufrufe.

## Protokoll des Stands vor POST R1

Historischer Zwischenstand vor den oben dokumentierten gemeinsamen Gates: Implementierung und fokussierte Integration waren vorhanden; A-05/A-12 und die sechs vollständigen Funktionen waren damals noch nicht abgenommen. Maßgeblich ist jetzt die finale Abnahme am Anfang dieser Datei.

- Journal-/I/O-Worker eingefroren: 114/114 fokussierte Tests, Typ/Lint/Diff bestanden. Physische Identität, Temp/Publish/Quarantäne, Descriptorrewrites, Reverse-Recovery/Undo, geschützte Save-/Uploadadapter und aktuelle SQLite-Besitzergrenzen geprüft.
- Profile/Saves-Worker eingefroren: 51 kombinierte fokussierte Prüfungen. Push/Pull/Zweiweg, gepaarte Baselines, tatsächliche Quellen-/Zielprüfung, Vorüberschreibungsbackup, immutable Versionen und Fortsetzung derselben Child-Pläne.
- Sync/Integritäts-Worker eingefroren: 56/56 fokussierte Prüfungen, Typ/Lint/Diff. Eindeutige Queue-Claims, Reviewpflicht für Altzeilen, nur eigene ausgewählte Runs; globale und gerätebezogene Owner-/Expiry-Fences in Ergebnissen und Zuständen.
- Root kausal: Upload-Planlinks fehlten bei Erfolg und Fehler (3 REDs); spätere Transferfehler wurden durch alten Erfolg verdeckt (1 RED); Elternstatusupdates brachen laufenden Plan ab und Profil-/Save-Deep-Links öffneten ihn nicht (2 REDs). Die fokussierten UI-Suites sind nach Minimalfix grün.
- Root echte SQLite: überlappende LOCAL-IDs haben genau einen Dateinamensraum-Besitzer; alter Besitzer kann nach Übernahme nicht schreiben. Catalog-Wipe/Cleanup erfordern denselben Fence und erhalten physische Duplikatzuordnungen, Journal und Saveversionen.
- Root Scan-Identität: gezielte Mutation im eigenen Source-Clone erzeugte zwei Spiele statt eines, der unveränderte Fix erzeugt eins mit ursprünglicher Metadaten-/anderer-Gerätezuordnung. RED/GREEN; Source nach Restore bytegleich SHA256 `f57773f047eb8e614ac3d54695e4584b0e9002bbc3166536c226f72cbc45805c`.
- Legacy-Upgrade 2/2: feste 16-Migrationen-Liste aus der tatsächlichen Anleitung, anschließend Admission und Dateijournal wirklich ausgeführt. Spiele/Verknüpfungen/Credentialbytes bleiben erhalten, neue Plan-/Save-/Uploadtabellen funktionieren. Kein dynamisches Markieren neuer Migrationen als bereits angewendet.
- Neue CI-YAML lokal geparst: nur pull_request/workflow_dispatch, contents:read, eigene CI-DB, keine injizierten Secrets. Extern nicht ausgeführt, nicht veröffentlicht.

## Neues API- und Nebenwirkungsinventar

Alle neuen Eintrittspunkte prüfen `requireAuth` vor Store-/Device-/Providerarbeit. Dieselbe Administrator-/Same-Origin-Grenze gilt für die private Installation; keine zusätzlichen SaaS-Rollen.

| Oberfläche | Ausdrückliche Schreib-/I/O-Aktion | Zulassung und Ergebnisgrenze |
| --- | --- | --- |
| `/api/file-plans`, `/[id]/apply`, `/undo`, `/reconcile` | DB-Vorschau; getrennte Anwendung/Rücknahme/Recovery | begrenzter JSON-Body; global `device-files` und sortierte `files:id`; gleicher TX-Owner-Fence; serverseitige Preconditions |
| `/api/devices/[id]/doctor` | POST liest Bestand, speichert immutable Diagnose | gemeinsame Dateileases; begrenztes Inventar; unvollständig bleibt unknown; GET nur Bericht |
| `/api/integrity/dats`, `/api/devices/[id]/integrity`, `/api/integrity/jobs/[id]/cancel` | lokaler begrenzter DAT-Import; expliziter Hashjob/Abbruch | Größe/Parser/Ergebnisse begrenzt; beide tatsächlichen Leasebesitzer in Result-/State-TX; keine Resolver/Provider |
| `/api/devices/[id]/profile`, `/api/device-sync`, `/[id]/apply` | Profil speichern, gespeicherte ROM-Vorschau, separate Apply | reale erlaubte Wurzeln; alle Datei-/Baselineänderungen gefencet; Child-Journal/Fingerprints, keine automatische Löschung |
| `/api/devices/[id]/saves`, `/saves/sync`, `/api/saves/versions/[id]/restore` | Backup, Sync-/Restorevorschau, separate Apply | unveränderlicher begrenzter interner Hashspeicher; persistentes verifiziertes Backup vor Ersetzung; Child-Journal; Versionen ohne Cascade |
| `/api/devices/discovery` | POST startet explizit private ausgewählte NIC-Suche | feste Ports/Hosts/Concurrency/Fristen, `lan-discovery`-Lease, keine Credentials/Autoanlage; GET nur NIC-Auswahl |
| bestehende Dateien/Sync/Transfer/Upload/Scan/Gerätekonfiguration/Cleanup/Wipe | bestehende UI-Aktionen | auf gemeinsame Namespace-/Devicejobs und Writer-Fences angebunden; keine zweite direkte ROM-Mutationsgrenze |

Providerinputs und -budgets bleiben aus dem vorherigen geprüften Admissionpaket erhalten. Bildcache und positive Upload-Intake-Dateien sind appverwalteter Stagingbereich, keine frei adressierbaren ROM-Journalschreiber. Cloudflare: private lokale/Own-LAN-Installation, daher keine Edge-Regel; kein öffentlicher Produktionsvertrag behauptet.

## PRE-Findings-Mapping

- FF-PRE-R1-01 (WARN): gemeinsame Datei-/Profilpläne hätten CUE/GDI/M3U-Referenzen nach Rename/Move/Wurzelwechsel gebrochen. Bestätigt; serverseitige Closure, Umschreibung, gesicherte Originaldescriptoren und Ablehnung unlösbarer Referenzen im Plan ergänzt. PRE R2 PASS; Implementierungs- und Recovery-Orakel anschließend hinzugefügt.
- FNS-PRE-R1-I01 (INFO): Integritäts-Jobzustände und Legacy-Restart brauchen beide tatsächlichen Besitzer. Berücksichtigt: `globalOwner`, Namespacehelper, gleicher TX-Fence für Ergebnisse und Eigentümerzustände, Legacy ohne globalen Besitzer interrupted.
- Statische Bounded-Writer-Prüfung meldete zwei WARN in Cleanup: keine gemeinsame Fence und verlorene DeviceFile.gameId bei Merge. Root hat beide bestätigt und mit einem gefenceten Merge auf den endgültigen Gewinner korrigiert; drei eigene Catalog-Wipe/Cleanup-DB-Tests grün. Immutable vorherige Planzuordnungen werden nicht umgeschrieben; geänderte Associations erzwingen die erneute Validierung.


## Vollständiger Report: file-foundation-pre-r1.md

## FINDINGS

- **FF-PRE-R1-01 — WARN — Descriptor-Abhängigkeiten fehlen im Änderungsvertrag.** Ort: `docs/dev/2026-10-12-file-foundation-plan.md:11`, `:13` und `:17`. Das physische Manifest bewahrt CUE/GDI/M3U und Tracks, aber Dateipläne und Profilkopien haben keinen Vertrag für deren Referenzen. Schon `generateM3u()` in `src/lib/uploader.ts:34` schreibt absolute Deck-Pfade. Ein unverändert kopiertes M3U auf ein anderes Profil oder ein isoliertes Rename/Move einer referenzierten Disc/Track-Datei kann daher trotz korrekter Hashes, Zuordnung und vollständig erfolgreichem Journal ein unspielbares Set erzeugen. Die vorgesehenen Manifest-Retention-/Hash-/Crash-Tests prüfen diese semantische Invariante nicht. **Minimaler Fix:** Den Plan um serverseitig ermittelte Descriptor-Abhängigkeiten ergänzen: betroffene Referenzen innerhalb eines gemeinsamen journalisierten Plans auf die tatsächlichen Zielpfade umschreiben; bei nicht sicher auflösbaren Abhängigkeiten vor I/O ablehnen. Kausale Tests für CUE-Track-Rename, M3U-Profilkopie mit anderer Wurzel und Kompensation/Undo der Descriptor-Änderung vorsehen (nach erfolgreicher Änderung null gebrochene Referenzen; ohne Schutz mindestens eine).

- **FF-PRE-R1-02 — INFO — Fähigkeiten getrennt und pro Protokoll belegen.** Ort: Plan `:12`, `:17`, `:31`. Die bestehende SSH-SFTP-Schnittstelle kann Streams und exklusive Open-Flags anbieten; OpenSSH-`statvfs`/Hardlink/Fsync sind Erweiterungen. `basic-ftp` bietet Stream-Upload und RNFR/RNTO, jedoch keinen im gelesenen API-Vertrag zugesicherten freien Speicher oder No-Clobber-Publish. Die im Plan vorgesehene Ablehnung vor Mutation ist richtig. Bei der verlangten Fähigkeitsauflösung Platzabfrage, exklusives Temp, Publish, Quarantäne und dauerhafte Flush-Garantie einzeln dokumentieren und unbekannte Fähigkeiten in API/UI sichtbar ablehnen. Aus diesen Bibliotheksverträgen folgt kein belegter genereller Ausfall eines bestimmten Handheld-Profils; das ist hier ausdrücklich kein Blocker.

- **FF-PRE-R1-03 — INFO — Gemeinsamen Geräte-Lock auch für Scans und kleine Schreiber nachweisen.** Ort: Plan `:14`, `:27`. `AdmissionStore` unterscheidet Ressourcen `scan:<id>` und `files:<id>`; diese Schlüssel schließen einander nicht aus. Die zugesagten Überlappungstests müssen deshalb wirklich den gemeinsamen `files:<id>`-Lock bei Scan-/Integritäts-/Save-/Profil-Arbeit beweisen. Auch der bestehende `/api/devices/[id]/files/mkdir`-Schreiber und Geräteentfernung gehören zum genannten vollständigen Anschluss der Schreiber. Das ist eine Konkretisierung des bereits geforderten gemeinsamen Vertrags, kein eigener PRE-Blocker.

- **FF-PRE-R1-04 — INFO — App-Backup-Speicher als interne Fähigkeit behandeln.** Ort: Plan `:18`; `src/lib/local-paths.ts:52` und `:93`. Der vorhandene LOCAL-Guard schließt `data/` und andere Appbereiche aus. Immutable Sicherungen unter diesem Bereich brauchen daher interne serverseitig bestimmte Speicherpfade; sie dürfen nicht durch Aufweiten der Geräte-Root-Grenze erreichbar werden. Nicht-kaskadierende historische Zuordnungen sowie die verifizierte Sicherung vor Restore sind bereits als Invarianten enthalten und müssen im zugesagten POST geprüft werden.

## EVIDENCE

- Geprüfter Plan: `docs/dev/2026-10-12-file-foundation-plan.md`, SHA-256 `4ce5f16e5ab91a9061827a0d577657fa60deefd611657209da0ba1b1dc341ea6`. Beschränkter unabhängiger PRE der geplanten Dateigrundlage und sechs Nutzerfunktionen; keine erneute Prüfung des laufenden Auth-/Providerpakets.
- Ausführung mit `node --import tsx --input-type=module`, ausschließlich eigene temporäre LOCAL-Verzeichnisse: zwei Scanwurzeln, tatsächlicher Alias `ps1`, zwei BIN-Discs, CUE, M3U und dritte Disc in `psx-multidisc` (fünf physische Dateien). `scanDevice()` gab `reliable: true` und genau einen `My Game.m3u`-Vertreter zurück; dessen Ergebnis besaß weder Scanroot noch Plattformalias. `scanner.ts:89`, `:158`, `:164` und `:218` erklären den Verlust. Alle eigenen Fixturedateien wurden im `finally` entfernt.
- Im selben One-off erzeugte das tatsächlich aufgerufene `generateM3u('My Game', 'psx', [...])` zwei absolute Referenzen unter `/home/deck/EmuVirtual/Emulation/roms/psx-multidisc/`. Ein anschließendes Rename einer eigenen BIN-Datei ließ die alte FILE-Referenz in ihrer CUE bestehen. Dies belegt den semantischen Zusammenhang für FF-PRE-R1-01, nicht eine bereits implementierte neue Dateiplan-Funktion.
- `pnpm exec vitest run __tests__/lib/integrity.test.ts`: Exit 0, **37/37 Tests bestanden**, ein fokussiertes Testfile, 95 ms. Die vorhandenen Streaming-Hash-/Byte-/Abbruch-/Frist- und DAT-Klassifizierungsverträge sind damit als wiederverwendbare Grundlage belegt. `dat.ts` begrenzt den Import schon auf 5 MiB/20.000 Einträge und hat keinen externen Resolver; `classifyDump()` verlangt Größe und alle bereitgestellten Hashes und behandelt fehlende Erwartungsidentität als unbekannt.
- Statisch geprüft: `scan-runner.ts:170` persistiert den einzelnen `GameDevice.originalFile`; `src/app/(main)/game/[id]/page.tsx:44` rekonstruiert Pfade aus allen ROM-Wurzeln und `dirs[0]`. `sync/queue/route.ts:64` prüft lexikalische Scanwurzeln ohne belegte Datei-/Spielzuordnung. `sync/apply/route.ts:13` nutzt `createdAt`-Recovery und liest sämtliche `in_progress`-Zeilen; dessen Rename-Recovery benutzt bloße Ziel-Existenz. `devices/transfer/route.ts:69` puffert mit `readFile`, `:89` schreibt das Ziel direkt. `upload/process/route.ts` kennt tatsächliche Transfer-/Playlistpfade, persistiert aber nur den Vertreter. Die vorgesehenen Manifest-/Owner-/Journaländerungen greifen diese Ursachen konkret auf.
- Lokale Treiberquellen gelesen: `node_modules/ssh2/SFTP.md:269`, `:284`, `:308`, `:332`–`:340`; `node_modules/basic-ftp/dist/Client.d.ts:131`, `:161`, `:184` und `Client.js:315`. Kein Remote-Server wurde verbunden. Fähigkeitserkennung und Profilstandardpfade sind im Plan als offene Vorarbeit markiert, nicht als vorhandene Garantien behauptet.
- Die verbleibenden kritischen Verträge sind im Plan ausdrücklich enthalten: serverseitige Identität/Preconditions und A-05-Null-I/O, verlässliche atomare Manifestgeneration, keine erfundenen Legacy-Pfade, sichere Veröffentlichung ohne stilles Überschreiben, Journal vor I/O, rückwärts gerichtete Kompensation, fremde Dateien bei Reconcile/Undo schützen, nicht-kaskadierende immutable Saves, Baselines statt Mtime-Konfliktauflösung, tatsächlich private NIC und begrenzte explizite Discovery sowie vollständige API/Persistenz/UI-Abnahme mit unabhängigem POST. Details ihrer Umsetzung können in der Implementierung entstehen.
- Keine volle Suite, Lint oder Build; keine Nutzer-DB, .env, Brain, Provider, Geräte, Container oder echten LAN-Ziele gelesen/verändert; keine Produktänderung, kein Staging/Commit. Geschrieben wurde ausschließlich dieser Reviewbericht.

## VERDICT

**FAIL — 0 CRITICAL / 1 WARN / 3 INFO.** FF-PRE-R1-01 erfordert die minimale Descriptor-Invariante im Plan und deren kausale Abnahme vor Umsetzung. Die INFO-Punkte sind beratend und halten PRE nicht auf. Nach Ergänzung nur diese Änderung und ihre direkten Nebenwirkungen erneut prüfen.


## Vollständiger Report: file-foundation-pre-r2.md

## FINDINGS

Keine neuen CRITICAL-, WARN- oder INFO-Befunde im beauftragten Delta.

- **FF-PRE-R1-01 — geschlossen.** `docs/dev/2026-10-12-file-foundation-plan.md:14` verlangt jetzt serverseitige Auflösung tatsächlicher CUE/GDI/M3U-Abhängigkeiten, gemeinsam journalisierte Datei-/Referenzänderungen, gesicherte Originaldescriptoren und deren Wiederherstellung bei Kompensation/Undo. Unlösbare, fremde oder nicht sicher umschreibbare Abhängigkeiten lehnen den gesamten Plan vor I/O ab. Profilkopien dürfen keine alten absoluten Master-/Deck-Pfade behalten; nach Erfolg müssen sämtliche Referenzen auflösbar sein. Damit ist der in R1 kausal belegte Vertragsgap geschlossen.
- **R1-INFO-Konkretisierungen akzeptiert.** Die getrennten Protokollfähigkeiten mit sichtbarer Ablehnung (`:12`), der gemeinsame `files:<id>`-Lock einschließlich Scans/Mkdir/Geräteentfernung (`:15`) und interne Backup-Pfade ohne Aufweitung der LOCAL-Gerätewurzeln (`:19`) widersprechen der Descriptor-Ergänzung nicht. Bereits geprüfte Bereiche wurden nicht neu bewertet.

## EVIDENCE

- Geprüfter R2-Plan: `docs/dev/2026-10-12-file-foundation-plan.md`, SHA-256 `99ba1edd3ef0eb1db1c6ce395e70c39c62033e413e2e4a197451befcdcaff8a4`. Delta gegen den in `.review/file-foundation-pre-r1.md` geprüften Plan und dessen Findings-Mapping.
- Der Minimalfix aus R1 ist in `:14` vollständig vorhanden: betroffene physische Dateien und Descriptoren gemeinsam planen, tatsächliche Zielreferenzen umschreiben, Originalbytes sichern, bei Unsicherheit vollständig vor I/O ablehnen. Die vorhandenen Journal-/Fingerprint-/Kollisions-/Leasegrenzen in `:13` bleiben dabei anwendbar; Undo darf weiterhin keine fremden späteren Dateien verändern.
- `:30` verlangt die diskriminierenden Tests für CUE-Track-Rename, GDI-Track-Move und M3U-Profilkopie auf eine andere Wurzel: ohne Schutz mindestens eine gebrochene Referenz, nach Erfolg null. Zusätzlich sind Fehler nach Descriptoränderung, bytegetreue Wiederherstellung der Originaldescriptoren durch Kompensation/Undo und null Dateiwrites bei ungelöster Abhängigkeit ausdrücklich vorgesehen. Diese Orakel decken den R1-Befund und seine direkten Recovery-Auswirkungen ab.
- R1-Laufzeitevidenz bleibt Grundlage des Befunds: tatsächlich aufgerufenes `generateM3u()` erzeugte absolute Deck-Referenzen; der eigene TempFS-Track-Rename ließ die alte CUE-Referenz bestehen. R2 behauptet noch keine implementierte neue Laufzeitfunktion. Deshalb keine Wiederholung der bereits grünen 37 Integritätstests und keine Globalgates.
- Nur der Plan und eng begrenzte Descriptor-Quellstellen wurden gelesen. Keine Produktänderungen, Nutzer-DB/Dateien, Geräte, Provider, Container oder echten LAN-Ziele; keine Staging-/Commitaktion. Ausschließlich dieser R2-Reviewbericht wurde geschrieben.

## VERDICT

**PASS — 0 CRITICAL / 0 WARN / 0 INFO.** FF-PRE-R1-01 ist durch den konkret ergänzten Vertrag und die verpflichtende kausale Abnahme geschlossen. Dieser PRE bestätigt die Ausführbarkeit des Plans; Implementierung und der vereinbarte unabhängige POST bleiben erforderlich.


## Vollständiger Report: file-namespace-pre-r1.md

# PRE R1 — gemeinsame Dateinamensraum-Sperre

## VERDICT: PASS

0 CRITICAL, 0 WARN, 1 INFO. Ausschließlich das Root-Delta in `docs/dev/2026-10-12-file-foundation-plan.md`, Abschnitt „Delta: überlappende LOCAL-Gerätewurzeln“, geprüft. Keine Abnahme der Journalimplementierung oder des gesamten Featurepakets.

## EVIDENCE

- Ausgeführt: `pnpm exec tsx .review/file-namespace-pre-probe.ts`, Exit 0. Eigene migrierte SQLite-Fixture, zwei echte Prisma-Clients, zwei synthetische LOCAL-Geräte mit derselben eigenen TempFS-Quelle; keine Nutzer-DB oder Geräteverbindung.
- Der aktuelle Helper erlaubte **2** gleichzeitig gehaltene Geräteleases für verschiedene Device-IDs; beide verwiesen tatsächlich auf **dieselbe native Dateiidentität**. Damit ist die Ursache der zusätzlichen Namespace-Sperre konkret belegt.
- Dieselbe bestehende atomare `AdmissionStore.acquire`-Implementierung akzeptierte für einen gemeinsamen festen Schlüssel **1** Besitzer und **0** zweite Besitzer; zweiter Client erhielt **409**. Nach Drain/Release wurde der zweite Client wieder zugelassen.
- Der Primitive-Test verwendete den bereits erlaubten festen Schlüssel `discover` ausschließlich in der eigenen DB als transparenten Platzhalter. Die geplante neue Literal-Whitelist `device-files` sowie Root-Helper/Integrität wurden nicht verändert. Das ist PRE-Evidenz für die keyunabhängige atomare Lease, keine Behauptung über schon implementierte Namespace-Integration.
- Gelesen: Root-Helper Erwerb/Signal/umgekehrter Close/TX-Fence; Integritätsjob direkter Einzel-Lease-Erwerb, Ergebnis-Writertransaktion und Restart-/Snapshot-Auswertung. Der Wechsel auf den gemeinsamen Helper und zusätzlich gespeicherten `globalOwner` passt zu diesen vorhandenen Laufzeitpfaden.
- Bounded Callsite-Prüfung bestätigte bereits den gemeinsamen Helper in Scanner, Doctor, Geräteänderungen, Sync, Profilen, Saves und Dateiplänen; die direkte Integritäts-Einzel-Lease ist im Delta ausdrücklich enthalten. Keine ganze Repoexploration, Vollsuite, Lint oder Build für diesen Review.
- Sämtliche Probe-Fixtures/Clients/Leases wurden geschlossen und eigene TempFS-/SQLite-Artefakte entfernt.

## FINDINGS

FNS-PRE-R1-I01 — INFO, `src/lib/device-integrity.ts` Start/Abschluss/Fehlerannotation und Snapshot: Beim Umstellen sind nicht nur Ergebnisse, sondern auch Besitzer-gebundene Jobzustände mit der tatsächlich gehaltenen globalen und Geräteautorität konsistent zu halten; Legacy-Zeilen ohne `globalOwner` dürfen keine laufende Autorität erhalten. Die Umsetzungstiefe ergibt sich beim Wechsel auf den bereits vorhandenen Writer-TX-Fence; das zusätzliche Feld und Restartprüfung sind ausdrücklich geplant. Advisory Minimalfix: denselben Helper-Fence für Besitzer-gebundene Zustandsschreibvorgänge einsetzen und fehlende globale Altbesitzer als unterbrochen behandeln. Kein zusätzlicher Planumfang erforderlich.

Die bewusst private Grenze „höchstens eine autoritative Dateiaufgabe gleichzeitig“ ist im Plan sichtbar; sie ist ein akzeptabler Mechanismus für diese App. Normales Browsen bleibt nicht autoritativ und kann weiterlaufen. Unbekannte Remote-Schreibgarantien werden durch die Sperre nicht zu garantierten Protokollfähigkeiten.
