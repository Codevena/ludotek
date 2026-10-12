# Upgrading an existing local installation

Keep the existing SQLite file and encryption key. The old Docker runner used `prisma db push`; the new runner uses checked migrations and runs as UID/GID 1000. A populated database without migration history will correctly stop with **P3005**. Do not fix that error by resetting the database or falling back to `db push`.

## Preserve the installation first

1. Stop all app processes/containers using this database. Locate the actual database and `data/.encryption-key`; when `ENCRYPTION_KEY` came from the environment, preserve that exact private configuration instead. Retain the entire existing data volume as well.
2. Make a separate private backup. SQLite's backup API includes committed WAL content; copying just the main file can omit it. With Python 3 and a newly created backup directory outside version control:

```sh
set -eu
export LUDOTEK_DATABASE_FILE='/absolute/path/to/existing/games.db'
export LUDOTEK_BACKUP_DIR="$(mktemp -d '/absolute/private/backup-parent/ludotek-upgrade.XXXXXX')"
python3 - <<'PY'
import os, pathlib, sqlite3, urllib.parse
source_path = pathlib.Path(os.environ['LUDOTEK_DATABASE_FILE']).resolve(strict=True)
backup_path = pathlib.Path(os.environ['LUDOTEK_BACKUP_DIR']) / 'before-upgrade.db'
fd = os.open(backup_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
os.close(fd)
source = sqlite3.connect('file:' + urllib.parse.quote(str(source_path)) + '?mode=ro', uri=True)
backup = sqlite3.connect(backup_path)
try:
    source.backup(backup)
    assert backup.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
finally:
    backup.close()
    source.close()
PY
```

Copy the encryption key into that same private backup directory, preserving its restricted permissions. Do not print its value. A database backup alone cannot decrypt stored credentials if the key is lost. For Docker volumes, perform this maintenance against the existing volume contents with the app stopped; do not substitute a new empty named volume.

## Check migration history and the exact legacy schema

Run the following from the new repository with its installed Prisma **6.x**. Point at the preserved database using an absolute filename:

```sh
export DATABASE_URL="file:${LUDOTEK_DATABASE_FILE}"
```

If `_prisma_migrations` already contains successfully applied migrations, use the normal `pnpm exec prisma migrate deploy` upgrade. Do **not** mark them applied again. The baseline below is only for the former `db push` installation with no applied history.

First compare its schema with the checked-in legacy schema, which corresponds to the first sixteen migrations:

```sh
pnpm exec prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/legacy-db-push.schema.prisma \
  --exit-code
```

Continue **only when this exits 0 and reports no difference**. Exit 2 means an older/custom/divergent schema; exit 1 is a tool/database error. Either requires a version-specific upgrade before proceeding. Do not ignore the result or execute the generated difference against the library.

## Record the verified baseline, then upgrade

With the app still stopped, the backup verified and the exact legacy comparison passed, record only these existing migrations as applied. This creates migration history; it does not replay their schema changes:

```sh
set -eu
for migration in \
  20260412214523_init \
  20260413092011_add_videos_artworks_franchise_themes \
  20260413183237_add_ai_language \
  20260413192922_add_favorites \
  20260413200511_add_wishlist \
  20260413203155_add_rom_search_url \
  20260413203756_fix_rom_search_url_default \
  20260413204243_fix_rom_url_query_format \
  20260413220509_add_device_model \
  20260414012729_add_active_device_id \
  20260414015102_add_game_device \
  20260414120000_add_sync_queue \
  20260414142420_add_cache_models \
  20260416210000_fix_cache_entry_per_game \
  20260602120000_add_gamedevice_originalfile \
  20260602130000_add_device_ftps
do
  pnpm exec prisma migrate resolve --applied "$migration"
done
pnpm exec prisma migrate deploy
```

If any command fails, keep the app stopped and investigate or restore the backup. Do not advance to later commands after a failure. After a successful upgrade, check the existing game/device counts, configured paths and credential availability before resuming device operations.

## Docker path and permissions

The new image keeps migration files at `/app/prisma` and stores its database at `/app/db`. A previous database such as `/app/prisma/games.db` must remain the **same existing volume and file**, mounted at `/app/db`, with `DATABASE_URL=file:/app/db/games.db`. Do not silently switch to `/app/db/ludotek.db` if the existing file is named `games.db`. The updated development Compose example retains the previous `ludotek-data` volume name and `games.db` filename while changing the mount target.

Keep the old image, both volume backups and the key until verification succeeds. UID/GID 1000 needs write access to the exact database directory and data directory (including the key). Review existing ownership and grant only those directories the needed access; the new runner does not automatically change existing volume permissions. Container migration/permission behavior still depends on the user's actual volumes.

For rollback, stop the new app, restore the backed-up database and matching key/private environment, then use the previous image. Never start old and new processes against the same file during recovery.

The schema-check/baseline/deploy procedure is tested with an isolated former-db-push fixture: games, device links and encrypted credential bytes remain unchanged; a divergent schema is rejected before any migration is marked applied. No actual user installation was migrated by the project tests.
