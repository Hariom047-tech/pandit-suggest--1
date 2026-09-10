-- ============================================================================
-- Post-apply schema verification
-- ============================================================================
-- Run after baseline + config + migrations, on every fresh build and in CI.
-- Every check RAISEs rather than returning a row, so a non-zero exit is the
-- only possible outcome of a failure.
--
--   psql -d <db> -v ON_ERROR_STOP=1 -f tools/verify-schema.sql
-- ============================================================================

\set ON_ERROR_STOP on

-- ----------------------------------------------------------------------------
-- 1. Every function body re-validates against the completed schema
-- ----------------------------------------------------------------------------
-- The baseline is a pg_dump, and pg_dump emits functions BEFORE the tables they
-- read, then sets check_function_bodies = false so that ordering is legal. That
-- is safe (the runner applies the whole file in one transaction, so the schema
-- is never half-built), but it means applying the baseline does NOT prove the
-- absence of a dangling reference — which is the class of defect that made the
-- original 01-schema.sql unable to build a fresh database at all.
--
-- So prove it here instead: re-create every non-extension function with body
-- checking ON, against the finished schema. A function referencing a missing
-- relation fails loudly at this point.
SET check_function_bodies = on;

DO $$
DECLARE
  f     RECORD;
  n     INT := 0;
BEGIN
  FOR f IN
    SELECT p.oid, pg_get_functiondef(p.oid) AS def
      FROM pg_proc p
      JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public'
       AND p.prokind IN ('f', 'p')
       -- Skip anything owned by an extension (PostGIS alone is ~1,000
       -- functions, and they are the extension's problem, not ours).
       AND NOT EXISTS (
             SELECT 1 FROM pg_depend d
              WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    BEGIN
      EXECUTE f.def;
      n := n + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'function body does not validate: % — %',
        f.oid::regprocedure, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'verify: % application function bodies re-validated with check_function_bodies=on', n;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Security posture
-- ----------------------------------------------------------------------------
DO $$
DECLARE n INT; bad TEXT;
BEGIN
  -- Every SECURITY DEFINER function pins search_path.
  SELECT count(*), string_agg(p.oid::regprocedure::text, ', ')
    INTO n, bad
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.prosecdef AND p.proconfig IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'verify: % SECURITY DEFINER function(s) do not pin search_path: %', n, bad;
  END IF;

  -- No LOGIN role may own an application table. This is what replaces FORCE
  -- ROW LEVEL SECURITY: policies are bypassable by a table's owner, so the
  -- guarantee we need is that no session can ever run as one. FORCE RLS itself
  -- is not usable here because the 14 SECURITY DEFINER functions execute as
  -- the owner by design (see tools/hardening.sql H1).
  SELECT count(*), string_agg(DISTINCT c.relowner::regrole::text, ', ')
    INTO n, bad
    FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    JOIN pg_roles r ON r.oid = c.relowner
   WHERE ns.nspname = 'public' AND c.relkind = 'r' AND r.rolcanlogin
     AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e')
     -- schema_migrations is deliberately owned by the migrator that creates it:
     -- it is deployment metadata, carries no user data, has no RLS to bypass,
     -- and is not granted to the runtime app role at all.
     AND c.relname <> 'schema_migrations';
  IF n > 0 THEN
    RAISE EXCEPTION 'verify: % application table(s) are owned by a role that can LOG IN (%). Ownership must be a NOLOGIN role.', n, bad;
  END IF;

  -- And that owner must not itself be able to bypass RLS or be superuser.
  IF EXISTS (SELECT 1 FROM pg_roles
              WHERE rolname = 'panditsuggest_owner'
                AND (rolcanlogin OR rolbypassrls OR rolsuper)) THEN
    RAISE EXCEPTION 'verify: panditsuggest_owner must be NOLOGIN, NOBYPASSRLS, NOSUPERUSER';
  END IF;

  -- RLS must still be ENABLED on every table that had it.
  SELECT count(*) INTO n
    FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
   WHERE ns.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity;
  IF n < 16 THEN
    RAISE EXCEPTION 'verify: RLS is enabled on only % tables, expected >= 16', n;
  END IF;

  -- The runtime role must not be able to read credentials.
  IF EXISTS (
    SELECT 1 FROM information_schema.column_privileges
     WHERE grantee = 'panditsuggest_app' AND table_name = 'users'
       AND privilege_type = 'SELECT'
       AND column_name IN ('password_hash','totp_secret_encrypted',
                           'google_id','facebook_id','date_of_birth')
  ) THEN
    RAISE EXCEPTION 'verify: panditsuggest_app can SELECT a credential column of users';
  END IF;

  -- No runtime role may bypass RLS or be superuser.
  IF EXISTS (SELECT 1 FROM pg_roles
              WHERE rolname IN ('panditsuggest_app','panditsuggest_readonly')
                AND (rolbypassrls OR rolsuper)) THEN
    RAISE EXCEPTION 'verify: a runtime role has BYPASSRLS or SUPERUSER';
  END IF;

  RAISE NOTICE 'verify: security posture ok (search_path pinned, owner is NOLOGIN, RLS enabled, no credential reads)';
END $$;

-- ----------------------------------------------------------------------------
-- 3. Business-critical objects exist with the right shape
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Lead distribution. Exactly ONE canonical definition of each, at the
  -- arity the application calls — historical migrations redefined
  -- record_qualified_lead four times at two different arities.
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
       WHERE ns.nspname='public' AND p.proname='record_qualified_lead') <> 1 THEN
    RAISE EXCEPTION 'verify: record_qualified_lead must have exactly one definition';
  END IF;
  IF to_regprocedure('public.record_qualified_lead(uuid,uuid,contact_method,integer,character varying,uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'verify: record_qualified_lead has the wrong signature (expected the 7-arg form)';
  END IF;
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
       WHERE ns.nspname='public' AND p.proname='get_pandit_lead_counts') <> 1 THEN
    RAISE EXCEPTION 'verify: get_pandit_lead_counts must have exactly one definition';
  END IF;

  -- Payment integrity, enforced structurally rather than by convention.
  IF to_regclass('public.uq_payment_gateway_payment_id') IS NULL THEN
    RAISE EXCEPTION 'verify: missing unique index on payment_transactions.gateway_payment_id';
  END IF;
  IF to_regclass('public.uq_payment_gateway_order_id') IS NULL THEN
    RAISE EXCEPTION 'verify: missing unique index on payment_transactions.gateway_order_id';
  END IF;
  IF to_regclass('public.uq_subscription_one_active_per_pandit') IS NULL THEN
    RAISE EXCEPTION 'verify: missing "one active subscription per pandit" index';
  END IF;

  -- The webhook idempotency primitive.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid='public.webhook_events'::regclass AND contype='u') THEN
    RAISE EXCEPTION 'verify: webhook_events has no unique dedupe constraint';
  END IF;

  RAISE NOTICE 'verify: lead and payment invariants present';
END $$;

-- ----------------------------------------------------------------------------
-- 4. Zero test/demo/business data  (Phase 16 assertion)
-- ----------------------------------------------------------------------------
DO $$
DECLARE n BIGINT; t TEXT; offenders TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['pandits','qualified_leads','contact_clicks',
                           'payment_transactions','pandit_subscriptions','reviews',
                           'inquiries','temples','pandit_analytics','pandit_exposure',
                           'user_activity_events','ai_query_analytics','visitor_geo_log',
                           'security_audit_log','admin_activity_log','notifications']
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION 'verify: % must be empty at T=0 but holds % row(s)', t, n;
    END IF;
  END LOOP;

  -- users may contain ONLY the genuine super-admin, and nothing matching a
  -- known fixture pattern.
  SELECT count(*), string_agg(email, ', ') INTO n, offenders
    FROM public.users
   WHERE email LIKE '%@test.local'
      OR email LIKE '%@panditsuggest.test'
      OR email LIKE '%@panditconnect.demo'
      OR email LIKE '%@example.com'
      OR email LIKE 'admin-test-%';
  IF n > 0 THEN
    RAISE EXCEPTION 'verify: % fixture user(s) present: %', n, offenders;
  END IF;

  SELECT count(*) INTO n FROM public.users;
  IF n > 1 THEN
    SELECT string_agg(email, ', ') INTO offenders FROM public.users;
    RAISE EXCEPTION 'verify: expected at most 1 user (the super-admin), found %: %', n, offenders;
  END IF;

  RAISE NOTICE 'verify: zero business data, % user(s) present', n;
END $$;

-- ----------------------------------------------------------------------------
-- 5. Required configuration is present
-- ----------------------------------------------------------------------------
DO $$
DECLARE n INT;
BEGIN
  SELECT count(*) INTO n FROM public.distribution_config;
    IF n < 14 THEN RAISE EXCEPTION 'verify: distribution_config has % keys, expected >= 14', n; END IF;
  SELECT count(*) INTO n FROM public.plan_market_entitlements WHERE is_active;
    IF n < 4 THEN RAISE EXCEPTION 'verify: only % active plan_market_entitlements', n; END IF;
  SELECT count(*) INTO n FROM public.subscription_plans;
    IF n < 2 THEN RAISE EXCEPTION 'verify: only % subscription_plans', n; END IF;
  SELECT count(*) INTO n FROM public.services;
    IF n < 32 THEN RAISE EXCEPTION 'verify: only % services in the catalogue', n; END IF;
  RAISE NOTICE 'verify: production configuration present';
END $$;

DO $$ BEGIN RAISE NOTICE 'verify-schema: ALL CHECKS PASSED'; END $$;
