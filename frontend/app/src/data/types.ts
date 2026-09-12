export interface Service {
  id: string;
  name: string;
  icon: string;
  cat: "daily" | "life" | "festival" | "shanti";
  tag: string;
  dur: string;
  pandits: number;
  desc: string;
  samagri: string[];
  priority?: number;
  /** The service's admin-authored content in Hindi (services.content_hi). */
  hi?: { name?: string; shortDescription?: string; description?: string } | null;
  /** Admin "Show on home page" — decides WHICH pujas the homepage features. */
  popular?: boolean;
  /**
   * Admin "Home position" — decides the ORDER of the featured pujas, low
   * first. Every service has one (it defaults to 0), so it only becomes
   * visible once `popular` puts the service on the homepage.
   */
  homePosition?: number;
  /** Ritual can be performed remotely (video call / live stream). */
  onlineAvailable?: boolean;
  onlineNote?: string | null;
  img?: string;
}

export interface Temple {
  id: string;
  name: string;
  /** Everything this temple has in Hindi. */
  hi?: HindiContent | null;
  city: string;
  state: string;
  deity: string;
  rating: number;
  reviews: number;
  pandits: number;
  timings: string;
  est: string;
  lat: number;
  lng: number;
  services: string[];
  img: string;
  album?: boolean;
  about: string;
  history: string;
  /**
   * Religious significance — rendered under history on the temple page.
   * Optional: the bundled temples in content.ts predate this field, and it is
   * genuinely optional content an admin may leave blank.
   */
  significance?: string;
  gallery: string[];
  highlights: string[];
}

export type PanditTier = "Diamond" | "Gold" | "Silver";

/**
 * The Hindi an admin's save produced (content_hi, migrations 0011/0012).
 *
 * Carried alongside the English rather than swapped in by the normaliser: the
 * language is the reader's own switch, and every screen falls back field by
 * field, so both have to be in hand at render time. Every key optional — a
 * field the translator skipped simply renders in English.
 */
export interface HindiContent {
  name?: string;
  title?: string;
  shortBio?: string;
  bio?: string;
  primarySpecialization?: string;
  vedicEducation?: string;
  gotra?: string;
  tradition?: string;
  respondsWithin?: string;
  shortDescription?: string;
  description?: string;
  primaryDeity?: string;
  templeType?: string;
  architecturalStyle?: string;
  history?: string;
  significance?: string;
  howToReach?: string;
  city?: string;
  state?: string;
  highlights?: string[];
  customServices?: { name?: string; description?: string }[];
}

export interface Pandit {
  id: string;
  name: string;
  /** Devanagari form of `name`, shown when the site is in Hindi mode. */
  nameHi?: string;
  /** Everything else this pandit has in Hindi. */
  hi?: HindiContent | null;
  city: string;
  state: string;
  exp: number;
  rating: number;
  reviews: number;
  verified: boolean;
  tier: PanditTier;
  langs: string[];
  services: string[];
  temples: string[];
  phone: string;
  edu: string;
  gotra: string;
  tradition?: string;
  respondsWithin?: string;
  acceptsOnline?: boolean;
  about: string;
  img: string;
}

export interface Review {
  name: string;
  city: string;
  rating: number;
  /** Headline the reviewer typed. Collected by the form since day one but
   *  never modelled here, so it was dropped before it reached the card. */
  title?: string;
  text: string;
  /** ISO timestamp — a review with no date reads as stale or fake. */
  date?: string;
  service?: string;
  variant?: "standard" | "with-photo" | "featured" | "short";
  avatar?: string;
  photos?: string[];
}

export interface BlogPost {
  id: string;
  cat: string;
  title: string;
  date: string;
  read: string;
  excerpt: string;
}

export interface Plan {
  name: string;
  price: string;
  per: string;
  feats: string[];
  cta: string;
  popular?: boolean;
}

export interface Faq {
  q: string;
  a: string;
}

export interface Stat {
  icon: string;
  num: string;
  label: string;
}

export interface RecommendRule {
  keys: string[];
  svc: string[];
  why: string;
}
