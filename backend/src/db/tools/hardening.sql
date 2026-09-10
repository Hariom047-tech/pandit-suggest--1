-- ============================================================================
-- Production hardening delta
-- ============================================================================
-- Applied on top of historical/01..36 by tools/build-baseline.sh to produce
-- baseline/0000-production-baseline.sql. This file is BUILD INPUT, never a
-- migration: it exists so the security fixes baked into the baseline are
-- reviewable as a diff rather than buried in a 7,000-line schema dump.
--
-- Every item traces to a finding in docs/DB_PRODUCTION_AUDIT.md.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- H1 (P1-13) — the owner must not be a role anything can connect as
-- ----------------------------------------------------------------------------
-- The finding: relforcerowsecurity was false everywhere, so a connection as the
-- table owner silently bypassed all 57 policies. Under the old two-role model
-- that mattered a great deal — the owner was `panditconnect`, a LOGIN SUPERUSER
-- used for migrations, admin scripts AND the test suite's "super pool".
--
-- FORCE ROW LEVEL SECURITY is the obvious fix and it is the WRONG one here.
-- It subjects the owner to its own policies, and all 14 SECURITY DEFINER
-- functions execute as the owner — that is the entire point of them. Forcing
-- RLS makes record_qualified_lead() unable to see the user it is validating
-- and auth_find_user_by_email() unable to find anyone, so authentication and
-- lead recording both fail closed. (Verified: with FORCE on, L1 of
-- tools/test-lead-payment.sql returns user_not_found.)
--
-- The real fix is structural, and it is stronger: nothing can connect as the
-- owner at all. tools/00-bootstrap-rds.sql creates panditsuggest_owner NOLOGIN
-- NOBYPASSRLS, and it owns every object. The migrator reaches it only via
-- SET ROLE, for the duration of a deployment. No login role owns any table, so
-- there is no session in which policies can be bypassed — while the definer
-- functions keep the narrow, audited bypass they are designed around.
--
-- tools/verify-schema.sql asserts both halves of this on every build.

-- ----------------------------------------------------------------------------
-- H2 (P0-4) — users: column-level SELECT, so RLS row visibility stops
--             being column visibility
-- ----------------------------------------------------------------------------
-- PROVEN in the audit: an anonymous app-role connection could read 100% of
-- `users` including the admin's password_hash, because users_select_public
-- and users_select_via_public_content expose whole ROWS and RLS has no
-- column dimension.
--
-- Authentication is unaffected: every credential read already goes through
-- the SECURITY DEFINER auth_* functions, which execute as the owner and are
-- not subject to these grants.
REVOKE SELECT ON public.users FROM panditsuggest_app;
GRANT SELECT (
  id, email, phone, full_name, display_name, avatar_url,
  role, status, city, state, pincode, latitude, longitude,
  preferred_language, theme_preference,
  email_verified, phone_verified, last_login_at, login_count,
  totp_enabled, created_at, updated_at, deleted_at, country
) ON public.users TO panditsuggest_app;

-- INSERT/UPDATE deliberately keep full column coverage: signup writes
-- password_hash, Google linking writes google_id, admin pandit creation
-- writes date_of_birth, admin MFA enrolment writes totp_secret_encrypted.
-- Writing a secret you cannot read back is exactly the property we want.

-- ----------------------------------------------------------------------------
-- H3 (P1-4) — pin search_path on every SECURITY DEFINER function
-- ----------------------------------------------------------------------------
-- All 14 had proconfig = NULL. Currently mitigated by the app role having no
-- CREATE on public, but one careless GRANT CREATE would open the classic
-- definer-hijack. Pin it so the mitigation is not load-bearing.
DO $$
DECLARE f TEXT;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', f);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- H4 (P1-7) — pandit_analytics: remove the policy that made the others dead
-- ----------------------------------------------------------------------------
-- Migration 21 widened SELECT to `true` to fix an upsert failure, which made
-- analytics_select_own and analytics_select_admin unreachable and published
-- every pandit's analytics to every caller. The upsert needs to SEE the row
-- it conflicts with, so the fix is to scope SELECT to the same rows the
-- system may write, not to open it to everything.
DROP POLICY IF EXISTS analytics_select_system ON public.pandit_analytics;

-- ----------------------------------------------------------------------------
-- H5 (P1-3) — ai_query_analytics: verbatim user queries had no RLS at all
-- ----------------------------------------------------------------------------
-- Same sentences migration 13 correctly locks down in ai_messages were
-- readable (and DELETEable) by any app-role connection here.
ALTER TABLE public.ai_query_analytics ENABLE ROW LEVEL SECURITY;

-- The pipeline must be able to record a query...
CREATE POLICY ai_qa_insert_system ON public.ai_query_analytics
  FOR INSERT WITH CHECK (true);
-- ...and admins may read the aggregate demand signal...
CREATE POLICY ai_qa_select_admin ON public.ai_query_analytics
  FOR SELECT USING (current_app_user_is_admin());
-- ...but nothing else may read the query text back out.
REVOKE DELETE, UPDATE ON public.ai_query_analytics FROM panditsuggest_app;

-- ----------------------------------------------------------------------------
-- H6 (P1-5) — payment & subscription integrity as structure, not convention
-- ----------------------------------------------------------------------------
-- Duplicate-webhook protection was entirely application-side (webhook_events).
-- These make a duplicate payment row impossible at the storage layer.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_gateway_payment_id
  ON public.payment_transactions (gateway_payment_id)
  WHERE gateway_payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_gateway_order_id
  ON public.payment_transactions (gateway_order_id)
  WHERE gateway_order_id IS NOT NULL;

-- "Exactly one active entitlement per pandit" was enforced only by the order
-- of two UPDATEs in application code.
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_one_active_per_pandit
  ON public.pandit_subscriptions (pandit_id)
  WHERE is_active;

ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_refund_within_amount
  CHECK (refund_amount IS NULL OR refund_amount <= amount);

ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_completed_has_paid_at
  CHECK (status <> 'completed' OR paid_at IS NOT NULL);

-- ----------------------------------------------------------------------------
-- H7 (P1-1) — activate_pandit_subscription() must verify what it is granting
-- ----------------------------------------------------------------------------
-- Was SECURITY DEFINER with zero validation and an unconditional seat-cap
-- override: any path reaching it granted an unlimited free diamond tier.
--
-- The runtime SUCCESS path is deliberately unchanged. Both callers already
-- activate the pandit_subscriptions row (with its tier and expiry) inside the
-- same transaction before calling this, so the entitlement it is about to
-- write is verifiable from committed state. This adds the check that
-- record_qualified_lead() has always modelled, and nothing else.
CREATE OR REPLACE FUNCTION public.activate_pandit_subscription(
  p_pandit_id  UUID,
  p_tier       subscription_tier,
  p_expires_at TIMESTAMPTZ
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_ok BOOLEAN;
BEGIN
  IF p_pandit_id IS NULL OR p_tier IS NULL OR p_expires_at IS NULL THEN
    RAISE EXCEPTION 'activate_pandit_subscription: all arguments are required';
  END IF;

  -- Bound the grant. An expiry in the past is meaningless; one decades out is
  -- either a bug or an attack.
  IF p_expires_at <= NOW() THEN
    RAISE EXCEPTION 'activate_pandit_subscription: expiry % is not in the future', p_expires_at;
  END IF;
  IF p_expires_at > NOW() + INTERVAL '10 years' THEN
    RAISE EXCEPTION 'activate_pandit_subscription: expiry % exceeds the 10 year ceiling', p_expires_at;
  END IF;

  -- The entitlement must already exist as an active subscription row whose
  -- plan tier and expiry match what is being written, AND be backed either by
  -- a captured payment or by an explicitly-recorded manual admin grant.
  SELECT EXISTS (
    SELECT 1
      FROM pandit_subscriptions s
      JOIN subscription_plans   pl ON pl.id = s.plan_id
     WHERE s.pandit_id  = p_pandit_id
       AND s.is_active
       AND pl.tier      = p_tier
       AND s.expires_at = p_expires_at
       AND (
             s.billing_cycle = 'manual'          -- audited admin override
             OR EXISTS (
                  SELECT 1 FROM payment_transactions t
                   WHERE t.id = s.last_payment_id
                     AND t.status = 'completed'
                )
           )
  ) INTO v_ok;

  IF NOT v_ok THEN
    RAISE EXCEPTION
      'activate_pandit_subscription: refusing to grant tier % to pandit % — no active subscription backed by a completed payment or a manual admin grant',
      p_tier, p_pandit_id;
  END IF;

  -- Seat-cap override is retained deliberately: capacity is enforced at
  -- purchase time (subscribe()/seat_usage()), and migration 19's trigger
  -- would otherwise block a legitimately-paid renewal into a full tier.
  PERFORM set_config('app.allow_seat_overflow', 'on', true);

  UPDATE pandits
     SET current_tier            = p_tier,
         subscription_expires_at = p_expires_at,
         is_paused               = FALSE,
         paused_reason           = NULL,
         paused_at               = NULL
   WHERE id = p_pandit_id;

  UPDATE pandits SET rank_score = calculate_pandit_rank(id) WHERE id = p_pandit_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.activate_pandit_subscription(UUID, subscription_tier, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_pandit_subscription(UUID, subscription_tier, TIMESTAMPTZ) TO panditsuggest_app;

-- ----------------------------------------------------------------------------
-- H8 — role grants for the non-runtime roles
-- ----------------------------------------------------------------------------
-- panditsuggest_readonly: diagnostics only, never write, never RLS-exempt.
GRANT USAGE ON SCHEMA public TO panditsuggest_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO panditsuggest_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO panditsuggest_readonly;

-- The readonly role must not be able to read credentials either.
REVOKE SELECT ON public.users FROM panditsuggest_readonly;
GRANT SELECT (
  id, email, phone, full_name, display_name, avatar_url,
  role, status, city, state, pincode,
  email_verified, phone_verified, last_login_at, login_count,
  totp_enabled, created_at, updated_at, deleted_at, country
) ON public.users TO panditsuggest_readonly;

-- Future objects created by the migrator must be usable by the app without a
-- follow-up grant migration every time.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO panditsuggest_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO panditsuggest_app;

-- ----------------------------------------------------------------------------
-- H9 (P1-6) — the migration ledger
-- ----------------------------------------------------------------------------
-- Replaces "re-run every migration on every deployment" with exactly-once
-- application. Lives in the baseline so that a database is never in a state
-- where schema exists but its provenance does not.
--
-- NOTE: this table is deliberately EXCLUDED from the baseline dump
-- (--exclude-table in build-baseline.sh). scripts/migrate.js owns its
-- definition and creates it with IF NOT EXISTS, because the runner must be
-- able to establish the ledger on a database that has no baseline yet. It is
-- defined here so the build database is realistic and the shape is reviewable.
--
-- Owned by the migrator/owner, and deliberately NOT granted to the runtime
-- app role: the application has no reason to read, and no business writing,
-- its own deployment history.
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version       VARCHAR(16)  PRIMARY KEY,   -- '0000', zero-padded: sorts correctly past 99
  filename      TEXT         NOT NULL,
  checksum      VARCHAR(64)  NOT NULL,      -- sha256 of the file's bytes, hex
  applied_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  execution_ms  INTEGER,
  applied_by    TEXT,                       -- db role @ host
  deployment_id TEXT                        -- CI run id / release tag
);

COMMENT ON TABLE public.schema_migrations IS
  'Exactly-once migration ledger. A version present here is never re-executed; a checksum mismatch aborts the deployment. See docs/MIGRATION_RULES.md.';

REVOKE ALL ON public.schema_migrations FROM PUBLIC;
GRANT SELECT ON public.schema_migrations TO panditsuggest_readonly;

-- ----------------------------------------------------------------------------
-- H10 — production marker
-- ----------------------------------------------------------------------------
-- Read by the test guard: a process running with NODE_ENV=test that finds this
-- row refuses to execute a single further statement. This is the check that
-- does not depend on guessing from a database NAME.
CREATE TABLE IF NOT EXISTS public.deployment_environment (
  id          BOOLEAN PRIMARY KEY DEFAULT TRUE CONSTRAINT deployment_environment_singleton CHECK (id),
  environment TEXT NOT NULL CHECK (environment IN ('production','staging','development','test','scratch')),
  marked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note        TEXT
);

COMMENT ON TABLE public.deployment_environment IS
  'Single-row environment marker. Set to production on the RDS instance at cutover; the test-suite guard aborts if it finds environment=production. See backend/src/config/testDbGuard.js.';

GRANT SELECT ON public.deployment_environment TO panditsuggest_app;
GRANT SELECT ON public.deployment_environment TO panditsuggest_readonly;
