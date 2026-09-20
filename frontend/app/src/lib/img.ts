/**
 * Responsive image URLs, derived from a master URL by convention.
 *
 * The backend writes a ladder of resized, re-encoded copies beside every
 * uploaded image: `<base>.webp` implies `<base>-320.avif`, `<base>-640.webp`
 * and so on. Nothing records those URLs — not the database, not the API — so
 * this file re-derives the same names the backend wrote. It is one half of a
 * convention whose other half is
 * backend/src/services/media/imageOptimizer.js (`VARIANT_WIDTHS`,
 * `VARIANT_FORMATS`, `variantFilename`). The two must not drift, which is why
 * each names the other.
 *
 * Why this exists: masters are capped at 1600px and weigh ~270KB, but a
 * service card paints one 340px wide on a desktop grid and ~170px on a phone.
 * Every visitor was downloading roughly 12x the pixels their screen could
 * show — 7.0 MB for the 26 cards on /services alone. The 320w AVIF rung of
 * that same image is 14KB.
 */

/** Must match VARIANT_WIDTHS in backend/src/services/media/imageOptimizer.js. */
export const VARIANT_WIDTHS = [320, 640, 1280] as const;

/**
 * Whether `url` is a master with a ladder beside it.
 *
 * Only images the backend's upload pipeline produced have variants. Three
 * kinds of URL reach an <img> on this site and must be left exactly as they
 * are:
 *   - bundled art under /assets (logos, the SVG placeholders in format.ts) —
 *     vector or already tiny, and never uploaded through the pipeline;
 *   - anything off-site (a Google avatar on a review);
 *   - data: URIs.
 * Deriving a rung for any of those would point at something that does not
 * exist, and a <source> that 404s renders broken rather than falling back.
 */
export function hasLadder(url: string | null | undefined): url is string {
  if (!url) return false;
  if (url.startsWith("data:")) return false;
  // The pipeline writes to the media CDN in production and /uploads/ on a
  // local-disk install; nothing else it produces is ever rendered.
  const isUploaded = url.startsWith("/uploads/") || url.includes("/uploads/")
    || /^https?:\/\/media\./.test(url);
  if (!isUploaded) return false;
  // SVG is vector: the backend deliberately skips it, so it has no rungs.
  return !/\.svgx?($|\?)/i.test(url);
}

/** `abc.webp` + (320, "avif") -> `abc-320.avif`. Mirrors variantFilename(). */
function rungUrl(master: string, width: number, ext: string): string {
  return `${master.replace(/\.[^./]+$/, "")}-${width}.${ext}`;
}

/**
 * A `srcset` for one format, or "" when `master` has no ladder.
 *
 * Every rung is listed unconditionally. The backend emits a TOTAL ladder —
 * every width for every master, even where the master is narrower than the
 * rung — precisely so that a consumer here, which cannot know how wide the
 * master is, never has to guess whether a rung exists.
 */
export function srcSetFor(master: string, ext: "avif" | "webp"): string {
  if (!hasLadder(master)) return "";
  return VARIANT_WIDTHS.map((w) => `${rungUrl(master, w, ext)} ${w}w`).join(", ");
}

/**
 * The rung closest to a known render width — for the rare case where a single
 * URL is needed rather than a srcset, such as a <link rel="preload"> the
 * server injects, or an image used as a CSS background.
 *
 * Rounds UP to the first rung at least as wide as `width`, so the result is
 * never upscaled, and falls back to the master when nothing is wide enough.
 */
export function rungAtLeast(master: string, width: number, ext: "avif" | "webp" = "webp"): string {
  if (!hasLadder(master)) return master;
  const w = VARIANT_WIDTHS.find((v) => v >= width);
  return w ? rungUrl(master, w, ext) : master;
}

/**
 * Ready-made `sizes` values for the layouts that repeat across the site.
 *
 * `sizes` tells the browser how wide the image will paint BEFORE any CSS has
 * loaded, which is the only reason srcset can pick the right rung on the
 * first request rather than after layout. Getting it wrong is silently
 * expensive — an absent `sizes` means the browser assumes 100vw and fetches
 * the largest rung for a thumbnail — so the handful of real layouts are
 * written down once here instead of being retyped per call site.
 *
 * Each value is read off the actual CSS, and the comment names the file so a
 * grid that changes can be traced back to the number that has to change with
 * it.
 */
export const SIZES = {
  /** styles/services-page.css .sp-all-grid — 4 cols desktop, 3 at 1024, 2 under 768. */
  serviceCard: "(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw",
  /** styles/home-sections.css service tiles — 3 across, full width on a phone. */
  homeTile: "(max-width: 768px) 100vw, 33vw",
  /** components/hero/HeroAstrotalk.css — 280px centre circle, 152px on a phone. */
  heroCircle: "(max-width: 760px) 160px, 280px",
  /** Pandit and temple cards: a fixed-ish card in a fluid grid. */
  card: "(max-width: 768px) 50vw, 320px",
  /** styles/services-page.css .sp-hero__img-wrap — 320px, 260px at 1024, 200px at 768. */
  pageHero: "(max-width: 768px) 200px, (max-width: 1024px) 260px, 320px",
  /** Anything that genuinely spans the viewport (page heroes, banners). */
  full: "100vw",
} as const;
