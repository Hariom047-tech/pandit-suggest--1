-- ============================================================================
-- One-time RDS bootstrap — run as the RDS MASTER user, once, per database
-- ============================================================================
-- This is the ONLY thing the master account is used for (plus emergency
-- administration). It exists because three operations are not available to
-- panditsuggest_migrator and must not be granted to it permanently:
--
--   1. CREATE EXTENSION for postgis/vector/... requires rds_superuser
--   2. ALTER SCHEMA public OWNER requires ownership of `public`, which on
--      PostgreSQL 15+ belongs to pg_database_owner
--   3. CREATE ROLE
--
-- Run it BEFORE scripts/migrate.js. See docs/PRODUCTION_DB_RUNBOOK.md.
--
-- NO PASSWORDS APPEAR IN THIS FILE. Roles are created NOLOGIN; the runbook
-- grants LOGIN and sets credentials from AWS Secrets Manager, out of band.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Extensions  (master only)
-- ----------------------------------------------------------------------------
-- Verify availability first: `SELECT * FROM pg_available_extensions WHERE name
-- IN ('postgis','vector','pgcrypto','pg_trgm','btree_gin','unaccent');`
-- The AI HNSW index needs vector >= 0.8 — confirm before cutover.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS vector;

-- ----------------------------------------------------------------------------
-- 2. Roles
-- ----------------------------------------------------------------------------
DO $$
DECLARE r TEXT;
BEGIN
  FOREACH r IN ARRAY ARRAY['panditsuggest_owner','panditsuggest_migrator',
                           'panditsuggest_app','panditsuggest_readonly'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', r);
      RAISE NOTICE 'created role %', r;
    END IF;
  END LOOP;
END $$;

-- NOTE ON NOSUPERUSER / NOBYPASSRLS
-- Those two attributes are deliberately NOT restated here. On RDS there is no
-- true superuser: the master account is a member of rds_superuser but does not
-- carry the SUPERUSER attribute, and PostgreSQL requires SUPERUSER to change
-- either SUPERUSER or BYPASSRLS on any role — even to turn them OFF. Stating
-- them fails with:
--
--   ERROR: permission denied to alter role
--   DETAIL: Only roles with the SUPERUSER attribute may change the SUPERUSER attribute.
--
-- They are also unnecessary: CREATE ROLE defaults to NOSUPERUSER NOBYPASSRLS,
-- which is exactly what we want. So the desired state is asserted in the
-- self-check below rather than commanded here — if a role ever acquires either
-- attribute, the bootstrap fails loudly instead of silently continuing.

-- panditsuggest_owner owns every object and never logs in. Nothing
-- authenticates as it, so nothing can accidentally bypass RLS as the owner.
ALTER ROLE panditsuggest_owner  NOLOGIN NOCREATEDB NOCREATEROLE;

-- The migrator becomes the owner only for the duration of a deployment, via
-- the SET ROLE at the top of the baseline.
GRANT panditsuggest_owner TO panditsuggest_migrator;
ALTER ROLE panditsuggest_migrator NOCREATEDB NOCREATEROLE;

-- The runtime role must never own a table and must never bypass RLS. These
-- are the two properties that make the entire policy model real.
ALTER ROLE panditsuggest_app      NOCREATEDB NOCREATEROLE;
ALTER ROLE panditsuggest_readonly NOCREATEDB NOCREATEROLE;

-- ----------------------------------------------------------------------------
-- 3. Schema ownership and the CREATE privilege
-- ----------------------------------------------------------------------------
ALTER SCHEMA public OWNER TO panditsuggest_owner;

-- Revoking CREATE from PUBLIC is what keeps the SECURITY DEFINER search_path
-- hardening from being merely decorative: without CREATE on public, the app
-- role cannot plant a shadowing function or operator.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT  USAGE  ON SCHEMA public TO panditsuggest_app, panditsuggest_readonly;

-- ----------------------------------------------------------------------------
-- 4. Connection policy
-- ----------------------------------------------------------------------------
REVOKE ALL ON DATABASE :"dbname" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"dbname"
  TO panditsuggest_app, panditsuggest_migrator, panditsuggest_readonly;

-- ----------------------------------------------------------------------------
-- 5. Statement/lock ceilings for the runtime role
-- ----------------------------------------------------------------------------
-- Server-wide these are 0 (unlimited) today, which is how one runaway query
-- takes the site down. Set per role so a migration can still take longer.
ALTER ROLE panditsuggest_app SET statement_timeout = '30s';
ALTER ROLE panditsuggest_app SET lock_timeout = '5s';
ALTER ROLE panditsuggest_app SET idle_in_transaction_session_timeout = '60s';

ALTER ROLE panditsuggest_readonly SET statement_timeout = '60s';
ALTER ROLE panditsuggest_readonly SET default_transaction_read_only = on;

ALTER ROLE panditsuggest_migrator SET lock_timeout = '10s';
ALTER ROLE panditsuggest_migrator SET statement_timeout = '15min';

-- ----------------------------------------------------------------------------
-- 6. Self-check
-- ----------------------------------------------------------------------------
DO $verify$
DECLARE missing TEXT;
BEGIN
  SELECT string_agg(e, ', ') INTO missing
    FROM unnest(ARRAY['pgcrypto','postgis','pg_trgm','btree_gin','unaccent','vector']) e
   WHERE NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = e);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'bootstrap: extensions not installed: %', missing;
  END IF;

  IF (SELECT nspowner::regrole::text FROM pg_namespace WHERE nspname='public')
     <> 'panditsuggest_owner' THEN
    RAISE EXCEPTION 'bootstrap: schema public is not owned by panditsuggest_owner';
  END IF;

  -- Enforces what the ALTERs above deliberately cannot command on RDS.
  IF EXISTS (SELECT 1 FROM pg_roles
              WHERE rolname IN ('panditsuggest_owner','panditsuggest_migrator',
                                'panditsuggest_app','panditsuggest_readonly')
                AND (rolbypassrls OR rolsuper)) THEN
    RAISE EXCEPTION 'bootstrap: a panditsuggest role has BYPASSRLS or SUPERUSER';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='panditsuggest_owner' AND rolcanlogin) THEN
    RAISE EXCEPTION 'bootstrap: panditsuggest_owner must be NOLOGIN';
  END IF;

  RAISE NOTICE 'bootstrap ok: extensions installed, roles created, public owned by panditsuggest_owner.';
END
$verify$;
