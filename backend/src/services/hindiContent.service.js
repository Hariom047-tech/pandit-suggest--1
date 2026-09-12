/**
 * One way in and out of the content_hi columns.
 *
 * Services, pandits and temples each keep the Hindi version of their
 * admin-authored text in a `content_hi` JSONB column (migrations 0011 and
 * 0012). The rule is the same for all three, so it lives here once rather than
 * being re-derived in three controllers that would then drift:
 *
 *   - translate from the row that was just SAVED, never from the request body.
 *     An update sends only the fields that changed, so translating the body
 *     would leave Hindi describing a fragment of the record.
 *   - an explicit `contentHi` in the request wins and skips the model. That is
 *     how a human correction is stored, and re-running the translator over one
 *     would simply undo it.
 *   - a failed translation CLEARS the Hindi for the fields it was asked to
 *     translate. Hindi describing the previous version of a paragraph is
 *     worse than falling back to English.
 *   - `force` re-translates everything, for when the stored Hindi is wrong
 *     rather than stale (a bad machine rendering an admin wants redone).
 *   - ONLY the fields whose English actually changed are re-translated. The
 *     English each field was translated from is fingerprinted into
 *     content_hi._source, so a save that changed an image, a price, a
 *     position — or nothing at all — costs no model call and leaves every
 *     Hindi word exactly as it was. See needsTranslation() below.
 */

const { translateToHindi, sourceFingerprints, CONTENT_SPECS } = require('./translation.service');

/**
 * Which column identifies a row, per table. Also the allow-list that makes the
 * interpolation below safe — a table name can never come from a caller.
 */
const TABLES = {
  service_categories: 'slug',
  services: 'slug',
  pandits: 'id',
  temples: 'id',
};

/**
 * Saved DB row -> the camelCase shape CONTENT_SPECS describes.
 *
 * Spelled out per kind rather than generated from the column names: the two
 * vocabularies genuinely differ (users.full_name is the pandit's `name`,
 * temples.custom_services is `customServices`), and a clever automatic mapping
 * would be one rename away from silently translating nothing.
 */
const FROM_ROW = {
  serviceCategory: (r) => ({
    name: r.name,
    tagline: r.tagline,
    description: r.description,
  }),
  service: (r) => ({
    name: r.name,
    shortDescription: r.short_description,
    description: r.description,
    estimatedDuration: r.estimated_duration,
    recommendedMuhurat: r.recommended_muhurat,
    onlineNote: r.online_note,
    metaTitle: r.meta_title,
    metaDescription: r.meta_description,
    benefits: r.benefits,
    process: r.process,
    faqs: r.faqs,
    samagri: r.samagri_list,
  }),
  pandit: (r) => ({
    // From the joined users row — a pandit's display name is not on `pandits`.
    name: r.name,
    title: r.title,
    shortBio: r.short_bio,
    bio: r.bio,
    primarySpecialization: r.primary_specialization,
    vedicEducation: r.vedic_education,
    gotra: r.gotra,
    tradition: r.tradition,
    respondsWithin: r.responds_within,
    // From the joined users row, like `name`.
    city: r.city,
    state: r.state,
  }),
  temple: (r) => ({
    name: r.name,
    shortDescription: r.short_description,
    description: r.description,
    primaryDeity: r.primary_deity,
    templeType: r.temple_type,
    architecturalStyle: r.architectural_style,
    history: r.history,
    significance: r.significance,
    howToReach: r.how_to_reach,
    nearestRailway: r.nearest_railway,
    nearestAirport: r.nearest_airport,
    city: r.city,
    district: r.district,
    state: r.state,
    highlights: r.highlights,
    customServices: r.custom_services,
  }),
};

/** The Hindi currently stored for a row, or null. */
async function readContentHi(q, table, keyValue) {
  const keyColumn = TABLES[table];
  if (!keyColumn) throw new Error(`readContentHi: unknown table "${table}"`);
  const { rows } = await q(`SELECT content_hi FROM ${table} WHERE ${keyColumn} = $1`, [keyValue]);
  return rows[0]?.content_hi || null;
}

/** Every top-level key a translation of this kind can produce. */
function contentKeys(kind) {
  const spec = CONTENT_SPECS[kind];
  return [...spec.text, ...Object.keys(spec.lists), ...spec.stringLists];
}

/**
 * Which fields have to go to the model this time.
 *
 * A field qualifies when its English differs from the English the stored
 * Hindi was made from, or when it has no Hindi at all. The second half is
 * what makes a previously failed field retry, and what translates a record
 * saved before fingerprints existed (no _source -> the fields that are missing
 * Hindi get done; for the rest `priorEnglish`, the row as it was before this
 * save, decides — and where even that is unavailable they are trusted and
 * simply re-fingerprinted).
 */
function needsTranslation(kind, live, previous, priorEnglish) {
  const before = previous?._source;
  return Object.keys(live).filter((key) => {
    // Never translated, or a previous attempt produced nothing usable.
    if (!hasHindi(previous?.[key])) return true;
    if (before) return before[key] !== live[key];
    // No fingerprints: a row last translated before they existed. Its Hindi
    // was trusted outright, which was wrong for exactly one case — the save
    // that is CHANGING the English right now. That is what left a pandit
    // renamed from "Acharya Ankit Sharma" to "Pandit Ankit Sharma" reading
    // "आचार्य अंकित शर्मा" in Hindi for good: the name was trusted, and then
    // fingerprinted against its NEW English below, so no later save saw a
    // change either.
    //
    // The row as it stood before this save answers it properly. Fields this
    // save left alone keep their Hindi and cost nothing (the original point
    // of trusting them); a field whose English just moved is retranslated.
    if (priorEnglish) return priorEnglish[key] !== live[key];
    // Nothing to compare against — a create, or a caller that cannot read the
    // row it is about to overwrite. Trust what is stored, as before.
    return false;
  });
}

/** Did a previous run actually produce something readable for this field? */
function hasHindi(value) {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

async function writeContentHi(q, table, keyValue, contentHi) {
  const keyColumn = TABLES[table];
  if (!keyColumn) throw new Error(`writeContentHi: unknown table "${table}"`);
  await q(
    `UPDATE ${table} SET content_hi = $2::jsonb WHERE ${keyColumn} = $1`,
    [keyValue, contentHi ? JSON.stringify(contentHi) : null],
  );
}

/**
 * Refreshes one row's Hindi. Awaited by its callers, so an admin sees the
 * result as soon as the save returns; never throws, because a save must not
 * fail over a translation.
 */
async function refreshHindiContent(q, { kind, table, key, row, previousRow, explicit, force }) {
  if (explicit !== undefined) {
    await writeContentHi(q, table, key, explicit || null);
    return explicit || null;
  }
  const mapper = FROM_ROW[kind];
  if (!mapper) throw new Error(`refreshHindiContent: unknown kind "${kind}"`);

  const content = mapper(row);
  const live = sourceFingerprints(kind, content);      // English as it stands now
  const previous = await readContentHi(q, table, key); // Hindi as it stands now
  // The English this save replaced, when the caller read the row first. Only
  // consulted for a row that has no fingerprints yet — see needsTranslation.
  const priorEnglish = previousRow ? sourceFingerprints(kind, mapper(previousRow)) : null;
  // `force` is the admin saying the stored Hindi is wrong, which no comparison
  // can work out on its own: the fingerprints say the English has not moved,
  // and they are right — it is the Hindi that is bad. Every field with English
  // goes back to the model.
  const stale = force ? Object.keys(live) : needsTranslation(kind, live, previous, priorEnglish);

  // The whole point: the model is reached ONLY when words actually changed.
  // Saving after swapping an image, ticking a flag, moving a homepage
  // position — or pressing Save having changed nothing — costs nothing and
  // leaves Hindi an admin may have corrected by hand exactly as it was.
  const fresh = stale.length ? await translateToHindi(kind, content, { only: stale }) : null;

  // A forced re-translation that came back with nothing (no API key, a
  // timeout) is a failed action, not an instruction to erase what is there.
  // Everywhere else an empty result deliberately clears the fields it covered
  // — but there the English had changed, so the old Hindi was describing text
  // that no longer exists. Here it is still the best the row has.
  if (force && !fresh) return null;

  // Rebuilt field by field rather than merged over `previous`, so Hindi whose
  // English has since been deleted goes with it instead of lingering under a
  // heading that no longer has any English text to sit beside.
  const merged = {};
  for (const field of contentKeys(kind)) {
    if (!(field in live)) continue;                    // no English -> no Hindi
    if (stale.includes(field)) {
      // Undefined when the call failed: leave the field out so the page falls
      // back to English for it. The fields that were already fine are not
      // punished for one bad translation, which is what clearing the whole
      // column used to do.
      if (fresh?.[field] !== undefined) merged[field] = fresh[field];
    } else if (previous?.[field] !== undefined) {
      merged[field] = previous[field];                 // untouched, and unpaid for
    }
  }

  if (!Object.keys(merged).length) {
    await writeContentHi(q, table, key, null);
    return null;
  }

  const contentHi = {
    ...merged,
    // Only fingerprint the fields that actually ended up with Hindi, so one
    // that failed is treated as still outstanding and retried on the next
    // save rather than being recorded as done.
    _source: Object.fromEntries(
      Object.entries(live).filter(([field]) => merged[field] !== undefined),
    ),
    // Left alone when nothing was translated — it records when this Hindi was
    // produced, not when the row was last saved.
    translatedAt: stale.length ? new Date().toISOString() : previous?.translatedAt,
    model: fresh?.model || previous?.model,
  };
  await writeContentHi(q, table, key, contentHi);
  // Returned so a caller that asked for this on purpose (the admin's
  // "re-translate" action) can show what came back. Every other caller
  // ignores it, exactly as before.
  return contentHi;
}

module.exports = { refreshHindiContent, writeContentHi };
