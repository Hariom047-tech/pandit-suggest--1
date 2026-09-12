#!/usr/bin/env node
/**
 * Regenerates the Hindi for rows that have none.
 *
 * Why this exists
 * ---------------
 * Migration 0016 restored the English on fourteen Maa Baglamukhi services and
 * set their content_hi to NULL, because the Hindi had been scrambled onto a
 * different permutation than the English and could not be put back by pairing
 * it with anything. Clearing it was the right call — a Hindi paragraph about a
 * different ritual is worse than falling back to English — but it leaves those
 * pages half-English for a Hindi reader until something re-translates them.
 *
 * The application already does exactly that on an admin save
 * (controllers/admin/services.controller.js -> refreshHindiContent). This is
 * that same call, for rows nobody has re-saved, so the pages do not wait on
 * someone opening fourteen editors and pressing Save in each.
 *
 * Usage
 * -----
 *   node scripts/backfill-hindi.js --dry-run     # list what it would do
 *   node scripts/backfill-hindi.js               # only rows with NO Hindi
 *   node scripts/backfill-hindi.js --force       # re-translate every row
 *   node scripts/backfill-hindi.js --slug=a,b    # just these
 *
 * Runs as the runtime app role, not the migrator: this writes content, not
 * schema, and it is the same write the admin panel makes. Needs OPENAI_API_KEY
 * — without it translateToHindi returns nothing and every row is left alone
 * rather than cleared, which is the library's own behaviour on a forced run.
 */

require('dotenv').config();
const { Pool } = require('pg');
const { refreshHindiContent } = require('../src/services/hindiContent.service');

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const slugArg = process.argv.find((a) => a.startsWith('--slug='));
const ONLY = slugArg ? slugArg.slice('--slug='.length).split(',').map((s) => s.trim()).filter(Boolean) : null;

function sslFor(url) {
  if (!/rds\.amazonaws\.com/.test(url)) return false;
  const fs = require('fs');
  const path = require('path');
  const ca = process.env.RDS_CA_BUNDLE
    || path.join(__dirname, '..', '..', 'certs', 'rds-global-bundle.pem');
  if (!fs.existsSync(ca)) throw new Error(`RDS needs the CA bundle at ${ca}`);
  return { rejectUnauthorized: true, ca: fs.readFileSync(ca, 'utf8') };
}

/** See scripts/migrate.js: pg builds its own ssl config from a `sslmode` in
 *  the URL and that one wins, CA and all. Strip it and keep ours. */
function stripSslMode(url) {
  try {
    const u = new URL(url);
    if (!u.searchParams.has('sslmode')) return url;
    u.searchParams.delete('sslmode');
    return u.toString();
  } catch { return url; }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('DATABASE_URL is not set.'); process.exit(1); }
  if (!process.env.OPENAI_API_KEY && !DRY_RUN) {
    console.error('OPENAI_API_KEY is not set — every row would be skipped. Stopping.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: stripSslMode(url), ssl: sslFor(url) });
  const q = (text, params) => pool.query(text, params);

  const where = [];
  const params = [];
  if (!FORCE) where.push('content_hi IS NULL');
  if (ONLY) { params.push(ONLY); where.push(`slug = ANY($${params.length})`); }
  const sql = `SELECT * FROM services${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY slug`;

  const { rows } = await q(sql, params);
  console.log(`[hindi] ${rows.length} service row(s) to process${DRY_RUN ? ' (dry run)' : ''}`);
  if (!rows.length) { await pool.end(); return; }

  let done = 0; let skipped = 0;
  for (const row of rows) {
    if (DRY_RUN) { console.log(`  would translate  ${row.slug}`); continue; }
    try {
      // force: the stored Hindi is absent or known-wrong, which no
      // fingerprint comparison can work out on its own.
      const result = await refreshHindiContent(q, {
        kind: 'service', table: 'services', key: row.slug, row, force: true,
      });
      if (result) { done += 1; console.log(`  ok     ${row.slug}`); }
      else { skipped += 1; console.log(`  SKIPPED ${row.slug} (translator returned nothing; left as it was)`); }
    } catch (err) {
      skipped += 1;
      console.log(`  FAILED ${row.slug}: ${err.message}`);
    }
  }
  console.log(`[hindi] translated ${done}, left alone ${skipped}`);
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
