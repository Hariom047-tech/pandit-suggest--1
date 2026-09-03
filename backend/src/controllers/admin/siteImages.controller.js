const repo = require('../../repositories/siteImages.repository');
const { SLOT_LIST, isValidSlot } = require('../../config/siteImageSlots');
const { makeMediaUpload } = require('../../middleware/mediaUpload');
const { logAdminAction } = require('../../utils/adminLog');

/**
 * Page images, one per slot — see src/config/siteImageSlots.js.
 *
 * Uploads go through the shared media pipeline (WebP re-encode, random
 * filename, S3 under the `site/` prefix), so a page image is stored exactly
 * like a pandit photo and never touches this server's filesystem.
 */
const site = makeMediaUpload('site');

/**
 * The catalog joined to what is currently stored — the admin page needs both
 * halves: an empty slot must still be listed (with its label and hint) so it
 * can be filled, which a plain SELECT of the table could never show.
 */
async function list(req, res) {
  const stored = new Map((await repo.listAll(req.db)).map((r) => [r.slot_key, r]));
  res.json(SLOT_LIST.map((slot) => {
    const row = stored.get(slot.key);
    return {
      ...slot,
      image_url: row?.image_url || null,
      alt_text: row?.alt_text || null,
      updated_at: row?.updated_at || null,
    };
  }));
}

async function upload(req, res) {
  const { slotKey } = req.params;
  if (!isValidSlot(slotKey)) {
    // The file is already stored at this point (multer ran first), so clean
    // it up rather than leaving an object nothing will ever reference.
    if (req.file?.mediaUrl) site.removeFile(req.file.mediaUrl);
    return res.status(400).json({ error: `Unknown image slot "${slotKey}"` });
  }
  if (!req.file) return res.status(400).json({ error: 'No file uploaded (expected field "file")' });

  const { row, previous } = await repo.upsert(req.db, {
    slotKey,
    imageUrl: req.file.mediaUrl,
    imageKey: req.file.storageKey,
    altText: req.body?.altText,
    mimeType: req.file.mimetype,
    sizeBytes: req.file.size,
    uploadedBy: req.adminUser.id,
  });

  // Replacing a slot orphans the previous object. Delete it only now that the
  // row points at the new one.
  if (previous?.image_url && previous.image_url !== row.image_url) {
    site.removeFile(previous.image_url);
  }

  await logAdminAction({
    adminUserId: req.adminUser.id, action: 'SITE_IMAGE_UPDATED',
    // admin_activity_log.target_id is a UUID column and a slot key is not one,
    // so the key travels in details instead of target_id.
    targetType: 'site_image', details: { slotKey }, ip: req.ip,
  });
  res.status(201).json(row);
}

async function updateAlt(req, res) {
  const { slotKey } = req.params;
  if (!isValidSlot(slotKey)) return res.status(400).json({ error: `Unknown image slot "${slotKey}"` });
  const updated = await repo.updateAlt(req.db, slotKey, req.body?.altText);
  if (!updated) return res.status(404).json({ error: 'No image uploaded for this slot yet' });
  res.json(updated);
}

async function remove(req, res) {
  const { slotKey } = req.params;
  if (!isValidSlot(slotKey)) return res.status(400).json({ error: `Unknown image slot "${slotKey}"` });
  const deleted = await repo.remove(req.db, slotKey);
  if (!deleted) return res.status(404).json({ error: 'No image uploaded for this slot' });
  site.removeFile(deleted.image_url);
  await logAdminAction({
    adminUserId: req.adminUser.id, action: 'SITE_IMAGE_DELETED',
    targetType: 'site_image', details: { slotKey }, ip: req.ip,
  });
  res.json({ ok: true });
}

module.exports = { list, upload, updateAlt, remove, siteUpload: site.handler };
