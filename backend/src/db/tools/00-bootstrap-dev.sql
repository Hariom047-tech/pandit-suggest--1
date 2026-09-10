-- ============================================================================
-- Local development bootstrap  (docker compose only — NEVER production)
-- ============================================================================
-- The dev equivalent of 00-bootstrap-rds.sql. Same role model, same ownership,
-- same grants — the only difference is that the login roles get LOGIN and a
-- placeholder password here, because there is no Secrets Manager on a laptop.
--
-- These passwords are committed on purpose and are worth exactly nothing: they
-- match a database that only exists inside `docker compose`. Production
-- credentials are generated at cutover and live in AWS Secrets Manager; no
-- production password appears anywhere in this repository.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS vector;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'panditsuggest_owner') THEN
    CREATE ROLE panditsuggest_owner NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'panditsuggest_migrator') THEN
    CREATE ROLE panditsuggest_migrator LOGIN PASSWORD 'dev_migrator_not_a_secret';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'panditsuggest_app') THEN
    CREATE ROLE panditsuggest_app LOGIN PASSWORD 'dev_app_not_a_secret';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'panditsuggest_readonly') THEN
    CREATE ROLE panditsuggest_readonly LOGIN PASSWORD 'dev_readonly_not_a_secret';
  END IF;
END $$;

-- Identical posture to production: the owner cannot log in, and no runtime
-- role may bypass RLS. Dev must not be weaker than prod, or dev proves nothing.
--
-- LOGIN and the password are re-asserted rather than left to the CREATE above,
-- because these roles may already exist NOLOGIN from a previous run of the
-- production bootstrap against the same postgres server (the scratch and CI
-- databases share it). CREATE ... IF NOT EXISTS would then silently skip, and
-- the app could not connect at all.
ALTER ROLE panditsuggest_owner    NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
ALTER ROLE panditsuggest_app      LOGIN PASSWORD 'dev_app_not_a_secret'
                                  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
ALTER ROLE panditsuggest_readonly LOGIN PASSWORD 'dev_readonly_not_a_secret'
                                  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
ALTER ROLE panditsuggest_migrator LOGIN PASSWORD 'dev_migrator_not_a_secret'
                                  NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
GRANT panditsuggest_owner TO panditsuggest_migrator;

ALTER SCHEMA public OWNER TO panditsuggest_owner;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO panditsuggest_app, panditsuggest_readonly;
