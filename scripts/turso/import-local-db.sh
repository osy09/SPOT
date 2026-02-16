#!/usr/bin/env bash
set -euo pipefail

if ! command -v turso >/dev/null 2>&1; then
  echo "[ERROR] turso CLI is required." >&2
  exit 1
fi

DB_NAME="${1:-}"
SQLITE_FILE="${2:-backend/prisma/dev.db}"

if [[ -z "$DB_NAME" ]]; then
  echo "Usage: $0 <turso-db-name> [sqlite-file-path]" >&2
  echo "Example: $0 spot-prod backend/prisma/dev.db" >&2
  exit 1
fi

if [[ ! -f "$SQLITE_FILE" ]]; then
  echo "[ERROR] SQLite file not found: $SQLITE_FILE" >&2
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "[ERROR] sqlite3 command is required." >&2
  exit 1
fi

if turso db show "$DB_NAME" >/dev/null 2>&1; then
  echo "[ERROR] Database already exists: $DB_NAME" >&2
  exit 1
fi

echo "[0/3] Ensuring WAL mode on '$SQLITE_FILE'..."
sqlite3 "$SQLITE_FILE" "PRAGMA journal_mode = WAL;" >/dev/null

echo "[1/3] Creating Turso DB '$DB_NAME' from '$SQLITE_FILE'..."
turso db create "$DB_NAME" --from-file "$SQLITE_FILE" --wait

echo "[2/3] Fetching Turso DB URL..."
DB_URL="$(turso db show "$DB_NAME" --url)"

echo "[3/3] Creating auth token..."
DB_TOKEN="$(turso db tokens create "$DB_NAME")"

cat <<OUT

[OK] Turso migration completed.

Set these values in your environment (.env):
TURSO_DATABASE_URL=$DB_URL
TURSO_AUTH_TOKEN=$DB_TOKEN

OUT
