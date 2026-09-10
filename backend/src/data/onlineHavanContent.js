/**
 * The English copy of /online-havan, for the server.
 *
 * The page itself is a client-rendered React route whose copy lives in
 * frontend/app/src/data/onlineHavan.ts as bilingual `{en, hi}` pairs. This is
 * the English half of the three blocks worth reading without JavaScript —
 * transcribed mechanically from that file, not rewritten, so a crawler and a
 * visitor are never told different things about the same page.
 *
 * Duplicated rather than shared, for the same reason seoMeta.js duplicates the
 * metadata formulas (docs/SEO_ARCHITECTURE.md §9): frontend and backend are
 * separate Node projects with no shared-code infrastructure, and standing one
 * up is a bigger change than this warrants.
 *
 * IF YOU EDIT THE PAGE COPY, EDIT IT HERE TOO. Nothing breaks if you forget —
 * the page keeps working and the crawler simply reads the older wording — but
 * the two are meant to say the same thing.
 */

const H1 = 'Online Havan & Puja — the full process, start to finish';

const INTRO = 'How an online havan is really performed: the ritual hour by hour, '
  + 'what your sankalp needs, what you do at home during the live call, and what '
  + 'reaches your door afterwards. The sankalp — your name, gotra and purpose spoken '
  + 'over the fire — is what binds the ritual to you, which is why a puja performed '
  + 'by a qualified pandit reaches the yajman who cannot be present in person.';

/** How a devotee actually gets from "I need this puja" to the fire being lit. */
const JOURNEY = [
  { title: "Find a verified Pandit Ji on PanditSuggest",
    detail: "Open the list of Pandit Jis who perform this puja and read their profiles properly — credentials, years of practice, the languages they speak, what other devotees have written. A Baglamukhi anushthan is advanced practice, so the person matters more than the price." },
  { title: "Call or WhatsApp them yourself",
    detail: "Their number is on their profile and you speak to them directly — nothing is booked through PanditSuggest and we take no commission on your puja. Describe the situation in your own words, in your own language. This first conversation is where everything else gets decided." },
  { title: "Pandit Ji decides the vidhi, the tier and the muhurat",
    detail: "Standard samagri, twenty-one jadi-buti, or a multi-day anushthan; the japa count, the nyasa, the paddhati; and the date — a Tuesday, a Friday, an Ashtami, or one chosen against your birth details. Every one of those is their call to make after hearing you, not a dropdown's. Nalkheda dates are usually settled about a week ahead." },
  { title: "You send the sankalp details they ask for",
    detail: "Usually your full name, your father's name, gotra, rashi and nakshatra if you know them, your city, and the purpose in your own words. If your gotra is not known, send your father's and grandfather's names, your birth place and your family's native village — Pandit Ji will resolve it. Send exactly what they ask for and nothing to anyone else." },
  { title: "Pandit Ji tells you what to do at home",
    detail: "What to wear, when to sit, whether to keep a diya or a fast, what to avoid eating, and which parts of the ritual you should be on the call for. Everything further down this page is how the tradition is generally described — but the instruction that actually applies to you is the one your Pandit Ji gives. Samagri is their side of it; you buy and arrange nothing." },
  { title: "Pandit Ji sends your live link",
    detail: "A WhatsApp video call, a Zoom link or a Meet link, with the time of your sankalp told to you in advance so you can be sitting when it happens rather than joining halfway through it." },
  { title: "The havan is performed",
    detail: "Ganesh pujan, avahan, your sankalp, japa, ahuti, purnahuti, aarti — the same order, in the same number, as it would be if you were standing there. Photographs and short clips are usually sent through the day. The next section walks that day hour by hour." },
  { title: "Bhasma and prasad are couriered",
    detail: "Havan bhasma, raksha sutra, an energised yantra where your tier includes one, and prasad — dispatched to the address you gave Pandit Ji, in India or abroad, typically arriving within seven to ten days." },
  { title: "Pandit Ji gives you the niyam to keep",
    detail: "Most acharyas give a small daily practice afterwards — a mantra count, a Tuesday diya, the raksha sutra worn until it falls away on its own. Keep their number; the havan is the beginning of the sankalp, not the end of it." },
];

/** What the devotee receives — the reason an online puja is verifiable at all. */
const DELIVERABLES = [
  { title: "Live video of your sankalp",
    detail: "WhatsApp, Zoom or Meet — joined from anywhere in the world" },
  { title: "Full HD recording",
    detail: "The whole ritual, including your name being spoken" },
  { title: "Havan bhasma",
    detail: "Ash from your own kund, in yellow cloth" },
  { title: "Raksha sutra",
    detail: "Tied during the ritual and offered at Maa's feet" },
  { title: "Energised yantra",
    detail: "Where the tier you chose includes one" },
  { title: "Prasad to your door",
    detail: "Couriered in India and overseas, usually 7–10 days" },
];

const FAQS = [
  { q: "Is a havan done online really valid?",
    a: "In tradition, what binds a ritual to a person is the sankalp — the name, gotra and purpose spoken over the fire — not the person's physical position. A puja performed by a qualified pandit, at the right time, with the sankalp taken correctly, is held to reach the yajman in their absence too. That is the same principle by which a family member has always been able to have a puja done for someone away from home." },
  { q: "Do I have to sit through the entire havan?",
    a: "No, and you should be suspicious of anyone who insists. The japa alone can run for hours, and a maha anushthan runs for days. Most devotees join for the sankalp, leave, and rejoin for the ahuti, purnahuti and aarti. The full recording covers everything you missed." },
  { q: "I don't know my gotra. Can I still do this?",
    a: "Yes. Share your full name, your father's and grandfather's names, your birth place and your family's native village — the acharya can usually resolve it. Where it genuinely cannot be traced, Kashyap gotra is the traditional fallback, but let the pandit make that call rather than assuming it yourself." },
  { q: "Can I book from outside India?",
    a: "Yes — remote sankalp is the reason online seva exists at all, and devotees join from the Gulf, the US, the UK, Australia and New Zealand. Ask for your sankalp to be scheduled at an hour you can actually be awake and seated for, and confirm that prasad courier reaches your country before you book." },
  { q: "How long does the whole thing take?",
    a: "A Samanya or Vishesh havan is a single day, typically from Brahma Muhurat to midday. An anushthan is graded by japa count — 36,000 upward — and a 1,25,000 maha anushthan usually runs nine to eleven days, with the havan and purnahuti on the final day. Your live call is on that final day." },
  { q: "Should I light a fire at home during the call?",
    a: "Not unless your acharya specifically asks you to. A diya is enough. A havan kund at home needs its own vidhi, its own samagri and someone who knows how to close it — running one unsupervised alongside a live call is how it goes wrong." },
  { q: "Can women participate during menstruation?",
    a: "Traditional paddhati asks that the yajman not actively participate in the ritual then, which is one practical reason the muhurat is fixed in advance. The sankalp can be taken in the name of a spouse or family member, or the date can simply be moved — ask the acharya, since practice varies between traditions." },
  { q: "Will this guarantee I win my court case?",
    a: "No, and nobody honest will tell you otherwise. Maa Baglamukhi is worshipped traditionally for stambhan — steadiness against opposition, clarity in speech, protection — and devotees have brought legal, professional and family matters to this fire for centuries. It is a devotional intention, not a legal, medical or financial outcome, and PanditSuggest lists it that way everywhere." },
  { q: "What if my internet drops during the sankalp?",
    a: "The ritual does not stop and does not need to be repeated — the sankalp was spoken over the fire, and the fire does not depend on your connection. Ask for the recorded clip of that moment; a pandit who was actually performing it will have no trouble sending it." },
  { q: "How do I choose between the havan tiers?",
    a: "By the weight of the sankalp, not by the price. Standard samagri suits general peace, protection and family well-being; the twenty-one jadi-buti tier is taken for a specific pressing matter; a multi-day anushthan is taken when someone is prepared to give it days rather than a morning. Describe the situation to a Pandit Ji and let them place it." },
];

module.exports = { H1, INTRO, JOURNEY, DELIVERABLES, FAQS };
