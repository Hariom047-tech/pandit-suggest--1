/**
 * services/ai/intent.service.js — the deterministic half of query
 * understanding. Pure: no database, no network, so this runs anywhere.
 *
 *   node --test tests/ai-intent.test.js
 *
 * Every case here is one that was wrong in production on 2026-09-16.
 */

const test = require('node:test');
const assert = require('node:assert');

const { extractIntent, isGreetingOnly } = require('../src/services/ai/intent.service');

/** The real taxonomy rows these bugs were found against. */
const VOCAB = {
  temples: [], cities: [], states: [], deities: [],
  categories: [
    { slug: 'santan-issues', examplePhrases: ['Bachha nahi ho raha hai', 'Pregnancy mein complications aa rahi hain'] },
    { slug: 'business-loss', examplePhrases: ['Business mein bahut loss ho raha hai', 'Dukaan par customer nahi aa rahe'] },
    { slug: 'ghar-mein-kalesh', examplePhrases: ['Ghar mein hamesha ladai hoti hai', 'Ghar mein shanti nahi hai', 'Roz kalesh rehta hai'] },
    { slug: 'family-illness', examplePhrases: ['Ghar mein koi na koi beemar rehta hai', 'Ghar beemar rehta'] },
  ],
};

const intentOf = (msg, memory = {}) => extractIntent(msg, VOCAB, memory);

/* ── category pre-filter ──────────────────────────────────────────────── */

test('a business problem is not classified as a children problem', () => {
  /*
   * The original scorer counted every word over 3 characters and used
   * substring matching, so Hinglish filler decided the category:
   *   santan-issues "Bachha nahi ho raha hai"  -> nahi + raha  = 0.67  (won)
   *   business-loss "Business mein bahut loss..." -> business + loss + raha = 0.60
   * A business query came back as santan-issues, live.
   */
  assert.strictEqual(
    intentOf('mere business me kaam acha nahi chal raha loss ho raha hai').problemCategory,
    'business-loss',
  );
});

test('filler-only overlap does not pick a category at all', () => {
  // "nahi", "raha", "hai" are in almost every sentence and identify nothing.
  assert.strictEqual(intentOf('pata nahi kya ho raha hai').problemCategory, null);
});

test('a near-verbatim example phrase still matches its category', () => {
  assert.strictEqual(intentOf('ghar mein hamesha ladai hoti hai').problemCategory, 'ghar-mein-kalesh');
});

test('a tie is broken by the more distinctive word, not by row order', () => {
  /*
   * "ghar me kalesh h" scored exactly 0.5 against both ghar-mein-kalesh
   * ("Roz kalesh rehta hai" — matched kalesh of kalesh+rehta) and
   * family-illness ("Ghar beemar rehta" — matched ghar). Whichever row the
   * database returned first won, and live that was family-illness: a
   * household-conflict question was answered about recurring illness, and
   * matched to the services for it. "kalesh" is the longer, more distinctive
   * match and must win.
   */
  assert.strictEqual(intentOf('ghar me kalesh h').problemCategory, 'ghar-mein-kalesh');
});

/* ── explicit request vs description ──────────────────────────────────── */

test('"acha" in a problem description is not a request for pandit cards', () => {
  // 'acha' was listed as a request keyword for "koi acha pandit batao", and
  // fired on ordinary descriptions — skipping the offer step and pushing
  // cards at someone who had just described a loss.
  assert.strictEqual(intentOf('mere business me kaam acha nahi chal raha').wantsRecommendations, false);
  assert.strictEqual(intentOf('ghar ka mahol acha nahi hai').wantsRecommendations, false);
});

test('an actual request for a pandit is still recognised', () => {
  for (const m of ['koi acha pandit batao', 'best pandit ji suggest kro', 'pandit dikhao']) {
    assert.strictEqual(intentOf(m).wantsRecommendations, true, m);
  }
});

/* ── greeting ─────────────────────────────────────────────────────────── */

test('a bare greeting is recognised, in several registers', () => {
  for (const m of ['hi', 'hello', 'Hello!', 'namaste', 'namaste ji', 'jai mata di',
    'ram ram', 'radhe radhe', 'good morning', 'pranam']) {
    assert.strictEqual(isGreetingOnly(m), true, m);
  }
});

test('a greeting that carries a problem is NOT a bare greeting', () => {
  // These must reach the normal pipeline, not the canned welcome.
  for (const m of ['namaste, business me dikkat hai', 'hello I need a pandit for griha pravesh',
    'jai mata di, ghar me kalesh rehta hai']) {
    assert.strictEqual(isGreetingOnly(m), false, m);
  }
});

test('an Indic greeting is answered in Hinglish, not English', () => {
  // detectLanguage() counts Hinglish marker words; "jai mata di" has none, so
  // the welcome came back in English. The greeting itself is the signal.
  for (const m of ['namaste', 'jai mata di', 'radhe radhe', 'pranam']) {
    assert.strictEqual(intentOf(m).language, 'hinglish', m);
  }
  assert.strictEqual(intentOf('hello').language, 'en');
});

/* ── affirmative, the consent step ────────────────────────────────────── */

test('a plain yes is consent; a sentence is not', () => {
  for (const m of ['haan', 'ha', 'ji', 'yes', 'ok', 'bilkul', 'haan batao']) {
    assert.strictEqual(intentOf(m).isAffirmative, true, m);
  }
  assert.strictEqual(intentOf('haan lekin pehle ye batao ki kitna kharcha hoga').isAffirmative, false);
});
