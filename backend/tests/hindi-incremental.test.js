/**
 * backend/src/services/hindiContent.service.js — the rule that decides whether
 * an admin's save costs an OpenAI call.
 *
 * Worth locking down because getting it wrong is invisible in the UI and
 * expensive in two different ways. Before this logic existed EVERY save
 * re-translated the whole record: swapping a service photo, ticking a
 * checkbox, or nudging a homepage position each paid for a full translation
 * of the name, overview, benefits, vidhi, samagri and FAQs — and replaced the
 * stored Hindi, including any wording an admin had corrected by hand, with a
 * fresh machine attempt.
 *
 * No DB and no network: `q` is a fake one-row table and the translator is
 * stubbed, so the assertions are about WHICH fields were asked for, never
 * about the Hindi itself.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');

const TRANSLATION = require.resolve('../src/services/translation.service');
const HINDI = require.resolve('../src/services/hindiContent.service');

/**
 * Replaces translateToHindi with a recorder. sourceFingerprints and
 * CONTENT_SPECS are kept real — they are the part under test.
 */
function stubTranslator() {
  const real = require(TRANSLATION);
  const calls = [];
  const state = { failNext: false };
  const stub = {
    ...real,
    translateToHindi: async (kind, content, options = {}) => {
      calls.push([...(options.only || [])].sort());
      if (state.failNext) { state.failNext = false; return null; }
      const out = {};
      for (const key of options.only) {
        const v = content[key];
        if (typeof v === 'string') out[key] = `हिं<${v}>`;
        else if (Array.isArray(v)) {
          out[key] = v.map((x) => (typeof x === 'string' ? 'हिं' : { ...x, title: 'हिं', q: 'हिं', item: 'हिं', name: 'हिं' }));
        }
      }
      return { ...out, translatedAt: new Date().toISOString(), model: 'stub-model' };
    },
  };
  const mod = new Module(TRANSLATION, null);
  mod.exports = stub;
  mod.loaded = true;
  mod.filename = TRANSLATION;
  mod.paths = Module._nodeModulePaths(path.dirname(TRANSLATION));
  require.cache[TRANSLATION] = mod;

  delete require.cache[HINDI];
  const { refreshHindiContent } = require(HINDI);
  return { calls, state, refreshHindiContent };
}

/** A fake single-row table for whichever content kind the test is using. */
function fakeTable(initial = null) {
  const box = { value: initial };
  const q = async (sql, params) => {
    if (/^SELECT content_hi/.test(sql)) return { rows: [{ content_hi: box.value }] };
    if (/^UPDATE/.test(sql)) { box.value = params[1] ? JSON.parse(params[1]) : null; return { rows: [] }; }
    throw new Error(`unexpected SQL in test: ${sql}`);
  };
  return { q, box };
}

const SERVICE_ROW = {
  slug: 'demo',
  name: 'Court Case Vijay Puja',
  short_description: 'For devotees facing a court case.',
  description: 'A purpose-based Maa Baglamukhi ritual.',
  estimated_duration: '2-4 hours',
  recommended_muhurat: null,
  online_note: null,
  benefits: [{ title: 'Protection', detail: 'Sought for steadiness.' }],
  process: [{ title: 'Sankalp', detail: 'The intention is recorded.' }],
  faqs: [{ q: 'Is it guaranteed?', a: 'No.' }],
  samagri_list: [{ item: 'Yellow cloth', qty: '1' }],
};

test('refreshHindiContent — only re-translates what actually changed', async (t) => {
  const { calls, state, refreshHindiContent } = stubTranslator();
  const { q, box } = fakeTable();
  let row = { ...SERVICE_ROW };
  const save = (explicit) => refreshHindiContent(q, {
    kind: 'service', table: 'services', key: 'demo', row, explicit,
  });

  await t.test('the first save translates every field that has English', async () => {
    calls.length = 0;
    await save();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].length, 8, `asked for: ${calls[0]}`);
    assert.equal(Object.keys(box.value._source).length, 8);
  });

  await t.test('changing only an image, a flag or a position costs nothing', async () => {
    const before = JSON.stringify(box.value);
    calls.length = 0;
    row = { ...row, image_url: 'https://cdn/new.webp', display_order: 5, is_popular: true };
    await save();
    assert.equal(calls.length, 0, 'the model must not be called');
    assert.equal(JSON.stringify(box.value), before, 'stored Hindi must be byte-identical');
  });

  await t.test('Hindi corrected by hand survives an unrelated save', async () => {
    box.value = { ...box.value, name: 'मेरा अपना अनुवाद' };
    calls.length = 0;
    row = { ...row, is_popular: false };
    await save();
    assert.equal(calls.length, 0);
    assert.equal(box.value.name, 'मेरा अपना अनुवाद');
  });

  await t.test('editing one paragraph re-translates that paragraph and nothing else', async () => {
    calls.length = 0;
    row = { ...row, description: 'A rewritten overview.' };
    await save();
    assert.deepEqual(calls, [['description']]);
    assert.equal(box.value.description, 'हिं<A rewritten overview.>');
    assert.equal(box.value.name, 'मेरा अपना अनुवाद', 'untouched field keeps its Hindi');
  });

  await t.test('editing one FAQ re-translates only the FAQ list', async () => {
    calls.length = 0;
    row = { ...row, faqs: [{ q: 'Is it guaranteed?', a: 'No, never.' }] };
    await save();
    assert.deepEqual(calls, [['faqs']]);
  });

  await t.test('an explicit human contentHi still bypasses the model', async () => {
    calls.length = 0;
    await save({ name: 'पूरी तरह हाथ से लिखा' });
    assert.equal(calls.length, 0);
    assert.equal(box.value.name, 'पूरी तरह हाथ से लिखा');
  });

  await t.test('one failed field falls back to English without harming the rest', async () => {
    box.value = null;
    row = { ...SERVICE_ROW };
    await save();
    const goodShort = box.value.shortDescription;

    calls.length = 0;
    state.failNext = true;
    row = { ...row, description: 'A rewrite the model chokes on.' };
    await save();
    assert.equal(box.value.description, undefined, 'bad field is dropped, not stored stale');
    assert.equal(box.value.shortDescription, goodShort, 'good fields are untouched');
    assert.equal(box.value._source.description, undefined, 'and it is left marked as outstanding');

    calls.length = 0;
    await save();
    assert.deepEqual(calls, [['description']], 'so the next save retries just that field');
  });

  await t.test('clearing the English clears the Hindi that described it', async () => {
    calls.length = 0;
    row = { ...row, estimated_duration: '' };
    await save();
    assert.equal(box.value.estimatedDuration, undefined);
    assert.equal(box.value._source.estimatedDuration, undefined);
  });
});

test('refreshHindiContent — records translated before fingerprints existed', async (t) => {
  const { calls, refreshHindiContent } = stubTranslator();
  const { q, box } = fakeTable();
  const row = { ...SERVICE_ROW };
  const save = () => refreshHindiContent(q, { kind: 'service', table: 'services', key: 'demo', row });

  await save();
  const legacy = { ...box.value };
  delete legacy._source;              // exactly how every row looked before this change

  await t.test('their Hindi is trusted, not re-translated', async () => {
    box.value = { ...legacy };
    calls.length = 0;
    await save();
    assert.equal(calls.length, 0, 'a legacy row must not be re-translated on sight');
    assert.equal(Object.keys(box.value._source).length, 8, 'it just gains fingerprints');

    calls.length = 0;
    await save();
    assert.equal(calls.length, 0, 'and every save after that stays free');
  });

  await t.test('but a field they are missing Hindi for is filled in', async () => {
    const partial = { ...legacy };
    delete partial.description;
    box.value = partial;
    calls.length = 0;
    await save();
    assert.deepEqual(calls, [['description']]);
  });
});

test('refreshHindiContent — the same rule covers pandits and temples', async (t) => {
  const { calls, refreshHindiContent } = stubTranslator();

  await t.test('a temple photo change costs nothing; editing highlights redoes only highlights', async () => {
    const { q } = fakeTable();
    let row = {
      id: 't1', name: 'Baglamukhi Mandir', description: 'An old temple.', city: 'Nalkheda',
      highlights: ['Ancient shrine', 'Riverside'],
      custom_services: [{ name: 'Abhishek', description: 'Performed daily.' }],
    };
    const save = () => refreshHindiContent(q, { kind: 'temple', table: 'temples', key: 't1', row });

    await save();
    calls.length = 0;
    row = { ...row, cover_image_url: 'new.webp' };
    await save();
    assert.equal(calls.length, 0);

    calls.length = 0;
    row = { ...row, highlights: ['Ancient shrine', 'Riverside', 'New ghat'] };
    await save();
    assert.deepEqual(calls, [['highlights']]);
  });

  await t.test("a pandit's new photo or tier costs nothing", async () => {
    const { q } = fakeTable();
    let row = { id: 'p1', name: 'Acharya Ankit', bio: 'Twenty years of seva.', city: 'Ujjain' };
    const save = () => refreshHindiContent(q, { kind: 'pandit', table: 'pandits', key: 'p1', row });

    await save();
    calls.length = 0;
    row = { ...row, profile_photo_url: 'new.jpg', current_tier: 'gold' };
    await save();
    assert.equal(calls.length, 0);
  });
});
