#!/usr/bin/env bash
#
# Run pending migrations against production RDS, from the running backend
# container.
#
# Why this exists rather than a command in the runbook: that command is six
# lines with backslash continuations, a nested `sh -c '...'` and a URL long
# enough to wrap. Pasting it into a terminal mangles it — the quoting breaks
# mid-URL and the failure surfaces as something unrelated-looking, such as
# SELF_SIGNED_CERT_IN_CHAIN, which sends you looking at certificates when the
# certificates were never the problem. A file cannot be mangled by a paste.
#
#   ./backend/scripts/migrate-prod.sh --dry-run    # read it before you run it
#   ./backend/scripts/migrate-prod.sh
#
# The password is read from the terminal with `read -rs`, so it never appears
# in your command line, your shell history, or this repository. Get it from
# AWS Secrets Manager -> panditsuggest/rds/migrator.
#
# The CA bundle needs no flag: scripts/migrate.js defaults to
# ../../certs/rds-global-bundle.pem, which resolves to /certs inside the
# container, exactly where docker-compose.yml mounts it.
set -euo pipefail

CONTAINER="${CONTAINER:-panditconnect-backend}"
DB_HOST="${DB_HOST:-panditsuggest-prod.c1mysiqayycv.ap-south-1.rds.amazonaws.com}"
DB_NAME="${DB_NAME:-panditsuggest}"
DB_USER="${DB_USER:-panditsuggest_migrator}"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "error: container '$CONTAINER' is not running." >&2
  exit 1
fi

read -rsp "Password for ${DB_USER} (AWS Secrets Manager -> panditsuggest/rds/migrator): " PGPW
echo

if [ -z "$PGPW" ]; then echo "error: no password entered." >&2; exit 1; fi

# Passed as an environment variable on the exec, never interpolated into the
# argv of the command being run, so it does not show up in `docker inspect`'s
# Cmd or in the container's own process list.
docker exec -i \
  -e "MIGRATOR_PW=${PGPW}" \
  -e "MIGRATOR_HOST=${DB_HOST}" \
  -e "MIGRATOR_DB=${DB_NAME}" \
  -e "MIGRATOR_USER=${DB_USER}" \
  -e "DEPLOYMENT_ID=manual-$(date -u +%Y%m%dT%H%M%SZ)" \
  "$CONTAINER" \
  sh -c 'DATABASE_MIGRATOR_URL="postgresql://${MIGRATOR_USER}:${MIGRATOR_PW}@${MIGRATOR_HOST}:5432/${MIGRATOR_DB}?sslmode=verify-full" \
         exec node scripts/migrate.js '"$*"

unset PGPW
