#!/usr/bin/env node
/**
 * Seeds the two tables that connect a devotee's PROBLEM to a real PanditSuggest
 * SERVICE, and therefore to a pandit.
 *
 * Why this exists: `matchServices()` (services/ai/matching.service.js) reads
 * `ai_problem_service_mappings` and nothing else. With that table empty it
 * returns `gapType: 'no_service'` on its first line, so no service card and
 * therefore NO PANDIT CARD can ever be shown, however well the knowledge base
 * retrieves and however good the model's answer is. It was empty in production
 * while all 43 categories and the whole AI pipeline were already live.
 *
 * It also fills `ai_problem_categories.example_phrases`, which is what
 * intent.service.js's cheap category pre-filter matches against. 13 of 43
 * categories had none at all and could never be pre-matched.
 *
 * Both are authored here rather than derived from the knowledge JSON, because
 * the JSON's own `connectToPandit.serviceId` values (`lakshmi_kubera_puja`,
 * `navagraha_shanti`) are invented slugs that match nothing in the catalogue
 * (`lakshmi-dhan-prapti-baglamukhi-puja`, `navgraha-shanti-puja`). Deriving
 * from them would silently map nothing.
 *
 *   node scripts/seed-ai-mappings.js              dry run
 *   node scripts/seed-ai-mappings.js --execute
 *
 * Idempotent: mappings are keyed on (problem_category_id, service_id) and
 * re-running updates relevance in place. A service slug that does not exist is
 * reported and skipped, never guessed at.
 */
require('dotenv').config();
const { query, pool } = require('../src/config/db');

/**
 * problem-category slug -> [[service slug, relevance]]
 *
 * Relevance is "how squarely does this ritual answer THIS intention", not
 * price and not popularity. 1.0 is the service the catalogue plainly exists to
 * answer that problem with; 0.7-0.9 are honest alternatives a devotee may
 * prefer on their own aastha.
 *
 * Group categories (business, health, marriage...) are mapped as well as leaf
 * ones, because chunker.js tags every problem chunk with BOTH its leaf slug
 * and its group — so retrieval can infer either.
 *
 * Deliberately NOT mapped: mundan-sanskar and bachche-ki-padhai. The catalogue
 * has no mundan sanskar and no Saraswati/vidya service, and inventing a
 * near-miss ("book a Satyanarayan katha for your child's exams") is worse than
 * the honest "yeh seva abhi PanditSuggest par available nahi hai" that
 * gapNote() already says. Add them here the day those services exist.
 */
const MAP = {
  // ── livelihood ──────────────────────────────────────────────────────────
  business:            [['business-growth-baglamukhi-puja', 0.90], ['lakshmi-dhan-prapti-baglamukhi-puja', 0.80]],
  'business-loss':     [['business-growth-baglamukhi-puja', 1.00], ['lakshmi-dhan-prapti-baglamukhi-puja', 0.90], ['ganesh-puja-vighnaharta', 0.70]],
  'business-opening':  [['ganesh-puja-vighnaharta', 1.00], ['lakshmi-dhan-prapti-baglamukhi-puja', 0.80], ['satyanarayan-katha-puja', 0.70]],
  'business-enemies':  [['shatru-stambhan-baglamukhi-puja', 1.00], ['sarva-badha-nivaran-baglamukhi-puja', 0.80]],
  // No `finance` entry: problems-solutions.json groups business-loss and
  // debt-rin under "finance", but ai_problem_categories has no such row — the
  // taxonomy's money categories are the two leaves below, and chunker.js tags
  // every chunk with its leaf slug as well as its group, so the leaves carry it.
  'debt-rin':          [['rin-mukti-puja', 1.00], ['lakshmi-dhan-prapti-baglamukhi-puja', 0.80]],

  // ── work ────────────────────────────────────────────────────────────────
  career:              [['career-job-success-baglamukhi-puja', 1.00], ['navgraha-shanti-puja', 0.80]],
  'job-problems':      [['career-job-success-baglamukhi-puja', 1.00], ['navgraha-shanti-puja', 0.80]],
  'promotion-issues':  [['career-job-success-baglamukhi-puja', 1.00], ['navgraha-shanti-puja', 0.70]],
  'political-success': [['rajneeti-vijay-baglamukhi-puja', 1.00]],

  // ── disputes ────────────────────────────────────────────────────────────
  legal:               [['court-case-vijay-baglamukhi-puja', 1.00], ['shatru-stambhan-baglamukhi-puja', 0.80]],
  'court-case':        [['court-case-vijay-baglamukhi-puja', 1.00], ['shatru-stambhan-baglamukhi-puja', 0.80]],
  enemies:             [['shatru-stambhan-baglamukhi-puja', 1.00], ['sarva-badha-nivaran-baglamukhi-puja', 0.80]],

  // ── home and family ─────────────────────────────────────────────────────
  family:              [['navgraha-shanti-puja', 0.90], ['rudrabhishek-puja', 0.80], ['vastu-shanti-puja', 0.70]],
  'ghar-mein-kalesh':  [['navgraha-shanti-puja', 0.90], ['rudrabhishek-puja', 0.80], ['vastu-shanti-puja', 0.70]],
  property:            [['vastu-shanti-puja', 1.00], ['griha-pravesh-puja', 0.80]],
  'vastu-dosh':        [['vastu-shanti-puja', 1.00]],
  'griha-pravesh':     [['griha-pravesh-puja', 1.00], ['vastu-shanti-puja', 0.80]],

  // ── marriage ────────────────────────────────────────────────────────────
  marriage:                 [['vivah-badha-nivaran-baglamukhi-puja', 1.00], ['mangal-dosh-nivaran-puja', 0.80]],
  'marriage-delays':        [['vivah-badha-nivaran-baglamukhi-puja', 1.00], ['mangal-dosh-nivaran-puja', 0.80]],
  'shaadi-problems':        [['vivah-badha-nivaran-baglamukhi-puja', 0.90], ['navgraha-shanti-puja', 0.70]],
  'post-marriage-problems': [['navgraha-shanti-puja', 0.80], ['rudrabhishek-puja', 0.70]],

  // ── children ────────────────────────────────────────────────────────────
  children:            [['santan-gopal-puja', 1.00]],
  'santan-issues':     [['santan-gopal-puja', 1.00]],
  'pregnancy-issues':  [['santan-gopal-puja', 0.90], ['maha-mrityunjaya-havan', 0.70]],

  // ── health ──────────────────────────────────────────────────────────────
  health:              [['maha-mrityunjaya-havan', 1.00], ['rog-nashak-baglamukhi-puja', 0.90]],
  'health-issues':     [['maha-mrityunjaya-havan', 1.00], ['rog-nashak-baglamukhi-puja', 0.90]],
  'family-illness':    [['maha-mrityunjaya-havan', 1.00], ['rog-nashak-baglamukhi-puja', 0.80]],
  'body-pain':         [['rog-nashak-baglamukhi-puja', 0.90], ['maha-mrityunjaya-havan', 0.80]],
  insomnia:            [['rudrabhishek-puja', 0.90]],
  'depression-stress': [['rudrabhishek-puja', 0.90], ['maha-mrityunjaya-havan', 0.70]],
  'repeated-accidents':[['maha-mrityunjaya-havan', 1.00], ['rahu-ketu-shanti-puja', 0.70]],

  // ── graha / dosh ────────────────────────────────────────────────────────
  planetary:           [['navgraha-shanti-puja', 1.00], ['rahu-ketu-shanti-puja', 0.80]],
  'shani-dosh':        [['shani-shanti-puja', 1.00], ['navgraha-shanti-puja', 0.80]],
  'kaal-sarpa-dosh':   [['kaal-sarp-dosh-nivaran-puja', 1.00], ['rahu-ketu-shanti-puja', 0.80]],
  'manglik-dosh':      [['mangal-dosh-nivaran-puja', 1.00]],
  ancestors:           [['pitra-dosh-nivaran-puja', 1.00]],
  'pitru-dosh':        [['pitra-dosh-nivaran-puja', 1.00]],

  // ── protection ──────────────────────────────────────────────────────────
  spiritual:           [['sarva-badha-nivaran-baglamukhi-puja', 0.90], ['maa-baglamukhi-havan', 0.70]],
  'nazar-evil-eye':    [['sarva-badha-nivaran-baglamukhi-puja', 1.00], ['navchandi-havan', 0.80]],
  'bhoot-pret':        [['navchandi-havan', 0.90], ['sarva-badha-nivaran-baglamukhi-puja', 0.90]],
};

/** Why this ritual is offered for this intention. Shown to no one directly —
 *  it is the `reason` column the matcher carries for auditability. */
const REASON = 'Curated mapping: this service is what the PanditSuggest catalogue offers for this intention.';

async function main() {
  const execute = process.argv.includes('--execute');
  console.log(execute ? 'EXECUTE\n' : 'DRY RUN — pass --execute to write\n');

  const cats = new Map((await query('SELECT id, slug FROM ai_problem_categories')).rows.map((r) => [r.slug, r.id]));
  const svcs = new Map((await query('SELECT id, slug FROM services WHERE is_active = TRUE')).rows.map((r) => [r.slug, r.id]));

  /* ── 1 · problem -> service ──────────────────────────────────────────── */
  let pairs = 0; const missingCat = []; const missingSvc = new Set();
  const rows = [];
  for (const [catSlug, list] of Object.entries(MAP)) {
    const catId = cats.get(catSlug);
    if (!catId) { missingCat.push(catSlug); continue; }
    for (const [svcSlug, rel] of list) {
      const svcId = svcs.get(svcSlug);
      if (!svcId) { missingSvc.add(svcSlug); continue; }
      rows.push([catId, svcId, rel]); pairs += 1;
    }
  }
  console.log(`mappings to write: ${pairs} across ${Object.keys(MAP).length} categories`);
  if (missingCat.length) console.log('  unknown category slugs (skipped):', missingCat.join(', '));
  if (missingSvc.size)  console.log('  unknown service slugs (skipped):', [...missingSvc].join(', '));

  /* ── 2 · example phrases from the knowledge corpus ───────────────────── */
  // userMightSay is exactly "what a devotee actually types", which is what the
  // pre-filter needs. Written to the LEAF category (the record id).
  const problems = require('../src/data/knowledge/custom/problems-solutions.json');
  const phrases = problems
    .filter((p) => cats.has(p.id) && Array.isArray(p.userMightSay) && p.userMightSay.length)
    .map((p) => [cats.get(p.id), p.userMightSay]);
  console.log(`example_phrases to write: ${phrases.length} categories`);

  if (!execute) { console.log('\nNothing written.'); await pool.end(); return; }

  /*
   * Delete-then-insert, NOT an upsert.
   *
   * The table's unique index is (problem_category_id, service_id, temple_id),
   * and every row here has temple_id NULL. In Postgres NULL is never equal to
   * NULL, so ON CONFLICT on that triple infers an arbiter that can never
   * match — re-running would quietly insert a second copy of all 76 rows
   * rather than updating them.
   *
   * Scoped by `reason` so this only ever clears rows THIS script wrote. A
   * mapping an admin curated by hand has a different reason and survives.
   */
  const removed = await query(
    'DELETE FROM ai_problem_service_mappings WHERE reason = $1 AND temple_id IS NULL', [REASON],
  );
  if (removed.rowCount) console.log(`  replaced ${removed.rowCount} previously-seeded rows`);

  for (const [catId, svcId, rel] of rows) {
    await query(
      `INSERT INTO ai_problem_service_mappings (problem_category_id, service_id, relevance_score, reason, status)
            VALUES ($1, $2, $3, $4, 'published')`,
      [catId, svcId, rel, REASON],
    );
  }
  for (const [catId, list] of phrases) {
    await query('UPDATE ai_problem_categories SET example_phrases = $2 WHERE id = $1',
      [catId, JSON.stringify(list)]);
  }

  const n = await query("SELECT COUNT(*)::int n FROM ai_problem_service_mappings WHERE status='published'");
  console.log(`\ndone — ${n.rows[0].n} published mappings in place`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
