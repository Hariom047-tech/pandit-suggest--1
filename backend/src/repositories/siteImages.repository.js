const { query } = require('../config/db');

/**
 * Admin-managed page images, one row per slot key.
 *
 * See src/config/siteImageSlots.js for what a slot is and why these images
 * are no longer hardcoded into the frontend.
 */

/**
 * Public read: `{ "home.trust": { url, alt }, ... }`.
 *
 * A map rather than an array because every consumer is a point lookup by
 * slot key — the page asks for one image, it never iterates them.
 */
async function getPublicMap(q = query) {
  const { rows } = await q('SELECT slot_key, image_url, alt_text FROM site_images');
  return Object.fromEntries(
    rows.map((r) => [r.slot_key, { url: r.image_url, alt: r.alt_text || '' }]),
  );
}

/** Admin read: every stored slot, with the upload metadata. */
async function listAll(q = query) {
  const { rows } = await q(
    `SELECT slot_key, image_url, image_key, alt_text, mime_type, file_size_bytes, updated_at
       FROM site_images ORDER BY slot_key`,
  );
  return rows;
}

async function get(q, slotKey) {
  const { rows } = await q('SELECT * FROM site_images WHERE slot_key = $1', [slotKey]);
  return rows[0] || null;
}

/**
 * Replaces the image in a slot, returning { row, previous } — `previous` is
 * the old row (or null) so the caller can delete the orphaned S3 object only
 * after the row has been repointed. Row first, file second: a stray object is
 * harmless, a row pointing at a deleted object renders as a broken image.
 */
async function upsert(q, { slotKey, imageUrl, imageKey, altText, mimeType, sizeBytes, uploadedBy }) {
  const previous = await get(q, slotKey);
  const { rows } = await q(
    `INSERT INTO site_images
       (slot_key, image_url, image_key, alt_text, mime_type, file_size_bytes, uploaded_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (slot_key) DO UPDATE SET
       image_url = EXCLUDED.image_url,
       image_key = EXCLUDED.image_key,
       -- A replacement upload with no alt text keeps the one already written,
       -- rather than silently dropping an accessibility label.
       alt_text = COALESCE(EXCLUDED.alt_text, site_images.alt_text),
       mime_type = EXCLUDED.mime_type,
       file_size_bytes = EXCLUDED.file_size_bytes,
       uploaded_by = EXCLUDED.uploaded_by,
       updated_at = NOW()
     RETURNING slot_key, image_url, image_key, alt_text, mime_type, file_size_bytes, updated_at`,
    [slotKey, imageUrl, imageKey || null, altText || null, mimeType || null,
      sizeBytes || null, uploadedBy || null],
  );
  return { row: rows[0], previous };
}

/** Alt text only — editing a caption should not require re-uploading the file. */
async function updateAlt(q, slotKey, altText) {
  const { rows } = await q(
    `UPDATE site_images SET alt_text = $2, updated_at = NOW()
      WHERE slot_key = $1
      RETURNING slot_key, image_url, alt_text, updated_at`,
    [slotKey, altText || null],
  );
  return rows[0] || null;
}

/** Clears a slot; the page falls back to its built-in default image. */
async function remove(q, slotKey) {
  const { rows } = await q(
    'DELETE FROM site_images WHERE slot_key = $1 RETURNING image_url',
    [slotKey],
  );
  return rows[0] || null;
}

module.exports = { getPublicMap, listAll, get, upsert, updateAlt, remove };
