/**
 * services/media/imageOptimizer.js — upload-time WebP re-encode + resize
 * cap. Pure buffer-in/buffer-out, no database, no network.
 *
 *   npm run test:media
 */

const test = require('node:test');
const assert = require('node:assert');
const sharp = require('sharp');

const { optimizeImage, MAX_DIMENSION } = require('../src/services/media/imageOptimizer');

async function makeJpeg(width, height) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 100, b: 50 } },
  }).jpeg({ quality: 100 }).toBuffer();
}

test('re-encodes a large JPEG to WebP and caps the dimension', async () => {
  const original = await makeJpeg(3000, 2000);
  const result = await optimizeImage(original, 'image/jpeg');

  assert.notStrictEqual(result, null);
  assert.strictEqual(result.ext, '.webp');
  assert.strictEqual(result.mimeType, 'image/webp');
  assert.ok(result.buffer.length < original.length, 'optimized output should be smaller than a quality-100 JPEG original');

  const meta = await sharp(result.buffer).metadata();
  assert.strictEqual(meta.format, 'webp');
  assert.ok(meta.width <= MAX_DIMENSION);
  assert.ok(meta.height <= MAX_DIMENSION);
});

test('does not upscale an image already smaller than the cap', async () => {
  const original = await makeJpeg(400, 300);
  const result = await optimizeImage(original, 'image/jpeg');
  assert.notStrictEqual(result, null);
  const meta = await sharp(result.buffer).metadata();
  assert.strictEqual(meta.width, 400);
  assert.strictEqual(meta.height, 300);
});

test('returns null (leave original alone) for a video mime type', async () => {
  const result = await optimizeImage(Buffer.from('not really a video'), 'video/mp4');
  assert.strictEqual(result, null);
});

test('returns null for a missing/empty mime type', async () => {
  assert.strictEqual(await optimizeImage(Buffer.from('x'), null), null);
  assert.strictEqual(await optimizeImage(Buffer.from('x'), ''), null);
});

test('returns null (falls back to original) for corrupt/unparseable image bytes, without throwing', async () => {
  const garbage = Buffer.from('this is not a real image file at all');
  await assert.doesNotReject(async () => {
    const result = await optimizeImage(garbage, 'image/jpeg');
    assert.strictEqual(result, null);
  });
});

test('preserves already-WebP input as WebP', async () => {
  // Random noise, not a solid color: a flat-color image already compresses
  // to a few hundred bytes at quality 100, which trips the "don't bother
  // re-encoding an already-tiny file" guard (see imageOptimizer.js) and is
  // not representative of a real uploaded photo anyway.
  const noise = Buffer.alloc(2000 * 2000 * 3);
  for (let i = 0; i < noise.length; i += 1) noise[i] = Math.floor(Math.random() * 256);
  const original = await sharp(noise, { raw: { width: 2000, height: 2000, channels: 3 } })
    .webp({ quality: 100 }).toBuffer();

  const result = await optimizeImage(original, 'image/webp');
  assert.notStrictEqual(result, null);
  assert.strictEqual(result.mimeType, 'image/webp');
});

/* ── responsive ladder (buildVariants / variantFilename) ─────────────────── */

const {
  buildVariants, variantFilename, VARIANT_WIDTHS, VARIANT_FORMATS,
} = require('../src/services/media/imageOptimizer');

test('variantFilename appends the rung and swaps the extension', () => {
  assert.strictEqual(variantFilename('a1b2c3.webp', 320, '.avif'), 'a1b2c3-320.avif');
  assert.strictEqual(variantFilename('a1b2c3.webp', 640, '.webp'), 'a1b2c3-640.webp');
  // The master's own extension must not survive into the rung name — the
  // fallback path (optimizeImage returned null) leaves masters as .jpg, and
  // frontend/app/src/lib/img.ts derives names from the URL the same way.
  assert.strictEqual(variantFilename('a1b2c3.jpg', 320, '.avif'), 'a1b2c3-320.avif');
});

test('builds every rung in every format for a large image', async () => {
  const original = await makeJpeg(2000, 1500);
  const master = await optimizeImage(original, 'image/jpeg');
  const variants = await buildVariants(master.buffer, master.mimeType);

  assert.strictEqual(variants.length, VARIANT_WIDTHS.length * VARIANT_FORMATS.length);
  for (const w of VARIANT_WIDTHS) {
    for (const fmt of VARIANT_FORMATS) {
      const hit = variants.find((v) => v.width === w && v.format === fmt.format);
      assert.ok(hit, `missing ${w}w ${fmt.format}`);
      const meta = await sharp(hit.buffer).metadata();
      assert.strictEqual(meta.width, w);
    }
  }
});

test('emits every rung even when the master is NARROWER than some of them', async () => {
  // The production-typical case: masters are capped at 1600 but real uploads
  // land around 1250, below the top rung. The ladder must still be total —
  // frontend/app/src/lib/img.ts derives rung URLs without knowing the
  // master's width, and a <source> pointing at a missing rung renders broken
  // rather than falling back to the <img>.
  const original = await makeJpeg(500, 500);
  const master = await optimizeImage(original, 'image/jpeg');
  const variants = await buildVariants(master.buffer, master.mimeType);

  assert.strictEqual(variants.length, VARIANT_WIDTHS.length * VARIANT_FORMATS.length);

  // ...but a rung above the master's width is not upscaled: it carries the
  // master's own pixels, so it is never larger than the master in dimension.
  for (const v of variants.filter((x) => x.width > 500)) {
    const meta = await sharp(v.buffer).metadata();
    assert.strictEqual(meta.width, 500, `${v.width}w rung should be clamped to the 500px master`);
  }
});

test('a rung is meaningfully smaller than the master it replaces', async () => {
  const noise = Buffer.alloc(1400 * 1400 * 3);
  for (let i = 0; i < noise.length; i += 1) noise[i] = Math.floor(Math.random() * 256);
  const original = await sharp(noise, { raw: { width: 1400, height: 1400, channels: 3 } })
    .jpeg({ quality: 92 }).toBuffer();
  const master = await optimizeImage(original, 'image/jpeg');
  const variants = await buildVariants(master.buffer, master.mimeType);

  const smallest = variants.find((v) => v.width === 320 && v.format === 'avif');
  assert.ok(
    smallest.buffer.length < master.buffer.length,
    `320w AVIF (${smallest.buffer.length}) should undercut the master (${master.buffer.length})`,
  );
});

test('returns [] rather than throwing for video, corrupt bytes and missing mime', async () => {
  assert.deepStrictEqual(await buildVariants(Buffer.from('x'), 'video/mp4'), []);
  assert.deepStrictEqual(await buildVariants(Buffer.from('x'), null), []);
  assert.deepStrictEqual(await buildVariants(Buffer.from('not an image at all'), 'image/jpeg'), []);
});
