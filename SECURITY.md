# Local security and data safety

Ludotek is an open-source application operated on a private machine or the operator's own LAN. Important assets are ROM/save files, immutable backup objects, the catalog, device credentials, provider keys and provider budgets.

## Access and filesystem configuration

- Production and LAN operation require `ADMIN_TOKEN` and an explicit `APP_ORIGIN`. Keep the token and encryption key private. Browser mutations require the configured Origin; an authenticated bearer CLI can operate without a browser Origin.
- Tokenless development uses the loopback launcher and fixed authority checks. Start it with the documented `pnpm dev` command.
- Configure exact `LOCAL_FILES_ROOT` or `LOCAL_FILES_ROOTS` directories. The server resolves real paths and excludes its database, application directories, encryption key and protected upload/backup areas. A device or HTTP input cannot grant a new LOCAL root.
- Device passwords and provider keys use the application encryption key. Back up the SQLite database, full data directory and matching key/private environment together. Preserve restricted permissions.

## File plans and saved versions

Authoritative file jobs share SQLite ownership leases, including a common namespace for overlapping LOCAL device roots. Catalog/result transactions verify the current owner and expiry inside the same writer transaction. Stopped or expired jobs cannot continue with a process-local lock fallback.

Plans derive paths, fingerprints, dependencies and preconditions on the server. Apply rechecks them, avoids silent replacement, and journals each effect. Delete and replacement preserve original bytes. Undo and recovery verify stored identity and content and stop on foreign changes. Filesystem and SQLite commits are separate; consult the stored plan after an interrupted or failed request.

Save objects have content-derived internal keys and immutable version records. Versions survive removal of a game or device. Restoring over an existing save requires a verified, persisted backup before target replacement. Direct access to the protected object directory is outside the device file browser.

LOCAL and Linux/OpenSSH SFTP mutation plans require evidenced native identity, no-replace publication and durability capabilities; missing SSH guarantees are rejected before mutation. Read-only copy sources use content checks without needing write guarantees. Normal FTP/FTPS has a separate checked policy and a visible preview warning: bounded hash-verified transfers and recorded server acknowledgements, without portable atomic no-replace, native fsync or durable identity. Equal-content foreign replacements cannot be distinguished, so FTP Undo assumes no concurrent external writer; lost/unrecorded public effects remain conflicts. Unknown FTP capacity permits only reserve0. LOCAL detection does not remove the native race between the last path identity check and unlink. Keep other software from editing the same files while applying or recovering a plan, and retain an independent backup for important originals.

## Optional network operations

Metadata services are used only with operator-configured keys; their requests consume bounded SQLite rate, budget and concurrency reservations. Save/ROM bytes are not metadata inputs. LAN discovery starts explicitly, selects a private local interface, and uses finite host, port, time and concurrency limits without credential attempts or automatic device creation.

## Reporting and reproducing a problem

Report the application version, startup mode, relevant configured protocol and a reproduction using small synthetic files. Include the stored plan/job status and exact error, with private paths redacted when appropriate. Do not attach `.env`, encryption keys, passwords, API tokens, actual ROMs or raw saves. For a suspected exploitable issue, choose a private maintainer reporting channel before publishing sensitive details.

Repository verification uses disposable SQLite files, temporary synthetic files and network/provider doubles. A passing test suite does not establish real hardware, operator volume permissions or every remote server's capabilities. Upgrade and rollback procedures are in [upgrading-local.md](docs/upgrading-local.md).
