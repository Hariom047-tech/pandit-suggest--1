-- migrate:no-transaction
-- ============================================================================
-- 0002 — supporting indexes for foreign keys on the growth tables
-- ============================================================================
-- The pre-RDS audit found 49 single-column foreign keys with no supporting
-- index. Most are low-cardinality attribution columns where nothing is paid
-- until a cascading delete: removing a user or a temple sequential-scans every
-- referencing table while holding locks on it. The 16 below are the ones on
-- the tables that actually grow — pandit_exposure is projected at ~20 rows per
-- listing view, user_activity_events at 5-15 per session — so these are the
-- ones where the seq-scan becomes an outage rather than a hiccup.
--
-- Written with CREATE INDEX CONCURRENTLY, which is the expand/contract rule for
-- every future index (docs/MIGRATION_RULES.md): a plain CREATE INDEX takes an
-- ACCESS EXCLUSIVE lock and blocks all writes to the table for its duration.
--
-- CONCURRENTLY cannot run inside a transaction block, hence the
-- `-- migrate:no-transaction` directive on line 1. That means this file is NOT
-- atomic: if it fails partway, the indexes created before the failure remain.
-- Every statement is IF NOT EXISTS so re-running is safe, but a FAILED
-- concurrent build leaves an INVALID index behind that must be dropped by hand
-- before retrying:
--
--   SELECT c.relname FROM pg_class c JOIN pg_index i ON i.indexrelid = c.oid
--    WHERE NOT i.indisvalid;
--   DROP INDEX CONCURRENTLY <name>;
--
-- On a fresh production database all 16 tables are empty and each of these
-- completes in milliseconds. The cost only matters on an upgrade.
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_clicks_qualified_lead ON public.contact_clicks (qualified_lead_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_clicks_service        ON public.contact_clicks (service_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_clicks_temple         ON public.contact_clicks (temple_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pandit_exposure_service       ON public.pandit_exposure (service_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pandit_exposure_temple        ON public.pandit_exposure (temple_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pandit_exposure_user          ON public.pandit_exposure (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pandit_subscriptions_plan     ON public.pandit_subscriptions (plan_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_transactions_plan     ON public.payment_transactions (plan_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_transactions_sub      ON public.payment_transactions (subscription_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_qualified_leads_service       ON public.qualified_leads (service_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_qualified_leads_temple        ON public.qualified_leads (temple_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_saved_pandits_pandit          ON public.saved_pandits (pandit_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_saved_temples_temple          ON public.saved_temples (temple_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activity_qualified_lead  ON public.user_activity_events (qualified_lead_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activity_service         ON public.user_activity_events (service_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activity_temple          ON public.user_activity_events (temple_id);

-- ----------------------------------------------------------------------------
-- Self-check
-- ----------------------------------------------------------------------------
DO $verify$
DECLARE missing TEXT; invalid TEXT;
BEGIN
  SELECT string_agg(x, ', ') INTO missing FROM unnest(ARRAY[
    'idx_contact_clicks_qualified_lead','idx_contact_clicks_service','idx_contact_clicks_temple',
    'idx_pandit_exposure_service','idx_pandit_exposure_temple','idx_pandit_exposure_user',
    'idx_pandit_subscriptions_plan','idx_payment_transactions_plan','idx_payment_transactions_sub',
    'idx_qualified_leads_service','idx_qualified_leads_temple',
    'idx_saved_pandits_pandit','idx_saved_temples_temple',
    'idx_user_activity_qualified_lead','idx_user_activity_service','idx_user_activity_temple'
  ]) x WHERE to_regclass('public.' || x) IS NULL;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 0002 incomplete — missing index(es): %', missing;
  END IF;

  -- A CONCURRENTLY build that failed leaves the index present but INVALID,
  -- which would otherwise pass the existence check above and be silently unused.
  SELECT string_agg(c.relname, ', ') INTO invalid
    FROM pg_class c JOIN pg_index i ON i.indexrelid = c.oid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND NOT i.indisvalid;
  IF invalid IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 0002 left INVALID index(es): % — DROP INDEX CONCURRENTLY them and re-run', invalid;
  END IF;

  RAISE NOTICE 'Migration 0002 applied: 16 foreign-key indexes present and valid.';
END
$verify$;
