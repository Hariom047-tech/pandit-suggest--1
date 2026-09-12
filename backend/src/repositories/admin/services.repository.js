/**
 * Normalises an admin-supplied list into the JSONB shape the public page
 * renders. Accepts undefined (leave alone) vs [] (explicitly cleared), which
 * a plain COALESCE cannot distinguish.
 */
function jsonListOrNull(value, shape) {
  if (value === undefined) return null;          // caller omitted it -> keep existing
  if (!Array.isArray(value)) return JSON.stringify([]);
  return JSON.stringify(value.map(shape).filter(Boolean).slice(0, 40));
}

const asBenefit = (b) => {
  const title = String(b?.title ?? b ?? '').trim();
  // `icon` is whatever emoji the admin picked for this benefit. Capped at a
  // few characters because it is rendered in a fixed-size chip and a pasted
  // sentence would break the layout — one emoji can be several code units, so
  // the cap is deliberately not 1. Blank means "use the default om".
  return title
    ? { title, detail: String(b?.detail ?? '').trim(), icon: String(b?.icon ?? '').trim().slice(0, 8) }
    : null;
};
const asStep = (p, i) => {
  const title = String(p?.title ?? p ?? '').trim();
  return title ? {
    step: Number(p?.step) || i + 1,
    title,
    detail: String(p?.detail ?? '').trim(),
    duration: String(p?.duration ?? '').trim(),
  } : null;
};
const asFaq = (f) => {
  const q = String(f?.q ?? '').trim();
  return q ? { q, a: String(f?.a ?? '').trim() } : null;
};
const asSamagri = (x) => {
  const item = String(x?.item ?? x ?? '').trim();
  return item ? { item, qty: String(x?.qty ?? '').trim() } : null;
};

/**
 * Homepage position: a whole number, or null meaning "leave it as it is".
 *
 * The admin form posts a string, and an empty box must not become 0 — that
 * would silently jump an untouched service to the front of the homepage strip
 * every time an admin saved an unrelated edit. Anything that is not a number
 * (a blank, a pasted word) is treated the same way: don't touch it. Negative
 * values are allowed on purpose, so one puja can be pinned above a row of
 * zeros without renumbering the rest.
 */
function asPosition(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

async function listCategories(q) {
  const { rows } = await q('SELECT * FROM service_categories ORDER BY display_order');
  return rows;
}

async function createCategory(q, { name, slug, description, iconName, displayOrder }) {
  const { rows } = await q(
    `INSERT INTO service_categories (name, slug, description, icon_name, display_order) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [name, slug, description || null, iconName || null, displayOrder || 0],
  );
  return rows[0];
}

async function updateCategory(q, id, fields) {
  const { rows } = await q(
    `UPDATE service_categories SET
       name          = COALESCE($2, name),
       description   = COALESCE($3, description),
       icon_name     = COALESCE($4, icon_name),
       display_order = COALESCE($5, display_order),
       is_active     = COALESCE($6, is_active),
       image_url     = COALESCE($7, image_url),
       tagline       = COALESCE($8, tagline),
       -- home_rank is nullable BY DESIGN (null = hidden from the strip), so it
       -- cannot use COALESCE — that would make un-featuring impossible.
       home_rank     = CASE WHEN $9::boolean THEN $10::int ELSE home_rank END
     WHERE id = $1 RETURNING *`,
    [id, fields.name, fields.description, fields.iconName, fields.displayOrder, fields.isActive,
      fields.imageUrl, fields.tagline,
      fields.homeRank !== undefined, fields.homeRank ?? null],
  );
  return rows[0] || null;
}

async function findCategoryById(q, id) {
  const { rows } = await q('SELECT * FROM service_categories WHERE id = $1', [id]);
  return rows[0] || null;
}

async function setCategoryImage(q, id, imageUrl, imageKey = null) {
  const { rows } = await q(
    'UPDATE service_categories SET image_url = $2, image_key = $3 WHERE id = $1 RETURNING image_url, image_key',
    [id, imageUrl, imageKey]);
  return rows[0] || null;
}

async function deleteCategory(q, id) {
  const { rowCount } = await q('UPDATE service_categories SET is_active = FALSE WHERE id = $1', [id]);
  return rowCount > 0;
}

async function list(q, { search, categorySlug, page, perPage }) {
  const where = [];
  const params = [];
  if (search) { params.push(`%${search}%`); where.push(`(s.name ILIKE $${params.length} OR s.description ILIKE $${params.length})`); }
  if (categorySlug) { params.push(categorySlug); where.push(`sc.slug = $${params.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  params.push(perPage, (page - 1) * perPage);
  const { rows } = await q(
    `SELECT s.id, s.slug, s.name, sc.name AS category, s.is_popular, s.is_active,
            s.is_online_available, s.created_at
     FROM services s JOIN service_categories sc ON sc.id = s.category_id
     ${whereSql} ORDER BY s.name LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const { rows: countRows } = await q(
    `SELECT COUNT(*)::int AS total FROM services s JOIN service_categories sc ON sc.id = s.category_id ${whereSql}`,
    params.slice(0, params.length - 2),
  );
  return { data: rows, total: countRows[0].total };
}

async function findIdBySlug(q, slug) {
  const { rows } = await q('SELECT id FROM services WHERE slug = $1', [slug]);
  return rows[0]?.id || null;
}

async function create(q, s) {
  const { rows } = await q(
    `INSERT INTO services
       (category_id, name, slug, description, short_description, icon_name,
        estimated_duration, is_popular, recommended_muhurat,
        benefits, process, faqs, samagri_list, is_online_available, online_note,
        display_order, meta_title, meta_description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
             COALESCE($10::jsonb, '[]'::jsonb), COALESCE($11::jsonb, '[]'::jsonb),
             COALESCE($12::jsonb, '[]'::jsonb), COALESCE($13::jsonb, '[]'::jsonb),
             COALESCE($14, FALSE), $15, COALESCE($16, 0), $17, $18)
     RETURNING id, slug`,
    [s.categoryId, s.name, s.slug, s.description || null, s.shortDescription || null,
      s.iconName || null, s.estimatedDuration || null, !!s.isPopular, s.recommendedMuhurat || null,
      jsonListOrNull(s.benefits, asBenefit),
      jsonListOrNull(s.process, asStep),
      jsonListOrNull(s.faqs, asFaq),
      jsonListOrNull(s.samagri, asSamagri),
      s.isOnlineAvailable, s.onlineNote || null,
      asPosition(s.displayOrder), s.metaTitle || null, s.metaDescription || null],
  );
  return rows[0];
}

async function update(q, slug, fields) {
  const { rows } = await q(
    `UPDATE services SET
       name                = COALESCE($2, name),
       description         = COALESCE($3, description),
       short_description   = COALESCE($4, short_description),
       icon_name           = COALESCE($5, icon_name),
       estimated_duration  = COALESCE($6, estimated_duration),
       is_popular          = COALESCE($7, is_popular),
       is_active           = COALESCE($8, is_active),
       recommended_muhurat = COALESCE($9, recommended_muhurat),
       benefits            = COALESCE($10::jsonb, benefits),
       process             = COALESCE($11::jsonb, process),
       faqs                = COALESCE($12::jsonb, faqs),
       samagri_list        = COALESCE($13::jsonb, samagri_list),
       is_online_available = COALESCE($14, is_online_available),
       online_note         = COALESCE($15, online_note),
       display_order       = COALESCE($16, display_order),
       -- Nullable BY DESIGN: blank means "no override, derive it from the
       -- name and short description" (see backend/src/utils/seoMeta.js), so
       -- COALESCE would make clearing an override impossible.
       meta_title          = CASE WHEN $17::boolean THEN $18 ELSE meta_title END,
       meta_description    = CASE WHEN $19::boolean THEN $20 ELSE meta_description END
     WHERE slug = $1 RETURNING *`,
    [slug, fields.name, fields.description, fields.shortDescription, fields.iconName,
      fields.estimatedDuration, fields.isPopular, fields.isActive, fields.recommendedMuhurat,
      jsonListOrNull(fields.benefits, asBenefit),
      jsonListOrNull(fields.process, asStep),
      jsonListOrNull(fields.faqs, asFaq),
      jsonListOrNull(fields.samagri, asSamagri),
      fields.isOnlineAvailable, fields.onlineNote,
      asPosition(fields.displayOrder),
      fields.metaTitle !== undefined, fields.metaTitle || null,
      fields.metaDescription !== undefined, fields.metaDescription || null],
  );
  return rows[0] || null;
}

/** Full record for the admin editor — the list query is intentionally slim. */
async function getBySlug(q, slug) {
  const { rows } = await q(
    `SELECT s.*, sc.slug AS category_slug, sc.name AS category_name
       FROM services s JOIN service_categories sc ON sc.id = s.category_id
      WHERE s.slug = $1`,
    [slug],
  );
  return rows[0] || null;
}

async function setImage(q, slug, imageUrl, imageKey = null) {
  const { rows } = await q(
    'UPDATE services SET image_url = $2, image_key = $3 WHERE slug = $1 RETURNING image_url, image_key',
    [slug, imageUrl, imageKey],
  );
  return rows[0] || null;
}

async function softDelete(q, slug) {
  const { rowCount } = await q('UPDATE services SET is_active = FALSE WHERE slug = $1', [slug]);
  return rowCount > 0;
}

/**
 * Really removes a service, as opposed to softDelete()'s is_active = FALSE.
 *
 * Left to the database to police. Of the twelve foreign keys pointing here,
 * five CASCADE (pandit_services, temple_services, service_samagri and the two
 * AI mapping tables — associations with no meaning once the service is gone),
 * four SET NULL (qualified_leads, pandit_exposure, user_activity_events,
 * ai_knowledge_documents — the record survives, it just stops pointing at a
 * service), and three are NO ACTION: contact_clicks, inquiries and reviews.
 * Those three are history a devotee created, so Postgres refuses the delete
 * outright and the caller turns 23503 into "deactivate it instead".
 *
 * Counting those rows in JS first would be both a race and a lie; the
 * constraint is the real rule.
 */
async function hardDelete(q, slug) {
  const { rowCount } = await q('DELETE FROM services WHERE slug = $1', [slug]);
  return rowCount > 0;
}

/** Same idea for a category: services.category_id is NO ACTION, so a category
 *  that still holds services — even deactivated ones — cannot be removed. */
async function hardDeleteCategory(q, id) {
  const { rowCount } = await q('DELETE FROM service_categories WHERE id = $1', [id]);
  return rowCount > 0;
}

/** Reactivates (or deactivates) without touching anything else — notably
 *  without re-running the translator, which a full update() would. */
async function setActive(q, slug, isActive) {
  const { rowCount } = await q(
    'UPDATE services SET is_active = $2 WHERE slug = $1', [slug, isActive],
  );
  return rowCount > 0;
}

async function listSamagri(q, serviceId) {
  const { rows } = await q('SELECT * FROM service_samagri WHERE service_id = $1 ORDER BY display_order', [serviceId]);
  return rows;
}

async function addSamagri(q, serviceId, item) {
  const { rows } = await q(
    `INSERT INTO service_samagri (service_id, item_name, quantity, is_essential, display_order) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [serviceId, item.itemName, item.quantity || null, item.isEssential !== false, item.displayOrder || 0],
  );
  return rows[0];
}

/**
 * Stores the Hindi content produced by the translator (migration 0011).
 *
 * Separate from update() rather than another COALESCE column in it: the Hindi
 * is derived from what update() just wrote, so it can only be produced after
 * that statement has run. Passing null clears it, which is what a caller does
 * when the English changed and no fresh translation could be made — stale
 * Hindi describing the previous version is worse than falling back to English.
 */
async function setContentHi(q, slug, contentHi) {
  await q(
    'UPDATE services SET content_hi = $2::jsonb WHERE slug = $1',
    [slug, contentHi ? JSON.stringify(contentHi) : null],
  );
}

module.exports = {
  findCategoryById, setCategoryImage,
  getBySlug, setImage,
  listCategories, createCategory, updateCategory, deleteCategory,
  list, findIdBySlug, create, update, softDelete, listSamagri, addSamagri,
  hardDelete, hardDeleteCategory, setActive,
  setContentHi,
};
