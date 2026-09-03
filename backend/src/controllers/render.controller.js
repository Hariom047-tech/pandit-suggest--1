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
const { injectSeo, injectBootstrap } = require('../utils/htmlInject');
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
  let out = meta ? injectSeo(html, meta, publicSiteUrl, SITE_NAME) : html;
  if (boot) out = injectBootstrap(out, boot.data, boot.preload);
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

const home = withShell(async () => seoMeta.homeMeta(), homeBootstrap);

// Static directory/utility pages — no DB lookup, no NOT_FOUND branch
// possible (the route only exists if the page exists), same withShell
// fail-safe contract as the 4 entity shapes above.
const servicesList = withShell(async () => seoMeta.servicesMeta(), directoryBootstrap('services.hero'));
const templesList = withShell(async () => seoMeta.templesMeta(), directoryBootstrap('temples.hero'));
const panditsList = withShell(async () => seoMeta.panditsMeta(), directoryBootstrap('pandits.hero'));
const aiRecommender = withShell(async () => seoMeta.aiRecommenderMeta());
const howItWorks = withShell(async () => seoMeta.howItWorksMeta());

const temple = withShell(async (req) => {
  const { market } = browsingMarketFor(req, typeof req.query.country === 'string' ? req.query.country : null);
  const t = await templesRepo.getBySlug(req.params.slug, market);
  return t ? seoMeta.templeMeta(t) : NOT_FOUND;
});

const service = withShell(async (req) => {
  const s = await servicesRepo.getBySlug(req.params.slug);
  return s ? seoMeta.serviceMeta(s) : NOT_FOUND;
});

const pandit = withShell(async (req) => {
  const p = await panditsRepo.getBySlug(req.params.slug);
  return p ? seoMeta.panditMeta(p) : NOT_FOUND;
});

module.exports = { home, temple, service, pandit, servicesList, templesList, panditsList, aiRecommender, howItWorks };
