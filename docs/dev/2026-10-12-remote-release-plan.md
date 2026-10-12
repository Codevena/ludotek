# Restore private LAN transfers and prepare a release

Base: fa21ea6. Markus explicitly requested restoring the missing SSH/SFTP and FTP/FTPS writers, Docker verification and release preparation. No push/tag/merge/publication. He chose normal FTP with hash checks/quarantine and documented concurrent-writer/power-loss limits, and allowed one bounded Docker Desktop test on this Mac. Use isolated loopback wire servers, own SQLite/files/certificates; never modify real user/device data. Preserve the original dirty checkout in its separate worktree.

## Runtime contract

Keep auth, bounded inputs, common SQLite device-files/files:id leases, owner/expiry fences, immutable previews, exact descriptor raw-byte snapshots, quarantine and original-byte retention. Do not return arbitrary unknown capabilities as supported or invent free bytes/native identity.

1. Split the existing transport implementations into dedicated SFTP and FTP modules behind the existing FileIo exports. Shared interfaces/scopes/meters retain LOCAL behavior. The strict primitives remain strict; introduce explicitly named checked-FTP mutations rather than claiming RNTO is atomic no-replace.
2. SFTP/Linux: use negotiated OpenSSH hardlink/fsync extensions; open directory with READ, fstat it and fsync its ordinary file handle. Probe without content changes. Exclusive write uses open wx, bounded stream, fsync before close and drain on abort. Use existing bounded SSH execution for native dev:ino metadata, safely quoted paths and type/size/mtime checks against SFTP. Validate namespace/realpath agreement, reject unsupported servers before mutation. No persistent daemon or installation on a device. Directory creation is nonrecursive and Undo only removes its verified empty creation.
3. FTP/FTPS: retain unsupported native fsync/atomic-no-replace flags. An explicit checked transfer policy records server acknowledgement, content/metadata checks and actual available uniqueID facts with their weaker validity. Reserve private staging ownership through raw exclusive MKD with a random plan filename/token, never ensureDir or recursive removeDir. Stream upload and read back/hash before checked RNFR/RNTO. Recheck absent target and source before mutation; do not silently overwrite known existing paths. Normal completed operations can Undo under the approved no-concurrent-external-writer boundary. Lost responses or unrecorded public effects remain recovery conflicts; never adopt a public file based only on identical hashes or a stale sidecar. Preserve uncertain files/quarantine for manual review. No claim of native identity or power-loss durability.
4. Read-only copy sources require bounded reads and exact content snapshots, not write/flush/free-space capabilities. Optional identities are compared when available; mutating strict targets and native LOCAL artifacts retain their existing strong checks. Carry strength explicitly in private specs/graph snapshots; a missing identity cannot silently downgrade a strict mutator. Undo of a verified copy need not mutate its source.
5. Surface the checked-FTP limitations in stored preview/status and normal UI. Profile/Upload/Save Restore and mkdir use the same journal policy. Unknown FTP capacity is shown as unknown: permit bounded transfer only with zero configured space reserve; an unprovable nonzero reserve refuses before conversion/write. Actual quota/write failures compensate or preserve recovery, never mark catalog success. No new auth/API roles or automatic actions.

## Files and ownership

- Root: shared file-io.ts contract/export refactor, release/package/docs/workflows/.dockerignore, integration orchestration, evidence/commit/Brain.
- SSH worker: new sftp-file-io.ts, narrow connection.ts native callback wiring, actual SSH/SFTP wire fixture and focused tests.
- FTP worker: new ftp-file-io.ts, actual FTP/FTPS wire fixture and focused tests.
- Journal worker: file-plans.ts/file-plans-directory.ts plus profile/upload/save consumers and FilePlanPanel warning; focused remote journal tests. No model/auth/other file changes unless coordinated.

Exclusive writing ownership; shared worktree, preserve other changes; controller stages/commits only. First independently review this concrete executable plan against the existing functions and the approved weaker FTP boundary, then implement. Maximum three rounds per gate, delta-only rereviews.

## Causal acceptance

- Actual client connections to owned loopback SSH/SFTP, FTP and verified FTPS certificates. Preview writes nothing. Successful LOCAL↔SFTP and checked-FTP transfers preserve actual bytes; full game CUE/GDI/M3U binding, Upload/Profile/Save Restore/mkdir plus Undo use real adapters, no protocol-renamed LOCAL fake.
- Native and content-precondition edits at same size/mtime reject before mutation; LOCAL/SFTP foreign identical identity replacement remains a conflict. FTP does not pretend it can prove foreign equal-content replacements; approved weaker boundary remains visible.
- Target exists before/after planning, workspace collision, unsupported extension, missing/changed unique facts, permission/quota error, partial transfer, channel loss, lost acknowledgement, SQLite failure after remote effect, restart/reconcile and cancellation/drain never create false completion. Original bytes/uncertain artifacts remain available.
- Remote copy source must not call any source mutation primitive. Descriptor graph snapshot and owner fences still reject their existing counterexamples. Auth/store/lease denial causes zero connect/write/conversion/provider side effects.
- Fake clock for deadlines; actual controlled socket draining where wire behavior is the tested invariant. No full suites/build/browser concurrently on this Mac.

## Release and Docker

Prepare v2.0.0-rc.1 locally: version, changelog/release notes, exact upgrade/rollback procedure and protocol capability matrix. No git tag or GitHub release creation/push. Keep existing MIT and private local/own-LAN positioning.

Build only a positively selected clean source context, exclude .env variants/private env/key/cert files, data/, SQLite sidecars and local agent artifacts. Check disk before large work. Build/test one own Docker Desktop image/container with explicit temporary bind roots/DB/data and --rm, no anonymous/shared volumes, no host network or real credentials. Verify startup as nonroot, existing-own-fixture migration, auth/root restrictions and HTTP plus own-source save paths; stop/drain and remove only owned image/container/build artifacts afterwards. No broad prune. CI should run tests and an isolated Docker correctness gate before the existing publisher; preparing workflow does not authorize publication.

Final unchanged-source gates: focused real transport/journal suites, full tests, tsc/lint, clean build and loopback browser, Docker runtime; independent executing POST. Record material limitations accurately, local coherent commits and canonical Brain/handoff. Do not call remote support complete from blanket refusal tests.
