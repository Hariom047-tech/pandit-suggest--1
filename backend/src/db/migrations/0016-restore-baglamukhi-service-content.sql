-- ============================================================================
-- 0016 — put every Maa Baglamukhi service's own words back on its own page
-- ============================================================================
-- Fourteen service rows were serving another service's content. Not similar
-- content, and not a duplicate blurb — the wrong ritual entirely, in both the
-- long description and the short one, consistently paired:
--
--   /services/court-case-vijay-baglamukhi-puja   described business stagnation
--   /services/graha-shanti-baglamukhi-puja       described business stagnation
--   /services/career-job-success-baglamukhi-puja described business stagnation
--   /services/rog-nashak-baglamukhi-puja         described dhan-prapti
--   /services/vivah-badha-nivaran-...-puja       described shatru-nash
--   /services/maa-baglamukhi-havan               described career and job success
--   ... eleven of the thirteen sub-services, plus the parent havan page.
--
-- A devotee reading the Court Case page was reading about blocked payments and
-- competitive pressure. That is the part that matters; the near-duplicate
-- content across four service pages was only the symptom that surfaced it.
--
-- NOT a migration bug. 0013 inserts row-wise from a VALUES list and 0014 is
-- ON CONFLICT (slug) DO NOTHING, so neither can move text between rows, and
-- the only UPDATE path in the application (repositories/admin/services.js's
-- update()) is keyed by slug. The scramble was introduced by editing, not by
-- code — which is also why it cannot be prevented here, only undone.
--
-- WHERE THE ORIGINALS COME FROM
--   Thirteen of them are the literals 0013 inserted, copied back verbatim.
--   The fourteenth, maa-baglamukhi-havan, predates 0013 and exists in no
--   migration — its text was found still sitting on the rajneeti-vijay page
--   and was recovered from there before this migration overwrote that row.
--   It is the one entry below not provable from a file in this repository,
--   and it is unmistakably the parent havan's: it names the ritual, and it
--   still carries the "On PanditSuggest, benefits should be presented as..."
--   editorial line that 0014's notes describe cleaning out of this source.
--
-- Idempotent, and safe to re-run: each UPDATE is keyed by slug and writes a
-- fixed literal, so running it twice changes nothing the second time.
--
-- content_hi is set to NULL for every row it touches. The Hindi was scrambled
-- too, on a DIFFERENT permutation from the English, so it cannot be put back
-- by pairing it with anything here. Clearing it makes each page fall back to
-- its (now correct) English per field rather than keep serving a Hindi
-- paragraph about a different ritual, and the next admin save regenerates it:
-- hindiContent.service.js compares the stored _source fingerprints against the
-- current English, and both are gone.
-- ============================================================================

-- Court Case Vijay Puja
UPDATE public.services SET
  description       = 'Court Case Vijay Puja is a purpose-based Maa Baglamukhi ritual. You give a clear legal sankalp — an ongoing court matter, a property dispute, a service matter, family litigation or a false accusation — and the pandit performs Maa Baglamukhi pujan, mantra-japa and havan in your name and gotra. Baglamukhi worship is traditionally associated with stambhan, the stilling of harmful speech, hostile intent and opposition, which is why Nalkheda practitioners have long offered it to devotees under legal pressure. It is offered here as a devotional prayer for protection, confidence and a just outcome — never as a guarantee of winning a case, and never as a replacement for your advocate. Choose this service if you are dealing with an ongoing court case, a property or inheritance dispute, a false allegation, service or employment litigation, a family or matrimonial legal matter, or repeated hearing-related stress.',
  short_description = 'For devotees facing a court case, property dispute, legal notice, false allegation or prolonged litigation. Performed as a prayer for courage, clarity, protection from hostile speech and a fair resolution.',
  content_hi        = NULL
WHERE slug = 'court-case-vijay-baglamukhi-puja';

-- Shatru Stambhan Puja
UPDATE public.services SET
  description       = 'Shatru Stambhan is one of the best-known intent-based forms of Baglamukhi worship. Stambhan means to still, restrain or immobilise. In plain terms, this service is for someone who feels continuously disturbed by hostile opposition, malicious speech, intimidation, rivalry or deliberate obstruction. The ritual uses a personalised sankalp, Maa Baglamukhi pujan, mantra-japa and havan. It is performed as protection and pacification: the prayer is that harmful conduct, speech and interference lose their power over you. It is never performed to physically harm, curse or destroy anyone. Choose this service if you face persistent hostile opposition, malicious speech or defamation-like pressure, workplace or business rivalry, repeated interference, fear caused by adversaries, or simply need protection and confidence.',
  short_description = 'For devotees facing persistent opposition, harmful speech, harassment-like pressure or repeated interference. A prayer to restrain hostile intent and protect the devotee — not to harm another person.',
  content_hi        = NULL
WHERE slug = 'shatru-stambhan-baglamukhi-puja';

-- Shatru Nash & Protection Puja
UPDATE public.services SET
  description       = 'Nalkheda practitioners commonly use the name Shatru Nashak or Shatru Nash Puja, and the meaning deserves to be stated plainly: the prayer is that the harmful influence — the fear, the harassment, the rivalry, the obstruction — comes to an end. The ritual follows Maa Baglamukhi pujan, mantra-japa, havan and purnahuti. Some lineages use special havan samagri or a longer anushthan depending on the situation, which the assigned pandit will tell you in advance. This service is never offered as a way to destroy an enemy; it is a protection and obstacle-removal sankalp. Choose it if you face severe opposition pressure, fear from adversaries, repeated harassment-like interference, a long-running rivalry, or need protection and peace during and after sustained hostility.',
  short_description = 'A stronger protection-oriented Baglamukhi puja for devotees severely troubled by opposition, fear or persistent hostile interference. Here “Shatru Nash” means the removal of the harmful influence — never harm to a person.',
  content_hi        = NULL
WHERE slug = 'shatru-nash-protection-baglamukhi-puja';

-- Political / Rajneeti Vijay Puja
UPDATE public.services SET
  description       = 'Rajneeti Vijay, or Political Success Puja, is a purpose-based Baglamukhi service offered by several Nalkheda practitioners. The sankalp may relate to an election, a leadership responsibility, public criticism, political opposition or an important campaign. The spiritual logic is Baglamukhi''s traditional association with speech, confidence, opposition and stambhan. It is performed as a prayer for clear speech, courage, protection from unfair hostility and success in legitimate public work — never for the manipulation of voters, the coercion of opponents, or a guaranteed election victory. Choose this service if you are running an election campaign, carrying public leadership responsibility, facing political opposition or reputation pressure, preparing an important public speech, or working through a difficult leadership decision.',
  short_description = 'For candidates, public representatives and people in leadership seeking spiritual strength during elections, public opposition, reputation pressure or difficult political work.',
  content_hi        = NULL
WHERE slug = 'rajneeti-vijay-baglamukhi-puja';

-- Business Growth Puja
UPDATE public.services SET
  description       = 'Business Growth Puja is widely listed by Nalkheda Baglamukhi practitioners. The ritual is performed with the business or firm name together with the owner''s naam-gotra sankalp. It combines Baglamukhi worship for protection and obstacle pacification with prosperity-oriented prayers, and depending on the pandit''s tradition, Lakshmi or Kuber worship may be included — your package will say exactly what is covered. It suits a devotee looking for spiritual support around slow growth, competitive pressure, blocked payments or a new venture. It is not a guaranteed profit, sales or investment-return service. Choose it if you face slow business growth, competitive pressure, blocked payments, a new venture or expansion, repeated operational obstacles, or the ordinary stress of running a business.',
  short_description = 'For business owners facing stagnation, competitive pressure, blocked payments, repeated obstacles or uncertainty. Combines Maa Baglamukhi protection with a prosperity-oriented sankalp.',
  content_hi        = NULL
WHERE slug = 'business-growth-baglamukhi-puja';

-- Lakshmi / Dhan Prapti Puja
UPDATE public.services SET
  description       = 'Dhan Prapti and Lakshmi Prapti services appear in Nalkheda practitioner catalogues as prosperity-oriented Baglamukhi rituals. The exact deity combination and mantra method vary by lineage: some use Maa Baglamukhi with Lakshmi, the Shri Yantra, Kuber or other prosperity mantras, and the assigned pandit will tell you which applies to your booking. It is offered as a prayer for financial stability, responsible prosperity and the removal of perceived spiritual obstacles around money. It does not promise sudden wealth, debt cancellation, lottery success or a guaranteed income. Choose it for a financial stability prayer, repeated money obstacles, business prosperity, a new financial beginning, a household prosperity sankalp, or simply as gratitude and abundance worship.',
  short_description = 'A prosperity-focused devotional service for financial stability, a dhan-prapti sankalp and relief from repeated money-related obstacles, often combining Maa Baglamukhi with Lakshmi-oriented worship.',
  content_hi        = NULL
WHERE slug = 'lakshmi-dhan-prapti-baglamukhi-puja';

-- Career & Job Success Puja
UPDATE public.services SET
  description       = 'Career and Job Success Puja is offered by Nalkheda practitioners as a Baglamukhi-based karya siddhi service. It is meant for a specific, real concern: repeated interview failure, a promotion delay, workplace politics, job insecurity or career stagnation. The ritual includes Maa Baglamukhi pujan, mantra-japa and havan, and if the pandit recommends it, a supporting graha-shanti element that will be disclosed to you in advance. No puja can guarantee a job or a promotion — your skills, preparation, applications and professional decisions remain essential, and this is offered alongside them, not instead of them. Choose it if you are facing a job-search delay, interview nerves, a promotion or appraisal concern, workplace opposition, career stagnation, or job insecurity and transition.',
  short_description = 'For job delay, interview pressure, promotion concerns, workplace opposition or career instability. A prayer for confidence, clarity, opportunity and the removal of obstacles.',
  content_hi        = NULL
WHERE slug = 'career-job-success-baglamukhi-puja';

-- Rog Nashak Puja
UPDATE public.services SET
  description       = 'Rog Nashak services are offered by Nalkheda Baglamukhi practitioners, sometimes combining Pitambara/Baglamukhi worship with Maha Mrityunjaya or other health prayers. The puja is performed for spiritual strength, peace, courage and wellbeing during illness or recovery. It does not cure disease, replace a doctor, justify stopping any medicine, or guarantee recovery — please continue with the treatment your clinician has advised. The exact mantra and deity combination is disclosed by the assigned pandit before the booking is confirmed. Choose this service for a prayer during illness, a post-treatment or recovery phase, a family member''s health sankalp, mental strength during medical stress, a general wellbeing prayer, or health-related fear and uncertainty.',
  short_description = 'A health and wellbeing prayer for devotees or family members going through illness, recovery, stress or a difficult health phase. Spiritual support only — it does not replace medical care.',
  content_hi        = NULL
WHERE slug = 'rog-nashak-baglamukhi-puja';

-- Vivah Badha Nivaran Puja
UPDATE public.services SET
  description       = 'Vivah Badha Nivaran Puja is repeatedly listed by Nalkheda practitioners, though the exact format differs between them: some combine Baglamukhi worship with Mangal Shanti, Rahu-Ketu remedies or Swayamvar Parvati prayers. Your package will show clearly which of these are actually included, so nothing is assumed. The core intent is straightforward — repeated delay or obstacles in the path to marriage — and the ritual is offered as a prayer for a suitable, consensual and auspicious alliance. It never promises a particular person, forces a relationship, or guarantees marriage by a fixed date. Choose it if you face repeated marriage delay, proposal obstacles, family resistance, recurring misunderstandings, an astrology-linked marriage concern, or simply wish to pray for a suitable alliance.',
  short_description = 'For people facing repeated marriage delay, proposal obstacles, misunderstandings or family resistance. A devotional prayer for suitable progress, clarity and harmony.',
  content_hi        = NULL
WHERE slug = 'vivah-badha-nivaran-baglamukhi-puja';

-- Santan Prapti Puja
UPDATE public.services SET
  description       = 'Santan Prapti Anushthan is offered by several Nalkheda practitioners as a family and progeny-related prayer. The exact ritual may be Baglamukhi-centred, or may include Krishna/Santan Gopal, Shiva-Parvati or Navgraha prayers depending on the acharya, and the assigned pandit states exactly what will be performed. Because this is a medical and emotionally sensitive area, the service makes no promise of conception, offers no treatment for infertility and makes no claim about preventing miscarriage. It is devotional support for hope, family wellbeing and the couple''s shared sankalp. Choose it as a prayer for progeny, a couple''s family sankalp, emotional support during a fertility journey, a family wellbeing prayer, an astrology-guided santan concern, or devotional hope after a long wait.',
  short_description = 'A devotional family prayer for couples seeking the blessing of children, hope and emotional strength. Spiritual support that does not replace fertility or obstetric care.',
  content_hi        = NULL
WHERE slug = 'santan-prapti-baglamukhi-puja';

-- Graha Shanti Puja
UPDATE public.services SET
  description       = 'Grah Dosh Nivaran and Navgraha Shanti are commonly offered alongside Maa Baglamukhi worship at Nalkheda. If you are paying for a specific dosha remedy, the ritual should never be generic: the assigned pandit identifies whether the focus is Shani, Rahu-Ketu, Mangal, the full Navgraha or another graha. A typical package includes Ganesh puja, Navgraha avahan, graha mantra-japa, Maa Baglamukhi pujan and havan. A kundli review is encouraged before any personalised graha claim is made — a difficult phase in life is not by itself proof that you have a dosha, and you will not be told otherwise here. Choose this service for a kundli-identified graha dosha, a Rahu-Ketu, Shani or Mangal-related concern, multiple planetary concerns, or a general Navgraha shanti.',
  short_description = 'For devotees who have been advised that one or more planetary influences may need shanti. Combines Baglamukhi protection with the appropriate graha or Navgraha worship.',
  content_hi        = NULL
WHERE slug = 'graha-shanti-baglamukhi-puja';

-- Tantra Badha / Negative Energy Protection Puja
UPDATE public.services SET
  description       = 'This category is offered carefully, and it is worth saying why. Fear, anxiety, illness, financial loss or a relationship problem is not proof of black magic or tantra badha, and you will not be told that it is. This is an optional spiritual protection ritual for devotees who find meaning in the tradition, and practical or professional help for real-world problems is encouraged alongside it. The ritual includes Baglamukhi pujan, protective mantra-japa, havan and shanti prayers. Any advanced tantric method stays under a qualified acharya and never involves harm, coercion or dangerous substances. Choose this service for perceived negativity, a nazar-related spiritual concern, fear of harmful influence, an uneasy home or work environment, repeated unexplained spiritual worry, or a general protection sankalp.',
  short_description = 'For devotees worried about perceived negative spiritual influence, fear, nazar-like disturbance or repeated unexplained uneasiness. Focused on protection, peace and grounding — without claiming that black magic has been proven.',
  content_hi        = NULL
WHERE slug = 'tantra-badha-negative-energy-protection-baglamukhi-puja';

-- Sarva Badha Nivaran Puja
UPDATE public.services SET
  description       = 'Sarva Badha Nivaran is the right starting point when the difficulty is broad rather than specific. Nalkheda practitioners use this name when a devotee reports recurring blocks across career, family, business or mental peace but has no single clear diagnosis or purpose. Rather than pushing you into Court Case, Graha Shanti or Tantra Badha, this service takes a general protection and obstacle-removal sankalp. The ritual includes sankalp, Ganesh puja, Maa Baglamukhi pujan, mantra-japa, havan and purnahuti. If the consultation reveals a more specific need, the pandit can recommend a suitable related service — with your approval before anything changes. Choose it for multiple recurring obstacles, an unclear source of difficulty, a general protection prayer, mixed family and work stress, repeated delays, or when you are simply unsure which Baglamukhi service fits.',
  short_description = 'For devotees facing repeated obstacles in more than one area of life, and unsure which specialised service to choose. A broad Baglamukhi prayer for protection, clarity, peace and the removal of obstacles.',
  content_hi        = NULL
WHERE slug = 'sarva-badha-nivaran-baglamukhi-puja';

-- Maa Baglamukhi Havan
UPDATE public.services SET
  description       = 'Maa Baglamukhi Havan is a Shakta ritual dedicated to Maa Baglamukhi, one of the Dasha Mahavidyas. The ceremony normally 
begins with purification, Ganesh and guru remembrance, sankalp, kalash/deity invocation and Baglamukhi mantra-japa, followed by 
homa and purnahuti. Yellow flowers, turmeric and other yellow offerings are commonly associated with the worship. The exact 
mantra count, nyasa, yantra use and homa paddhati should be decided by a qualified Baglamukhi upasaka or acharya because 
traditions vary and some forms are advanced tantric practice. On PanditSuggest, benefits should be presented as traditional 
devotional intentions, not guaranteed legal, medical or financial outcomes.',
  short_description = 'A sacred Maa Baglamukhi puja and havan traditionally sought for protection, courage, control over hostile situations and relief from  obstacles, performed with sankalp, mantra-japa and yellow offerings',
  content_hi        = NULL
WHERE slug = 'maa-baglamukhi-havan';

-- ----------------------------------------------------------------------------
-- Self-check — no two of these fourteen may share a short_description again.
-- ----------------------------------------------------------------------------
DO $verify$
DECLARE
  dupes INT;
  touched INT;
BEGIN
  SELECT COUNT(*) INTO touched
    FROM public.services
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
                  'sarva-badha-nivaran-baglamukhi-puja',
                  'maa-baglamukhi-havan');

  IF touched <> 14 THEN
    RAISE EXCEPTION 'Migration 0016 expected 14 Maa Baglamukhi service rows, found %', touched;
  END IF;

  SELECT COUNT(*) INTO dupes FROM (
    SELECT short_description
      FROM public.services
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
                  'sarva-badha-nivaran-baglamukhi-puja',
                  'maa-baglamukhi-havan')
     GROUP BY short_description
    HAVING COUNT(*) > 1
  ) d;

  IF dupes > 0 THEN
    RAISE EXCEPTION 'Migration 0016 left % shared short_description(s) across the Baglamukhi services', dupes;
  END IF;
END
$verify$;
