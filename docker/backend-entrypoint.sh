#!/bin/sh
set -eu

node --enable-source-maps /app/apps/backend/dist/database/migrate.js
exec "$@"
