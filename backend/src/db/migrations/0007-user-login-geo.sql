-- ============================================================================
-- 0007 — remember where a devotee logged in from, without touching what they typed
-- ============================================================================
-- The admin Users list has a Location column that reads users.city/state/
-- country. Nothing has ever written those, so every row says "Unknown" — the
-- geo CloudFront already attaches to each request was being used for market
-- eligibility and thrown away.
--
-- Why NOT just fill city/state/country on login: those three are the devotee's
-- OWN address, editable by them on the dashboard and by an admin on the user
-- detail screen. Writing edge geo into them would either overwrite what a
-- person typed, or — if we only wrote them when NULL — freeze the very first
-- login's city forever and quietly present a guess as if the user had stated
-- it. Neither is honest.
--
-- So the edge's guess gets its own columns. They are refreshed on every login
-- (auth.controller.js issueSession), never merged, and the admin screen shows
-- the typed address when there is one and falls back to these when there is
-- not — so the two can always be told apart.
--
-- All nullable with no default: a request that reaches the server without
-- passing through CloudFront legitimately has no geo at all, and NULL is the
-- correct answer for it rather than a fabricated country.
-- ============================================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS geo_city         VARCHAR(120);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS geo_region       VARCHAR(120);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS geo_country_code VARCHAR(2);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS geo_country_name VARCHAR(120);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS geo_updated_at   TIMESTAMPTZ;

COMMENT ON COLUMN public.users.geo_city IS
  'CloudFront edge guess at last login. Never user-entered — see users.city for that.';
COMMENT ON COLUMN public.users.geo_updated_at IS
  'When the geo_* columns were last refreshed, so a stale guess can be recognised.';

-- ----------------------------------------------------------------------------
-- Self-check
-- ----------------------------------------------------------------------------
DO $verify$
DECLARE missing TEXT;
BEGIN
  SELECT string_agg(c, ', ') INTO missing
    FROM unnest(ARRAY['geo_city','geo_region','geo_country_code','geo_country_name','geo_updated_at']) AS c
   WHERE NOT EXISTS (
     SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = c);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 0007 incomplete — users is missing: %', missing;
  END IF;
END
$verify$;
