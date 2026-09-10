/**
 * The page's real words, in the HTML, before any JavaScript runs.
 *
 * Why this exists
 * ---------------
 * The frontend is a client-rendered SPA (docs/SEO_ARCHITECTURE.md §1): every
 * URL ships `<div id="root"></div>` and nothing else. Phase 7 closed half the
 * gap by injecting title/description/OG/JSON-LD into `<head>`, but the BODY
 * stayed empty — so a crawler that does not execute JavaScript could read what
 * a service page is *called* and never a word of what it actually *says*: not
 * the overview, not the benefits, not the vidhi, not the samagri, not the FAQ
 * answers.
 *
 * Googlebot does render JavaScript and eventually sees all of it. Plenty of
 * other things that send traffic do not: Bing, DuckDuckGo, the assistant
 * crawlers that increasingly answer "which puja for a court case", and every
 * link-preview unfurler. For those, this block is the page.
 *
 * Not cloaking
 * ------------
 * `<noscript>` is the honest container: what is written here is the same text
 * React renders from the same database row moments later, never a keyword list
 * or a description of a page that does not exist. It is served identically to
 * every visitor and every crawler — there is no user-agent branch anywhere in
 * this file or its callers. A reader with JavaScript never sees it, which is
 * exactly what `<noscript>` means, and a reader without it gets the article
 * instead of a blank page.
 *
 * Everything is escaped on the way in: this content is admin-authored, and an
 * apostrophe in a FAQ answer or a "<" in a samagri note must not be able to
 * break the document.
 */

const { esc } = require('./htmlInject');

/** A heading plus its section, or '' when the section has nothing in it. */
function section(heading, body) {
  return body ? `<h2>${esc(heading)}</h2>${body}` : '';
}

/** `[{title, detail}]` -> a list where the title leads and the detail follows. */
function titledList(rows, { ordered = false, titleKey = 'title', detailKey = 'detail' } = {}) {
  if (!Array.isArray(rows) || !rows.length) return '';
  const items = rows.map((row) => {
    const title = String(row?.[titleKey] ?? '').trim();
    const detail = String(row?.[detailKey] ?? '').trim();
    if (!title && !detail) return '';
    if (!title) return `<li>${esc(detail)}</li>`;
    return `<li><strong>${esc(title)}</strong>${detail ? ` — ${esc(detail)}` : ''}</li>`;
  }).filter(Boolean);
  if (!items.length) return '';
  const tag = ordered ? 'ol' : 'ul';
  return `<${tag}>${items.join('')}</${tag}>`;
}

/** FAQs as a description list — the markup a question/answer pair actually is. */
function faqList(faqs) {
  if (!Array.isArray(faqs) || !faqs.length) return '';
  const items = faqs.map((f) => {
    const q = String(f?.q ?? '').trim();
    const a = String(f?.a ?? '').trim();
    if (!q) return '';
    return `<dt>${esc(q)}</dt><dd>${esc(a)}</dd>`;
  }).filter(Boolean);
  return items.length ? `<dl>${items.join('')}</dl>` : '';
}

/** "Duration: 2-4 hours" style facts, skipping the ones this row doesn't have. */
function factList(facts) {
  const items = Object.entries(facts)
    .filter(([, v]) => typeof v === 'string' && v.trim())
    .map(([label, v]) => `<li><strong>${esc(label)}</strong>: ${esc(v.trim())}</li>`);
  return items.length ? `<ul>${items.join('')}</ul>` : '';
}

function paragraph(text) {
  const t = String(text ?? '').trim();
  return t ? `<p>${esc(t)}</p>` : '';
}

/**
 * A service page as an article.
 *
 * `service` is exactly what services.repository.js's getBySlug() returns — the
 * same object seoMeta.serviceMeta() is handed, so the two can never describe
 * different content.
 */
function serviceArticle(service, { siteUrl } = {}) {
  const samagri = Array.isArray(service.samagri)
    ? service.samagri.map((s) => (typeof s === 'string' ? { item: s } : s))
    : [];

  const body = [
    `<h1>${esc(service.name)}</h1>`,
    paragraph(service.short_description),
    paragraph(service.desc),
    section('Benefits', titledList(service.benefits)),
    section('Puja vidhi — step by step', titledList(service.process, { ordered: true })),
    section('Samagri', titledList(samagri, { titleKey: 'item', detailKey: 'qty' })),
    section('Frequently asked questions', faqList(service.faqs)),
    section('Details', factList({
      Duration: service.dur,
      'Recommended muhurat': service.recommended_muhurat,
      'Online puja / havan': service.is_online_available
        ? (service.online_note || 'Available — the pandit performs the ritual and you join by live sankalp.')
        : '',
    })),
  ].filter(Boolean).join('');

  const home = siteUrl ? `<p><a href="${esc(siteUrl)}/services">All puja &amp; havan services</a></p>` : '';
  return `<article>${body}${home}</article>`;
}

/**
 * A static editorial page (today: /online-havan) as an article.
 *
 * Takes the copy already written for the page rather than inventing SEO text
 * for it, so the two cannot drift into saying different things.
 */
function pageArticle({ h1, intro, sections = [], faqs = [] }) {
  const body = [
    `<h1>${esc(h1)}</h1>`,
    paragraph(intro),
    ...sections.map((s) => section(s.heading, [
      paragraph(s.body),
      titledList(s.items, { ordered: !!s.ordered }),
    ].filter(Boolean).join(''))),
    section('Frequently asked questions', faqList(faqs)),
  ].filter(Boolean).join('');
  return `<article>${body}</article>`;
}

/**
 * A directory page as an article: a heading, a line of context, and — the
 * whole point — REAL LINKS to everything it lists.
 *
 * This is the piece that fixes discovery rather than content. Every internal
 * link on this site is rendered by React, so before JavaScript runs the
 * catalogue pages contain no `<a href>` at all. A crawler arriving at
 * /services therefore found nothing to follow, and the only way any service
 * URL was known at all was sitemap.xml. Search Console shows exactly that
 * shape: "Discovered - currently not indexed", "Referring page: None
 * detected", "Last crawl: N/A" — a URL Google has heard of and never had a
 * reason to fetch.
 *
 * A sitemap says "these URLs exist". Links say "these URLs matter, and here
 * is how the site itself connects them". Only the second one builds a crawl
 * path.
 *
 * Absolute hrefs on purpose: this markup is injected into documents served at
 * several path depths, and a relative href would resolve differently on each.
 */
function linkListArticle({ h1, intro, links = [], footerNote }) {
  const items = links
    .filter((l) => l && l.href && l.label)
    .map((l) => {
      const note = String(l.note ?? '').trim();
      return `<li><a href="${esc(l.href)}">${esc(l.label)}</a>${note ? ` — ${esc(note)}` : ''}</li>`;
    });
  if (!items.length) return '';
  return `<article><h1>${esc(h1)}</h1>${paragraph(intro)}<ul>${items.join('')}</ul>${paragraph(footerNote)}</article>`;
}

/**
 * Wraps an article for injection. Returns '' for empty input so a caller can
 * pass it straight through without checking.
 */
function noscriptBlock(articleHtml) {
  return articleHtml ? `<noscript>${articleHtml}</noscript>` : '';
}

module.exports = { serviceArticle, pageArticle, linkListArticle, noscriptBlock };
