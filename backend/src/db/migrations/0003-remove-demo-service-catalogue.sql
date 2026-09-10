-- ============================================================================
-- 0003 — remove the demo service catalogue from production
-- ============================================================================
-- config/0001-production-config.sql shipped 32 services, their 4 categories and
-- 22 AI problem->service mappings, on the judgement that a catalogue of real
-- Hindu rituals was reference data rather than demo content.
--
-- That judgement was wrong. The service NAMES are real; the DESCRIPTIONS are
-- scrambled 02-seed.sql placeholder text that was never reviewed:
--
--   Antim Sanskar      -> "The baby's first rice ceremony performed on a shubh
--                          muhurat with kheer prepared ..."
--   Bhoomi Pujan       -> the same baby's-rice-ceremony text
--   Bhagwat Katha      -> describes Chhath Puja vidhi
--   Chhath Puja Vidhi  -> describes Shilanyas and Bhoomi Pujan
--
-- Three services share one identical description. Antim Sanskar is the funeral
-- rite; presenting it to a grieving family as a baby's first rice ceremony is
-- not a cosmetic defect. The accompanying imagery is a single placeholder
-- portrait repeated across every card.
--
-- Production therefore starts with an EMPTY catalogue, exactly as it starts
-- with zero pandits and zero temples. Real services get added through the admin
-- panel, with descriptions that match their names.
--
-- Written as a forward migration rather than an edit to 0001: 0001 has been
-- applied to production and its checksum is recorded in schema_migrations, so
-- editing it would abort every future deployment (see docs/MIGRATION_RULES.md).
-- On a fresh install 0001 creates these rows and 0003 removes them again; the
-- end state is identical either way, which is the property that matters.
--
-- KEPT deliberately: ai_problem_categories (43 rows). That taxonomy is coherent
-- reference data ("Kaal Sarpa dosh", "Court case", "New business opening", with
-- Hindi names and a parent hierarchy), it is not user-visible, and it is what a
-- future real catalogue will be mapped onto. It is inert until then.
-- ============================================================================

-- Order matters: mappings reference services, services reference categories.
DELETE FROM public.ai_problem_service_mappings;
DELETE FROM public.services;
DELETE FROM public.service_categories;

-- ----------------------------------------------------------------------------
-- Self-check
-- ----------------------------------------------------------------------------
DO $verify$
DECLARE n INT;
BEGIN
  SELECT count(*) INTO n FROM public.services;
    IF n <> 0 THEN RAISE EXCEPTION 'Migration 0003 incomplete — % service(s) remain', n; END IF;
  SELECT count(*) INTO n FROM public.service_categories;
    IF n <> 0 THEN RAISE EXCEPTION 'Migration 0003 incomplete — % service_categorie(s) remain', n; END IF;
  SELECT count(*) INTO n FROM public.ai_problem_service_mappings;
    IF n <> 0 THEN RAISE EXCEPTION 'Migration 0003 incomplete — % mapping(s) remain', n; END IF;

  -- The taxonomy this migration deliberately does NOT touch.
  SELECT count(*) INTO n FROM public.ai_problem_categories;
    IF n < 43 THEN RAISE EXCEPTION 'Migration 0003 removed ai_problem_categories (found %), which it must not', n; END IF;

  -- Nothing else may have been caught by the cascade.
  SELECT count(*) INTO n FROM public.pandit_services;
    IF n <> 0 THEN RAISE EXCEPTION 'Migration 0003: pandit_services is not empty (%)', n; END IF;

  RAISE NOTICE 'Migration 0003 applied: demo service catalogue removed; % problem categories retained.',
    (SELECT count(*) FROM public.ai_problem_categories);
END
$verify$;
