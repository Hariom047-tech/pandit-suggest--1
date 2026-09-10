-- ============================================================================
-- 0004 — restore the SELECT policy pandit_analytics needs to be written at all
-- ============================================================================
-- Every contact button on the site has been failing with HTTP 500 and no lead
-- has ever been recorded. Both symptoms are this one missing policy.
--
-- pandit_analytics is written by two upserts:
--
--   qualifiedLeads.repository.js  recordContact()   whatsapp_clicks/call_clicks
--   pandits.repository.js         trackView()       profile_views
--
-- both shaped INSERT ... ON CONFLICT (pandit_id, date) DO UPDATE. The table has
-- RLS enabled with an unconditional INSERT policy (analytics_write_system,
-- WITH CHECK (true)) and an unconditional UPDATE policy (analytics_update_system,
-- USING (true)) — but its only SELECT policies are analytics_select_own (matches
-- a pandit reading their own row) and analytics_select_admin. A devotee's
-- session, which is what every real contact click runs as, is neither.
--
-- Postgres plans ON CONFLICT DO UPDATE with the target's SELECT policies folded
-- into the statement's WITH CHECK options. They are evaluated when the statement
-- runs, NOT only when a conflict is actually found — so with no satisfiable
-- SELECT policy the statement fails with
--
--     ERROR:  new row violates row-level security policy for table "pandit_analytics"
--     SQLSTATE 42501, routine ExecWithCheckOptions
--
-- on an EMPTY table, on the very first click, before a single tuple is written.
-- (historical/21-fix-analytics-upsert-rls.sql, which added this same policy to
-- the pre-RDS database, reasoned that only the second-and-later click of a given
-- day would fail. That understated it: reproduced against a table with this
-- exact policy set, the first insert fails too. pg_class.relpages for
-- pandit_analytics on production is 0 — not one tuple, live or dead, has ever
-- reached it.)
--
-- The blast radius is larger than the analytics rollup, because recordContact()
-- wraps the qualified lead, the contact click, the pandit counters and this
-- rollup in ONE transaction: the rollup throws last, and the ROLLBACK takes the
-- lead and the click with it. Production shows the shape of that exactly —
-- qualified_leads and contact_clicks each have n_tup_ins = 14 with 0 live rows:
-- fourteen contacts attempted, fourteen rolled back, nothing kept. That is why
-- the user analytics and the pandit analytics are both empty, and why the
-- devotee sees "Contact record nahi ho paya".
--
-- Why the policy went missing: baseline/0000-production-baseline.sql was dumped
-- from a database that had not had historical/21 applied, and historical/ is
-- never executed by the runner (docs/MIGRATION_RULES.md rule 5). This looks like
-- a one-file gap rather than a stale baseline: spot-checked against production,
-- the objects created by 22, 25, 27, 28, 30, 31, 32 and 36 are all present and
-- only 21's policy is absent. The rest were not checked. Fixing it forward
-- here rather than editing the baseline, per rule 1 — the baseline's checksum is
-- recorded in schema_migrations and editing it would abort every deployment.
--
-- Unconditional, matching the INSERT and UPDATE policies already on the table:
-- it holds per-pandit daily click totals, not anything one devotee's session
-- must be gated from seeing on another's behalf. The application-facing reads
-- are unaffected — the pandit dashboard and admin analytics keep going through
-- analytics_select_own / analytics_select_admin, both left untouched.
--
-- Idempotent.
-- ============================================================================

DROP POLICY IF EXISTS analytics_select_system ON public.pandit_analytics;
CREATE POLICY analytics_select_system ON public.pandit_analytics
    FOR SELECT USING (true);

-- ----------------------------------------------------------------------------
-- Self-check
-- ----------------------------------------------------------------------------
DO $verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
     WHERE c.relname = 'pandit_analytics'
       AND p.polname = 'analytics_select_system'
  ) THEN
    RAISE EXCEPTION 'Migration 0004 incomplete — analytics_select_system missing on pandit_analytics';
  END IF;
END
$verify$;
