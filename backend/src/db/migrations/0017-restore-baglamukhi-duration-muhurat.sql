-- ============================================================================
-- 0017 — the rest of the scrambled Maa Baglamukhi fields
-- ============================================================================
-- 0016 restored `description` and `short_description`, which were the fields
-- the wrong content was most visible in. It did not go far enough: the same
-- admin-form race wrote every plain text field the form carries, and a check
-- against 0013's literals afterwards found estimated_duration differing on
-- 9 of the 13 rows and recommended_muhurat on 11 — carrying a sibling's text
-- the same way the descriptions did. A Kaal Sarp-scale puja advertised as
-- "2-3 hours" when its own seed says "2.5-4 hours" is a promise to a devotee
-- about their day.
--
-- The list fields were checked too and are NOT affected: first-FAQ and
-- first-benefit match 0013 on all 13 rows, so benefits, process, samagri and
-- faqs are deliberately left untouched here rather than rewritten for the
-- sake of completeness.
--
-- maa-baglamukhi-havan is absent: it predates 0013, and unlike its
-- description — recovered in 0016 from the row it had been copied onto —
-- there is no surviving source for its duration or muhurat. Guessing one
-- would be worse than leaving what is there.
--
-- content_hi is cleared again for these rows, for the reason 0016 gives:
-- Hindi generated from text that has since been corrected is describing the
-- wrong thing. Re-run `node scripts/backfill-hindi.js` after this to refill
-- it — the whole file takes about a minute.
--
-- Idempotent: each UPDATE is keyed by slug and writes a fixed literal.
-- ============================================================================

-- Court Case Vijay Puja
UPDATE public.services SET
  estimated_duration  = '2-4 hours (standard); longer with mantra-anushthan',
  recommended_muhurat = 'Chosen with the officiating pandit based on case urgency, your sankalp and the local Panchang. Tuesday, Thursday/Friday and auspicious Devi tithis are commonly used by practitioners, but there is no single compulsory time.',
  online_note         = 'Live sankalp participation is available. Booked as a Nalkheda service, the physical havan is performed by the pandit at Nalkheda while you join remotely.',
  content_hi          = NULL
WHERE slug = 'court-case-vijay-baglamukhi-puja';

-- Shatru Stambhan Puja
UPDATE public.services SET
  estimated_duration  = '2-4 hours',
  recommended_muhurat = 'Pandit-guided. Tuesday, Friday, Ashtami and Baglamukhi-related auspicious periods are commonly preferred, but the exact timing varies by tradition.',
  online_note         = 'Live sankalp participation is possible — the pandit takes your sankalp remotely and you may join the ritual by video.',
  content_hi          = NULL
WHERE slug = 'shatru-stambhan-baglamukhi-puja';

-- Shatru Nash & Protection Puja
UPDATE public.services SET
  estimated_duration  = '2-4 hours',
  recommended_muhurat = 'Selected by the pandit based on your sankalp and the Panchang. Devi tithis and Tuesday/Friday are commonly used by practitioners.',
  online_note         = 'Live sankalp participation is possible. The pandit performs the physical havan and you join remotely or by sankalp.',
  content_hi          = NULL
WHERE slug = 'shatru-nash-protection-baglamukhi-puja';

-- Political / Rajneeti Vijay Puja
UPDATE public.services SET
  estimated_duration  = '2-4 hours',
  recommended_muhurat = 'Pandit-guided. Some Nalkheda practitioners prefer Tuesday, Friday, Baglamukhi Jayanti or a chart-based auspicious muhurat.',
  online_note         = 'Live sankalp participation is possible, so a campaign schedule need not be interrupted to attend in person.',
  content_hi          = NULL
WHERE slug = 'rajneeti-vijay-baglamukhi-puja';

-- Business Growth Puja
UPDATE public.services SET
  estimated_duration  = '2-3 hours',
  recommended_muhurat = 'Friday, an auspicious business-start muhurat, or another date selected by the pandit. The business name and the owner''s sankalp can both be included.',
  online_note         = 'Live sankalp participation is possible, with the firm name and owner details taken remotely before the ritual.',
  content_hi          = NULL
WHERE slug = 'business-growth-baglamukhi-puja';

-- Lakshmi / Dhan Prapti Puja
UPDATE public.services SET
  estimated_duration  = '2-3 hours',
  recommended_muhurat = 'Friday, Diwali-related auspicious periods, or a muhurat selected by the pandit.',
  online_note         = 'Live sankalp participation is possible; the family or business prosperity sankalp is taken in your name remotely.',
  content_hi          = NULL
WHERE slug = 'lakshmi-dhan-prapti-baglamukhi-puja';

-- Career & Job Success Puja
UPDATE public.services SET
  estimated_duration  = '2-3 hours',
  recommended_muhurat = 'Selected by the pandit, and often timed before an interview, a joining date, an appraisal or another auspicious day.',
  online_note         = 'Live sankalp participation is possible, so the ritual can be timed around an interview or joining date.',
  content_hi          = NULL
WHERE slug = 'career-job-success-baglamukhi-puja';

-- Rog Nashak Puja
UPDATE public.services SET
  estimated_duration  = '2-3 hours',
  recommended_muhurat = 'Selected by the pandit. An urgent health prayer need not wait for a distant festival — the priest can choose a suitable available muhurat.',
  online_note         = 'Can be performed in the patient''s name even if they are unable to attend, with the family joining by live sankalp.',
  content_hi          = NULL
WHERE slug = 'rog-nashak-baglamukhi-puja';

-- Vivah Badha Nivaran Puja
UPDATE public.services SET
  estimated_duration  = '2-4 hours; an extended anushthan may take multiple days',
  recommended_muhurat = 'Selected by the pandit or astrologer. A chart review may be useful if the service includes Mangal, Rahu-Ketu or other graha remedies.',
  online_note         = 'Live sankalp participation is possible, with the name, gotra and concern taken remotely before the ritual.',
  content_hi          = NULL
WHERE slug = 'vivah-badha-nivaran-baglamukhi-puja';

-- Santan Prapti Puja
UPDATE public.services SET
  estimated_duration  = '2-4 hours; an anushthan format may run longer',
  recommended_muhurat = 'Selected by the pandit. If astrology is part of the package, birth details may be reviewed; no universal fixed time applies.',
  online_note         = 'The couple can join live, or the sankalp can be taken in both their names if they cannot attend.',
  content_hi          = NULL
WHERE slug = 'santan-prapti-baglamukhi-puja';

-- Graha Shanti Puja
UPDATE public.services SET
  estimated_duration  = '2.5-4 hours',
  recommended_muhurat = 'Ideally after a kundli review when the service is dosha-specific. The date is selected according to the relevant graha and the local Panchang.',
  online_note         = 'Live sankalp participation is possible; birth details can be shared in advance for a dosha-specific booking.',
  content_hi          = NULL
WHERE slug = 'graha-shanti-baglamukhi-puja';

-- Tantra Badha / Negative Energy Protection Puja
UPDATE public.services SET
  estimated_duration  = '2-4 hours; an extended anushthan may take longer',
  recommended_muhurat = 'Consultation-based. The acharya chooses a suitable tithi and method — advanced tantric details should never be self-prescribed.',
  online_note         = 'Available after a consultation and a clear, non-harmful sankalp is agreed with the pandit.',
  content_hi          = NULL
WHERE slug = 'tantra-badha-negative-energy-protection-baglamukhi-puja';

-- Sarva Badha Nivaran Puja
UPDATE public.services SET
  estimated_duration  = '2-4 hours',
  recommended_muhurat = 'A general auspicious Devi muhurat selected by the pandit — suitable when the concern is broad rather than one specific dosha.',
  online_note         = 'Live sankalp participation is possible, with the general concern discussed before the ritual is fixed.',
  content_hi          = NULL
WHERE slug = 'sarva-badha-nivaran-baglamukhi-puja';

DO $verify$
DECLARE touched INT;
BEGIN
  SELECT COUNT(*) INTO touched FROM public.services
   WHERE slug IN ('court-case-vijay-baglamukhi-puja',
                  'shatru-stambhan-baglamukhi-puja',
                  'shatru-nash-protection-baglamukhi-puja',
                  'rajneeti-vijay-baglamukhi-puja',
                  'business-growth-baglamukhi-puja',
                  'lakshmi-dhan-prapti-baglamukhi-puja',
                  'career-job-success-baglamukhi-puja',
                  'rog-nashak-baglamukhi-puja',
                  'vivah-badha-nivaran-baglamukhi-puja',
                  'santan-prapti-baglamukhi-puja',
                  'graha-shanti-baglamukhi-puja',
                  'tantra-badha-negative-energy-protection-baglamukhi-puja',
                  'sarva-badha-nivaran-baglamukhi-puja') AND estimated_duration IS NOT NULL;
  IF touched <> 13 THEN
    RAISE EXCEPTION 'Migration 0017 expected 13 rows with a duration, found %', touched;
  END IF;
END
$verify$;
