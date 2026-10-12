# Reviewing and recovering local file work

The File Manager first creates a stored preview. It does not apply a copy, move, rename, delete or mkdir merely because the preview request succeeded. Read the source/target list and any generated descriptor changes, then choose **Plan ausführen**. Parent directories must already exist; create a separate reviewed folder plan when necessary.

## Interrupted work

Open **Gespeicherte Dateipläne**, or follow `/files?plan=<id>`. Refresh the stored status after an HTTP failure or cancellation. A failure after file publication can leave real effects even when the final database transaction did not commit.

Choose **Wiederherstellung prüfen** for a plan that needs recovery. The journal compares original, temporary, published and quarantined entries by identity and content. Verified effects are restored in reverse order; foreign replacements or changed content stop the operation with a conflict. Preserve the original device configuration and all `.ludotek-*` artifacts until the plan is resolved. Do not manually erase them to clear an error.

An applied plan offers **Rückgängig machen**. Copy output is retained in owned undo quarantine; original moved/deleted/replaced files are restored only when their recorded state matches. Directory Undo removes only a verified owned empty directory. Newly added user files are never recursively removed by directory Undo.

## Saves and physical inventory

Backup saves before restore or sync; versions remain in the protected application data store after catalog/device removal. The global **Save-Versionen** page can list them even when no device remains. Restore requires an explicitly selected existing device and a declared save root, then a separate reviewed journal application.

Scan devices to confirm physical paths before ROM sync. The manifest retains discs, tracks, variants and actual directory aliases even when the catalog groups them as one title. Legacy links without confirmed files cannot authorize an old rename/delete queue entry. Incomplete scans and Doctor snapshots keep unobserved files unknown and cannot justify deleting them.

## Backup, storage and protocol limits

Keep an independent copy of important originals. Back up the catalog with SQLite's backup API or with the app stopped, including committed WAL data, and keep the full data directory and matching encryption key/private configuration. Never reset an old database to solve migration errors; use [the checked upgrade procedure](upgrading-local.md).

The application retains immutable save versions and verified journal artifacts; it does not silently apply retention to them. Check available storage before large work. Remote protocol support is per capability, and a successful SSH/FTP login is not evidence of safe no-replace publication or directory flush. Unknown required capabilities fail visibly before device writes.
