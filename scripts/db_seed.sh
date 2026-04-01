#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SEED_FILE="$ROOT_DIR/supabase/seed.sql"

if [ ! -f "$SEED_FILE" ]; then
  echo "Brak pliku seed: $SEED_FILE" >&2
  exit 1
fi

if [ -n "${DATABASE_URL:-}" ] && command -v psql >/dev/null 2>&1; then
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SEED_FILE"
  exit 0
fi

if docker compose -f "$ROOT_DIR/docker/docker-compose.yml" ps db >/dev/null 2>&1; then
  docker compose -f "$ROOT_DIR/docker/docker-compose.yml" exec -T db \
    psql -U autosales -d autosales -v ON_ERROR_STOP=1 -f - < "$SEED_FILE"
  exit 0
fi

echo "Nie udało się załadować seeda. Ustaw DATABASE_URL z lokalnym psql albo uruchom usługę db przez docker compose." >&2
exit 1
