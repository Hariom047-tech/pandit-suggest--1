/** Metadata-only server injection for the 4 highest-value dynamic routes
 *  (docs/SEO_ARCHITECTURE.md, Phase 7) — a non-JS crawler or link-preview
 *  bot hitting one of these paths gets the real entity's title/description/
 *  canonical/OG/JSON-LD baked into the SPA shell before any JS runs. A real
 *  visitor's browser still mounts React exactly as before, and Seo.tsx /
 *  useStructuredData overwrite these same tags in place with identical
 *  content once it does.
 *
 *  Fails safe at every step: if the frontend's index.html can't be fetched
 *  at all, respond 502 so nginx's error_page directive can fall back to
 *  serving the static SPA shell directly (docker/nginx/*.conf). Any other
 *  failure (unknown slug, DB error, meta-generation bug) serves the plain,
 *  unmodified index.html — a visitor must never see a broken page because
 *  this feature had a bad day. */

const { getIndexHtml } = require('../services/indexHtmlCache');
const { injectSeo, injectBootstrap, injectCrawlableContent } = require('../utils/htmlInject');
const { serviceArticle, pageArticle, linkListArticle, noscriptBlock } = require('../utils/crawlableContent');
const ONLINE_HAVAN = require('../data/onlineHavanContent');
const seoMeta = require('../utils/seoMeta');
const templesRepo = require('../repositories/temples.repository');
const servicesRepo = require('../repositories/services.repository');
const panditsRepo = require('../repositories/pandits.repository');
const homeHeroRepo = require('../repositories/homeHero.repository');
const siteImagesRepo = require('../repositories/siteImages.repository');
const { browsingMarketFor } = require('../services/distribution/market');
const { publicSiteUrl } = require('../config/env');

const SITE_NAME = 'PanditSuggest';

// Distinguishes "looked the entity up, it genuinely doesn't exist" from any
// other failure — only the former should produce a real 404 status
// (Phase 12 technical SEO batch: these routes were returning 200 for a
// nonexistent slug, a textbook "soft 404" that search consoles flag and that
// wastes crawl budget). The plain shell is still served either way so a real
// browser's React Router mounts and shows the friendly NotFound page exactly
// as before — only the HTTP status code changes.
const NOT_FOUND = Symbol('render-not-found');

function send(res, html, meta, status = 200, boot = null) {
  res.status(status);
  // The same header nginx puts on every SPA route it serves statically
  // (docker/nginx/*.conf). These shells name this build's hashed bundles, so
  // a browser reusing one after a redeploy boots the previous build and then
  // asks for lazy chunks that have since been deleted — an ErrorBoundary
  // screen on a healthy page (observed on /services, 10 Sep 2026). Express
  // sends them with an ETag and NO Cache-Control at all, which leaves
  // freshness to browser heuristics: the only difference between these routes
  // and the static ones, and the reason they could go stale. no-cache still
  // allows the 304 the ETag was there for; it only forbids reuse without
  // asking.
  res.set('Cache-Control', 'no-cache');
  let out = meta ? injectSeo(html, meta, publicSiteUrl, SITE_NAME) : html;
  if (boot) out = injectBootstrap(out, boot.data, boot.preload);
  // `meta.article` is the page's real text as HTML (utils/crawlableContent.js),
  // attached by the handlers that have something worth reading without
  // JavaScript. Deliberately not part of the meta contract every builder has
  // to satisfy: a page with nothing to say simply omits it, and the NOT_FOUND
  // branch above passes meta=null and so can never emit one.
  if (meta?.article) out = injectCrawlableContent(out, noscriptBlock(meta.article));
  return res.type('html').send(out);
}

/**
 * Wraps a per-route handler with the shared fetch-shell / fail-safe logic.
 *
 * @param {Function} buildMeta
 * @param {Function} [buildBootstrap] optional — returns { data, preload } to
 *        embed in the HTML (see utils/htmlInject.js). Deliberately failure-
 *        tolerant on its own: it is a speed optimization, so a DB hiccup
 *        here must cost the page nothing more than the fetch it would have
 *        done anyway.
 */
function withShell(buildMeta, buildBootstrap) {
  return async (req, res) => {
    let html;
    try {
      html = await getIndexHtml();
    } catch (err) {
      console.error('[render] could not reach frontend for index.html:', err.message);
      return res.status(502).end();
    }

    let boot = null;
    if (buildBootstrap) {
      try {
        boot = await buildBootstrap(req);
      } catch (err) {
        console.error('[render] bootstrap build failed, client will fetch instead:', err.message);
      }
    }

    try {
      const meta = await buildMeta(req);
      if (meta === NOT_FOUND) return send(res, html, null, 404);
      return send(res, html, meta, 200, boot);
    } catch (err) {
      // An unexpected failure (DB error, meta-generation bug) is NOT the same
      // as a confirmed missing entity — keep the existing fail-safe contract
      // of "a visitor must never see a broken page because this feature had
      // a bad day", so this stays 200 with the plain shell.
      console.error('[render] meta generation failed, serving plain shell:', err.message);
      return send(res, html, null, 200, boot);
    }
  };
}

/**
 * The homepage's own images, embedded so they need no request.
 *
 * Only the three hero circles are preloaded: they are the one image group
 * above the fold. The trust portrait and the two section backdrops travel in
 * the payload (so an admin-uploaded one paints immediately instead of
 * swapping in over the built-in default) but are NOT preloaded — they sit
 * far below the fold, and preloading them would compete for bandwidth with
 * the images the visitor is actually looking at.
 */
async function homeBootstrap() {
  const [homeHero, siteImages, services] = await Promise.all([
    homeHeroRepo.listPublic(),
    siteImagesRepo.getPublicMap(),
    servicesRepo.list({}),
  ]);
  return {
    // `services` is shaped exactly like GET /api/services' body, because the
    // client primes it under that path — a payload that merely resembled the
    // endpoint would desync the moment either side changed.
    data: { homeHero, siteImages, services: { data: services, meta: { total: services.length } } },
    preload: homeHero.map((h) => h.image_url),
  };
}

/**
 * The directory pages (/pandits, /temples, /services) each open on one hero
 * image from a site-image slot. Same treatment as the homepage hero: the URL
 * travels in the HTML with a preload, so it is not discovered at the end of
 * HTML -> bundle -> GET /api/site-images.
 *
 * Their listings are deliberately NOT embedded. A directory's rows are what
 * the visitor came to filter and page through, they change per query, and
 * they are far larger than a hero URL — inlining them would slow down the
 * very HTML the hero is waiting on.
 */
function directoryBootstrap(heroSlot) {
  return async () => {
    const siteImages = await siteImagesRepo.getPublicMap();
    return {
      data: { siteImages },
      preload: [siteImages[heroSlot]?.url],
    };
  };
}

/** Cap on links in one crawlable list. Past a few hundred a single page
 *  stops working as a crawl hub and paginated hubs are the right answer. */
const LIST_CAP = 200;

const home = withShell(
  async () => {
    // The homepage is the page every crawl starts from and the one carrying
    // the most authority, so it is where a link matters most. Kept to the
    // sections plus the catalogue: a link block, not a copy of the page.
    const [services, temples] = await Promise.all([
      servicesRepo.list({}),
      templesRepo.list({ page: 1, perPage: 1 }),
    ]);
    return {
      ...seoMeta.homeMeta(),
      article: linkListArticle({
        // Same words as the homepage's own <h1> (dictionary.en.ts home
        // heroTitle1 + heroTitleGold + heroTitlePlatform) — see the note on
        // the directory listings below for why the two must not drift. The
        // old heading also named Temples, a section the site hides while the
        // directory is empty.
        h1: "India's most trusted pandit connection platform",
        intro: 'Find a verified Pandit for any puja or havan — at your home, online, or at a temple.',
        // The site's main sections first, labelled with the SAME words the
        // header nav and footer use for them (frontend dictionary.en.ts's
        // nav.* keys). This block is the only set of links a crawler that
        // does not run JavaScript can see, so a page missing from it is a
        // page the site appears not to link to at all — which is how
        // /ai-recommender came to be absent from here while being one of the
        // four sections we most want found.
        links: [
          { href: `${publicSiteUrl}/pandits`, label: 'Pandits', note: 'Verified Pandit profiles across India' },
          { href: `${publicSiteUrl}/services`, label: 'Services', note: 'Every puja and havan in the catalogue' },
          { href: `${publicSiteUrl}/online-havan`, label: 'Online Puja', note: 'How an online havan or puja is really performed' },
          { href: `${publicSiteUrl}/ai-recommender`, label: 'AI Pooja Guide', note: 'Describe your situation, get the ritual that fits' },
          // Only when there is a directory to arrive at. The homepage hides
          // its temples section on the same rule (frontend Home.tsx), and
          // pointing a crawler at an empty listing is the same broken promise
          // in a form the visitor never sees.
          ...(temples.total > 0
            ? [{ href: `${publicSiteUrl}/temples`, label: 'Temples', note: 'Temples across India and their pujas' }]
            : []),
          { href: `${publicSiteUrl}/how-it-works`, label: 'How PanditSuggest works' },
          ...services.slice(0, LIST_CAP).map((r) => ({
            href: `${publicSiteUrl}/services/${r.slug}`,
            label: r.name,
            note: r.short_description,
          })),
        ],
      }),
    };
  },
  homeBootstrap,
);

// Static directory/utility pages — no DB lookup, no NOT_FOUND branch
// possible (the route only exists if the page exists), same withShell
// fail-safe contract as the 4 entity shapes above.
/**
 * The directory pages, each now carrying real links to everything it lists.
 *
 * Without these there was no crawl path into the catalogue at all: the links
 * a visitor clicks are drawn by React, so a crawler's first pass found an
 * `<a href>`-free document and had nothing to follow. Every entity URL was
 * known only from sitemap.xml, which is a list of addresses with no indication
 * that the site itself considers any of them worth reaching — the exact
 * "Discovered - currently not indexed / Referring page: None detected" state
 * Search Console reported for the whole service catalogue.
 *
 * The extra query is the listing the page is about to fetch anyway, and at
 * this catalogue's size it is a few rows. LIST_CAP keeps that honest if the
 * catalogue ever grows: past a few hundred links a single page stops being a
 * useful crawl hub, and paginated hub pages would be the right answer instead.
 */
/**
 * The three directory listings.
 *
 * Each `h1` below must be the SAME WORDS as the <h1> the React page renders
 * for that URL (frontend dictionary.en.ts, the `heroTitle1` + `heroTitleGold`
 * pair for each). They had drifted: a crawler that ran the JavaScript read
 * "Your trusted pandit connection" on /pandits while one that did not read
 * "Verified Pandits Across India" — one URL with two different headings
 * depending on who was looking. Google resolved that by ignoring the <title>
 * and captioning the page with the visible heading, which said nothing about
 * what the page was.
 */
const servicesList = withShell(
  async () => {
    const rows = await servicesRepo.list({});
    return {
      ...seoMeta.servicesMeta(rows),
      article: linkListArticle({
        h1: 'Puja & havan services, performed with devotion',
        intro: 'Every ritual in the PanditSuggest catalogue, with the verified Pandits who perform each one.',
        links: rows.slice(0, LIST_CAP).map((r) => ({
          href: `${publicSiteUrl}/services/${r.slug}`,
          label: r.name,
          note: r.short_description,
        })),
      }),
    };
  },
  directoryBootstrap('services.hero'),
);

const templesList = withShell(
  async () => {
    const { data } = await templesRepo.list({ page: 1, perPage: LIST_CAP });
    return {
      // No temples published yet -> noindex. The directory is real but
      // empty, and the frontend hides every link into it until the first
      // one exists (frontend/app/src/hooks/useHasTemples.ts).
      ...seoMeta.templesMeta(data),
      article: linkListArticle({
        h1: 'Temples across India, each with its own story',
        intro: 'Temples listed on PanditSuggest, with the puja services and Pandits associated with each.',
        links: data.map((r) => ({
          href: `${publicSiteUrl}/temples/${r.slug}`,
          label: r.name,
          note: [r.city, r.state].filter(Boolean).join(', '),
        })),
      }),
    };
  },
  directoryBootstrap('temples.hero'),
);

const panditsList = withShell(
  async () => {
    const { data } = await panditsRepo.list({ page: 1, perPage: LIST_CAP });
    return {
      ...seoMeta.panditsMeta(data),
      article: linkListArticle({
        h1: 'Find a verified Pandit across India',
        intro: 'Browse verified Pandit profiles — experience, languages and the rituals each one performs.',
        links: data.map((r) => ({
          href: `${publicSiteUrl}/pandits/${r.slug}`,
          label: r.name,
          note: [r.city, r.state].filter(Boolean).join(', '),
        })),
      }),
    };
  },
  directoryBootstrap('pandits.hero'),
);
const aiRecommender = withShell(async () => seoMeta.aiRecommenderMeta());

/**
 * /online-havan — until now the one high-intent page nginx never routed here,
 * so a non-JS crawler got a blank document for it. Static copy, no DB lookup.
 */
const onlineHavan = withShell(async () => ({
  ...seoMeta.onlineHavanMeta(),
  article: pageArticle({
    h1: ONLINE_HAVAN.H1,
    intro: ONLINE_HAVAN.INTRO,
    sections: [
      { heading: 'How an online havan is arranged, step by step', items: ONLINE_HAVAN.JOURNEY, ordered: true },
      { heading: 'What reaches you afterwards', items: ONLINE_HAVAN.DELIVERABLES },
    ],
    faqs: ONLINE_HAVAN.FAQS,
  }),
}));
const howItWorks = withShell(async () => seoMeta.howItWorksMeta());

// The six static pages and the per-service pandit list, which until now were
// served from nginx's SPA catch-all with no title, description or canonical —
// the shape Google reports as "Duplicate without user-selected canonical",
// because that is what a set of byte-identical documents is.
const blog = withShell(async () => seoMeta.blogMeta());
const about = withShell(async () => seoMeta.aboutMeta());
const contact = withShell(async () => seoMeta.contactMeta());
const templeMap = withShell(async () => {
  // Only the count — the map's pins are fetched by the client as before.
  const { total } = await templesRepo.list({ page: 1, perPage: 1 });
  return seoMeta.templeMapMeta(total);
});
const privacy = withShell(async () => seoMeta.legalMeta('privacy'));
const terms = withShell(async () => seoMeta.legalMeta('terms'));

const servicePandits = withShell(async (req) => {
  const s = await servicesRepo.getBySlug(req.params.slug);
  return s ? seoMeta.servicePanditsMeta(s) : NOT_FOUND;
});

const temple = withShell(async (req) => {
  const { market } = browsingMarketFor(req, typeof req.query.country === 'string' ? req.query.country : null);
  const t = await templesRepo.getBySlug(req.params.slug, market);
  return t ? seoMeta.templeMeta(t) : NOT_FOUND;
});

const service = withShell(async (req) => {
  const s = await servicesRepo.getBySlug(req.params.slug);
  if (!s) return NOT_FOUND;
  // Built from the same row the metadata is built from, so the structured
  // data, the visible page and this block cannot describe different rituals.
  return { ...seoMeta.serviceMeta(s), article: serviceArticle(s, { siteUrl: publicSiteUrl }) };
});

const pandit = withShell(async (req) => {
  const p = await panditsRepo.getBySlug(req.params.slug);
  return p ? seoMeta.panditMeta(p) : NOT_FOUND;
});

module.exports = {
  home, temple, service, pandit,
  servicesList, templesList, panditsList,
  aiRecommender, howItWorks, onlineHavan,
  blog, about, contact, templeMap, privacy, terms, servicePandits,
};
