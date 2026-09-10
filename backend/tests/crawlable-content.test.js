/**
 * backend/src/utils/crawlableContent.js + the SEO additions that go with it.
 *
 * What these lock down is the promise the whole thing rests on: the text a
 * crawler reads is the text the database holds — never invented, never a
 * keyword list, and never able to break the document it is injected into.
 *
 * Pure functions only: no DB, no network, no server.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ADMIN_SECRET_PATH = process.env.ADMIN_SECRET_PATH || 'test-admin';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://user@localhost/db';
process.env.PUBLIC_SITE_URL = 'https://www.panditsuggest.com';

const { serviceArticle, pageArticle, noscriptBlock } = require('../src/utils/crawlableContent');
const { injectCrawlableContent } = require('../src/utils/htmlInject');
const seoMeta = require('../src/utils/seoMeta');

const SERVICE = {
  slug: 'court-case-vijay-baglamukhi-puja',
  name: 'Court Case Vijay Puja',
  short_description: 'For devotees facing a court case or a false allegation.',
  desc: 'A purpose-based Maa Baglamukhi ritual performed with sankalp and havan.',
  dur: '2-4 hours',
  recommended_muhurat: 'Chosen with the officiating pandit.',
  is_online_available: true,
  online_note: 'Live sankalp participation is available.',
  benefits: [{ title: 'Legal-pressure support', detail: 'Sought for inner steadiness.' }],
  process: [
    { title: 'Case Sankalp', detail: 'Your name & gotra are recorded.' },
    { title: 'Court Case Havan', detail: 'Ahutis are offered into the fire.' },
  ],
  samagri: [{ item: 'Yellow cloth', qty: '1' }, { item: 'Ghee', qty: '250-500 ml' }],
  faqs: [{ q: 'Does this puja guarantee I win?', a: 'No. Outcomes depend on facts and law.' }],
};

test('serviceArticle — the page\'s own words, safely', async (t) => {
  await t.test('carries every section a devotee reads on the page', () => {
    const html = serviceArticle(SERVICE);
    for (const needle of [
      '<h1>Court Case Vijay Puja</h1>',
      'For devotees facing a court case',
      'A purpose-based Maa Baglamukhi ritual',
      'Legal-pressure support',
      'Case Sankalp',
      'Yellow cloth',
      'Does this puja guarantee I win?',
      'No. Outcomes depend on facts and law.',
      '2-4 hours',
    ]) {
      assert.ok(html.includes(needle), `missing from the crawlable article: ${needle}`);
    }
  });

  await t.test('the vidhi is an ordered list, the FAQ a definition list', () => {
    const html = serviceArticle(SERVICE);
    assert.match(html, /<h2>Puja vidhi[^<]*<\/h2><ol>/);
    assert.match(html, /<h2>Frequently asked questions<\/h2><dl>/);
  });

  await t.test('admin-typed markup cannot break out of the document', () => {
    const hostile = {
      ...SERVICE,
      name: 'Puja </article><script>alert(1)</script>',
      faqs: [{ q: 'Is "this" & that ok?', a: '</noscript><img src=x onerror=alert(1)>' }],
    };
    const html = serviceArticle(hostile);
    assert.ok(!html.includes('<script>'), 'a script tag survived escaping');
    assert.ok(!html.includes('</noscript>'), 'a noscript close survived escaping');
    assert.ok(!html.includes('<img'), 'an img tag survived escaping');
    assert.ok(html.includes('&lt;script&gt;'), 'the text itself should still be readable, escaped');
  });

  await t.test('omits sections the service genuinely has nothing for', () => {
    const bare = { slug: 'x', name: 'Bare Puja', short_description: 'A short line.' };
    const html = serviceArticle(bare);
    assert.ok(html.includes('<h1>Bare Puja</h1>'));
    assert.ok(!html.includes('<h2>Benefits</h2>'), 'an empty benefits heading was emitted');
    assert.ok(!html.includes('<h2>Samagri</h2>'), 'an empty samagri heading was emitted');
  });

  await t.test('an online note only appears when the ritual is actually offered online', () => {
    assert.ok(serviceArticle(SERVICE).includes('Live sankalp participation'));
    const offline = { ...SERVICE, is_online_available: false };
    assert.ok(!serviceArticle(offline).includes('Live sankalp participation'));
  });
});

test('noscript injection', async (t) => {
  await t.test('lands before </body>, outside the React root', () => {
    const shell = '<!doctype html><html><head></head><body><div id="root"></div></body></html>';
    const out = injectCrawlableContent(shell, noscriptBlock(serviceArticle(SERVICE)));
    assert.ok(out.includes('<div id="root"></div><noscript>'), 'must sit after #root, not inside it');
    assert.ok(out.endsWith('</noscript>\n</body></html>'), `unexpected tail: ${out.slice(-60)}`);
  });

  await t.test('an empty article changes nothing', () => {
    const shell = '<html><body></body></html>';
    assert.equal(injectCrawlableContent(shell, noscriptBlock('')), shell);
  });
});

test('service structured data', async (t) => {
  const nodes = seoMeta.serviceMeta(SERVICE).structuredData;
  const byType = (t2) => nodes.find((n) => n['@type'] === t2);

  await t.test('describes the vidhi and its samagri as a HowTo', () => {
    const howTo = byType('HowTo');
    assert.ok(howTo, 'no HowTo node');
    assert.equal(howTo.step.length, 2);
    assert.equal(howTo.step[0].name, 'Case Sankalp');
    assert.equal(howTo.supply.length, 2);
    assert.equal(howTo.supply[0].name, 'Yellow cloth');
  });

  await t.test('totalTime is a valid ISO-8601 duration, or absent', () => {
    assert.equal(byType('HowTo').totalTime, 'PT4H');
    const vague = seoMeta.serviceMeta({ ...SERVICE, dur: 'as advised by the pandit' });
    assert.equal(
      vague.structuredData.find((n) => n['@type'] === 'HowTo').totalTime,
      undefined,
      'unparseable wording must be omitted, never asserted as-is',
    );
  });

  await t.test('claims an online channel only when the admin ticked it', () => {
    assert.ok(byType('Service').availableChannel, 'online service should declare a channel');
    const offline = seoMeta.serviceMeta({ ...SERVICE, is_online_available: false });
    assert.equal(
      offline.structuredData.find((n) => n['@type'] === 'Service').availableChannel,
      undefined,
    );
  });

  await t.test('a service with no vidhi emits no empty HowTo', () => {
    const bare = seoMeta.serviceMeta({ slug: 'x', name: 'Bare', short_description: 'x', process: [] });
    assert.equal(bare.structuredData.find((n) => n['@type'] === 'HowTo'), undefined);
  });
});

test('/online-havan — the page that had no server-side SEO at all', async (t) => {
  const meta = seoMeta.onlineHavanMeta();

  await t.test('has the metadata every indexable page needs', () => {
    assert.ok(meta.title && meta.description);
    assert.equal(meta.canonicalPath, '/online-havan');
    assert.ok(!meta.noindex);
  });

  await t.test('publishes its FAQs as a FAQPage', () => {
    const faq = meta.structuredData.find((n) => n['@type'] === 'FAQPage');
    assert.ok(faq, 'no FAQPage node');
    assert.ok(faq.mainEntity.length >= 10, `only ${faq.mainEntity.length} questions`);
    for (const q of faq.mainEntity) {
      assert.ok(q.name.trim(), 'a question with no text');
      assert.ok(q.acceptedAnswer.text.trim(), `no answer for: ${q.name}`);
    }
  });

  await t.test('its article carries the real page copy, not a summary', () => {
    const OH = require('../src/data/onlineHavanContent');
    const html = pageArticle({
      h1: OH.H1, intro: OH.INTRO,
      sections: [
        { heading: 'How an online havan is arranged, step by step', items: OH.JOURNEY, ordered: true },
        { heading: 'What reaches you afterwards', items: OH.DELIVERABLES },
      ],
      faqs: OH.FAQS,
    });
    assert.ok(html.includes(OH.JOURNEY[0].title), 'first journey step missing');
    assert.ok(html.includes(OH.FAQS[0].q), 'first FAQ missing');
    assert.ok(html.length > 4000, `article is only ${html.length} chars — too thin to be the page`);
  });

  await t.test('the FAQs it publishes are the FAQs it shows', () => {
    const OH = require('../src/data/onlineHavanContent');
    const published = meta.structuredData.find((n) => n['@type'] === 'FAQPage')
      .mainEntity.map((q) => q.name);
    assert.deepEqual(published, OH.FAQS.map((f) => f.q));
  });
});
