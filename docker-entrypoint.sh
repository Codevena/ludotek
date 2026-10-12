#!/bin/sh
set -eu
: "${ADMIN_TOKEN:?Set ADMIN_TOKEN before starting a production container}"
: "${APP_ORIGIN:?Set APP_ORIGIN to the browser HTTP or HTTPS origin}"
export LUDOTEK_LOCAL_MODE=0
./node_modules/.bin/prisma migrate deploy
exec node server.js
