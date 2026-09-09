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
