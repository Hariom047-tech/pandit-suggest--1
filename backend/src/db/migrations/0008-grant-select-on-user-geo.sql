-- ============================================================================
-- 0008 — grant the app role SELECT on the geo_* columns 0007 added
-- ============================================================================
-- 0007 added users.geo_city/geo_region/geo_country_code/geo_country_name/
-- geo_updated_at and stopped there. That was a mistake with a visible cost:
-- the admin Users list started returning "permission denied for table users"
-- the moment it selected them.
--
-- The reason is a deliberate piece of this schema's hardening. The runtime
-- role holds COLUMN-level SELECT on `users` — 24 named columns — rather than
-- table-level, so that RLS exposing a pandit's row (users_select_public) can
-- never also expose that row's password_hash, totp_secret_encrypted,
-- google_id, facebook_id or date_of_birth. A column-level grant does not
-- extend to columns added later, by design: a new column is unreadable until
-- someone decides it should be readable. 0007 added five and decided nothing.
--
-- These five are safe to read: they are a CDN edge's coarse guess at a city
-- and country, already shown to admins in the Users list, and carry no
-- credential material. Writes were never the problem — the role has
-- table-level UPDATE, which is why the login-time capture worked throughout.
--
-- Note for anything that adds a column to `users` in future: grant SELECT on
-- it here too, or leave it deliberately unreadable and keep it out of every
-- query. `SELECT *` and `RETURNING *` both fail outright when a single column
-- is unreadable, which is why auth.repository.js spells out USER_COLUMNS
-- instead of using either.
-- ============================================================================

GRANT SELECT (geo_city, geo_region, geo_country_code, geo_country_name, geo_updated_at)
  ON public.users TO panditsuggest_app;

-- ----------------------------------------------------------------------------
-- Self-check
-- ----------------------------------------------------------------------------
DO $verify$
DECLARE missing TEXT;
BEGIN
  SELECT string_agg(c, ', ') INTO missing
    FROM unnest(ARRAY['geo_city','geo_region','geo_country_code','geo_country_name','geo_updated_at']) AS c
   WHERE NOT has_column_privilege('panditsuggest_app', 'public.users', c, 'SELECT');
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 0008 incomplete — app role still cannot SELECT: %', missing;
  END IF;
END
$verify$;
