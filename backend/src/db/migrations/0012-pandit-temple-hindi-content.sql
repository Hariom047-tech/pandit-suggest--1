-- ============================================================================
-- 0012 — the same Hindi content column for pandits and temples
-- ============================================================================
-- 0011 gave services a content_hi and a translator that fills it on save. The
-- rest of what a devotee actually reads — a pandit's bio and title, a temple's
-- description, history and significance — was still English-only behind a
-- language switch that changed the buttons around it.
--
-- Same shape and same reasoning as services.content_hi: one JSONB document per
-- row, every key optional, the reader falling back to English field by field.
-- See 0011 for why one column rather than a _hi twin per field.
--
-- What goes in is an allow-list, not "every text column" — see CONTENT_SPECS
-- in services/translation.service.js. Phone numbers, URLs, slugs and hashes
-- are text too and a model asked to translate them will corrupt them. Street
-- addresses are excluded on purpose: a transliterated address reads nicer and
-- a wrong one stops a devotee reaching the temple. City, district and state
-- are included, being well-known names with settled Hindi spellings.
--
--   pandits.content_hi  { name, title, shortBio, bio, primarySpecialization,
--                         vedicEducation, gotra, tradition, respondsWithin,
--                         translatedAt, model }
--   temples.content_hi  { name, shortDescription, description, primaryDeity,
--                         templeType, architecturalStyle, history,
--                         significance, howToReach, nearestRailway,
--                         nearestAirport, city, district, state,
--                         highlights: [ "..." ],
--                         customServices: [ { name, description } ],
--                         translatedAt, model }
--
-- `name` on a pandit is a person's name and is transliterated, not translated
-- — which is exactly what the frontend's long-standing `nameHi` field was
-- always meant to hold and has been reading as undefined ever since.
--
-- Grants stated explicitly. Both tables carry table-level SELECT today so this
-- is redundant, and it is written anyway: 0007 added columns to `users` on the
-- assumption a grant was unnecessary, `users` turned out to use column-level
-- grants, and the admin Users screen went down until 0008 repaired it.
-- ============================================================================

ALTER TABLE public.pandits ADD COLUMN IF NOT EXISTS content_hi JSONB;
ALTER TABLE public.temples ADD COLUMN IF NOT EXISTS content_hi JSONB;

GRANT SELECT (content_hi) ON public.pandits TO panditsuggest_app;
GRANT SELECT (content_hi) ON public.temples TO panditsuggest_app;

COMMENT ON COLUMN public.pandits.content_hi IS
  'Hindi version of this pandit''s admin-authored profile text, written by the translator on save and editable afterwards. Every key optional; a missing key means the reader falls back to the English column.';
COMMENT ON COLUMN public.temples.content_hi IS
  'Hindi version of this temple''s admin-authored content, written by the translator on save and editable afterwards. Every key optional; a missing key means the reader falls back to the English column.';

-- ----------------------------------------------------------------------------
-- Self-check
-- ----------------------------------------------------------------------------
DO $verify$
DECLARE missing TEXT;
BEGIN
  SELECT string_agg(t, ', ') INTO missing
    FROM unnest(ARRAY['pandits', 'temples']) AS t
   WHERE NOT EXISTS (
     SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'content_hi');
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 0012 incomplete — content_hi missing on: %', missing;
  END IF;

  SELECT string_agg(t, ', ') INTO missing
    FROM unnest(ARRAY['pandits', 'temples']) AS t
   WHERE NOT has_column_privilege('panditsuggest_app', 'public.' || t, 'content_hi', 'SELECT');
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 0012 incomplete — app role cannot SELECT content_hi on: %', missing;
  END IF;
END
$verify$;
