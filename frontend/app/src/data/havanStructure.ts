/* Havan & Anushthan category structure for the service detail page's Havan tab.
 *
 * Some deities are not booked as one flat "puja" — they are offered as a
 * ladder of havan tiers (what samagri goes into the fire) and a second ladder
 * of anushthan tiers (how many mantra japa precede the havan). A devotee
 * choosing between them is really choosing between those two numbers, so the
 * tab exists to make the difference between the tiers legible before they
 * contact a pandit.
 *
 * Static, like serviceMeta.ts, and for the same reason: there is no column
 * behind it yet (services has benefits/process/faqs/samagri_list and nothing
 * else). Unlike serviceMeta there is no generic default — a service missing
 * from REGISTRY below renders no Havan tab at all, rather than a plausible
 * looking tier ladder invented for a puja that is not sold that way.
 */

export interface HavanTier {
  id: string;
  /** "Vishesh Havan" */
  name: string;
  /** The qualifier that names the tier: "21 Types of Special Jadi-Buti". */
  subtitle: string;
  /** Short form for the service card / comparison row: "21 Special Jadi-Buti". */
  cardLabel: string;
  /** The single thing that separates this tier from the one below it. */
  keyFeature: string;
  description: string;
  /**
   * Number of special jadi-buti offered. 0 is meaningful, not missing — it is
   * exactly what defines the Samanya tier (standard samagri, no additional
   * jadi-buti), and the dial renders it as "Standard" rather than a zero.
   */
  jadiButi: number;
  /** The vidhi, in order, as it is quoted to the devotee. */
  includes: string[];
}

export interface AnushthanTier {
  id: string;
  /** Japa count as a number, for the count-up dial. */
  japa: number;
  /** The same number in Indian digit grouping — "1,25,000", not "125,000". */
  japaLabel: string;
  /** "1,25,000 Mantra Japa Maha Anushthan" */
  name: string;
  /** "1,25,000 Maa Baglamukhi Mantra Japa + Havan" */
  summary: string;
  includes: string[];
}

export interface HavanStructure {
  /** The deity these tiers belong to — every tier name is scoped to it. */
  deity: string;
  intro: string;
  havanIntro: string;
  havan: HavanTier[];
  anushthanIntro: string;
  anushthan: AnushthanTier[];
  /** Hindi rendering, applied field by field — see localizeHavan. */
  hi?: HavanStructureHi;
}

/**
 * The Hindi half, deliberately all-optional and row-aligned.
 *
 * Same shape as services.content_hi on the service page: a translation can be
 * missing a field, and the reader should get English for that one field
 * rather than a blank card. Rows line up by index with the English arrays.
 */
export interface HavanStructureHi {
  deity?: string;
  intro?: string;
  havanIntro?: string;
  anushthanIntro?: string;
  havan?: Partial<Pick<HavanTier, "name" | "subtitle" | "cardLabel" | "keyFeature" | "description" | "includes">>[];
  anushthan?: Partial<Pick<AnushthanTier, "name" | "summary" | "includes">>[];
}

const BAGLAMUKHI: HavanStructure = {
  deity: "Maa Baglamukhi",
  intro:
    "Maa Baglamukhi is offered in two forms — a Havan, graded by the jadi-buti that goes into the fire, and an Anushthan, graded by the number of mantra japa completed before that fire is lit. Pick the row that matches your sankalp.",
  havanIntro:
    "All three are the same Maa Baglamukhi Havan. What changes between them is the samagri: how many types of special jadi-buti are offered during the ahuti.",
  havan: [
    {
      id: "samanya",
      name: "Samanya Havan",
      subtitle: "Standard Havan Samagri",
      cardLabel: "Standard Samagri",
      keyFeature: "No additional special jadi-buti is used.",
      description:
        "A traditional Maa Baglamukhi Havan performed with standard Havan samagri for general peace, positivity, protection, family well-being, and removal of common obstacles.",
      jadiButi: 0,
      includes: [
        "Sankalp",
        "Maa Baglamukhi Puja",
        "Mantra chanting",
        "Standard Havan samagri",
        "Havan",
        "Purnahuti",
        "Aarti",
      ],
    },
    {
      id: "vishesh",
      name: "Vishesh Havan",
      subtitle: "21 Types of Special Jadi-Buti",
      cardLabel: "21 Special Jadi-Buti",
      keyFeature: "21 types of special jadi-buti are used during the Havan.",
      description:
        "A special Maa Baglamukhi Havan for important personal, professional, business, legal, or protection-related sankalp.",
      jadiButi: 21,
      includes: [
        "Sankalp",
        "Maa Baglamukhi Puja",
        "Mantra chanting",
        "Regular Havan samagri",
        "21 types of special jadi-buti",
        "Vishesh Havan",
        "Purnahuti",
        "Aarti",
      ],
    },
    {
      id: "maha-vishesh",
      name: "Maha Vishesh Havan",
      subtitle: "36 Types of Special Jadi-Buti",
      cardLabel: "36 Special Jadi-Buti",
      keyFeature: "36 types of special jadi-buti are used during the Havan.",
      description:
        "An elaborate Maa Baglamukhi Havan for major or complex sankalp, significant obstacles, protection, business, professional, or other important objectives.",
      jadiButi: 36,
      includes: [
        "Detailed Sankalp",
        "Maa Baglamukhi Puja",
        "Mantra chanting",
        "Regular Havan samagri",
        "36 types of special jadi-buti",
        "Maha Vishesh Havan",
        "Special Purnahuti",
        "Aarti",
      ],
    },
  ],
  anushthanIntro:
    "Anushthan is an extended Maa Baglamukhi ritual based on a fixed mantra-japa count, followed by Havan and completion rituals.",
  anushthan: [
    {
      id: "36000",
      japa: 36000,
      japaLabel: "36,000",
      name: "36,000 Mantra Japa Anushthan",
      summary: "36,000 Maa Baglamukhi Mantra Japa + Havan",
      includes: [
        "Sankalp",
        "Maa Baglamukhi Puja",
        "Mantra Japa",
        "Havan",
        "Purnahuti",
        "Aarti",
        "Completion rituals",
      ],
    },
    {
      id: "125000",
      japa: 125000,
      japaLabel: "1,25,000",
      name: "1,25,000 Mantra Japa Maha Anushthan",
      summary: "1,25,000 Maa Baglamukhi Mantra Japa + Havan",
      includes: [
        "Sankalp",
        "Maa Baglamukhi Puja",
        "Mantra Japa",
        "Havan",
        "Purnahuti",
        "Aarti",
        "Completion rituals",
      ],
    },
    {
      id: "525000",
      japa: 525000,
      japaLabel: "5,25,000",
      name: "5,25,000 Mantra Japa Maha Anushthan",
      summary: "5,25,000 Maa Baglamukhi Mantra Japa + Havan",
      includes: [
        "Sankalp",
        "Maa Baglamukhi Puja",
        "Mantra Japa",
        "Havan",
        "Purnahuti",
        "Aarti",
        "Completion rituals",
      ],
    },
  ],

  hi: {
    deity: "मां बगलामुखी",
    intro:
      "मां बगलामुखी दो रूपों में की जाती है — हवन, जो अग्नि में अर्पित जड़ी-बूटियों के अनुसार निर्धारित होता है, और अनुष्ठान, जो अग्नि प्रज्वलित करने से पूर्व पूर्ण किए गए मंत्र जप की संख्या पर आधारित होता है। अपने संकल्प के अनुसार पंक्ति चुनें।",
    havanIntro:
      "तीनों एक ही मां बगलामुखी हवन हैं। अंतर केवल सामग्री का है: आहुति के समय कितने प्रकार की विशेष जड़ी-बूटियाँ अर्पित की जाती हैं।",
    havan: [
      {
        name: "सामान्य हवन",
        subtitle: "मानक हवन सामग्री",
        cardLabel: "मानक सामग्री",
        keyFeature: "कोई अतिरिक्त विशेष जड़ी-बूटी प्रयोग नहीं होती।",
        description:
          "मानक हवन सामग्री से किया जाने वाला पारंपरिक मां बगलामुखी हवन — सामान्य शांति, सकारात्मकता, रक्षा, पारिवारिक कल्याण तथा सामान्य बाधाओं के निवारण हेतु।",
        includes: ["संकल्प", "मां बगलामुखी पूजा", "मंत्र जाप", "मानक हवन सामग्री", "हवन", "पूर्णाहुति", "आरती"],
      },
      {
        name: "विशेष हवन",
        subtitle: "21 प्रकार की विशेष जड़ी-बूटी",
        cardLabel: "21 विशेष जड़ी-बूटी",
        keyFeature: "हवन में 21 प्रकार की विशेष जड़ी-बूटियाँ प्रयोग होती हैं।",
        description:
          "महत्वपूर्ण व्यक्तिगत, व्यावसायिक, व्यापारिक, कानूनी अथवा रक्षा-संबंधी संकल्प हेतु विशेष मां बगलामुखी हवन।",
        includes: [
          "संकल्प",
          "मां बगलामुखी पूजा",
          "मंत्र जाप",
          "नियमित हवन सामग्री",
          "21 प्रकार की विशेष जड़ी-बूटी",
          "विशेष हवन",
          "पूर्णाहुति",
          "आरती",
        ],
      },
      {
        name: "महा विशेष हवन",
        subtitle: "36 प्रकार की विशेष जड़ी-बूटी",
        cardLabel: "36 विशेष जड़ी-बूटी",
        keyFeature: "हवन में 36 प्रकार की विशेष जड़ी-बूटियाँ प्रयोग होती हैं।",
        description:
          "बड़े अथवा जटिल संकल्प, गंभीर बाधाओं, रक्षा, व्यापार, व्यवसाय या अन्य महत्वपूर्ण उद्देश्यों हेतु विस्तृत मां बगलामुखी हवन।",
        includes: [
          "विस्तृत संकल्प",
          "मां बगलामुखी पूजा",
          "मंत्र जाप",
          "नियमित हवन सामग्री",
          "36 प्रकार की विशेष जड़ी-बूटी",
          "महा विशेष हवन",
          "विशेष पूर्णाहुति",
          "आरती",
        ],
      },
    ],
    anushthanIntro:
      "अनुष्ठान एक विस्तृत मां बगलामुखी साधना है, जो निश्चित मंत्र-जप संख्या पर आधारित होती है, और जिसके पश्चात हवन एवं समापन विधि सम्पन्न की जाती है।",
    anushthan: [
      {
        name: "36,000 मंत्र जप अनुष्ठान",
        summary: "36,000 मां बगलामुखी मंत्र जप + हवन",
        includes: ["संकल्प", "मां बगलामुखी पूजा", "मंत्र जप", "हवन", "पूर्णाहुति", "आरती", "समापन विधि"],
      },
      {
        name: "1,25,000 मंत्र जप महा अनुष्ठान",
        summary: "1,25,000 मां बगलामुखी मंत्र जप + हवन",
        includes: ["संकल्प", "मां बगलामुखी पूजा", "मंत्र जप", "हवन", "पूर्णाहुति", "आरती", "समापन विधि"],
      },
      {
        name: "5,25,000 मंत्र जप महा अनुष्ठान",
        summary: "5,25,000 मां बगलामुखी मंत्र जप + हवन",
        includes: ["संकल्प", "मां बगलामुखी पूजा", "मंत्र जप", "हवन", "पूर्णाहुति", "आरती", "समापन विधि"],
      },
    ],
  },
};

/**
 * Which services carry a tier ladder.
 *
 * Matched on the slug AND the name rather than an exact slug list: the
 * catalogue is admin-authored, so the slug this deity ends up with ("maa-
 * baglamukhi", "baglamukhi-havan", "baglamukhi-puja", …) is not knowable from
 * here. Devanagari is matched too — a service may be named बगलामुखी.
 *
 * To add a deity: write its HavanStructure above and add one row here.
 */
const REGISTRY: { test: RegExp; structure: HavanStructure }[] = [
  { test: /baglamukhi|बगलामुखी/i, structure: BAGLAMUKHI },
];

/**
 * The tier ladder for a service, or null when it is not sold as tiers — the
 * Havan tab is hidden entirely in that case rather than rendering empty.
 */
export function getHavanStructure(
  service: { id?: string; name?: string } | null | undefined,
): HavanStructure | null {
  if (!service) return null;
  const haystack = `${service.id || ""} ${service.name || ""}`;
  return REGISTRY.find((r) => r.test.test(haystack))?.structure ?? null;
}

/** Drops absent/blank keys, so a missing translation falls back per field. */
function present<T extends object>(over: T | undefined): Partial<T> {
  if (!over) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && !v.trim()) continue;
    if (Array.isArray(v) && !v.length) continue;
    out[k] = v;
  }
  return out as Partial<T>;
}

/**
 * The structure as the reader's language, English elsewhere.
 *
 * Applied field by field rather than swapping whole objects: a half-finished
 * translation should leave English prose in the gaps, never blank cards. The
 * numbers (jadiButi, japa, japaLabel) are never translated — they drive the
 * dials, and "1,25,000" is already the Indian grouping in both languages.
 */
export function localizeHavan(s: HavanStructure, lang: string): HavanStructure {
  if (lang !== "hi" || !s.hi) return s;
  const hi = s.hi;
  return {
    ...s,
    deity: hi.deity || s.deity,
    intro: hi.intro || s.intro,
    havanIntro: hi.havanIntro || s.havanIntro,
    anushthanIntro: hi.anushthanIntro || s.anushthanIntro,
    havan: s.havan.map((t, i) => ({ ...t, ...present(hi.havan?.[i]) })),
    anushthan: s.anushthan.map((t, i) => ({ ...t, ...present(hi.anushthan?.[i]) })),
  };
}
