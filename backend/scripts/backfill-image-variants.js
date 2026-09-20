#!/usr/bin/env node
/**
 * Generates the responsive ladder (imageOptimizer.buildVariants) for images
 * that were uploaded BEFORE the ladder existed.
 *
 * Every upload path now writes 320/640/1280 AVIF+WebP rungs beside the master
 * automatically. The images already in the bucket predate that, so without
 * this script the frontend's <picture> sources would point at objects that do
 * not exist — and a missing <source> is a broken image, not a fallback: the
 * browser does not retry the <img> when the source it chose 404s. Running
 * this to completion is therefore a HARD PREREQUISITE for shipping the
 * frontend half of the change, not a nice-to-have cleanup.
 *
 * Safe by construction, same contract as migrate-media-to-s3.js:
 *   - dry-run by default. Nothing is written until --execute.
 *   - idempotent / resumable. A master whose rungs all already exist is
 *     skipped without being re-encoded, so re-running costs only HeadObject
 *     calls and finishes in seconds.
 *   - one master's failure is logged and skipped; it never aborts the batch.
 *   - the master itself is never modified, re-encoded or deleted. Only new
 *     `-<width>.<ext>` objects are added beside it.
 *
 * Usage:
 *   node scripts/backfill-image-variants.js                  # dry run, everything
 *   node scripts/backfill-image-variants.js --execute
 *   node scripts/backfill-image-variants.js --execute --folder=services
 *   node scripts/backfill-image-variants.js --execute --limit=10
 *   node scripts/backfill-image-variants.js --verify         # report coverage only
 *
 * Requires AWS_S3_MEDIA_BUCKET (S3 mode). Local-disk installs have nothing
 * in a bucket to walk; their variants are produced at upload time like any
 * other and there is no historical backlog to fix.
 */
require('dotenv').config();

const mediaStore = require('../src/services/media/mediaStorage');
const {
  buildVariants, variantFilename, VARIANT_WIDTHS, VARIANT_FORMATS,
} = require('../src/services/media/imageOptimizer');

// Only raster images get a ladder. Videos are out of scope (imageOptimizer
// never touches them), and SVG is vector — it is already resolution
// independent, so every rung would be a strictly larger raster of it.
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.avif': 'image/avif',
};

/** `<anything>-320.avif` — the names this script itself writes. Re-walking
 *  the bucket after a run must not treat its own output as fresh masters. */
const VARIANT_RE = new RegExp(`-(${VARIANT_WIDTHS.join('|')})\\.(avif|webp)$`, 'i');

function extOf(key) {
  const m = key.match(/\.[^./]+$/);
  return m ? m[0].toLowerCase() : '';
}

function parseArgs(argv) {
  const args = { execute: false, verify: false, limit: Infinity, folder: null };
  for (const raw of argv) {
    if (raw === '--execute') args.execute = true;
    else if (raw === '--verify') args.verify = true;
    else if (raw.startsWith('--limit=')) args.limit = parseInt(raw.slice(8), 10) || args.limit;
    else if (raw.startsWith('--folder=')) args.folder = raw.slice(9);
  }
  return args;
}

/** Every key in the bucket, following pagination. */
async function listAllKeys() {
  const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
  const client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
  const keys = [];
  let ContinuationToken;
  do {
    const page = await client.send(new ListObjectsV2Command({
      Bucket: process.env.AWS_S3_MEDIA_BUCKET, ContinuationToken,
    }));
    for (const obj of page.Contents || []) keys.push(obj.Key);
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return keys;
}

/**
 * Collapses the key list into one job per ladder.
 *
 * Deduplication by BASE name, not by key, is the subtle part. The variant
 * convention strips the master's extension (`x.jpg` and `x.webp` both imply
 * `x-320.avif`), and this bucket really does hold 16 such pairs — the
 * hand-named legacy temple photos, each present as both a .jpg and a .webp of
 * the same picture. Treating them as two masters would make two jobs race to
 * write the same rung filenames. One job per base, preferring the .webp
 * source (it is the already-optimized one), resolves it; the .jpg sibling
 * gets the same ladder it would have produced anyway.
 */
function groupMasters(keys, folderFilter) {
  const byBase = new Map();

  for (const key of keys) {
    const ext = extOf(key);
    if (!IMAGE_EXTS.has(ext)) continue;
    if (VARIANT_RE.test(key)) continue;

    const slash = key.lastIndexOf('/');
    if (slash < 0) continue;
    const folder = key.slice(0, slash);
    if (folderFilter && folder !== folderFilter) continue;

    const base = key.slice(0, -ext.length);
    const existing = byBase.get(base);
    // .webp wins: it is the output of optimizeImage, so it is the same
    // pixels the site already serves, at a smaller download for this script.
    if (!existing || (ext === '.webp' && existing.ext !== '.webp')) {
      byBase.set(base, { key, folder, filename: key.slice(slash + 1), ext });
    }
  }

  return [...byBase.values()];
}

/**
 * Whether `filename`'s ladder is already complete, judged from the bucket
 * listing alone — no per-rung HeadObject calls.
 *
 * buildVariants emits a TOTAL ladder: every width in VARIANT_WIDTHS, in every
 * format, for every master, regardless of the master's own width (see its
 * comment on why a rung must never be legitimately absent). So "complete"
 * really is just "all of them are there", and any master short of that is
 * re-encoded in full — which is also the repair path if an earlier run wrote
 * a partial ladder before that rule was in place.
 *
 * @returns {{ complete: boolean, present: number, total: number }}
 */
function ladderState(keySet, folder, filename) {
  let present = 0;
  for (const w of VARIANT_WIDTHS) {
    for (const fmt of VARIANT_FORMATS) {
      if (keySet.has(`${folder}/${variantFilename(filename, w, fmt.ext)}`)) present += 1;
    }
  }
  const total = VARIANT_WIDTHS.length * VARIANT_FORMATS.length;
  return { complete: present === total, present, total };
}

async function getObjectBuffer(key) {
  const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
  const client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
  const res = await client.send(new GetObjectCommand({
    Bucket: process.env.AWS_S3_MEDIA_BUCKET, Key: key,
  }));
  const chunks = [];
  for await (const chunk of res.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!mediaStore.s3Enabled()) {
    console.error('AWS_S3_MEDIA_BUCKET is not set — nothing to back-fill.');
    console.error('Local-disk installs generate variants at upload time and have no historical backlog.');
    process.exit(1);
  }

  console.log(`bucket   ${process.env.AWS_S3_MEDIA_BUCKET}`);
  console.log(`ladder   ${VARIANT_WIDTHS.join('/')}w x ${VARIANT_FORMATS.map((f) => f.format).join('+')}`);
  console.log(`mode     ${args.verify ? 'VERIFY (coverage report only)' : args.execute ? 'EXECUTE' : 'DRY RUN (no writes — pass --execute)'}`);
  if (args.folder) console.log(`folder   ${args.folder}`);
  console.log('');

  const keys = await listAllKeys();
  // The listing is the only source of truth about what already exists — no
  // per-rung HeadObject calls, which at 6 rungs x 112 masters would be 672
  // round-trips to learn what one ListObjectsV2 already told us.
  const keySet = new Set(keys);
  const masters = groupMasters(keys, args.folder);
  console.log(`${keys.length} objects in bucket -> ${masters.length} image masters needing a ladder\n`);

  let done = 0; let skipped = 0; let failed = 0; let incomplete = 0;
  let processed = 0; let bytesWritten = 0;

  for (const m of masters) {
    if (processed >= args.limit) break;

    const state = ladderState(keySet, m.folder, m.filename);

    if (state.complete) {
      skipped += 1;
      continue;
    }

    if (args.verify) {
      incomplete += 1;
      console.log(`MISSING  ${m.key}  (${state.present}/${state.total} rungs present)`);
      continue;
    }

    processed += 1;

    if (!args.execute) {
      console.log(`would build  ${m.key}  (${state.present}/${state.total} rungs present)`);
      done += 1;
      continue;
    }

    try {
      const buffer = await getObjectBuffer(m.key);
      const variants = await buildVariants(buffer, MIME_BY_EXT[m.ext]);

      if (!variants.length) {
        console.log(`skip (too small for any rung)  ${m.key}`);
        skipped += 1;
        continue;
      }

      const written = await mediaStore.saveVariants(m.folder, m.filename, variants);
      const kb = variants.reduce((n, v) => n + v.buffer.length, 0) / 1024;
      bytesWritten += kb * 1024;
      console.log(
        `built  ${m.key}  ${written}/${variants.length} rungs  `
        + `${(buffer.length / 1024).toFixed(0)}KB master -> ${kb.toFixed(0)}KB ladder`,
      );
      done += 1;
    } catch (err) {
      console.error(`FAILED ${m.key}: ${err.message}`);
      failed += 1;
    }
  }

  console.log('');
  if (args.verify) {
    console.log(`coverage: ${skipped}/${masters.length} masters have a complete ladder, ${incomplete} incomplete`);
    process.exit(incomplete ? 1 : 0);
  }
  console.log(`${done} built, ${skipped} already complete/too small, ${failed} failed`);
  if (args.execute) console.log(`~${(bytesWritten / 1024 / 1024).toFixed(1)} MB of rungs written`);
  if (!args.execute) console.log('\nDry run — nothing was written. Re-run with --execute.');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
