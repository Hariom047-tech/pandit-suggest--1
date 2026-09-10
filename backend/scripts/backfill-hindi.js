#!/usr/bin/env node
/**
 * Regenerates services.content_hi / pandits.content_hi / temples.content_hi
 * for rows that already exist.
 *
 * The translator only runs on save (see services/hindiContent.service.js), so
 * anything written before the feature — or before a fix to the field spec, or
 * to the prompt — keeps whatever Hindi it had, including none. This is the
 * way to catch those up without an admin opening and re-saving every record.
 *
 * It was written after exactly that: the service spec asked for `question`/
 * `answer` while FAQs are stored as `q`/`a`, so every service's FAQ list was
 * silently dropped as untranslatable and stayed English under a Hindi page.
 *
 * Usage:
 *   node scripts/backfill-hindi.js                 # every row missing Hindi
 *   node scripts/backfill-hindi.js --all           # every row, re-translating
 *   node scripts/backfill-hindi.js --kind=service  # one kind only
 *   node scripts/backfill-hindi.js --dry-run
 */
'use strict';

require('dotenv').config();
const { query, withUserContext } = require('../src/config/db');
const { translateToHindi } = require('../src/services/translation.service');

const ARGS = process.argv.slice(2);
const DRY_RUN = ARGS.includes('--dry-run');
const FORCE = ARGS.includes('--all');
const ONLY = (ARGS.find((a) => a.startsWith('--kind=')) || '').split('=')[1] || null;

/**
 * Each kind's rows, the shape the translator wants, and how to write the
 * result back.
 *
 * `pandits` has RLS enabled and allows UPDATE only to the pandit themselves or
 * an admin, so its write runs inside that pandit's OWN user context — the same
 * policy the pandit's dashboard uses. services and temples have RLS disabled,
 * so a plain UPDATE is enough. A script that ignored this would not fail: RLS
 * filters rows out of an UPDATE rather than raising, so it would report
 * success and change nothing.
 */
const KINDS = {
  service: {
    select: `SELECT slug AS key, name, short_description, description, estimated_duration,
                    recommended_muhurat, online_note, benefits, process, faqs, samagri_list,
                    (content_hi IS NOT NULL) AS has_hindi
               FROM services WHERE is_active = TRUE`,
    map: (r) => ({
      name: r.name,
      shortDescription: r.short_description,
      description: r.description,
      estimatedDuration: r.estimated_duration,
      recommendedMuhurat: r.recommended_muhurat,
      onlineNote: r.online_note,
      benefits: r.benefits,
      process: r.process,
      faqs: r.faqs,
      samagri: r.samagri_list,
    }),
    write: (row, hindi) => query(
      'UPDATE services SET content_hi = $2::jsonb WHERE slug = $1',
      [row.key, hindi ? JSON.stringify(hindi) : null],
    ),
  },
  pandit: {
    select: `SELECT p.id AS key, p.user_id, u.full_name AS name, p.title, p.short_bio, p.bio,
                    p.primary_specialization, p.vedic_education, p.gotra, p.tradition,
                    p.responds_within, u.city, u.state,
                    (p.content_hi IS NOT NULL) AS has_hindi
               FROM pandits p JOIN users u ON u.id = p.user_id
              WHERE p.deleted_at IS NULL`,
    map: (r) => ({
      name: r.name,
      title: r.title,
      shortBio: r.short_bio,
      bio: r.bio,
      primarySpecialization: r.primary_specialization,
      vedicEducation: r.vedic_education,
      gotra: r.gotra,
      tradition: r.tradition,
      respondsWithin: r.responds_within,
      city: r.city,
      state: r.state,
    }),
    write: (row, hindi) => withUserContext(row.user_id, (q) => q(
      'UPDATE pandits SET content_hi = $2::jsonb WHERE id = $1',
      [row.key, hindi ? JSON.stringify(hindi) : null],
    )),
  },
  temple: {
    select: `SELECT id AS key, name, short_description, description, primary_deity, temple_type,
                    architectural_style, history, significance, how_to_reach, nearest_railway,
                    nearest_airport, city, district, state, highlights, custom_services,
                    (content_hi IS NOT NULL) AS has_hindi
               FROM temples WHERE deleted_at IS NULL`,
    map: (r) => ({
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
    write: (row, hindi) => query(
      'UPDATE temples SET content_hi = $2::jsonb WHERE id = $1',
      [row.key, hindi ? JSON.stringify(hindi) : null],
    ),
  },
};

async function run() {
  const kinds = ONLY ? [ONLY] : Object.keys(KINDS);
  for (const kind of kinds) {
    const spec = KINDS[kind];
    if (!spec) {
      console.error(`unknown --kind=${kind}; expected one of ${Object.keys(KINDS).join(', ')}`);
      process.exitCode = 1;
      return;
    }

    const { rows } = await query(spec.select);
    // Sequential on purpose: this hits a rate-limited API, and a handful of
    // rows finishing a few seconds later costs nothing.
    const todo = FORCE ? rows : rows.filter((r) => !r.has_hindi);
    console.log(`\n[${kind}] ${rows.length} row(s), ${todo.length} to translate${FORCE ? ' (--all)' : ''}`);

    for (const row of todo) {
      const label = row.key;
      if (DRY_RUN) { console.log(`  would translate ${label}`); continue; }
      const hindi = await translateToHindi(kind, spec.map(row));
      if (!hindi) { console.log(`  SKIP  ${label} — translator returned nothing`); continue; }
      await spec.write(row, hindi);
      const keys = Object.keys(hindi).filter((k) => k !== 'translatedAt' && k !== 'model');
      console.log(`  ok    ${label} — ${keys.length} field(s): ${keys.join(', ')}`);
    }
  }
}

run()
  .then(() => { console.log('\ndone'); process.exit(0); })
  .catch((err) => { console.error('\nbackfill failed:', err); process.exit(1); });
