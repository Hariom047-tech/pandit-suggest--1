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
 * No URL for any of them survives in this bundle, by design: if the API is
 * unreachable the images are absent, the same way the temples and pandits
 * themselves are. An image is data, not markup.
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
 * The whole map, cached for five minutes like the other editorial reads
 * (home hero, public settings). One request serves every slot on the page —
 * a per-slot hook would fire a dozen of them.
 */
export function useSiteImages() {
  const { data } = useApi<SiteImageMap>("/site-images", { cacheTtl: 300_000 });

  return useMemo(() => {
    const map = data || {};
    /**
     * The URL for a slot, or undefined when the database has no row for it.
     *
     * There is deliberately no built-in default: the whole point is that
     * every page image is data, so a slot with no row renders nothing at all
     * rather than a URL baked into this bundle. Callers must therefore treat
     * a missing image as "draw no <img>", not as "draw a broken one".
     */
    const src = (slot: SiteImageSlot): string | undefined => map[slot]?.url;
    /** Admin-supplied alt text, falling back to the caller's own wording. */
    const alt = (slot: SiteImageSlot, fallback = "") => map[slot]?.alt || fallback;
    return { src, alt };
  }, [data]);
}
