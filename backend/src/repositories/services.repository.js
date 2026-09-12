const { query } = require('../config/db');

const BASE_SELECT = `
  SELECT s.id, s.slug, s.name, s.icon_name AS icon, sc.slug AS cat, s.estimated_duration AS dur,
         s.description AS desc, s.short_description, s.samagri_list AS samagri, s.is_popular,
         s.image_url, s.recommended_muhurat, s.recommended_tithi,
         -- Admin-managed content that used to be hardcoded in
         -- frontend/app/src/data/serviceMeta.ts.
         s.benefits, s.process, s.faqs,
         -- The Hindi version of all of the above (migration 0011). Sent
         -- alongside rather than swapped in server-side: the language is the
         -- reader's own switch, and the page falls back per field, so both
         -- have to be in hand at render time.
         s.content_hi,
         s.is_online_available, s.online_note,
         -- Where this service sits in the homepage strip when an admin has
         -- ticked "Show on home page" (is_popular). The column existed from
         -- the beginning and nothing ever read it; the homepage grid was
         -- ordered by name, so an admin could choose WHICH pujas were
         -- featured but never in WHICH ORDER. Kept out of the catalogue's own
         -- ORDER BY below on purpose — /services stays alphabetical.
         s.display_order,
         s.meta_title, s.meta_description,
         (SELECT COUNT(*) FROM pandit_services ps WHERE ps.service_id = s.id AND ps.is_active = TRUE)::int AS pandit_count
  FROM services s JOIN service_categories sc ON sc.id = s.category_id
`;

async function list({ q, cat, online }) {
  const where = ['s.is_active = TRUE'];
  const params = [];
  if (cat && cat !== 'all') { params.push(cat); where.push(`sc.slug = $${params.length}`); }
  if (q) { params.push(`%${q}%`); where.push(`(s.name ILIKE $${params.length} OR s.description ILIKE $${params.length})`); }
  // ?online=true powers the "Online Puja / Havan" listing.
  if (online === 'true' || online === true) where.push('s.is_online_available = TRUE');

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const { rows } = await query(`${BASE_SELECT} ${whereSql} ORDER BY s.name`, params);
  return rows;
}

/**
 * Which online pujas devotees are ACTUALLY using, most-used first.
 *
 * Read from user_activity_events (the cross-role activity timeline), not from
 * a counter column: the events are already being written for every other
 * surface, they carry the service they happened on, and they expire naturally
 * — so this is "popular THIS month", which is what a homepage strip should
 * mean, rather than a lifetime total that a puja booked heavily one Navratri
 * would sit on top of forever.
 *
 * Two signals, deliberately weighted:
 *   SERVICE_VIEW                     someone opened the puja's page
 *   PANDIT_CHAT_CLICK / _CALL_CLICK  someone contacted a pandit FROM it
 *
 * A contact is worth 5 views because it is the thing the business actually
 * cares about; a puja people open and leave should not outrank one people
 * open and act on. Both are raw interest, neither is a booking — nothing in
 * this system records a completed puja yet, so nothing here pretends to.
 *
 * Returns [] when there is no traffic yet (the case today). The caller treats
 * that as "no opinion" and falls back to the admin's own ordering rather than
 * showing an empty strip.
 */
async function popularOnline({ days = 30, limit = 24 } = {}) {
  const { rows } = await query(
    `SELECT s.slug,
            COUNT(*) FILTER (WHERE e.event_type = 'SERVICE_VIEW')::int AS views,
            COUNT(*) FILTER (WHERE e.event_type IN ('PANDIT_CHAT_CLICK', 'PANDIT_CALL_CLICK'))::int AS enquiries,
            (COUNT(*) FILTER (WHERE e.event_type = 'SERVICE_VIEW')
             + 5 * COUNT(*) FILTER (WHERE e.event_type IN ('PANDIT_CHAT_CLICK', 'PANDIT_CALL_CLICK')))::int AS score
       FROM services s
       JOIN user_activity_events e ON e.service_id = s.id
      WHERE s.is_active = TRUE
        AND s.is_online_available = TRUE
        AND e.event_type IN ('SERVICE_VIEW', 'PANDIT_CHAT_CLICK', 'PANDIT_CALL_CLICK')
        AND e.created_at > NOW() - ($1 || ' days')::interval
      GROUP BY s.slug
      -- slug as the tiebreaker so an untrafficked tie is at least stable
      -- between requests rather than reshuffling on every page load.
      ORDER BY score DESC, s.slug
      LIMIT $2`,
    [String(days), limit],
  );
  return rows;
}

/** If this service has any published rows in the newer universal_faqs CMS
 *  (entity_type='SERVICE'), they replace the legacy s.faqs JSONB list for
 *  display — never both at once, so a devotee never sees the same question
 *  twice. No rows there (the common case today) leaves s.faqs untouched. */
async function getBySlug(slug) {
  // is_active, not just the slug. Without it a service an admin has
  // Deactivated stayed fully reachable at its own URL — HTTP 200, real title,
  // full JSON-LD and the crawlable article — so a ritual taken off the site
  // could still be crawled and indexed, and the admin's confirmation dialog
  // ("It disappears from the public site") was not true by direct link. The
  // listing already filtered it; only the detail lookup did not.
  const { rows } = await query(`${BASE_SELECT} WHERE s.slug = $1 AND s.is_active = TRUE`, [slug]);
  const service = rows[0];
  if (!service) return null;

  const { rows: cmsFaqs } = await query(
    `SELECT question AS q, answer AS a FROM universal_faqs
      WHERE entity_type = 'SERVICE' AND entity_id = $1 AND status = 'published'
      ORDER BY sort_order`,
    [service.id],
  );
  if (cmsFaqs.length) service.faqs = cmsFaqs;
  return service;
}

async function findIdBySlug(slug) {
  const { rows } = await query('SELECT id FROM services WHERE slug = $1', [slug]);
  return rows[0]?.id || null;
}

/**
 * Categories for the "Most booked services" strip.
 *
 * pandit_count and service_count are COMPUTED, not stored. The previous
 * hardcoded figures (186 / 257 / 251 / 167) were invented and could never be
 * right; a number on a public page should either be true or absent.
 *
 * Only categories an admin has given a home_rank appear here, so the strip
 * stays curated instead of growing silently with every new category.
 */
/**
 * Does service_categories carry content_hi yet (migration 0015)?
 *
 * Checked once per process, not per request. Selecting a column that does not
 * exist is a 42703 that would take the whole /services page down, and this
 * code has to be deployable before the migration runs — the migrator role is
 * not available everywhere the app is. Same defensive shape temples.repository
 * already uses for its own late-added column.
 */
let categoryHasHindi = null;
async function categoryHindiColumn() {
  if (categoryHasHindi !== null) return categoryHasHindi;
  const { rows } = await query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'service_categories'
        AND column_name = 'content_hi'`);
  categoryHasHindi = rows.length > 0;
  return categoryHasHindi;
}

async function homeCategories() {
  const hindi = await categoryHindiColumn();
  const { rows } = await query(
    `SELECT sc.slug, sc.name, sc.image_url, sc.tagline, sc.icon_name,
            ${hindi ? 'sc.content_hi,' : 'NULL::jsonb AS content_hi,'}
            (SELECT COUNT(*) FROM services s
              WHERE s.category_id = sc.id AND s.is_active = TRUE)::int AS service_count,
            (SELECT COUNT(DISTINCT ps.pandit_id)
               FROM pandit_services ps
               JOIN services s2 ON s2.id = ps.service_id
              WHERE s2.category_id = sc.id AND ps.is_active = TRUE)::int AS pandit_count
       FROM service_categories sc
      WHERE sc.is_active = TRUE AND sc.home_rank IS NOT NULL
        -- ...and only when the category actually has something live in it.
        -- A tile is a clickable promise: without this, a category whose
        -- services are all still drafts showed a card that filtered the grid
        -- below down to nothing. Same rule the homepage now uses for its
        -- temples section — a heading with nothing under it is worse than no
        -- heading. The tile returns on its own the moment an admin activates
        -- the first service in that category.
        AND EXISTS (SELECT 1 FROM services s3
                     WHERE s3.category_id = sc.id AND s3.is_active = TRUE)
      ORDER BY sc.home_rank, sc.display_order
      LIMIT 8`,
  );
  return rows;
}

module.exports = {
  homeCategories, list, getBySlug, findIdBySlug, popularOnline };
