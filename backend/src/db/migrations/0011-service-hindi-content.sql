-- ============================================================================
-- 0011 — a place to keep the Hindi version of a service's content
-- ============================================================================
-- The site has a language switch, but it only ever swapped UI labels: every
-- word an admin writes about a puja — the description, the benefits, the vidhi
-- steps, the FAQs — was served in English to a devotee reading in Hindi.
--
-- One JSONB column rather than a _hi twin for each of the twelve translatable
-- fields. Twelve columns would be twelve things to add, grant and remember the
-- next time a field is added to a service; this is one, and a new field just
-- appears inside it. It also keeps the whole Hindi document together, which is
-- what the translator writes and what an admin later corrects.
--
-- Shape (every key optional — a translation that failed or was never run
-- simply has no key, and the reader falls back to English per field):
--
--   {
--     "name": "...", "shortDescription": "...", "description": "...",
--     "estimatedDuration": "...", "recommendedMuhurat": "...",
--     "onlineNote": "...", "metaTitle": "...", "metaDescription": "...",
--     "benefits": [{ "title": "...", "detail": "..." }],
--     "process":  [{ "title": "...", "detail": "...", "duration": "..." }],
--     "faqs":     [{ "question": "...", "answer": "..." }],
--     "samagri":  [{ "item": "...", "note": "..." }],
--     "translatedAt": "2026-09-09T12:00:00Z", "model": "gpt-4o-mini"
--   }
--
-- NOT a machine-only field. It is written by the translator on save and is
-- plain editable content afterwards, because machine Hindi for ritual
-- vocabulary is exactly the kind of thing a human needs to be able to correct.
-- translatedAt/model are recorded so a stale or suspect translation can be
-- recognised rather than guessed at.
--
-- The grant below is redundant on production today — services carries
-- TABLE-level SELECT for the app role, so a new column is readable at once.
-- It is stated anyway. 0007 added five columns to `users` on the assumption
-- that a grant was not needed, `users` turned out to hold COLUMN-level SELECT,
-- and the admin Users screen went down with "permission denied" until 0008
-- fixed it. Saying it explicitly costs nothing and does not depend on knowing
-- which style a table happens to use.
-- ============================================================================

ALTER TABLE public.services ADD COLUMN IF NOT EXISTS content_hi JSONB;

GRANT SELECT (content_hi) ON public.services TO panditsuggest_app;

COMMENT ON COLUMN public.services.content_hi IS
  'Hindi version of this service''s admin-authored content, written by the translator on save and editable afterwards. Every key optional; a missing key means the reader falls back to the English column.';

-- ----------------------------------------------------------------------------
-- Self-check
-- ----------------------------------------------------------------------------
DO $verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'content_hi'
  ) THEN
    RAISE EXCEPTION 'Migration 0011 incomplete — services.content_hi missing';
  END IF;
  IF NOT has_column_privilege('panditsuggest_app', 'public.services', 'content_hi', 'SELECT') THEN
    RAISE EXCEPTION 'Migration 0011 incomplete — app role cannot SELECT services.content_hi';
  END IF;
END
$verify$;
