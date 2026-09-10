#!/usr/bin/env bash
# Deterministic schema fingerprint for a database.
#
# Two databases built from the same baseline + config + migrations must produce
# the same fingerprint. Used by the CI fresh-install/upgrade equivalence gate
# and by the restore drill.
#
#   ./tools/schema-fingerprint.sh <dbname> [--verbose]
set -euo pipefail
DB="${1:?usage: schema-fingerprint.sh <dbname>}"
CONTAINER="${PG_CONTAINER:-panditconnect-db}"
SUPER="${PG_SUPERUSER:-panditconnect}"

# pg_dump output is stable for a given catalog state, but carries a version
# banner and per-run comments. Strip those, plus the ledger (whose timestamps
# and execution_ms legitimately differ between two runs).
docker exec "$CONTAINER" pg_dump -U "$SUPER" -d "$DB" \
    --schema-only --no-owner --schema=public \
    --exclude-table=public.schema_migrations \
  | grep -v '^--' \
  | grep -v '^$' \
  | grep -v '^SET ' \
  | grep -v '^SELECT pg_catalog.set_config' \
  | sort \
  | sha256sum | cut -d' ' -f1
