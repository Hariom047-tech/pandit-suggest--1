-- ============================================================================
-- 0014 — three main service categories and their 18 subservices
-- ============================================================================
-- The catalogue held one category (Maa Baglamukhi Puja & Havan) and its
-- thirteen problem-specific sub-services. This adds the rest of the business:
-- Astrology & Dosh Nivaran, Deity Havans & Poojas, and Vastu, Home & Occasion
-- Pujas, with 18 services beneath them.
--
-- WHAT IS DELIBERATELY NOT HERE
-- The source document lists "Maa Baglamukhi Puja & Havan" as subservice #1 of
-- Astrology & Dosh Nivaran. It is skipped, because that ritual is already the
-- site's own category holding thirteen sub-services, and inserting it again as
-- a service would put two pages on one ritual intent — the exact near-duplicate
-- the same document warns against ("one canonical service page per ritual
-- intent"). Reactivating services.maa-baglamukhi-havan gives that category its
-- parent page without a second URL competing for the same query.
--
-- CONTENT DEPARTURES FROM THE SOURCE
--   1. Its overviews and several FAQ answers are addressed to the site owner
--      ("PanditSuggest should frame the service as...", "What SEO claims
--      should be avoided?"). Those are editorial instructions, not devotee
--      copy. They are rewritten as prose addressed to the reader, keeping
--      every no-guarantee commitment: no promised court win, election, profit,
--      cure, conception, marriage or debt clearance.
--   2. The meta descriptions in the source are cut off mid-word at about 155
--      characters ("...obstacle-shanti and supp."). Complete ones are written
--      here instead, inside the length Google actually shows.
--   3. Keyword clusters are not stored. There is no keywords column and the
--      meta keywords tag has been ignored by Google for many years; the
--      clusters belong in the copy, which is where they are.
--
-- Unlike migration 0013, process[].duration IS filled — this source gives a
-- duration for every vidhi step, so nothing had to be invented.
--
-- INSERTED INACTIVE (is_active = FALSE). None of these have images yet; an
-- admin adds one, checks the copy and activates each from the admin panel.
-- Nothing reaches the public site or sitemap.xml until then.
--
-- Idempotent: ON CONFLICT (slug) DO NOTHING on both tables, so re-running
-- never overwrites an admin's later edits.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Categories first: the services below resolve their parent by slug.
-- ----------------------------------------------------------------------------
INSERT INTO public.service_categories
  (name, slug, description, tagline, icon_name, display_order, is_active)
VALUES
  ('Astrology & Dosh Nivaran Pujas', 'astrology-dosh-nivaran-pujas',
   'Pujas connected with kundli concerns — graha shanti, Mangal dosh, Kaal Sarp, Shani, Rahu-Ketu, Pitra dosh and Guru Chandal. Each page explains what the concern means, then what actually happens in the puja, then lets you find a pandit who performs it. Dosh-specific claims are presented as traditional Jyotish beliefs, to be confirmed by a kundli review rather than diagnosed from life problems alone.',
   'Kundli-based graha shanti, dosh nivaran and protective puja services', 'moon', 10, TRUE),

  ('Deity Havans & Poojas', 'deity-havan-puja',
   'Direct deity worship — Chandi Havan, Maha Mrityunjaya Havan, Rudrabhishek, Lakshmi Puja, Satyanarayan Katha, Navchandi and Ganesh Puja. Each page names the presiding deity, the ritual format, the occasions it is booked for, the approximate duration and what is included. Large anushthans state their mantra or path count and the number of pandits before you book, so nothing about the scale is a surprise on the day.',
   'Deity-focused pujas, mantra jaap, path, abhishek and sacred fire rituals', 'flame', 20, TRUE),

  ('Vastu, Home & Occasion Pujas', 'vastu-home-occasion-pujas',
   'Home and life-situation rituals — Vastu Shanti, Griha Pravesh, Rin Mukti and Santan Gopal. Each page says plainly which services are property-specific and need a pandit on site, which can be joined online, and which need a personalised muhurat. Where a ritual touches health or money, it is described as devotional support alongside proper medical or financial advice, never instead of it.',
   'House, Vastu, debt-relief and family sankalp pujas', 'home', 30, TRUE)
ON CONFLICT (slug) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Astrology & Dosh Nivaran Pujas
-- ----------------------------------------------------------------------------
WITH cat AS (SELECT id FROM public.service_categories WHERE slug = 'astrology-dosh-nivaran-pujas'),
incoming (name, slug, icon_name, display_order, is_popular, is_online_available,
          description, short_description, estimated_duration, recommended_muhurat,
          online_note, meta_title, meta_description,
          benefits, process, samagri_list, faqs) AS (
  VALUES
  ('Kaal Sarp Dosh Nivaran Puja', 'kaal-sarp-dosh-nivaran-puja', 'trishul', 10, TRUE, TRUE,
   'Kaal Sarp Dosh Nivaran is best treated as a kundli-confirmed remedial puja, not something diagnosed from dreams or a run of bad luck. Trimbakeshwar is one of the best-known locations for this ritual; public Trimbakeshwar sources commonly describe a three to four hour ceremony involving Rahu-Ketu and Naga worship, serpent symbols or idols, havan and associated Shiva worship. Local paddhati varies between priests, so the package you book states exactly what will be performed rather than promising one universal sequence. Choose this service if an astrologer has identified Kaal Sarp Yoga in your chart and you want a traditional remedy performed properly.',
   'A Rahu-Ketu and Naga-focused shanti puja for devotees whose astrologer identifies Kaal Sarp Yoga in the birth chart, performed with sankalp, graha worship, mantra-japa, havan and Shiva-related rites.',
   '3-4 hours for a standard Trimbakeshwar-style puja',
   'Chosen with the Trimbakeshwar purohit or your astrologer after a kundli and local Panchang review. No single tithi is the only valid one.',
   'The consultation and sankalp can be joined online. Sold as a Trimbakeshwar service, the physical ritual is performed there by a qualified purohit.',
   'Kaal Sarp Dosh Nivaran Puja | PanditSuggest',
   'A Rahu-Ketu and Naga shanti puja for a kundli-confirmed Kaal Sarp Yoga — sankalp, graha worship, mantra-japa, havan and Shiva rites, with verified pandits.',
   '[{"icon":"🌑","title":"Rahu-Ketu shanti","detail":"The traditional intention is to pacify difficult Rahu-Ketu influences."},{"icon":"🧘","title":"Peace of mind","detail":"Devotees seek devotional reassurance through an uncertain period."},{"icon":"⏳","title":"Delay-related prayer","detail":"Often chosen when repeated delays are astrologically associated with the yoga."},{"icon":"🪔","title":"Obstacle pacification","detail":"A traditional graha-shanti remedy for recurring blocks."},{"icon":"🐍","title":"Naga reverence","detail":"Serpent symbolism and Naga worship feature in many local traditions."},{"icon":"🔱","title":"Shiva worship","detail":"Trimbakeshwar versions are closely connected with Shiva worship."}]'::jsonb,
   '[{"step":1,"title":"Kundli confirmation & Sankalp","detail":"The yoga is confirmed and the yajman’s details are recorded.","duration":"15-20 min"},{"step":2,"title":"Shuddhi & Ganesh Pujan","detail":"Opening purification and Ganesh worship.","duration":"15-20 min"},{"step":3,"title":"Rahu-Ketu / Naga Sthapana","detail":"Rahu-Ketu and Naga symbols are invoked.","duration":"30-40 min"},{"step":4,"title":"Mantra Japa & Shanti Pujan","detail":"Rahu-Ketu and Naga mantras and prayers are recited.","duration":"60-90 min"},{"step":5,"title":"Havan / Abhishek","detail":"Havan and, in some traditions, Shiva abhishek according to the booked method.","duration":"45-60 min"},{"step":6,"title":"Purnahuti & Closing","detail":"Final prayer, aarti and daan guidance where it is included.","duration":"15-30 min"}]'::jsonb,
   '[{"item":"Rahu-Ketu symbols/idols","qty":"1 set"},{"item":"Naga / serpent symbol","qty":"as local tradition"},{"item":"Kalash & coconut","qty":"1 set"},{"item":"Black sesame","qty":"250-500 g"},{"item":"Flowers, akshat, sandal, roli","qty":"1 set"},{"item":"Panchamrit ingredients","qty":"1 set if abhishek"},{"item":"Bilva leaves","qty":"as required"},{"item":"Havan samagri & ghee","qty":"1 set"},{"item":"Incense, camphor, deepa","qty":"1 set"},{"item":"Fruits / naivedya","qty":"as required"},{"item":"New ritual cloth","qty":"as advised"},{"item":"Daan items","qty":"as advised"}]'::jsonb,
   '[{"q":"How do I know if I have Kaal Sarp Yoga?","a":"Have the full birth chart checked by a competent astrologer. It should not be inferred from symptoms or a run of bad luck."},{"q":"How long does the puja take?","a":"Trimbakeshwar sources commonly state about three to four hours for a standard puja."},{"q":"Is Trimbakeshwar compulsory?","a":"No, but it is a major traditional location. A Trimbakeshwar-labelled service is actually performed there."},{"q":"What are the main ritual elements?","a":"Sankalp, Ganesh puja, Rahu-Ketu and Naga worship, mantra-japa, havan and Shiva-related rites."},{"q":"Are serpent idols always needed?","a":"Some Trimbakeshwar traditions specify them; the material and number vary by local priest."},{"q":"Can I join online?","a":"Yes, for the sankalp and live participation. Location-specific rites are physically conducted at the stated place."},{"q":"Does it guarantee marriage or career success?","a":"No. It is a religious and Jyotish remedy, never a guaranteed material outcome."}]'::jsonb),

  ('Mangal Dosh Nivaran Puja (Manglik Puja)', 'mangal-dosh-nivaran-puja', 'flame', 20, TRUE, TRUE,
   'Definitions of Manglik Dosha differ across Jyotish schools, so this service begins with kundli verification rather than assuming that every marriage delay is caused by Mars. The ritual usually includes Ganesh puja, sankalp, Navagraha and Mangal avahan, Mangal mantra-japa, red-coloured offerings and a shanti havan. Hanuman or Shiva worship may be added according to the officiating pandit’s tradition. Choose it if an astrologer has confirmed Mangal placement in your chart, whether before marriage or as general Mars graha shanti.',
   'A Mangal Graha Shanti puja traditionally performed when Manglik or Mangal Dosha is identified in the kundli, especially before marriage, using sankalp, Mangal worship, mantra-japa and havan.',
   '2-3 hours',
   'Tuesday is commonly associated with Mangal, but the final timing follows your kundli and the local Panchang.',
   'Suitable for live sankalp and remote participation; both partners can be included where the pandit recommends it.',
   'Mangal Dosh Nivaran Puja (Manglik Puja) | PanditSuggest',
   'Mangal Graha Shanti puja for a kundli-confirmed Manglik dosha — sankalp, Mangal worship, mantra-japa and shanti havan, with verified pandits across India.',
   '[{"icon":"🔴","title":"Mangal graha shanti","detail":"The traditional prayer to pacify an adverse Mars influence."},{"icon":"💍","title":"Pre-marriage sankalp","detail":"Often performed before marriage when Manglik Dosha is confirmed."},{"icon":"🧘","title":"Conflict discipline","detail":"Devotees pray for calmness, patience and better handling of conflict."},{"icon":"🪔","title":"Obstacle reduction","detail":"A graha-shanti prayer for Mars-related obstacles."},{"icon":"🔥","title":"Balanced courage","detail":"Mars is linked with energy and courage; the worship seeks its balanced expression."},{"icon":"🏠","title":"Family auspiciousness","detail":"A sankalp for harmony and an auspicious married life."}]'::jsonb,
   '[{"step":1,"title":"Kundli review & Sankalp","detail":"Mangal placement and the purpose of the puja are confirmed.","duration":"15-20 min"},{"step":2,"title":"Ganesh & Kalash Pujan","detail":"Opening purification and kalash establishment.","duration":"15-20 min"},{"step":3,"title":"Mangal Graha Avahan","detail":"Mangal is invoked with the prescribed offerings.","duration":"20-30 min"},{"step":4,"title":"Mangal Mantra Japa","detail":"The mantra count is completed as per the package.","duration":"45-75 min"},{"step":5,"title":"Mangal Shanti Havan","detail":"Fire offerings with ghee and graha-shanti samagri.","duration":"30-45 min"},{"step":6,"title":"Aarti & Daan Guidance","detail":"Closing prayer and traditional charity guidance where applicable.","duration":"15-20 min"}]'::jsonb,
   '[{"item":"Red cloth","qty":"1"},{"item":"Red flowers","qty":"as required"},{"item":"Kumkum / red sandal","qty":"1 set"},{"item":"Jaggery","qty":"250-500 g"},{"item":"Masoor dal","qty":"250-500 g if used"},{"item":"Copper vessel/item","qty":"1, optional"},{"item":"Kalash & coconut","qty":"1 set"},{"item":"Mangal/Navagraha symbol","qty":"1"},{"item":"Havan samagri & ghee","qty":"1 set"},{"item":"Incense, camphor, deepa","qty":"1 set"},{"item":"Fruits / naivedya","qty":"as required"},{"item":"Akshat, roli, moli","qty":"1 set"}]'::jsonb,
   '[{"q":"What is Mangal or Manglik Dosha?","a":"A Jyotish classification based on the placement of Mars. The exact rules differ across schools, which is why the chart is checked first."},{"q":"Is Tuesday compulsory?","a":"No, but Tuesday is traditionally associated with Mangal and is commonly chosen."},{"q":"Is this only for marriage?","a":"No. It can also be performed as general Mangal Graha Shanti."},{"q":"Can both partners participate?","a":"Yes, if the pandit recommends it based on both charts."},{"q":"How long does it take?","a":"Usually around two to three hours for a standard puja-havan."},{"q":"Can it be done online?","a":"Yes, with live sankalp and remote participation."},{"q":"Does it guarantee a successful marriage?","a":"No. It is a devotional and Jyotish remedy, not a guarantee of relationship outcomes."}]'::jsonb),

  ('Rahu-Ketu Shanti Puja', 'rahu-ketu-shanti-puja', 'moon', 30, TRUE, TRUE,
   'Rahu-Ketu Shanti is broader than Kaal Sarp Puja. It is used when a Jyotish consultation identifies challenging Rahu or Ketu periods, placements or afflictions. The common elements are Ganesh and Navagraha worship, Rahu-Ketu avahan, mantra-japa, homa and daan guidance. Not every sudden loss, health scare or spell of confusion is caused by the lunar nodes, and this service does not claim otherwise — it is offered after a chart reading, for the concerns that reading actually identifies.',
   'A graha-shanti ritual dedicated to Rahu and Ketu, traditionally performed after a horoscope assessment with sankalp, Navagraha worship, focused mantra-japa, offerings and havan.',
   '2-3 hours',
   'Chosen after a kundli and Panchang review. Some traditions prefer Saturday or a relevant nakshatra, but there is no single universal time.',
   'Live sankalp participation is available; birth details can be shared in advance for a chart-based booking.',
   'Rahu-Ketu Shanti Puja | PanditSuggest',
   'Graha-shanti puja for Rahu and Ketu after a chart reading — sankalp, Navagraha worship, mantra-japa and homa, performed by verified Vedic pandits.',
   '[{"icon":"🌑","title":"Rahu-Ketu pacification","detail":"The traditional graha-shanti intention of the ritual."},{"icon":"🧘","title":"Mental steadiness","detail":"Devotees seek relief from confusion and unsettled thoughts through prayer."},{"icon":"🧭","title":"Decision support","detail":"Often booked during periods of change or uncertainty."},{"icon":"🪔","title":"Obstacle pacification","detail":"A traditional remedy for disruptions linked astrologically to the lunar nodes."},{"icon":"🕉️","title":"Spiritual introspection","detail":"Ketu worship is associated with detachment and reflection."},{"icon":"🛡️","title":"Protection sankalp","detail":"A prayer for stability through a challenging planetary period."}]'::jsonb,
   '[{"step":1,"title":"Kundli review & Sankalp","detail":"Whether Rahu, Ketu or both are being addressed is identified.","duration":"15-20 min"},{"step":2,"title":"Ganesh & Navagraha Pujan","detail":"Opening shuddhi and Navagraha invocation.","duration":"20-30 min"},{"step":3,"title":"Rahu-Ketu Avahan","detail":"Focused worship with the graha symbols and offerings.","duration":"20-30 min"},{"step":4,"title":"Mantra Japa","detail":"Rahu and Ketu mantras in the declared count.","duration":"45-75 min"},{"step":5,"title":"Graha Shanti Havan","detail":"Homa with ghee, sesame and the prescribed samagri.","duration":"30-45 min"},{"step":6,"title":"Purnahuti & Daan","detail":"Closing prayer and charity guidance where it is included.","duration":"15-20 min"}]'::jsonb,
   '[{"item":"Navagraha/Rahu-Ketu symbols","qty":"1 set"},{"item":"Kalash & coconut","qty":"1 set"},{"item":"Black sesame","qty":"250 g approx."},{"item":"White sesame","qty":"250 g if used"},{"item":"Flowers / durva","qty":"as advised"},{"item":"Havan samagri & ghee","qty":"1 set"},{"item":"Incense, camphor, deepa","qty":"1 set"},{"item":"Akshat, roli, moli","qty":"1 set"},{"item":"Fruits / sweets","qty":"as required"},{"item":"Daan items","qty":"as advised"},{"item":"Puja thali basics","qty":"1 set"},{"item":"New cloth / asana","qty":"as advised"}]'::jsonb,
   '[{"q":"Is Rahu-Ketu Shanti the same as Kaal Sarp Puja?","a":"No. Kaal Sarp is a specific planetary configuration; Rahu-Ketu Shanti is broader."},{"q":"When is it recommended?","a":"After a qualified astrologer identifies the relevant Rahu or Ketu placements, dasha or affliction."},{"q":"Do I need a kundli?","a":"A general Navagraha prayer can be done without one, but a dosha-specific service is better after a chart review."},{"q":"Which day is best?","a":"The pandit may choose a Saturday or another suitable muhurat based on the chart and Panchang."},{"q":"How long does it take?","a":"Usually around two to three hours."},{"q":"Can it be done online?","a":"Yes."},{"q":"Are results guaranteed?","a":"No. It is a traditional devotional and Jyotish practice, never a guaranteed material outcome."}]'::jsonb),

  ('Shani Shanti Puja (Shani Dosh Nivaran)', 'shani-shanti-puja', 'shield-check', 40, TRUE, TRUE,
   'Shani Shanti is dedicated to Shani Dev and is commonly booked when an astrologer identifies Sade Sati, Dhaiya, a Shani dasha or another challenging Saturn influence. A standard service combines Ganesh and Navagraha worship, Shani avahan, mantra-japa, til and oil-related offerings, homa and daan. Saturday is strongly associated with Shani worship, but the remedy is still personalised to your chart rather than applied from a template. Choose it during a Saturn period a Jyotish review has actually identified.',
   'A Shani Graha Shanti puja commonly requested during difficult Saturn periods such as Sade Sati or Dhaiya, with sankalp, Shani mantra-japa, sesame and oil offerings, havan and charity guidance.',
   '2-3 hours',
   'Saturday is traditionally preferred; the final time follows the local Panchang and the pandit’s guidance.',
   'Live sankalp participation is available, with the daan guidance given at the close of the ritual.',
   'Shani Shanti Puja (Shani Dosh Nivaran) | PanditSuggest',
   'Shani Graha Shanti puja for Sade Sati, Dhaiya or a Shani dasha — sankalp, mantra-japa, til and oil offerings, havan and daan, with verified pandits.',
   '[{"icon":"🪐","title":"Shani graha shanti","detail":"The traditional prayer to pacify a difficult Saturn influence."},{"icon":"⏳","title":"Patience and discipline","detail":"Shani worship emphasises responsibility and steady effort."},{"icon":"🪔","title":"Obstacle prayer","detail":"Often performed through repeated delays or heavy burdens."},{"icon":"💼","title":"Work stability sankalp","detail":"A prayer for steadiness in duty and career."},{"icon":"🧘","title":"Mental endurance","detail":"Devotional strength through long, demanding phases."},{"icon":"🤲","title":"Seva and charity","detail":"Shani remedies commonly emphasise daan and ethical conduct."}]'::jsonb,
   '[{"step":1,"title":"Sankalp & Purification","detail":"Shuddhi and a personalised sankalp.","duration":"15-20 min"},{"step":2,"title":"Ganesh & Navagraha Pujan","detail":"Opening worship and Navagraha invocation.","duration":"20-30 min"},{"step":3,"title":"Shani Avahan & Upachara","detail":"Shani worship with sesame and oil-related offerings.","duration":"25-35 min"},{"step":4,"title":"Shani Mantra Japa","detail":"Mantra and stotra recitation in the declared count.","duration":"45-60 min"},{"step":5,"title":"Shani Shanti Havan","detail":"Homa with ghee, sesame and the standard samagri.","duration":"30-45 min"},{"step":6,"title":"Aarti & Daan Guidance","detail":"Closing prayers and charity suggestions.","duration":"15-20 min"}]'::jsonb,
   '[{"item":"Black sesame","qty":"250-500 g"},{"item":"Sesame/mustard oil","qty":"250 ml approx."},{"item":"Iron diya / lamp","qty":"1"},{"item":"Blue/black flowers","qty":"as available"},{"item":"Kalash & coconut","qty":"1 set"},{"item":"Shani/Navagraha symbols","qty":"1 set"},{"item":"Havan samagri & ghee","qty":"1 set"},{"item":"Incense, camphor, wicks","qty":"1 set"},{"item":"Akshat, roli, moli","qty":"1 set"},{"item":"Fruits / naivedya","qty":"as required"},{"item":"Black urad","qty":"as advised"},{"item":"Daan items","qty":"as advised"}]'::jsonb,
   '[{"q":"What is Sade Sati?","a":"In Jyotish it refers to Saturn’s transit around the natal Moon sign across three consecutive signs."},{"q":"Is Saturday best?","a":"Saturday is traditionally dedicated to Shani and is commonly selected."},{"q":"Can I do this during Dhaiya?","a":"Yes. Many devotees do so after astrologer guidance."},{"q":"Is the oil offering compulsory?","a":"It is common, but the exact practice varies by temple and tradition."},{"q":"How long does the puja take?","a":"Usually around two to three hours."},{"q":"Can it be done online?","a":"Yes."},{"q":"Does it guarantee a job or debt relief?","a":"No. It is a religious remedy and is never offered as a guaranteed financial outcome."}]'::jsonb),

  ('Navgraha Shanti Puja', 'navgraha-shanti-puja', 'sun', 50, TRUE, TRUE,
   'Navgraha Shanti collectively honours the nine grahas. The ritual normally begins with sankalp and Ganesh puja, then Navgraha avahan, separate or collective mantra and upachara for each graha, followed by havan and purnahuti. When the booking is based on a kundli, one or more planets can be given special emphasis. It is also commonly incorporated into larger rituals such as Griha Pravesh and Vastu Shanti. Choose it for general nine-planet shanti, for multiple graha concerns at once, or before an important beginning.',
   'A complete worship of Surya, Chandra, Mangal, Budh, Guru, Shukra, Shani, Rahu and Ketu through avahan, mantra-japa, offerings and havan.',
   '2.5-4 hours',
   'An auspicious muhurat chosen after a Panchang review; kundli-based timing is preferable for a dosha-specific booking.',
   'Live sankalp participation is available; birth details help where one graha is to be given emphasis.',
   'Navgraha Shanti Puja | PanditSuggest',
   'Complete nine-planet worship — Surya to Ketu — with avahan, mantra-japa, offerings and havan. Booked for general graha shanti and before new beginnings.',
   '[{"icon":"☀️","title":"Nine-graha worship","detail":"Honours all nine grahas in a single ceremony."},{"icon":"🪐","title":"General graha shanti","detail":"Useful when several planetary concerns are being addressed together."},{"icon":"🌱","title":"Life-event preparation","detail":"Often performed before an important beginning."},{"icon":"🧘","title":"Mental balance prayer","detail":"Devotees seek steadiness while navigating change."},{"icon":"🏠","title":"Family auspiciousness","detail":"Common in home and family rituals."},{"icon":"🧱","title":"Foundation ritual","detail":"Frequently included in Vastu and Griha Pravesh ceremonies."}]'::jsonb,
   '[{"step":1,"title":"Purification & Sankalp","detail":"Shuddhi and sankalp.","duration":"15-20 min"},{"step":2,"title":"Ganesh & Kalash Pujan","detail":"Opening Ganesh puja and kalash sthapana.","duration":"20-30 min"},{"step":3,"title":"Navgraha Avahan","detail":"All nine grahas are invoked.","duration":"30-40 min"},{"step":4,"title":"Graha Upachara & Japa","detail":"Each graha receives its mantra and offering.","duration":"60-90 min"},{"step":5,"title":"Navgraha Havan","detail":"Collective or graha-specific homa.","duration":"45-60 min"},{"step":6,"title":"Purnahuti & Aarti","detail":"Final offering and closing prayer.","duration":"15-20 min"}]'::jsonb,
   '[{"item":"Navgraha symbols/set","qty":"1 set"},{"item":"Navdhanya / nine grains","qty":"1 set"},{"item":"Kalash & coconut","qty":"1 set"},{"item":"Appropriate flowers","qty":"as available"},{"item":"Akshat, roli, sandal, moli","qty":"1 set"},{"item":"Havan samagri","qty":"1 pack"},{"item":"Ghee","qty":"500 ml approx."},{"item":"Samidha / mango wood","qty":"as required"},{"item":"Incense, camphor, deepa","qty":"1 set"},{"item":"Fruits / sweets","qty":"as required"},{"item":"Graha-specific grains","qty":"as advised"},{"item":"Daan items","qty":"as advised"}]'::jsonb,
   '[{"q":"Which planets are included?","a":"Surya, Chandra, Mangal, Budh, Brihaspati, Shukra, Shani, Rahu and Ketu."},{"q":"Is it only for people with a dosha?","a":"No. It can also be done for general auspiciousness and graha-shanti."},{"q":"Do I need birth details?","a":"Not always for a general puja. For personalised remedies, accurate birth details are useful."},{"q":"Is there one fixed muhurat?","a":"No. The date is selected by Panchang and, where relevant, by kundli."},{"q":"How long does it take?","a":"Usually about two and a half to four hours."},{"q":"Can it be done online?","a":"Yes."},{"q":"Is Navgraha Puja part of Griha Pravesh?","a":"It is commonly included in many Griha Pravesh and Vastu Shanti traditions."}]'::jsonb),

  ('Pitra Dosh Nivaran Puja', 'pitra-dosh-nivaran-puja', 'diya', 60, TRUE, TRUE,
   'Pitra Dosh Nivaran Puja is a broad service label rather than one single pan-Indian ritual, and the exact procedure changes by family tradition and by location. The common elements are an ancestor sankalp, tarpana with water and sesame, pinda or shraddha offerings where appropriate, Vishnu or Shiva remembrance and charity. Tripindi Shraddha and Narayan Nagbali are distinct tirtha rituals and are not merged into a generic package here — if you need one of those, it is booked as itself. Choose this service for ancestor remembrance, pitru shanti, tirtha shraddha, or a pitru concern identified astrologically.',
   'An ancestor-focused shanti service involving sankalp, tarpana and, where prescribed, pind or shraddha offerings and prayers for pitru shanti according to family and tirtha tradition.',
   '2-4 hours; tirtha-specific shraddha may take longer',
   'Pitru Paksha, Amavasya and the death-anniversary tithi are common. The final date is confirmed from family details and the local Panchang.',
   'The prayers and sankalp can be joined online. Tirtha-specific pind-daan or shraddha is physically performed at the promised location.',
   'Pitra Dosh Nivaran Puja | PanditSuggest',
   'Ancestor-focused shanti service with sankalp, tarpana and, where prescribed, pinda or shraddha offerings for pitru shanti, according to family tradition.',
   '[{"icon":"🙏","title":"Ancestor remembrance","detail":"A formal devotional way to honour departed ancestors."},{"icon":"🕊️","title":"Pitru shanti prayer","detail":"The traditional prayers for the peace of ancestors."},{"icon":"👪","title":"Family duty","detail":"Supports shraddha and tarpana obligations according to tradition."},{"icon":"💧","title":"Gratitude","detail":"Water and sesame offerings express remembrance and gratitude."},{"icon":"🏠","title":"Family peace sankalp","detail":"A prayer for harmony and wellbeing among the descendants."},{"icon":"🪔","title":"Spiritual closure","detail":"Provides a religious framework for remembrance and closure."}]'::jsonb,
   '[{"step":1,"title":"Family details & Sankalp","detail":"Ancestor details, gotra and purpose are recorded.","duration":"15-20 min"},{"step":2,"title":"Purification & Deity Invocation","detail":"Ganesh, Vishnu or Shiva remembrance as the tradition prescribes.","duration":"15-20 min"},{"step":3,"title":"Tarpana","detail":"Water, sesame and mantra offerings.","duration":"30-45 min"},{"step":4,"title":"Pinda / Shraddha Offering","detail":"Where prescribed, pinda or shraddha is performed.","duration":"30-60 min"},{"step":5,"title":"Pitru Shanti Japa / Homa","detail":"Some traditions include mantra-japa or homa; others do not.","duration":"30-60 min"},{"step":6,"title":"Daan / Bhojan & Closing","detail":"Charity or food offering and closing prayers.","duration":"20-40 min"}]'::jsonb,
   '[{"item":"Black sesame","qty":"250-500 g"},{"item":"Kusha/darbha grass","qty":"1 bundle"},{"item":"Copper lota","qty":"1"},{"item":"Water / Gangajal","qty":"as required"},{"item":"Rice / pinda ingredients","qty":"as prescribed"},{"item":"White cloth / asana","qty":"1"},{"item":"Flowers / tulsi","qty":"as advised"},{"item":"Puja thali basics","qty":"1 set"},{"item":"Satvik food / fruits","qty":"as required"},{"item":"Daan items","qty":"as advised"},{"item":"Havan materials","qty":"only if the selected rite includes homa"},{"item":"Barley / jau","qty":"as prescribed"}]'::jsonb,
   '[{"q":"Is Pitra Dosh Puja the same as Shraddha?","a":"Not exactly. Shraddha, Tarpana, Tripindi Shraddha and Narayan Nagbali are distinct ritual traditions."},{"q":"When is it commonly performed?","a":"Pitru Paksha, Amavasya and the ancestor’s death-anniversary tithi are common."},{"q":"Can it be done online?","a":"You can join the prayers online, but tirtha-specific rites are physically performed there."},{"q":"Do I need ancestor names and tithi?","a":"Provide them if known; gotra and family relation are also useful."},{"q":"Is havan always required?","a":"No. Many ancestor rites focus on tarpana and pinda rather than havan."},{"q":"Can it replace annual Shraddha?","a":"That depends on your family tradition and the priest’s guidance."},{"q":"Does it guarantee removal of family problems?","a":"No. It is an ancestral religious rite, not a guaranteed solution to fertility, finance or family difficulties."}]'::jsonb),

  ('Guru Chandal Dosh Puja', 'guru-chandal-dosh-puja', 'book-open', 70, FALSE, TRUE,
   'Guru Chandal Yoga is commonly described in Jyotish as a conjunction or influence involving Jupiter and Rahu, and some schools also consider Ketu. Its interpretation depends on the full chart, which is why a kundli review comes before this is offered as a remedy — a Jupiter-Rahu conjunction alone is not a diagnosis. A standard ritual combines Ganesh and Navgraha puja, Brihaspati and Rahu avahan, mantra-japa, havan and daan. Choose it when an astrologer has identified the yoga in your chart and explained why a remedy is appropriate.',
   'A Jupiter-Rahu focused graha-shanti puja traditionally performed when an astrologer identifies Guru Chandal Yoga, combining Guru and Rahu worship, mantra-japa, Navgraha prayer and havan.',
   '2-3 hours',
   'The date is selected by a qualified astrologer or pandit. Thursday is often preferred for Guru-oriented worship.',
   'Live sankalp participation is available; birth details can be shared in advance for the chart review.',
   'Guru Chandal Dosh Puja | PanditSuggest',
   'Jupiter-Rahu graha-shanti puja for a chart-confirmed Guru Chandal Yoga — Brihaspati and Rahu worship, mantra-japa, havan and daan, with verified pandits.',
   '[{"icon":"🪐","title":"Guru-Rahu shanti","detail":"The traditional remedy for a challenging Jupiter-Rahu combination."},{"icon":"📖","title":"Wisdom prayer","detail":"Guru worship is associated with knowledge and wise judgement."},{"icon":"🧭","title":"Clarity","detail":"Devotees seek steadiness through a period of confusion."},{"icon":"🙏","title":"Teacher blessings","detail":"Honours the principle of guru, learning and dharma."},{"icon":"⚖️","title":"Graha balance","detail":"Combines Guru worship with Rahu pacification."},{"icon":"🕉️","title":"Ethical discipline","detail":"Best paired with sincere conduct and respect for teachers and elders."}]'::jsonb,
   '[{"step":1,"title":"Kundli review & Sankalp","detail":"The Jupiter-Rahu or Ketu relationship is confirmed.","duration":"15-20 min"},{"step":2,"title":"Ganesh & Navgraha Puja","detail":"Opening shuddhi and Navgraha invocation.","duration":"20-30 min"},{"step":3,"title":"Guru & Rahu Avahan","detail":"Separate worship of Brihaspati and Rahu.","duration":"25-35 min"},{"step":4,"title":"Guru/Rahu Mantra Japa","detail":"The declared mantra count is completed.","duration":"45-60 min"},{"step":5,"title":"Shanti Havan","detail":"Homa with the prescribed graha samagri.","duration":"30-45 min"},{"step":6,"title":"Aarti & Daan","detail":"Closing prayer and charity guidance.","duration":"15-20 min"}]'::jsonb,
   '[{"item":"Yellow cloth / flowers","qty":"1 set"},{"item":"Chana dal / turmeric","qty":"as advised"},{"item":"Rahu-related sesame items","qty":"as advised"},{"item":"Navgraha symbols","qty":"1 set"},{"item":"Kalash & coconut","qty":"1 set"},{"item":"Havan samagri & ghee","qty":"1 set"},{"item":"Incense, camphor, deepa","qty":"1 set"},{"item":"Akshat, roli, moli","qty":"1 set"},{"item":"Fruits / sweets","qty":"as required"},{"item":"Daan items","qty":"as advised"},{"item":"Puja thali basics","qty":"1 set"},{"item":"Books / study items","qty":"optional, for the Guru sankalp"}]'::jsonb,
   '[{"q":"What is Guru Chandal Yoga?","a":"A Jyotish combination commonly involving Jupiter and Rahu. Its effects depend on the whole chart."},{"q":"Should everyone with a Jupiter-Rahu conjunction do this puja?","a":"Not necessarily. Have the chart interpreted first."},{"q":"Is Thursday compulsory?","a":"No, but Thursday is associated with Guru and is often preferred."},{"q":"Does the puja only strengthen Jupiter?","a":"Many remedial formats honour Guru while also pacifying Rahu."},{"q":"How long does it take?","a":"Usually around two to three hours."},{"q":"Can it be done online?","a":"Yes."},{"q":"Will it guarantee a better reputation or better decisions?","a":"No. It is a devotional and Jyotish remedy; your own choices still matter."}]'::jsonb)
)
INSERT INTO public.services
  (category_id, name, slug, icon_name, display_order, is_popular, is_online_available,
   description, short_description, estimated_duration, recommended_muhurat,
   online_note, meta_title, meta_description,
   benefits, process, samagri_list, faqs, is_active)
SELECT (SELECT id FROM cat), i.name, i.slug, i.icon_name, i.display_order,
       i.is_popular, i.is_online_available,
       i.description, i.short_description, i.estimated_duration, i.recommended_muhurat,
       i.online_note, i.meta_title, i.meta_description,
       i.benefits, i.process, i.samagri_list, i.faqs,
       FALSE   -- draft until an admin adds the image and activates it
  FROM incoming i
ON CONFLICT (slug) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Deity Havans & Poojas
-- ----------------------------------------------------------------------------
WITH cat AS (SELECT id FROM public.service_categories WHERE slug = 'deity-havan-puja'),
incoming (name, slug, icon_name, display_order, is_popular, is_online_available,
          description, short_description, estimated_duration, recommended_muhurat,
          online_note, meta_title, meta_description,
          benefits, process, samagri_list, faqs) AS (
  VALUES
  ('Durga Saptashati / Chandi Havan', 'durga-saptashati-chandi-havan', 'trishul', 10, TRUE, TRUE,
   'Durga Saptashati, also called Devi Mahatmyam or Chandi Path, contains 700 verses arranged in 13 chapters. It is a central Shakta text and is widely recited during Navratri. A Chandi Havan combines Devi puja and the recitation with fire offerings. One documented Chandi Homa format uses 700 ahutis, but homa paddhati varies by lineage, so the package states plainly whether it is Path only, Path and Havan, or an extended anushthan. Choose it for Devi worship, a protection prayer, Navratri, a major sankalp or extended Shakti upasana.',
   'A complete Devi worship centred on the 700 verses and 13 chapters of Durga Saptashati (Devi Mahatmyam), followed by Chandi Havan according to the officiating tradition.',
   '4-8 hours for one complete path and havan; longer anushthans may span days',
   'Navratri, Ashtami and Navami are popular; other auspicious Devi dates may be selected by the acharya.',
   'Live participation is practical while trained pandits perform the recitation and the havan.',
   'Durga Saptashati / Chandi Havan | PanditSuggest',
   'Complete Devi worship — the 700 verses and 13 chapters of Durga Saptashati followed by Chandi Havan, performed by trained pandits. Popular during Navratri.',
   '[{"icon":"🔱","title":"Devi worship","detail":"A complete devotional offering to the Divine Mother."},{"icon":"🛡️","title":"Protection prayer","detail":"Traditionally sought for courage and protection."},{"icon":"🪔","title":"Obstacle pacification","detail":"Often selected for major sankalps and difficult phases."},{"icon":"📿","title":"Spiritual discipline","detail":"Extended recitation and homa create a focused period of worship."},{"icon":"🌺","title":"Navratri observance","detail":"One of the major rituals of Navratri."},{"icon":"✨","title":"Auspicious beginnings","detail":"Often chosen before a major family, home or business milestone."}]'::jsonb,
   '[{"step":1,"title":"Sankalp, Kalash & Ganesh Puja","detail":"Opening purification and Devi kalash sthapana.","duration":"30-45 min"},{"step":2,"title":"Devi Avahan & Preliminary Recitations","detail":"The lineage-specific preliminary texts and mantras.","duration":"30-45 min"},{"step":3,"title":"Durga Saptashati Path","detail":"The complete 13-chapter recitation by trained pandits.","duration":"2.5-4 hours"},{"step":4,"title":"Chandi Havan","detail":"Fire offerings with the prescribed Devi mantras.","duration":"60-120 min"},{"step":5,"title":"Purnahuti & Seva","detail":"Final offering and optional tradition-based seva.","duration":"20-40 min"},{"step":6,"title":"Aarti & Prasad","detail":"Closing aarti and prasad.","duration":"15-20 min"}]'::jsonb,
   '[{"item":"Durga Saptashati text","qty":"1 per reciter"},{"item":"Devi image/murti","qty":"1"},{"item":"Kalash & coconut","qty":"1 set"},{"item":"Red cloth & red flowers","qty":"1 set"},{"item":"Kumkum, akshat, sandal","qty":"1 set"},{"item":"Havan kund & samidha","qty":"1 set"},{"item":"Havan samagri","qty":"1-2 packs, or as the ahuti count requires"},{"item":"Ghee","qty":"500 ml - 1 L approx."},{"item":"Grains / sesame / dry fruits","qty":"as prescribed"},{"item":"Fruits / sweets / naivedya","qty":"as required"},{"item":"Incense, camphor, lamps","qty":"1 set"},{"item":"Chunari / Devi vastra","qty":"1"}]'::jsonb,
   '[{"q":"What is Durga Saptashati?","a":"It is the Devi Mahatmyam or Chandi Path, traditionally counted as 700 verses in 13 chapters."},{"q":"Is Chandi Havan the same as Saptashati Path?","a":"No. The Path is the recitation; Chandi Havan adds a fire ritual."},{"q":"How long does it take?","a":"A one-day path plus havan can take roughly four to eight hours."},{"q":"Is Navratri compulsory?","a":"No, but it is especially popular during Navratri."},{"q":"How many pandits are required?","a":"One or more, depending on the package and the scale."},{"q":"Can it be done online?","a":"Yes."},{"q":"Are there always exactly 700 ahutis?","a":"One documented Chandi Homa format uses 700 ahutis, but homa procedures vary. Your package states the actual method."}]'::jsonb),

  ('Maha Mrityunjaya Havan', 'maha-mrityunjaya-havan', 'om', 20, TRUE, TRUE,
   'The Maha Mrityunjaya Mantra is a Vedic mantra addressed to Tryambaka or Rudra and is widely used in both japa and homa. A standard service includes sankalp, Ganesh and Shiva puja, mantra-japa, havan, purnahuti and aarti. Common packages use 108 or 1008 recitations, while larger anushthans use higher counts — the exact count is declared before you book. This is spiritual support during illness, recovery or a difficult period, and it does not replace medical diagnosis, medication or emergency care.',
   'A Shiva-focused mantra-japa and havan using the Maha Mrityunjaya (Tryambakam) Mantra, traditionally performed as a prayer for wellbeing, courage and protection from fear.',
   '2-4 hours; longer for a high-count mantra anushthan',
   'Monday, Pradosh, Mahashivratri and Shravan are popular Shiva occasions; other auspicious times can be used.',
   'Live participation is available, and the sankalp can be taken in the name of someone unable to attend.',
   'Maha Mrityunjaya Havan | PanditSuggest',
   'Shiva mantra-japa and havan with the Maha Mrityunjaya Mantra — 108, 1008 or a declared higher count, as a traditional prayer for wellbeing and courage.',
   '[{"icon":"🙏","title":"Wellbeing prayer","detail":"Traditionally performed as a prayer for health and strength."},{"icon":"🕊️","title":"Fear reduction","detail":"Devotees seek courage during illness or recovery."},{"icon":"🔱","title":"Shiva blessings","detail":"Focused worship of Shiva as Mrityunjaya."},{"icon":"🛡️","title":"Protection sankalp","detail":"A prayer for spiritual protection through a difficult period."},{"icon":"🧘","title":"Mental resilience","detail":"Japa and havan support devotional steadiness."},{"icon":"👪","title":"Family prayer","detail":"Can be performed for yourself or for a family member."}]'::jsonb,
   '[{"step":1,"title":"Sankalp & Ganesh Puja","detail":"Opening purification and sankalp.","duration":"15-20 min"},{"step":2,"title":"Shiva Pujan / Abhishek","detail":"Shiva worship, with abhishek if it is included.","duration":"20-30 min"},{"step":3,"title":"Maha Mrityunjaya Japa","detail":"The declared mantra count is completed.","duration":"45-120 min"},{"step":4,"title":"Maha Mrityunjaya Havan","detail":"Ahutis are offered with the mantra.","duration":"30-60 min"},{"step":5,"title":"Purnahuti & Shanti Path","detail":"Final oblation and the peace prayers.","duration":"15-20 min"},{"step":6,"title":"Aarti & Prasad","detail":"Closing Shiva aarti and prasad.","duration":"10-15 min"}]'::jsonb,
   '[{"item":"Shiva Lingam/image","qty":"1"},{"item":"Kalash & coconut","qty":"1 set"},{"item":"Bilva leaves","qty":"as required"},{"item":"Flowers","qty":"as required"},{"item":"Panchamrit ingredients","qty":"1 set if abhishek"},{"item":"Gangajal / water","qty":"as required"},{"item":"Havan samagri","qty":"1 pack"},{"item":"Ghee","qty":"250-500 ml"},{"item":"Samidha / mango wood","qty":"as required"},{"item":"Sesame / barley","qty":"as prescribed"},{"item":"Incense, camphor, deepa","qty":"1 set"},{"item":"Fruits / naivedya","qty":"as required"}]'::jsonb,
   '[{"q":"What is the Maha Mrityunjaya Mantra?","a":"A Vedic Tryambakam mantra addressed to Rudra or Shiva, widely used in japa and homa."},{"q":"How many times is it chanted?","a":"Common packages use 108 or 1008. Larger counts are stated explicitly before booking."},{"q":"Is this medical treatment?","a":"No. It is a spiritual practice and does not replace diagnosis, medication or emergency care."},{"q":"Can it be done for someone not present?","a":"Yes. The sankalp can be taken in that person’s name."},{"q":"Which day is best?","a":"Monday and other Shiva occasions are popular."},{"q":"Can I join online?","a":"Yes."},{"q":"Does it always include Rudrabhishek?","a":"No. Rudrabhishek is a separate service unless your package explicitly bundles it."}]'::jsonb),

  ('Rudrabhishek Puja', 'rudrabhishek-puja', 'kalash', 30, TRUE, TRUE,
   'Rudrabhishek is the ceremonial bathing of the Shiva Lingam while Shri Rudram, Rudri or Shiva mantras are recited. The common abhishek dravyas are water, milk, curd, ghee, honey and sugar, followed by pure water, and bilva leaves are a standard offering. Monday, Pradosh, Shravan and Mahashivratri are the popular occasions. A havan is a separate item and appears in your package only when it is actually included. Choose it for Shiva abhishek, for Shravan or a Monday, or as a general peace and prosperity sankalp.',
   'A Shiva abhishek ceremony in which the Shiva Lingam is ritually bathed with water and panchamrit while Rudra mantras are recited, followed by bilva offerings, puja and aarti.',
   '1.5-3 hours',
   'Monday, Pradosh, Mahashivratri and Shravan are widely preferred; the local Panchang or temple schedule decides the rest.',
   'Live participation while the pandit performs the abhishek; the dravyas are offered on your behalf with your sankalp.',
   'Rudrabhishek Puja | PanditSuggest',
   'Shiva Lingam abhishek with water and panchamrit while Rudra mantras are recited, followed by bilva offerings and aarti. Popular in Shravan and on Mondays.',
   '[{"icon":"🔱","title":"Shiva bhakti","detail":"A direct form of Shiva worship through abhishek and mantra."},{"icon":"🧘","title":"Peace prayer","detail":"A common sankalp for mental and family peace."},{"icon":"🪔","title":"Obstacle prayer","detail":"Often selected during a difficult phase or before a new beginning."},{"icon":"💧","title":"Spiritual purification","detail":"The sacred bathing and mantra emphasise devotional purification."},{"icon":"🌧️","title":"Shravan observance","detail":"One of the most popular Shiva services in Shravan."},{"icon":"🏠","title":"Family auspiciousness","detail":"Suitable for birthdays, anniversaries and general wellbeing prayers."}]'::jsonb,
   '[{"step":1,"title":"Sankalp & Ganesh Puja","detail":"Opening purification and sankalp.","duration":"15-20 min"},{"step":2,"title":"Shiva Avahan & Pujan","detail":"Shiva is invoked and the basic upacharas are offered.","duration":"15-20 min"},{"step":3,"title":"Abhishek","detail":"Water and the selected dravyas are offered over the Lingam.","duration":"30-60 min"},{"step":4,"title":"Rudra / Rudri Path","detail":"Rudra recitation according to the package.","duration":"30-60 min"},{"step":5,"title":"Bilva & Naivedya Archana","detail":"Bilva leaves, flowers and naivedya are offered.","duration":"15-20 min"},{"step":6,"title":"Aarti & Prasad","detail":"Closing aarti and blessings.","duration":"10-15 min"}]'::jsonb,
   '[{"item":"Shiva Lingam","qty":"1"},{"item":"Gangajal / pure water","qty":"2-5 L or as needed"},{"item":"Milk","qty":"1-2 L"},{"item":"Curd","qty":"250-500 g"},{"item":"Honey","qty":"100-250 ml"},{"item":"Ghee","qty":"100-250 ml"},{"item":"Sugar","qty":"250 g"},{"item":"Bilva leaves","qty":"21 or more, as available"},{"item":"Flowers","qty":"as required"},{"item":"Sandal / bhasma","qty":"1 set"},{"item":"Incense, camphor, deepa","qty":"1 set"},{"item":"Fruits / naivedya","qty":"as required"}]'::jsonb,
   '[{"q":"What is Rudrabhishek?","a":"The ritual bathing of the Shiva Lingam accompanied by Rudra or Shiva mantras."},{"q":"Which liquids are used?","a":"Water is fundamental; panchamrit commonly uses milk, curd, ghee, honey and sugar."},{"q":"Is Monday compulsory?","a":"No, but Monday is traditionally associated with Shiva."},{"q":"Is havan included?","a":"Only if the package explicitly says so."},{"q":"Can it be done online?","a":"Yes."},{"q":"How long does it take?","a":"Usually around one and a half to three hours."},{"q":"Can I book during Shravan?","a":"Yes. Shravan is one of the most popular periods, so booking early helps."}]'::jsonb),

  ('Lakshmi Puja (Dhan Prapti Puja)', 'lakshmi-puja-dhan-prapti', 'sparkles', 40, TRUE, TRUE,
   'Lakshmi Puja honours Goddess Lakshmi, associated with Shri, abundance and auspiciousness. A 16-step Shodashopachara Lakshmi Puja is documented for Diwali; outside Diwali, home and business versions are often shorter. Where the wording "Dhan Prapti" is used, it means a devotional prosperity prayer — this service never promises guaranteed money, investment returns or debt clearance. Choose it for Diwali, a business or shop opening, household auspiciousness, or as a prosperity sankalp before a new venture.',
   'A Shodashopachara-style worship of Goddess Lakshmi with sankalp, kalash, flowers, lamp, naivedya and prosperity prayers, commonly booked on Diwali, on Fridays and before new ventures.',
   '1.5-2.5 hours',
   'On Diwali, the location-specific Lakshmi Puja muhurat. Outside Diwali, Friday or another auspicious muhurat may be selected.',
   'Live participation is available; business families can have account books or tools included in the sankalp.',
   'Lakshmi Puja (Dhan Prapti Puja) | PanditSuggest',
   'Shodashopachara worship of Goddess Lakshmi with sankalp, kalash, lamp, naivedya and Shri Sukta — booked for Diwali, Fridays and new business openings.',
   '[{"icon":"🌸","title":"Lakshmi blessings","detail":"A prayer for the grace of Goddess Lakshmi."},{"icon":"🏺","title":"Prosperity sankalp","detail":"A devotional prayer for financial stability and responsible growth."},{"icon":"🏪","title":"Business auspiciousness","detail":"Popular for shop, office and venture openings."},{"icon":"🏠","title":"Household harmony","detail":"A prayer for a peaceful, auspicious home."},{"icon":"🙏","title":"Gratitude","detail":"The offerings express gratitude for resources and wellbeing."},{"icon":"🪔","title":"Diwali observance","detail":"A central ritual for many families on Diwali."}]'::jsonb,
   '[{"step":1,"title":"Purification, Ganesh & Sankalp","detail":"The puja area is prepared and the sankalp taken.","duration":"15-20 min"},{"step":2,"title":"Kalash & Lakshmi Avahan","detail":"The kalash is established and Goddess Lakshmi invoked.","duration":"15-20 min"},{"step":3,"title":"Main Upachara Pujan","detail":"Gandha, flowers, akshat, vastra, dhupa and deepa are offered.","duration":"30-45 min"},{"step":4,"title":"Lakshmi Mantra / Shri Sukta","detail":"Recitation as per the package.","duration":"20-40 min"},{"step":5,"title":"Naivedya & Account/Tool Worship","detail":"Sweets and fruits are offered; business families may worship account books or tools.","duration":"15-20 min"},{"step":6,"title":"Aarti & Prasad","detail":"Closing aarti and prasad.","duration":"10-15 min"}]'::jsonb,
   '[{"item":"Lakshmi image/murti","qty":"1"},{"item":"Ganesh image","qty":"1 if included"},{"item":"Kalash & coconut","qty":"1 set"},{"item":"Lotus / red-pink flowers","qty":"as available"},{"item":"Rice / akshat","qty":"1 bowl"},{"item":"Kumkum, turmeric, sandal","qty":"1 set"},{"item":"Coins / Shri Yantra","qty":"optional"},{"item":"Ghee/oil lamps & wicks","qty":"1 set"},{"item":"Incense & camphor","qty":"1 set"},{"item":"Fruits & sweets","qty":"as required"},{"item":"Paan / supari","qty":"as advised"},{"item":"Chunari / new cloth","qty":"optional"}]'::jsonb,
   '[{"q":"Is this the same as Diwali Lakshmi Puja?","a":"The deity worship is similar, but Diwali has a specific festival context and a location-based muhurat."},{"q":"Can it be done for business growth?","a":"Yes, as a devotional business-auspiciousness sankalp. Financial outcomes are not guaranteed."},{"q":"Which day is best outside Diwali?","a":"Friday is commonly associated with Lakshmi worship."},{"q":"Is the Shri Yantra compulsory?","a":"No. It is optional in many traditions."},{"q":"Can it be done online?","a":"Yes."},{"q":"How long does it take?","a":"Usually around one and a half to two and a half hours."},{"q":"Does it promise wealth?","a":"No. It is a devotional prosperity prayer — never guaranteed wealth, money doubling or debt removal."}]'::jsonb),

  ('Satyanarayan Katha', 'satyanarayan-katha-puja', 'book-open', 50, TRUE, TRUE,
   'Satyanarayan Puja is a household worship of Lord Vishnu in the Satyanarayan form. The five-chapter Katha sits at the centre of the ceremony, with Ganesh worship, sankalp, kalash, Satyanarayan puja, the Katha, aarti and prasad around it. Sheera or halwa is the common prasad, with regional variations in the recipe. Purnima is especially popular, but the ritual is also performed for housewarmings, marriages, births and as gratitude after a milestone. Choose it as a family gratitude puja, after moving into a new home, or when a wish has been fulfilled.',
   'A widely performed Lord Vishnu and Satyanarayan puja with formal worship, the five-chapter Satyanarayan Vrat Katha, naivedya and aarti, often observed on Purnima and family occasions.',
   '2-3 hours',
   'Purnima is especially popular; other auspicious days and family occasions are also used.',
   'Families can join live and prepare their own prasad at home if they wish.',
   'Satyanarayan Katha | PanditSuggest',
   'Lord Satyanarayan puja with the five-chapter Vrat Katha, naivedya and aarti — booked on Purnima, after a housewarming and as a family gratitude puja.',
   '[{"icon":"🕉️","title":"Vishnu worship","detail":"Devotional worship of Lord Satyanarayan."},{"icon":"🙏","title":"Gratitude","detail":"Often performed after a milestone or the fulfilment of a wish."},{"icon":"👪","title":"Family gathering","detail":"The Katha is commonly heard together by the whole family."},{"icon":"🏠","title":"Home auspiciousness","detail":"Popular after moving into a new home."},{"icon":"⚖️","title":"Truth and dharma","detail":"The Katha emphasises truthfulness and keeping commitments."},{"icon":"🍚","title":"Prasad and charity","detail":"The ceremony ends with shared prasad and often with charity."}]'::jsonb,
   '[{"step":1,"title":"Purification, Ganesh & Sankalp","detail":"The opening sankalp and Ganesh worship.","duration":"20-30 min"},{"step":2,"title":"Kalash & Satyanarayan Avahan","detail":"The altar is established and Lord Satyanarayan invoked.","duration":"20-30 min"},{"step":3,"title":"Main Pujan","detail":"The traditional upacharas are offered.","duration":"30-45 min"},{"step":4,"title":"Satyanarayan Vrat Katha","detail":"The five chapters are recited and heard.","duration":"45-60 min"},{"step":5,"title":"Naivedya & Aarti","detail":"Prasad is offered and the aarti performed.","duration":"15-20 min"},{"step":6,"title":"Prasad Distribution","detail":"The ceremony concludes and prasad is distributed.","duration":"10-15 min"}]'::jsonb,
   '[{"item":"Satyanarayan/Vishnu image","qty":"1"},{"item":"Ganesh image","qty":"1"},{"item":"Kalash & coconut","qty":"1 set"},{"item":"Flowers & tulsi","qty":"as required"},{"item":"Panchamrit ingredients","qty":"1 set"},{"item":"Sheera/halwa ingredients","qty":"as your family recipe"},{"item":"Bananas / fruits","qty":"as required"},{"item":"Incense, camphor, lamps","qty":"1 set"},{"item":"Akshat, roli, moli, sandal","qty":"1 set"},{"item":"Paan / supari","qty":"as advised"},{"item":"New cloth / vastra","qty":"optional"},{"item":"Puja thali basics","qty":"1 set"}]'::jsonb,
   '[{"q":"When should Satyanarayan Puja be done?","a":"It can be performed on many days; Purnima is especially popular."},{"q":"How many chapters are in the Katha?","a":"The commonly recited Vrat Katha is organised into five chapters."},{"q":"What prasad is used?","a":"Sheera or halwa made from wheat flour or semolina with ghee, sugar and often banana. Recipes vary by family."},{"q":"Can it be performed after Griha Pravesh?","a":"Yes, many families do so."},{"q":"Is fasting compulsory?","a":"Practices vary by family tradition and personal health."},{"q":"Can it be done online?","a":"Yes."},{"q":"How long does it take?","a":"Usually about two to three hours, depending on the pace of the full puja and Katha."}]'::jsonb),

  ('Navchandi Havan', 'navchandi-havan', 'award', 60, TRUE, TRUE,
   'Navchandi refers to an extended Chandi anushthan, but the exact number of recitations, the number of pandits and the homa sequence vary by tradition. Because of that, no fixed count is claimed here — the booking discloses the actual path count, pandit count, duration, homa method and inclusions before you commit. Choose it for a large-scale Devi anushthan, a major or prolonged sankalp, Navratri, or extended Shakti worship for a family or an institution.',
   'An elaborate Devi anushthan built around multiple Chandi or Durga Saptashati recitations and homa, generally performed by a team of experienced priests for intensive Shakti upasana and major sankalps.',
   '1 full day to multiple days, depending on the path count and the pandit team',
   'Navratri and other auspicious Devi periods are especially popular; the final date is set by the acharya and the Panchang.',
   'Live participation is suitable while the priest team performs the physical anushthan.',
   'Navchandi Havan | PanditSuggest',
   'Extended Devi anushthan with multiple Chandi recitations and homa by a team of experienced pandits. Path count, pandit count and duration stated upfront.',
   '[{"icon":"🔱","title":"Intensive Devi worship","detail":"A larger-scale Shakti anushthan."},{"icon":"📿","title":"Major sankalp","detail":"Traditionally selected for important or prolonged concerns."},{"icon":"🛡️","title":"Protection and courage","detail":"A prayer for the Devi’s protection and for inner strength."},{"icon":"👥","title":"Team recitation","detail":"Often performed by several trained pandits together."},{"icon":"🌺","title":"Navratri significance","detail":"Especially popular during Navratri."},{"icon":"🏛️","title":"Family or community sankalp","detail":"Can be organised for an individual, a family or an institution."}]'::jsonb,
   '[{"step":1,"title":"Acharya Briefing & Sankalp","detail":"The exact path count, priest count and duration are agreed.","duration":"20-30 min"},{"step":2,"title":"Kalash, Ganesh & Devi Pujan","detail":"Opening purification and Devi installation.","duration":"30-45 min"},{"step":3,"title":"Chandi/Saptashati Recitations","detail":"The declared recitation cycles are completed.","duration":"several hours"},{"step":4,"title":"Devi Mantra Japa","detail":"Lineage-specific mantra-japa, where it is included.","duration":"variable"},{"step":5,"title":"Navchandi Havan","detail":"The extended homa according to the package.","duration":"1-3 hours"},{"step":6,"title":"Purnahuti, Aarti & Seva","detail":"Final offering, aarti and optional seva.","duration":"20-40 min"}]'::jsonb,
   '[{"item":"Devi image/yantra","qty":"1"},{"item":"Kalash & coconut","qty":"1 or more"},{"item":"Durga Saptashati texts","qty":"one per pandit"},{"item":"Red cloth & flowers","qty":"as required"},{"item":"Kumkum, akshat, sandal","qty":"1 set"},{"item":"Havan kund & samidha","qty":"as required"},{"item":"Havan samagri","qty":"by ahuti count"},{"item":"Ghee","qty":"by homa scale"},{"item":"Dry fruits / grains / sesame","qty":"as prescribed"},{"item":"Fruits / sweets","qty":"as required"},{"item":"Incense, camphor, lamps","qty":"1 set"},{"item":"Chunari / Devi vastra","qty":"as required"}]'::jsonb,
   '[{"q":"Is Navchandi the same as Chandi Havan?","a":"Navchandi generally refers to a larger or repeated Chandi anushthan. The exact format varies by tradition."},{"q":"Is it always nine complete recitations?","a":"Not universally. The exact recitation count for your booked package is stated before you confirm."},{"q":"How many pandits are needed?","a":"It depends on the scale and the duration."},{"q":"Can it be completed in one day?","a":"Some formats can; larger anushthans may take several days."},{"q":"Is Navratri compulsory?","a":"No, though it is a very popular period."},{"q":"Can I attend online?","a":"Yes."},{"q":"What should I confirm before booking?","a":"The path count, the pandit count, the duration, what samagri is included, the homa details and any seva or daan."}]'::jsonb),

  ('Ganesh Puja (Vighnaharta Puja)', 'ganesh-puja-vighnaharta', 'diya', 70, TRUE, TRUE,
   'Lord Ganesha is traditionally invoked before any auspicious task, as Vighnaharta. A standalone service commonly includes purification, sankalp, Ganesh avahan, upachara worship, durva and red or yellow flower offerings, mantra-japa, modak or laddoo naivedya and aarti. A short havan appears only when the package includes it. Choose it before a new beginning, an inauguration, a business opening or an event, or simply as a Ganesh worship at home.',
   'A Lord Ganesha worship traditionally performed before new beginnings, ceremonies and ventures, with sankalp, avahan, durva, modak or naivedya, mantra and aarti.',
   '1-2 hours',
   'Can be performed before the intended auspicious activity. Wednesday and Chaturthi are popular, but an event-specific muhurat works just as well.',
   'Live participation is available, and the puja can be timed to your event rather than to a fixed day.',
   'Ganesh Puja (Vighnaharta Puja) | PanditSuggest',
   'Lord Ganesha worship before a new beginning, inauguration or venture — sankalp, avahan, durva and modak offerings, mantra and aarti, with verified pandits.',
   '[{"icon":"✨","title":"Auspicious beginning","detail":"Traditionally performed before starting new work."},{"icon":"🪔","title":"Obstacle-removal prayer","detail":"Ganesha is worshipped as Vighnaharta."},{"icon":"📖","title":"Wisdom and clarity","detail":"A prayer for buddhi and good judgement."},{"icon":"🏪","title":"Business and event blessing","detail":"Popular for inaugurations and launches."},{"icon":"🏠","title":"Family worship","detail":"Suitable as a simple home puja."},{"icon":"🧱","title":"Foundation ritual","detail":"Ganesh worship commonly opens larger pujas."}]'::jsonb,
   '[{"step":1,"title":"Purification & Sankalp","detail":"Shuddhi and sankalp.","duration":"10-15 min"},{"step":2,"title":"Ganesh Avahan","detail":"Lord Ganesha is invoked.","duration":"10-15 min"},{"step":3,"title":"Main Upachara Pujan","detail":"Durva, flowers, akshat, dhupa and deepa are offered.","duration":"20-30 min"},{"step":4,"title":"Ganesh Mantra / Path","detail":"Recitation according to the package.","duration":"15-30 min"},{"step":5,"title":"Naivedya & Optional Havan","detail":"Modak or laddoo is offered; havan only if it is included.","duration":"15-30 min"},{"step":6,"title":"Aarti & Prasad","detail":"Closing aarti and prasad.","duration":"10-15 min"}]'::jsonb,
   '[{"item":"Ganesh image/murti","qty":"1"},{"item":"Durva grass","qty":"as required"},{"item":"Red/yellow flowers","qty":"as required"},{"item":"Modak/laddoo","qty":"11 or 21, or as the family prefers"},{"item":"Coconut","qty":"1"},{"item":"Kalash","qty":"1, optional"},{"item":"Akshat, roli, sandal, moli","qty":"1 set"},{"item":"Incense, camphor, lamp","qty":"1 set"},{"item":"Fruits","qty":"as required"},{"item":"Paan/supari","qty":"as advised"},{"item":"Havan materials","qty":"only if included"},{"item":"New cloth / vastra","qty":"optional"}]'::jsonb,
   '[{"q":"Why is Ganesh Puja done first?","a":"Lord Ganesha is traditionally invoked at the start of auspicious ceremonies."},{"q":"Is Wednesday compulsory?","a":"No. Wednesday is associated with Ganesha, but the puja can be performed for the actual event muhurat."},{"q":"Is havan required?","a":"No. A standard Ganesh Puja is complete without havan."},{"q":"What is the common naivedya?","a":"Modak or laddoo is widely offered."},{"q":"Why is durva offered?","a":"Durva grass is a major traditional offering in Ganesh worship."},{"q":"Can it be done online?","a":"Yes."},{"q":"How long does it take?","a":"Usually around one to two hours."}]'::jsonb)
)
INSERT INTO public.services
  (category_id, name, slug, icon_name, display_order, is_popular, is_online_available,
   description, short_description, estimated_duration, recommended_muhurat,
   online_note, meta_title, meta_description,
   benefits, process, samagri_list, faqs, is_active)
SELECT (SELECT id FROM cat), i.name, i.slug, i.icon_name, i.display_order,
       i.is_popular, i.is_online_available,
       i.description, i.short_description, i.estimated_duration, i.recommended_muhurat,
       i.online_note, i.meta_title, i.meta_description,
       i.benefits, i.process, i.samagri_list, i.faqs,
       FALSE   -- draft until an admin adds the image and activates it
  FROM incoming i
ON CONFLICT (slug) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Vastu, Home & Occasion Pujas
-- ----------------------------------------------------------------------------
WITH cat AS (SELECT id FROM public.service_categories WHERE slug = 'vastu-home-occasion-pujas'),
incoming (name, slug, icon_name, display_order, is_popular, is_online_available,
          description, short_description, estimated_duration, recommended_muhurat,
          online_note, meta_title, meta_description,
          benefits, process, samagri_list, faqs) AS (
  VALUES
  ('Vastu Shanti Puja', 'vastu-shanti-puja', 'kalash', 10, TRUE, TRUE,
   'Vastu Shanti is a property-specific religious consecration and shanti ceremony. The common format is Ganesh puja, kalash, Navgraha worship, Vastu Purusha and directional deity worship, havan and purnahuti, with the scale varying by regional tradition. It is a religious rite, not an engineering one: a puja does not physically correct a structural defect, and architectural problems still need architectural fixes. Choose it for a new or renovated home or office, before first occupation, or when a Vastu concern has been raised.',
   'A home or office consecration ceremony with sankalp, Ganesh puja, Vastu Purusha and Navgraha worship, directional offerings and havan, commonly paired with Griha Pravesh.',
   '2.5-4 hours',
   'Usually selected together with a property-specific Griha Pravesh or Vastu muhurat using the local Panchang.',
   'Live-streaming is possible, but a property-specific Vastu Shanti is best performed by the pandit at the actual site.',
   'Vastu Shanti Puja | PanditSuggest',
   'Home or office consecration with Ganesh puja, Vastu Purusha and Navgraha worship, directional offerings and havan. Commonly paired with Griha Pravesh.',
   '[{"icon":"🏠","title":"Space consecration","detail":"Ritual purification and dedication of a new or renovated space."},{"icon":"🧭","title":"Vastu Purusha worship","detail":"Honours Vastu Purusha and the directional deities."},{"icon":"🪐","title":"Navgraha shanti","detail":"Navgraha worship is commonly included."},{"icon":"👪","title":"Family peace prayer","detail":"A sankalp for harmony and wellbeing in the new space."},{"icon":"🚪","title":"Pre-entry auspiciousness","detail":"Common before a family first occupies the property."},{"icon":"🔥","title":"Homa purification","detail":"The sacred fire is used as a traditional purification rite."}]'::jsonb,
   '[{"step":1,"title":"Site Shuddhi & Sankalp","detail":"The area is purified and the property and family sankalp taken.","duration":"15-20 min"},{"step":2,"title":"Ganesh & Kalash Pujan","detail":"Opening worship.","duration":"20-30 min"},{"step":3,"title":"Vastu Purusha / Dikpal Pujan","detail":"Directional and Vastu worship according to the paddhati.","duration":"30-45 min"},{"step":4,"title":"Navgraha Pujan","detail":"The nine-graha invocation.","duration":"30-45 min"},{"step":5,"title":"Vastu Shanti Havan","detail":"The fire ritual with the prescribed offerings.","duration":"45-60 min"},{"step":6,"title":"Purnahuti & Space Blessing","detail":"Final offering and blessing of the property.","duration":"20-30 min"}]'::jsonb,
   '[{"item":"Kalash & coconut","qty":"1 set"},{"item":"Vastu Purusha mandala/symbol","qty":"1"},{"item":"Navgraha set","qty":"1"},{"item":"Rice / grains","qty":"as required"},{"item":"Flowers, turmeric, kumkum, sandal","qty":"1 set"},{"item":"Mango leaves","qty":"as required"},{"item":"Havan kund, samidha, samagri","qty":"1 set"},{"item":"Ghee","qty":"500 ml approx."},{"item":"Incense, camphor, lamps","qty":"1 set"},{"item":"Fruits / sweets","qty":"as required"},{"item":"Gangajal / water","qty":"as required"},{"item":"New cloth / asana","qty":"1 set"}]'::jsonb,
   '[{"q":"Is Vastu Shanti the same as Griha Pravesh?","a":"No. They are related but distinct, and many families combine them."},{"q":"Can Vastu Puja fix a structural defect?","a":"No. It is a religious ritual, not a substitute for architectural or engineering correction."},{"q":"Should the pandit come to the property?","a":"Yes. Physical presence is preferable for a property-specific Vastu Shanti."},{"q":"How is the muhurat chosen?","a":"Using the location-specific Panchang together with the property and family details."},{"q":"How long does it take?","a":"Usually around two and a half to four hours."},{"q":"Can it be done in an office?","a":"Yes."},{"q":"Is Navgraha Puja included?","a":"Commonly, yes — but your package states it clearly rather than leaving it assumed."}]'::jsonb),

  ('Griha Pravesh Puja', 'griha-pravesh-puja', 'home', 20, TRUE, FALSE,
   'Griha Pravesh marks the ceremonial entry into a new or reoccupied home. Three types are commonly described: Apurva, the first entry into a new house; Sapurva, re-entry after an absence or renovation; and Dwandwa, entry after rebuilding or damage. A typical ceremony includes Ganesh puja, kalash, Navgraha and Vastu worship, havan, the entry itself at the selected muhurat and the symbolic boiling of milk. The exact sequence varies by region. Choose it for the first entry into a new or bought home, or as a house blessing on reoccupation.',
   'The traditional house-entry ceremony performed before a family begins living in a new home, commonly including Ganesh puja, Vastu and Navgraha worship, havan, threshold entry and the symbolic boiling of milk.',
   '2.5-4 hours',
   'Strictly location and date specific, using Panchang Shuddhi with your family and property details. There is no universal fixed time for it.',
   'Performed in person, because the ritual is tied to the actual property. Remote guidance is arranged separately.',
   'Griha Pravesh Puja | PanditSuggest',
   'Traditional house-entry ceremony with Ganesh puja, Vastu and Navgraha worship, havan, threshold entry and milk boiling. Muhurat chosen for your property.',
   '[{"icon":"🚪","title":"Auspicious first entry","detail":"Marks the family’s formal entry into the home."},{"icon":"🏠","title":"Home consecration","detail":"Creates a devotional beginning before residence starts."},{"icon":"🪔","title":"Ganesh and Vastu blessings","detail":"The customary prayers to Ganesha and Vastu Purusha."},{"icon":"👪","title":"Family sankalp","detail":"A family prayer for harmony and wellbeing."},{"icon":"🔥","title":"Homa purification","detail":"The sacred-fire rite frequently used to bless a space."},{"icon":"📿","title":"Cultural continuity","detail":"Preserves a major household tradition."}]'::jsonb,
   '[{"step":1,"title":"Shubh Entry Preparation & Sankalp","detail":"The threshold is prepared and the sankalp taken at the chosen muhurat.","duration":"15-20 min"},{"step":2,"title":"Ganesh & Kalash Pujan","detail":"Opening worship.","duration":"20-30 min"},{"step":3,"title":"Vastu / Navgraha Pujan","detail":"Property and graha worship.","duration":"30-45 min"},{"step":4,"title":"Havan","detail":"The Griha and Vastu shanti homa.","duration":"45-60 min"},{"step":5,"title":"House Rituals & Milk Boiling","detail":"Threshold and kitchen rituals according to family tradition.","duration":"20-30 min"},{"step":6,"title":"Aarti, Prasad & Closing","detail":"Final blessings and prasad.","duration":"15-20 min"}]'::jsonb,
   '[{"item":"Kalash, coconut, mango leaves","qty":"1 set"},{"item":"Ganesh image/murti","qty":"1"},{"item":"Vastu/Navgraha items","qty":"1 set as per package"},{"item":"Milk","qty":"1-2 L"},{"item":"New vessel for milk","qty":"1"},{"item":"Rice / grains","qty":"as required"},{"item":"Flowers, turmeric, kumkum, sandal","qty":"1 set"},{"item":"Havan kund, samidha, samagri","qty":"1 set"},{"item":"Ghee","qty":"500 ml approx."},{"item":"Incense, camphor, lamps","qty":"1 set"},{"item":"Fruits / sweets","qty":"as required"},{"item":"Gangajal / water","qty":"as required"}]'::jsonb,
   '[{"q":"How is the Griha Pravesh muhurat decided?","a":"It is location-specific and selected using Panchang factors such as tithi and nakshatra."},{"q":"Are there different types of Griha Pravesh?","a":"Yes — Apurva, Sapurva and Dwandwa are the forms commonly described."},{"q":"Is Vastu Shanti included?","a":"Often, but not automatically. Your package states it."},{"q":"Can it be fully online?","a":"A pandit on site is preferable, because the ritual concerns the actual home."},{"q":"Why is milk boiled?","a":"In many regional traditions it symbolises abundance and the beginning of household life."},{"q":"How long does it take?","a":"Usually around two and a half to four hours."},{"q":"Can Satyanarayan Katha be added?","a":"Yes. Many families book it separately, after or around the housewarming."}]'::jsonb),

  ('Rin Mukti Puja (Debt Relief Puja)', 'rin-mukti-puja', 'briefcase', 30, FALSE, TRUE,
   'Rin Mukti Puja is not one single standardised pan-Indian ritual. Different priests use Lakshmi and Kuber worship, Rin Mukteshwar Shiva, Hanuman or Mangal-related prayer, Baglamukhi or graha-shanti, depending on lineage and on the devotee’s chart. Because of that, the booking identifies the actual deity, mantra and ritual method rather than leaving it vague. This service never promises automatic debt clearance: it is devotional support alongside real budgeting, a repayment plan and professional financial or legal advice where that is needed.',
   'A devotional debt-relief sankalp puja that may combine Lakshmi and Kuber, Shiva or graha-shanti worship with mantra-japa and havan, offered as spiritual support alongside practical financial planning.',
   '2-3 hours',
   'Depends on the chosen deity and mantra and the local Panchang. Friday, Tuesday or another suitable muhurat may be selected for the package.',
   'Live sankalp participation is available once the deity and mantra method have been agreed with the pandit.',
   'Rin Mukti Puja (Debt Relief Puja) | PanditSuggest',
   'Devotional debt-relief sankalp puja with Lakshmi-Kuber, Shiva or graha-shanti worship, mantra-japa and havan — spiritual support alongside a repayment plan.',
   '[{"icon":"🙏","title":"Debt-relief sankalp","detail":"A formal prayer focused on freedom from financial burden."},{"icon":"🏺","title":"Prosperity worship","detail":"May include Lakshmi and Kuber worship."},{"icon":"📿","title":"Discipline and resolve","detail":"The sankalp can reinforce commitment to a practical repayment plan."},{"icon":"🪐","title":"Graha-shanti option","detail":"Relevant graha worship may be added after a kundli review."},{"icon":"🧘","title":"Stress support","detail":"A devotional practice can provide emotional steadiness."},{"icon":"🤲","title":"Charity and gratitude","detail":"Prosperity traditions often pair prayer with daan and ethical use of resources."}]'::jsonb,
   '[{"step":1,"title":"Service Method Confirmation & Sankalp","detail":"The deity, mantra and debt-relief intention are confirmed.","duration":"15-20 min"},{"step":2,"title":"Ganesh & Kalash Pujan","detail":"Opening purification.","duration":"15-20 min"},{"step":3,"title":"Main Deity / Graha Pujan","detail":"The declared deity or grahas are worshipped.","duration":"25-35 min"},{"step":4,"title":"Mantra Japa","detail":"The declared mantra count is completed.","duration":"45-60 min"},{"step":5,"title":"Havan","detail":"The homa is performed, where it is included.","duration":"30-45 min"},{"step":6,"title":"Aarti, Daan & Practical Sankalp","detail":"Closing prayer, with encouragement toward responsible financial action.","duration":"15-20 min"}]'::jsonb,
   '[{"item":"Main deity image/yantra","qty":"1"},{"item":"Kalash & coconut","qty":"1 set"},{"item":"Flowers","qty":"as required"},{"item":"Coins / lotus seeds","qty":"optional, per package"},{"item":"Havan samagri & ghee","qty":"1 set if havan"},{"item":"Rice, turmeric, kumkum, sandal","qty":"1 set"},{"item":"Incense, camphor, lamps","qty":"1 set"},{"item":"Fruits / sweets","qty":"as required"},{"item":"Daan items","qty":"as advised"},{"item":"Yellow or red cloth","qty":"1, per deity"},{"item":"Naivedya","qty":"as required"},{"item":"Puja thali basics","qty":"1 set"}]'::jsonb,
   '[{"q":"Is Rin Mukti Puja one fixed Vedic ritual?","a":"No. Different traditions use different deities and mantras, which is why your package names the one being used."},{"q":"Will it clear my loan automatically?","a":"No. It is spiritual support, not a financial mechanism."},{"q":"Which deity is worshipped?","a":"Depending on the package: Lakshmi, Kuber, Shiva as Rin Mukteshwar, Hanuman, Baglamukhi or the relevant grahas."},{"q":"Do I need a kundli?","a":"Only if the service includes a chart-based graha remedy."},{"q":"Can it be done online?","a":"Yes."},{"q":"How long does it take?","a":"Usually around two to three hours."},{"q":"What should I check before booking?","a":"The exact deity, the mantra count, whether havan is included, the duration and what samagri is covered."}]'::jsonb),

  ('Santan Gopal Puja', 'santan-gopal-puja', 'baby', 40, TRUE, TRUE,
   'Santan Gopal Puja worships Lord Krishna in child form and is commonly performed by couples praying for progeny and family wellbeing. The typical elements are Ganesh puja, the couple’s sankalp, Santan Gopal or Krishna avahan, tulsi and flower offerings, mantra-japa and an optional havan. The widely used Santan Gopal mantra begins "Devaki Suta Govinda", though the mantra form and count vary by tradition. This is a spiritual practice and it does not replace fertility evaluation or medical care — please continue with the treatment your clinician advises.',
   'A Krishna-focused devotional puja for couples praying for progeny and family blessings, commonly including Santan Gopal worship, mantra-japa, sankalp and optional havan.',
   '2-3 hours',
   'A suitable auspicious muhurat chosen by the priest; Krishna-related days or chart-based timing may be used.',
   'The couple can participate live and provide their sankalp details remotely if they cannot attend in person.',
   'Santan Gopal Puja | PanditSuggest',
   'Krishna-focused devotional puja for couples praying for progeny — Santan Gopal worship, mantra-japa, sankalp and optional havan, with verified pandits.',
   '[{"icon":"👶","title":"Progeny prayer","detail":"A devotional sankalp for the blessing of children."},{"icon":"🪈","title":"Krishna bhakti","detail":"Worship of Lord Krishna in the Santan Gopal form."},{"icon":"🤝","title":"The couple’s joint sankalp","detail":"A shared spiritual practice for both partners."},{"icon":"🏠","title":"Family wellbeing prayer","detail":"A prayer for a healthy, harmonious family."},{"icon":"🕊️","title":"Emotional support","detail":"A devotional practice can provide comfort through a fertility journey."},{"icon":"🪐","title":"Graha-shanti option","detail":"Some priests add Navgraha-related rites where they recommend it."}]'::jsonb,
   '[{"step":1,"title":"Couple Details & Sankalp","detail":"Both partners’ names, gotra and the purpose are recorded.","duration":"15-20 min"},{"step":2,"title":"Ganesh & Kalash Pujan","detail":"Opening purification.","duration":"15-20 min"},{"step":3,"title":"Santan Gopal / Krishna Avahan","detail":"Child Krishna is worshipped with tulsi, flowers and naivedya.","duration":"25-35 min"},{"step":4,"title":"Santan Gopal Mantra Japa","detail":"The declared mantra count is completed.","duration":"45-60 min"},{"step":5,"title":"Optional Havan / Graha Shanti","detail":"Only if it is included in the selected package.","duration":"30-45 min"},{"step":6,"title":"Aarti & Prasad","detail":"Closing prayer and prasad.","duration":"10-15 min"}]'::jsonb,
   '[{"item":"Santan Gopal / child Krishna image","qty":"1"},{"item":"Kalash & coconut","qty":"1 set"},{"item":"Tulsi leaves","qty":"as available"},{"item":"Yellow/white flowers","qty":"as required"},{"item":"Butter/mishri or Krishna naivedya","qty":"as tradition"},{"item":"Fruits / sweets","qty":"as required"},{"item":"Akshat, roli, sandal, moli","qty":"1 set"},{"item":"Incense, camphor, lamps","qty":"1 set"},{"item":"Havan samagri & ghee","qty":"only if included"},{"item":"Navgraha items","qty":"only if included"},{"item":"New cloth / vastra","qty":"1"},{"item":"Puja thali basics","qty":"1 set"}]'::jsonb,
   '[{"q":"Who usually performs Santan Gopal Puja?","a":"Couples who wish to pray for progeny or family blessings commonly perform it together."},{"q":"Is it a fertility treatment?","a":"No. Difficulty conceiving should be evaluated by qualified medical professionals."},{"q":"Can one spouse participate if the other is away?","a":"Often yes — the sankalp can include both names, according to the priest’s tradition."},{"q":"Is havan compulsory?","a":"No. Some packages are puja and japa only."},{"q":"Do we need kundli matching?","a":"Not for a general devotional puja. A kundli is only needed for a specific Jyotish remedy."},{"q":"Can it be done online?","a":"Yes."},{"q":"How long does it take?","a":"Usually around two to three hours, depending on the mantra count and whether havan is included."}]'::jsonb)
)
INSERT INTO public.services
  (category_id, name, slug, icon_name, display_order, is_popular, is_online_available,
   description, short_description, estimated_duration, recommended_muhurat,
   online_note, meta_title, meta_description,
   benefits, process, samagri_list, faqs, is_active)
SELECT (SELECT id FROM cat), i.name, i.slug, i.icon_name, i.display_order,
       i.is_popular, i.is_online_available,
       i.description, i.short_description, i.estimated_duration, i.recommended_muhurat,
       i.online_note, i.meta_title, i.meta_description,
       i.benefits, i.process, i.samagri_list, i.faqs,
       FALSE   -- draft until an admin adds the image and activates it
  FROM incoming i
ON CONFLICT (slug) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Self-check
-- ----------------------------------------------------------------------------
DO $verify$
DECLARE
  cats INT;
  svcs INT;
BEGIN
  SELECT COUNT(*) INTO cats FROM public.service_categories
   WHERE slug IN ('astrology-dosh-nivaran-pujas', 'deity-havan-puja', 'vastu-home-occasion-pujas');
  IF cats <> 3 THEN
    RAISE EXCEPTION 'Migration 0014: expected 3 categories, found %', cats;
  END IF;

  SELECT COUNT(*) INTO svcs FROM public.services
   WHERE slug IN ('kaal-sarp-dosh-nivaran-puja',
                  'mangal-dosh-nivaran-puja',
                  'rahu-ketu-shanti-puja',
                  'shani-shanti-puja',
                  'navgraha-shanti-puja',
                  'pitra-dosh-nivaran-puja',
                  'guru-chandal-dosh-puja',
                  'durga-saptashati-chandi-havan',
                  'maha-mrityunjaya-havan',
                  'rudrabhishek-puja',
                  'lakshmi-puja-dhan-prapti',
                  'satyanarayan-katha-puja',
                  'navchandi-havan',
                  'ganesh-puja-vighnaharta',
                  'vastu-shanti-puja',
                  'griha-pravesh-puja',
                  'rin-mukti-puja',
                  'santan-gopal-puja');
  IF svcs <> 18 THEN
    RAISE EXCEPTION 'Migration 0014: expected 18 services, found %', svcs;
  END IF;

  -- A service whose category lookup missed would have failed the NOT NULL on
  -- category_id already; this catches one landing in the wrong parent.
  IF EXISTS (
    SELECT 1 FROM public.services s JOIN public.service_categories sc ON sc.id = s.category_id
     WHERE s.slug IN ('kaal-sarp-dosh-nivaran-puja',
                      'mangal-dosh-nivaran-puja',
                      'rahu-ketu-shanti-puja',
                      'shani-shanti-puja',
                      'navgraha-shanti-puja',
                      'pitra-dosh-nivaran-puja',
                      'guru-chandal-dosh-puja',
                      'durga-saptashati-chandi-havan',
                      'maha-mrityunjaya-havan',
                      'rudrabhishek-puja',
                      'lakshmi-puja-dhan-prapti',
                      'satyanarayan-katha-puja',
                      'navchandi-havan',
                      'ganesh-puja-vighnaharta',
                      'vastu-shanti-puja',
                      'griha-pravesh-puja',
                      'rin-mukti-puja',
                      'santan-gopal-puja')
       AND sc.slug NOT IN ('astrology-dosh-nivaran-pujas', 'deity-havan-puja', 'vastu-home-occasion-pujas')
  ) THEN
    RAISE EXCEPTION 'Migration 0014: a new service landed outside its intended category';
  END IF;
END
$verify$;
