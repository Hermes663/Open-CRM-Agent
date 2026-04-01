#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$ROOT_DIR/supabase/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "Brak katalogu migracji: $MIGRATIONS_DIR" >&2
  exit 1
fi

run_with_psql() {
  local database_url="$1"
  for file in "$MIGRATIONS_DIR"/*.sql; do
    echo "Applying $(basename "$file")"
    psql "$database_url" -v ON_ERROR_STOP=1 -f "$file"
  done
}

if [ -n "${DATABASE_URL:-}" ] && command -v psql >/dev/null 2>&1; then
  run_with_psql "$DATABASE_URL"
  exit 0
fi

if docker compose -f "$ROOT_DIR/docker/docker-compose.yml" ps db >/dev/null 2>&1; then
  for file in "$MIGRATIONS_DIR"/*.sql; do
    echo "Applying $(basename "$file") through docker compose"
    docker compose -f "$ROOT_DIR/docker/docker-compose.yml" exec -T db \
      psql -U autosales -d autosales -v ON_ERROR_STOP=1 -f - < "$file"
  done
  exit 0
fi

echo "Nie udało się uruchomić migracji. Ustaw DATABASE_URL z lokalnym psql albo uruchom usługę db przez docker compose." >&2
exit 1
