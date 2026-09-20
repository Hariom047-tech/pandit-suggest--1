import type { ImgHTMLAttributes, SyntheticEvent } from "react";
import { srcSetFor, hasLadder } from "../../lib/img";

/**
 * An <img> that serves the smallest rung the viewer's screen actually needs.
 *
 * Renders a <picture> with AVIF and WebP srcsets derived from the master URL
 * (see lib/img.ts for the naming convention and why it is derived rather than
 * stored), falling back to a plain <img> on the master itself. A URL with no
 * ladder — bundled SVG placeholders, off-site avatars — renders as an
 * ordinary <img>, unchanged, so this is safe to use at every call site rather
 * than only the ones known to hold uploaded photos.
 *
 * `sizes` is effectively required for any image that is not full-width: the
 * browser picks a rung before CSS has been applied, so without it it assumes
 * 100vw and downloads the largest rung for a thumbnail — the exact waste this
 * component exists to remove. lib/img.ts's SIZES holds the values for the
 * layouts that repeat.
 *
 * `onError` still works and still matters: it is the last line of defence for
 * a master that has gone missing (format.ts's onImgError swaps in a
 * placeholder). It cannot rescue a missing RUNG, though — a <source> that
 * fails renders broken without notifying the <img> — which is why the backend
 * guarantees every rung exists for every master.
 */

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  /**
   * True for an image that is visible without scrolling.
   *
   * `loading="lazy"` on an above-the-fold image is actively harmful, not
   * merely pointless: the browser defers the fetch until it has done layout
   * and decided the image is near the viewport, so the one picture the
   * visitor is waiting on starts LATER than it would have with no attribute
   * at all. Measured on the live site, /services had four of them (the "Most
   * Booked" cards) and the homepage five.
   *
   * Setting this marks the image eager and hints high priority, so it
   * competes with the stylesheet rather than waiting behind it. It is
   * deliberately opt-IN — lazy remains the default, because the great
   * majority of images on a listing page genuinely are below the fold and
   * marking those eager would be the same mistake in reverse.
   */
  priority?: boolean;
  /**
   * Optional for the same reason the plain <img> it replaces had it optional:
   * several call sites compute the URL inline behind a truthiness guard that
   * TypeScript cannot narrow through. An undefined src renders exactly what
   * <img src={undefined}> rendered before — no ladder, no change in
   * behaviour — rather than being asserted away at the call site.
   */
  src: string | undefined;
  alt: string;
  /** How wide this will paint, in CSS terms. See SIZES in lib/img.ts. */
  sizes?: string;
  onError?: (e: SyntheticEvent<HTMLImageElement>) => void;
};

export function Img({ src, alt, sizes, priority, loading, fetchPriority, className, ...rest }: Props) {
  // An explicit loading/fetchPriority on the call site still wins — `priority`
  // only supplies the defaults for the common case.
  const load = loading ?? (priority ? "eager" : "lazy");
  const fetchPrio = fetchPriority ?? (priority ? "high" : undefined);
  // decoding="async" keeps a large image off the main thread during paint.
  // It is the default for most browsers already, but not all, and it costs
  // nothing to be explicit.
  const ladder = hasLadder(src);

  const img = (
    <img
      src={src}
      alt={alt}
      sizes={sizes}
      className={ladder ? `${className ? `${className} ` : ""}img-ph` : className}
      loading={load}
      fetchPriority={fetchPrio}
      decoding="async"
      {...rest}
    />
  );

  if (!ladder) return img;

  return (
    <picture>
      <source type="image/avif" srcSet={srcSetFor(src, "avif")} sizes={sizes} />
      <source type="image/webp" srcSet={srcSetFor(src, "webp")} sizes={sizes} />
      {img}
    </picture>
  );
}
