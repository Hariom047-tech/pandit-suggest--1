import { useMemo } from "react";
import { useApi } from "./useApi";

/**
 * Admin-managed page images.
 *
 * Page heroes, the homepage trust portrait, the two homepage backdrops and
 * the service tile fallbacks used to be URLs typed into components and
 * stylesheets — replacing one meant a code change and a redeploy. They are
 * uploaded through Admin Panel -> Page Images now, stored in S3 like every
 * other upload, and read from GET /api/site-images.
 *
 * The slot keys here mirror backend/src/config/siteImageSlots.js — that file
 * is the catalog, this one is the client half of the same contract.
 */

export type SiteImageSlot =
  | "home.trust"
  | "home.epuja_bg"
  | "home.reviews_bg"
  | "pandits.hero"
  | "temples.hero"
  | "services.hero"
  | "services.cat_life"
  | "services.cat_daily"
  | "services.cat_festival"
  | "services.cat_shanti"
  | "services.fallback_puja"
  | "services.fallback_havan";

export interface SiteImage { url: string; alt: string }

export type SiteImageMap = Partial<Record<SiteImageSlot, SiteImage>>;

/**
 * What a slot shows until an admin uploads into it.
 *
 * These are the URLs that were previously hardcoded across the pages, kept
 * in exactly one place: the site looks identical before the first upload,
 * and a slot an admin later clears falls back here rather than rendering a
 * hole. They point at the CDN (media.panditsuggest.com), never at a file on
 * the web server's own disk.
 */
const CDN_STATIC = "https://media.panditsuggest.com/static";

export const SITE_IMAGE_DEFAULTS: Record<SiteImageSlot, string> = {
  "home.trust": `${CDN_STATIC}/pandit-hero.webp`,
  "home.epuja_bg": `${CDN_STATIC}/epuja-illustration.webp`,
  "home.reviews_bg": `${CDN_STATIC}/review-bg.webp`,
  "pandits.hero": `${CDN_STATIC}/pandit-hero.webp`,
  "temples.hero": `${CDN_STATIC}/temple-hero.webp`,
  "services.hero": `${CDN_STATIC}/pandit-hero.webp`,
  "services.cat_life": `${CDN_STATIC}/cat-life.webp`,
  "services.cat_daily": `${CDN_STATIC}/cat-daily.webp`,
  "services.cat_festival": `${CDN_STATIC}/cat-festival.webp`,
  "services.cat_shanti": `${CDN_STATIC}/cat-shanti.webp`,
  "services.fallback_puja": `${CDN_STATIC}/puja-new.webp`,
  "services.fallback_havan": `${CDN_STATIC}/havan-new.webp`,
};

/**
 * The whole map, cached for five minutes like the other editorial reads
 * (home hero, public settings). One request serves every slot on the page —
 * a per-slot hook would fire a dozen of them.
 */
export function useSiteImages() {
  const { data } = useApi<SiteImageMap>("/site-images", { cacheTtl: 300_000 });

  return useMemo(() => {
    const map = data || {};
    /** The URL for a slot: admin upload if there is one, built-in default otherwise. */
    const src = (slot: SiteImageSlot) => map[slot]?.url || SITE_IMAGE_DEFAULTS[slot];
    /** Admin-supplied alt text, falling back to the caller's own wording. */
    const alt = (slot: SiteImageSlot, fallback = "") => map[slot]?.alt || fallback;
    return { src, alt };
  }, [data]);
}
