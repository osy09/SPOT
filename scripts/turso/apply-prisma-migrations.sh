#!/usr/bin/env bash
set -euo pipefail

if ! command -v turso >/dev/null 2>&1; then
  echo "[ERROR] turso CLI is required." >&2
  exit 1
fi

if ! command -v shasum >/dev/null 2>&1; then
  echo "[ERROR] shasum command is required." >&2
  exit 1
fi

DB_NAME="${1:-}"
MIGRATIONS_DIR="${2:-backend/prisma/migrations}"

if [[ -z "$DB_NAME" ]]; then
  echo "Usage: $0 <turso-db-name> [migrations-dir]" >&2
  echo "Example: $0 spot-prod backend/prisma/migrations" >&2
  exit 1
fi

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "[ERROR] Migrations directory not found: $MIGRATIONS_DIR" >&2
  exit 1
fi

query_scalar() {
  local sql="$1"
  turso db shell "$DB_NAME" "$sql" | tail -n1 | tr -d '[:space:]'
}

history_exists="$(query_scalar "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = '_prisma_migrations';")"
if [[ "$history_exists" != "1" ]]; then
  turso db shell "$DB_NAME" "CREATE TABLE IF NOT EXISTS \"_prisma_migrations\" (\"id\" TEXT NOT NULL PRIMARY KEY, \"checksum\" TEXT NOT NULL, \"finished_at\" DATETIME, \"migration_name\" TEXT NOT NULL, \"logs\" TEXT, \"rolled_back_at\" DATETIME, \"started_at\" DATETIME NOT NULL DEFAULT current_timestamp, \"applied_steps_count\" INTEGER NOT NULL DEFAULT 0);"
fi

shopt -s nullglob
migration_files=("$MIGRATIONS_DIR"/*/migration.sql)
shopt -u nullglob

if [[ ${#migration_files[@]} -eq 0 ]]; then
  echo "[ERROR] No migration.sql files found in: $MIGRATIONS_DIR" >&2
  exit 1
fi

for migration in "${migration_files[@]}"; do
  migration_name="$(basename "$(dirname "$migration")")"
  applied_count="$(query_scalar "SELECT COUNT(*) FROM \"_prisma_migrations\" WHERE migration_name = '$migration_name' AND rolled_back_at IS NULL;")"

  if [[ "$applied_count" != "0" ]]; then
    echo "[SKIP] $migration_name (already applied)"
    continue
  fi

  echo "[APPLY] $migration_name"
  turso db shell "$DB_NAME" < "$migration"

  checksum="$(shasum -a 256 "$migration" | awk '{print $1}')"
  turso db shell "$DB_NAME" "INSERT INTO \"_prisma_migrations\" (id, checksum, finished_at, migration_name, started_at, applied_steps_count) VALUES (lower(hex(randomblob(16))), '$checksum', CURRENT_TIMESTAMP, '$migration_name', CURRENT_TIMESTAMP, 1);"
done

echo "[OK] Prisma migrations are in sync for '$DB_NAME'."
