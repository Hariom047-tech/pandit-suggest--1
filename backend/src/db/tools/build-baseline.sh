#!/usr/bin/env bash
# ============================================================================
# Regenerates baseline/0000-production-baseline.sql from historical/01..36.
#
# The baseline is a GENERATED artifact. It is committed (so production and CI
# apply reviewed bytes, not a build run), but it must never be hand-edited —
# re-run this instead, and the diff shows exactly what moved.
#
#   ./tools/build-baseline.sh <scratch-db-name>
#
# Requires the local postgres container. Never point this at RDS.
# ============================================================================
set -euo pipefail

SCRATCH="${1:-baseline_build}"
CONTAINER="${PG_CONTAINER:-panditconnect-db}"
SUPER="${PG_SUPERUSER:-panditconnect}"
DB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HIST="$DB_DIR/historical"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

psql_scratch() { docker exec -i "$CONTAINER" psql -U "$SUPER" -d "$SCRATCH" -v ON_ERROR_STOP=1 -q "$@"; }

echo "==> Recreating scratch database: $SCRATCH"
docker exec "$CONTAINER" psql -U "$SUPER" -d postgres -q \
  -c "DROP DATABASE IF EXISTS $SCRATCH;" -c "CREATE DATABASE $SCRATCH;"

# --------------------------------------------------------------------------
# Roles. Created NOLOGIN and WITHOUT passwords on purpose: the baseline is in
# git, so it must never contain a credential. The cutover runbook grants LOGIN
# and sets passwords from Secrets Manager.
# --------------------------------------------------------------------------
echo "==> Creating role model"
docker exec -i "$CONTAINER" psql -U "$SUPER" -d "$SCRATCH" -v ON_ERROR_STOP=1 -q <<'ROLES'
DO $$
DECLARE r TEXT;
BEGIN
  FOREACH r IN ARRAY ARRAY['panditsuggest_owner','panditsuggest_migrator',
                           'panditsuggest_app','panditsuggest_readonly'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', r);
    END IF;
  END LOOP;
END $$;
ROLES

# --------------------------------------------------------------------------
# 01-schema.sql, transformed:
#   - drop the DROP/CREATE SCHEMA public preamble (RDS owns that schema and
#     recreating it loses RDS's default ACLs)
#   - drop the CREATE ROLE block carrying a git-committed password
#   - relocate get_pandit_lead_counts() past contact_clicks (the one genuine
#     ordering defect: its body forward-references a table 31 lines later)
#   - rename the runtime role to the production name
# --------------------------------------------------------------------------
echo "==> Transforming 01-schema.sql"
sed -n '800,819p' "$HIST/01-schema.sql" > "$WORK/leadcounts.sql"
{
  sed -n '1,11p'   "$HIST/01-schema.sql"   # header, minus DROP/CREATE SCHEMA
  sed -n '14,28p'  "$HIST/01-schema.sql"   # extensions, minus role block
  sed -n '39,799p' "$HIST/01-schema.sql"   # everything up to the stray function
  sed -n '820,$p'  "$HIST/01-schema.sql"   # everything after it
  echo
  echo "-- [build-baseline] relocated from 01-schema.sql:807 — body reads contact_clicks"
  cat "$WORK/leadcounts.sql"
} | sed 's/panditconnect_app/panditsuggest_app/g' > "$WORK/01.sql"

psql_scratch < "$WORK/01.sql"
echo "    01-schema.sql ok"

# --------------------------------------------------------------------------
# 03..36. 02-seed.sql is EXCLUDED — it is demo content (23 users sharing one
# committed bcrypt hash, including an active admin), never production data.
# --------------------------------------------------------------------------
for f in "$HIST"/[0-3][0-9]-*.sql; do
  b="$(basename "$f")"
  case "$b" in 01-*|02-seed*) continue;; esac

  # Migration 25's self-check asserts >= 8 published GLOBAL FAQs — a
  # CONTENT assertion that only ever passed because 02-seed.sql supplied
  # them. Production legitimately starts with zero FAQs. Satisfy it with
  # placeholders, then remove them; the baseline is schema-only regardless.
  if [ "$b" = "25-universal-faqs.sql" ]; then
    psql_scratch -c "INSERT INTO faqs (question, answer, display_order)
                     SELECT 'baseline-build placeholder ' || g, 'removed after build', g
                     FROM generate_series(1,8) g;"
  fi

  sed 's/panditconnect_app/panditsuggest_app/g' "$f" | psql_scratch
  echo "    $b ok"

  if [ "$b" = "25-universal-faqs.sql" ]; then
    psql_scratch -c "DELETE FROM universal_faqs WHERE question LIKE 'baseline-build placeholder %';"
  fi
done

# --------------------------------------------------------------------------
echo "==> Applying hardening delta"
psql_scratch < "$DB_DIR/tools/hardening.sql"

# --------------------------------------------------------------------------
echo "==> Asserting the build carries no data"
docker exec -i "$CONTAINER" psql -U "$SUPER" -d "$SCRATCH" -v ON_ERROR_STOP=1 -q <<'ASSERT'
DO $$
DECLARE n BIGINT;
BEGIN
  SELECT count(*) INTO n FROM users;            IF n > 0 THEN RAISE EXCEPTION 'users must be empty, found %', n; END IF;
  SELECT count(*) INTO n FROM pandits;          IF n > 0 THEN RAISE EXCEPTION 'pandits must be empty, found %', n; END IF;
  SELECT count(*) INTO n FROM universal_faqs;   IF n > 0 THEN RAISE EXCEPTION 'faq placeholders leaked, found %', n; END IF;
  SELECT count(*) INTO n FROM temples;          IF n > 0 THEN RAISE EXCEPTION 'temples must be empty, found %', n; END IF;
END $$;
ASSERT

# --------------------------------------------------------------------------
echo "==> Dumping baseline"
docker exec "$CONTAINER" pg_dump -U "$SUPER" -d "$SCRATCH" \
  --schema-only --no-owner \
  --schema=public \
  --exclude-table=public.schema_migrations \
  > "$DB_DIR/baseline/0000-production-baseline.sql.tmp"

{
  cat <<'HDR'
-- ============================================================================
-- PanditSuggest — production schema baseline
-- ============================================================================
-- GENERATED FILE. Do not hand-edit.
--   Regenerate: backend/src/db/tools/build-baseline.sh <scratch-db>
--   Source:     historical/01-schema.sql (transformed) + historical/03..36
--               + tools/hardening.sql
--   Excluded:   historical/02-seed.sql (demo content — never production)
--
-- This is the ONLY bootstrap mechanism for a new production database. The
-- historical migrations are provenance, not a deployment path.
--
-- Contains schema only: extensions, types, tables, constraints, indexes,
-- functions, triggers, views, RLS, policies and grants. No rows of any kind.
-- Roles are created NOLOGIN and WITHOUT passwords; the cutover runbook grants
-- LOGIN and sets credentials from AWS Secrets Manager.
-- ============================================================================

DO $roles$
DECLARE r TEXT;
BEGIN
  FOREACH r IN ARRAY ARRAY['panditsuggest_owner','panditsuggest_migrator',
                           'panditsuggest_app','panditsuggest_readonly'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', r);
    END IF;
  END LOOP;
END $roles$;

-- Every object below is owned by panditsuggest_owner, never by the migrator
-- that happens to be applying this and never by the RDS master user. That is
-- what makes FORCE ROW LEVEL SECURITY meaningful: no login role owns these
-- tables, so no login role can bypass their policies.
SET ROLE panditsuggest_owner;


-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
-- Emitted explicitly rather than left to pg_dump: --schema=public omits them
-- entirely, and on RDS these must be created before anything that depends on
-- them (PostGIS for the geo indexes, vector for the AI HNSW index, pgcrypto
-- for gen_random_uuid()). All are on the RDS PostgreSQL 16 supported list;
-- verify the target minor ships vector >= 0.8 before cutover.
CREATE EXTENSION IF NOT EXISTS pgcrypto  WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS postgis   WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm   WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS btree_gin WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS unaccent  WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS vector    WITH SCHEMA public;

HDR
  # `public` already exists on every fresh database, RDS included, where it
  # is owned by pg_database_owner — recreating it would both fail and lose
  # RDS's default ACLs.
  # Two statements pg_dump always emits that a non-owner cannot run, and that
  # a fresh database does not need:
  #   CREATE SCHEMA public       — always already exists (RDS included)
  #   COMMENT ON SCHEMA public   — requires owning `public`, which on PG15+ is
  #                                owned by pg_database_owner, not by us
  sed -e 's/^CREATE SCHEMA public;$/-- [build-baseline] CREATE SCHEMA public omitted: it always exists./' \
      -e "s/^COMMENT ON SCHEMA public IS .*/-- [build-baseline] COMMENT ON SCHEMA public omitted: requires schema ownership./" \
      -e 's/ALTER DEFAULT PRIVILEGES FOR ROLE panditconnect /ALTER DEFAULT PRIVILEGES FOR ROLE panditsuggest_owner /' \
    "$DB_DIR/baseline/0000-production-baseline.sql.tmp"
} > "$DB_DIR/baseline/0000-production-baseline.sql"
rm -f "$DB_DIR/baseline/0000-production-baseline.sql.tmp"

# The local build superuser must never appear in a file destined for RDS.
if grep -qE '(^|[^_a-z])panditconnect([^_a-z]|$)' "$DB_DIR/baseline/0000-production-baseline.sql" \
     --include=* 2>/dev/null; then
  if grep -nE '(^|[^_a-z])panditconnect([^_a-z]|$)' "$DB_DIR/baseline/0000-production-baseline.sql" | grep -qv '^\s*[0-9]*:--'; then
    echo "ERROR: baseline still references the local build role 'panditconnect':" >&2
    grep -nE '(^|[^_a-z])panditconnect([^_a-z]|$)' "$DB_DIR/baseline/0000-production-baseline.sql" | grep -v ':--' >&2
    exit 1
  fi
fi

echo "==> Baseline written: $(wc -l < "$DB_DIR/baseline/0000-production-baseline.sql") lines"
echo "==> sha256: $(sha256sum "$DB_DIR/baseline/0000-production-baseline.sql" | cut -d' ' -f1)"
