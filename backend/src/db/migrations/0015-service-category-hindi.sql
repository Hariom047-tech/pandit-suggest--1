-- ============================================================================
-- 0015 — a place to keep the Hindi version of a service category
-- ============================================================================
-- services, pandits and temples each got a content_hi column (migrations 0011
-- and 0012) and the translator has been filling them on every admin save
-- since. service_categories never got one, so the four category names on
-- /services stayed in English for a Hindi reader while every service name,
-- count and label around them was already Hindi:
--
--     सबसे ज़्यादा बुक की गई सेवाएं
--       [ Maa Baglamukhi Puja & Havan ]   [ Astrology & Dosh Nivaran Pujas ]
--       [ Deity Havans & Poojas       ]   [ Vastu, Home & Occasion Pujas   ]
--
-- One JSONB column rather than name_hi/tagline_hi/description_hi twins, for
-- the same reason 0011 gives: a new translatable field then just appears
-- inside it instead of needing its own column, grant and migration.
--
-- Shape (every key optional — a translation that failed or was never run
-- simply has no key, and the reader falls back to English per field):
--
--   {
--     "name": "...", "tagline": "...", "description": "...",
--     "_source": { "name": "<hash>", ... },
--     "translatedAt": "...", "model": "..."
--   }
--
-- _source is what services/hindiContent.service.js compares against to decide
-- which fields actually changed, so re-saving a category whose words are
-- unchanged costs no model call.
--
-- Editable afterwards, like the other three: machine Hindi for ritual
-- vocabulary is exactly the kind of thing a human needs to be able to correct.
--
-- The grant is stated explicitly rather than assumed. 0007 added five columns
-- to `users` on the assumption that column-level grants would follow the
-- table, they did not, and the admin Users screen went down with "permission
-- denied" until 0008 fixed it. Saying it costs nothing.
-- ============================================================================

ALTER TABLE public.service_categories ADD COLUMN IF NOT EXISTS content_hi JSONB;

GRANT SELECT (content_hi), UPDATE (content_hi) ON public.service_categories TO panditsuggest_app;

COMMENT ON COLUMN public.service_categories.content_hi IS
  'Hindi version of this category''s admin-authored text, written by the translator on save and editable afterwards. Every key optional; a missing key means the reader falls back to the English column.';

-- ----------------------------------------------------------------------------
-- Self-check
-- ----------------------------------------------------------------------------
DO $verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'service_categories'
       AND column_name = 'content_hi'
  ) THEN
    RAISE EXCEPTION 'Migration 0015 incomplete — service_categories.content_hi missing';
  END IF;
END
$verify$;
