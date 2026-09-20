const sharp = require('sharp');

/**
 * Upload-time image optimization (docs/S3_CLOUDFRONT_MIGRATION.md #15).
 *
 * A phone photo can be 5-10 MB at 4000x3000 — nothing on this site displays
 * that many pixels, and shipping the original to a Pandit card wastes
 * bandwidth for every visitor, forever. This re-encodes every uploaded
 * IMAGE (never video — transcoding video is a different, much heavier
 * problem, deliberately out of scope here) to WebP, capped at a sensible
 * max dimension.
 *
 * `optimizeImage` produces the MASTER: the one buffer whose URL is written to
 * the database and stays the single source of truth. `buildVariants` produces
 * the responsive ladder beside it — see its own comment for why that is now
 * worth doing, and how the two relate.
 */

const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 82;

/**
 * The responsive ladder, in CSS pixels of width.
 *
 * Chosen from what this site actually paints, not from a generic ladder:
 * service cards render 340px wide on desktop (4-col grid) and ~170px on a
 * 360px phone (2-col), hero circles 280px/152px, temple and pandit cards
 * similar. Doubling those for a 2x screen lands on 320 and 640; 1280 covers
 * the handful of genuinely large renders (temple banner, profile portrait)
 * and 3x phones. A 960 rung was measured and dropped — it sat between two
 * rungs that already bracket every real layout width, so it only ever added
 * encode time and storage.
 */
const VARIANT_WIDTHS = [320, 640, 1280];

/**
 * AVIF first, WebP second — every variant is encoded in both.
 *
 * Measured on a real 1254x1254 service image from production: at 640w, AVIF
 * is 46KB against WebP's 75KB for the same visual quality. Both are emitted
 * because <picture> falls back on format support, not on a 404 — a browser
 * without AVIF must find a WebP rung at the same width, or it drops all the
 * way back to the full-size master and the whole exercise is wasted.
 *
 * `effort: 2` is deliberate and measured, not a default. AVIF encode time is
 * dominated by this knob: the full ladder takes 16s at sharp's default
 * effort 4, 3.1s at 3, and 1.7s at 2 — while the OUTPUT sizes across those
 * three settings differ by under 5% (320w: 14KB at every level; 1280w: 130KB
 * at effort 4 vs 139KB at effort 2). An admin waiting 16s for an upload to
 * return, to save 9KB on the largest rung, is the wrong trade. Quality 52 is
 * AVIF's rough perceptual match for WebP q76, not the same number on a
 * different scale.
 */
const VARIANT_FORMATS = [
  { format: 'avif', ext: '.avif', mimeType: 'image/avif', options: { quality: 52, effort: 2 } },
  { format: 'webp', ext: '.webp', mimeType: 'image/webp', options: { quality: 76 } },
];

/**
 * @param {Buffer} buffer
 * @param {string} mimeType  the ORIGINAL mime type, used only to decide
 *        whether this is an image worth touching at all
 * @returns {Promise<{ buffer: Buffer, ext: string, mimeType: string } | null>}
 *          null means "leave the original buffer alone" — either it is not
 *          an image, or re-encoding failed and the safest thing is to store
 *          exactly what the user uploaded rather than fail the request.
 */
async function optimizeImage(buffer, mimeType) {
  if (!mimeType || !mimeType.startsWith('image/')) return null;

  try {
    const optimized = await sharp(buffer, { failOn: 'none' })
      .rotate() // apply EXIF orientation before it's stripped, or sideways photos ship sideways
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    // A pathological input (e.g. a 1x1 pixel) can re-encode LARGER than it
    // started — not worth strictly enforcing "always smaller", but never
    // ship a re-encode that grew for no visual benefit on an already-small file.
    if (optimized.length >= buffer.length && buffer.length < 20 * 1024) return null;

    return { buffer: optimized, ext: '.webp', mimeType: 'image/webp' };
  } catch (err) {
    // Corrupt/unsupported input, or an environment without the libvips
    // codec for this format. The upload must not fail because of an
    // optimization that is a nice-to-have, not a correctness requirement —
    // store the original as uploaded instead.
    console.error('[media] image optimization failed, storing original:', err.message);
    return null;
  }
}

/**
 * The responsive ladder for one master image.
 *
 * imageOptimizer used to emit exactly one output, and said so: "Deliberately
 * ONE output, not a 320/640/1280 srcset ... a reasonable follow-up once this
 * is live, not a blocker for it." This is that follow-up, and the numbers
 * that made it due: the master is capped at 1600px and weighs ~270KB, but a
 * service card paints it 340px wide on desktop and ~170px on a phone. Every
 * visitor was downloading roughly 12x the pixels their screen could show —
 * 7.0 MB for the 26 cards on /services alone. The 320w AVIF rung is 14KB.
 *
 * Variants are addressed BY CONVENTION rather than by new database columns:
 * `<base>.webp` implies `<base>-320.avif`, `<base>-640.webp` and so on, so
 * `image_url`/`media_url` stay the single resolved source of truth every
 * existing query already reads, and no schema, repository or admin flow
 * changes. frontend/app/src/lib/img.ts derives the same names on the other
 * side; the two conventions must not drift, which is why both files name
 * each other.
 *
 * EVERY rung is always emitted, even when the master is narrower than it.
 * That is deliberate and it is the whole reason the convention is safe. A
 * consumer deriving `<base>-1280.avif` from a URL has no way to know how wide
 * the master behind that URL is — the width is in neither the filename, the
 * database, nor an S3 listing. If a rung could be legitimately absent, every
 * <picture> on the site would be one un-knowable condition away from pointing
 * a <source> at a 403, and a <source> that fails does NOT fall back to the
 * <img> — it renders broken. Measured on production: a 1254px master (the
 * common case here, so not a corner case at all) would be missing exactly the
 * 1280 rung.
 *
 * `withoutEnlargement` still prevents actual upscaling, so a rung above the
 * master's width is simply the master's own pixels re-encoded at that rung's
 * quality. It is never larger than the master, usually much smaller (that
 * 1254px master is 274KB as stored, 139KB as its AVIF "1280" rung), and the
 * srcset width descriptor overstates it by at most a few percent, which
 * changes nothing about which rung a browser picks.
 *
 * @param {Buffer} buffer    the MASTER buffer (post-optimizeImage), so the
 *        ladder is resized from the same pixels the master shows — never
 *        from an un-rotated original, or EXIF-sideways photos would come out
 *        rotated differently at different widths.
 * @param {string} mimeType
 * @returns {Promise<Array<{ width: number, format: string, ext: string, mimeType: string, buffer: Buffer }>>}
 *          empty on any failure — variants are strictly an optimization, and
 *          an upload must never fail because one could not be produced.
 */
async function buildVariants(buffer, mimeType) {
  if (!mimeType || !mimeType.startsWith('image/')) return [];

  // Metadata is read only to confirm libvips can decode these bytes at all —
  // a master that cannot be parsed yields no ladder rather than six failed
  // encodes and six error lines.
  try {
    const meta = await sharp(buffer, { failOn: 'none' }).metadata();
    if (!meta.width) return [];
  } catch (err) {
    console.error('[media] could not read image metadata for variants:', err.message);
    return [];
  }

  const jobs = [];
  for (const w of VARIANT_WIDTHS) {
    for (const fmt of VARIANT_FORMATS) {
      jobs.push(
        sharp(buffer, { failOn: 'none' })
          .resize({ width: w, withoutEnlargement: true })
          [fmt.format](fmt.options)
          .toBuffer()
          .then((out) => ({ width: w, format: fmt.format, ext: fmt.ext, mimeType: fmt.mimeType, buffer: out }))
          // One rung failing must not lose the rest of the ladder: a missing
          // rung is invisible (the browser picks another), a rejected
          // Promise.all would throw away every rung that did encode.
          .catch((err) => {
            console.error(`[media] variant ${w}w ${fmt.format} failed:`, err.message);
            return null;
          }),
      );
    }
  }

  return (await Promise.all(jobs)).filter(Boolean);
}

/**
 * The storage filename for one rung, given the master's filename.
 *
 * Kept here, next to the ladder that defines the rungs, so the convention has
 * exactly one definition on the backend. `abc123.webp` + (320, '.avif') ->
 * `abc123-320.avif`. The master's own extension is irrelevant to the result,
 * which matters for the fallback path where optimizeImage returned null and
 * the master is still a `.jpg`.
 */
function variantFilename(masterFilename, width, ext) {
  const base = masterFilename.replace(/\.[^./]+$/, '');
  return `${base}-${width}${ext}`;
}

/**
 * True when `url` points at a master this pipeline produced, and therefore
 * has a ladder beside it.
 *
 * Mirrors hasLadder() in frontend/app/src/lib/img.ts — the server injects
 * preload hints for the very images that file later renders, and if the two
 * disagreed about whether an image has rungs, the preload would fetch one URL
 * while <picture> fetched another and the visitor would download both.
 */
function urlHasLadder(url) {
  if (!url || url.startsWith('data:')) return false;
  const uploaded = url.includes('/uploads/') || /^https?:\/\/media\./.test(url);
  return uploaded && !/\.svgx?($|\?)/i.test(url);
}

/**
 * A `srcset` string over the ladder of `masterUrl`, for one format.
 *
 * Used to build <link rel="preload" as="image" imagesrcset=...> in
 * utils/htmlInject.js. A preload must describe the SAME candidate set as the
 * <picture> that will later consume it, or the browser preloads one rung and
 * then downloads a different one — strictly worse than not preloading.
 *
 * Returns "" for a URL with no ladder, so callers fall back to a plain href.
 */
function srcSetForUrl(masterUrl, ext) {
  if (!urlHasLadder(masterUrl)) return '';
  const base = masterUrl.replace(/\.[^./]+$/, '');
  return VARIANT_WIDTHS.map((w) => `${base}-${w}${ext} ${w}w`).join(', ');
}

module.exports = {
  optimizeImage,
  urlHasLadder,
  srcSetForUrl,
  buildVariants,
  variantFilename,
  MAX_DIMENSION,
  WEBP_QUALITY,
  VARIANT_WIDTHS,
  VARIANT_FORMATS,
};
