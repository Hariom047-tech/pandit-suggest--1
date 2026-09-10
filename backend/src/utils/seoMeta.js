/**
 * Server-side mirror of frontend/app/src/lib/{Seo.tsx,structuredData.ts}'s
 * per-page title/description/canonical/OG/JSON-LD formulas — same fallback
 * text, same field names, same @id scheme — so a request that gets
 * server-injected metadata (render.controller.js) and one that only gets the
 * client-side version (everything else) never disagree, and so a crawler
 * sees the exact same entity graph either way. Duplicated rather than shared
 * as a package: frontend and backend are separate Node projects with no
 * existing shared-code infrastructure, and building one is a bigger change
 * than this phase warrants (docs/SEO_ARCHITECTURE.md, Phase 7).
 *
 * Deliberately simpler than the client in two places, both documented
 * inline below: no `serviceMeta.ts` static-fallback merge (legacy content
 * for services seeded before the admin CMS existed), and no Hindi
 * display-name switch (a user toggle with no server-side equivalent). A
 * real visitor's browser still gets the richer client-side version in both
 * cases once React mounts — this only affects the brief pre-JS/non-JS-bot
 * window.
 */
const { publicSiteUrl } = require('../config/env');
const { isTempleIndexable, isServiceIndexable, isPanditIndexable } = require('./indexability');
const ONLINE_HAVAN = require('../data/onlineHavanContent');

const SITE_NAME = 'PanditSuggest';
const DEFAULT_OG_IMAGE = `${publicSiteUrl}/assets/img/logo-new.png`;

function absoluteUrl(pathOrUrl) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${publicSiteUrl}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

// Some pandits' stored full_name already includes the "Pandit" honorific
// (16 rows, confirmed via DB query) — prepending it unconditionally produced
// titles like "Pandit Pandit Ramesh Sharma" (Phase 12 technical SEO batch,
// docs/SEO_ARCHITECTURE.md). Mirrors frontend/app/src/lib/normalize.ts's
// withPanditHonorific.
function withPanditHonorific(name) {
  return /^pandit\s/i.test(name) ? name : `Pandit ${name}`;
}

function withSiteName(title) {
  return title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
}

// Stable entity identifiers — must match structuredData.ts's organizationId()/
// websiteId()/placeOfWorshipId()/serviceId()/personId()/faqPageId() exactly,
// so the server-injected graph and the client-rendered graph describe the
// same entities under the same @id, not two disconnected copies.
const organizationId = () => `${publicSiteUrl}/#organization`;
const websiteId = () => `${publicSiteUrl}/#website`;
const placeOfWorshipId = (path) => `${absoluteUrl(path)}#place`;
const serviceEntityId = (path) => `${absoluteUrl(path)}#service`;
const personId = (path) => `${absoluteUrl(path)}#person`;

function organizationSchema() {
  return {
    '@type': 'Organization', '@id': organizationId(),
    name: SITE_NAME, url: publicSiteUrl, logo: DEFAULT_OG_IMAGE,
  };
}

function websiteSchema() {
  return {
    '@type': 'WebSite', '@id': websiteId(),
    name: SITE_NAME, url: publicSiteUrl, publisher: { '@id': organizationId() },
  };
}

/** `aboutId` optional — omitted on pages (like ProfilePage-based pandit
 *  pages) that already fill the WebPage role themselves; see
 *  structuredData.ts's webPageSchema docstring for why. */
function webPageSchema({ path, name, aboutId }) {
  return {
    '@type': 'WebPage', '@id': `${absoluteUrl(path)}#webpage`,
    url: absoluteUrl(path), name, isPartOf: { '@id': websiteId() },
    ...(aboutId ? { about: { '@id': aboutId } } : {}),
  };
}

function breadcrumbSchema(items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem', position: i + 1, name: item.name, item: absoluteUrl(item.path),
    })),
  };
}

function homeMeta() {
  const title = 'PanditSuggest — Connect with Trusted Pandits Across India';
  const description = 'Discover verified Pandits for puja, havan and anushthan at temples, online, or at your home. Browse temples, compare Pandit profiles by city and language, and contact them directly on WhatsApp or call — no middleman, no commission.';
  return {
    title, description, canonicalPath: '/', ogImage: DEFAULT_OG_IMAGE,
    structuredData: [
      organizationSchema(),
      websiteSchema(),
      webPageSchema({ path: '/', name: title, aboutId: organizationId() }),
    ],
  };
}

/** Mirrors TempleDetail.tsx's <Seo>/placeOfWorshipSchema. `temple` is exactly
 *  what temples.repository.js's getBySlug() already returns. */
function templeMeta(temple) {
  const path = `/temples/${temple.slug}`;
  const title = withSiteName(temple.meta_title || `${temple.name} — Puja, Havan & Pandits`);
  const description = temple.meta_description
    || `Explore ${temple.name} in ${temple.city}, ${temple.state}. Discover available puja and havan services, and connect directly with verified Pandits associated with the temple.`;
  const image = temple.img ? absoluteUrl(temple.img) : DEFAULT_OG_IMAGE;

  const place = {
    '@type': 'PlaceOfWorship', '@id': placeOfWorshipId(path),
    name: temple.name, url: absoluteUrl(path),
    address: {
      '@type': 'PostalAddress',
      ...(temple.address_line1 ? { streetAddress: temple.address_line1 } : {}),
      addressLocality: temple.city, addressRegion: temple.state, addressCountry: 'IN',
    },
  };
  // lat/lng/rating arrive as strings from Postgres DECIMAL columns — never
  // put a quoted number into a JSON-LD numeric field.
  if (temple.lat && temple.lng) {
    place.geo = { '@type': 'GeoCoordinates', latitude: Number(temple.lat), longitude: Number(temple.lng) };
  }
  if (image) place.image = image;
  if (temple.reviews > 0 && temple.rating) {
    place.aggregateRating = { '@type': 'AggregateRating', ratingValue: Number(temple.rating), reviewCount: temple.reviews };
  }

  return {
    title, description, canonicalPath: path, ogImage: image,
    // Indexability engine (docs/SEO_ARCHITECTURE.md §15) — a bare name+city
    // stub with no description and no real relationships never gets served
    // to search engines, mirrored client-side in lib/indexability.ts.
    noindex: !isTempleIndexable(temple),
    structuredData: [
      organizationSchema(),
      websiteSchema(),
      webPageSchema({ path, name: title, aboutId: placeOfWorshipId(path) }),
      breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Temples', path: '/temples' }, { name: temple.name, path }]),
      place,
    ],
  };
}

/** Mirrors ServiceDetail.tsx's <Seo>/serviceSchema/faqPageSchema. `service`
 *  is exactly what services.repository.js's getBySlug() already returns —
 *  including the universal_faqs merge from Phase 2, so real admin-authored
 *  FAQs are picked up here automatically with no extra query. Note the
 *  repository aliases the description column as `desc` (not `description`)
 *  since `description` collides with a JS reserved-ish convention there. */
/**
 * "2-4 hours" -> "PT4H", for schema.org's `totalTime`.
 *
 * That property is typed as an ISO-8601 Duration, not free text: an
 * admin-typed "2-4 hours (standard)" is invalid there and shows up in Search
 * Console as a structured-data warning rather than being quietly ignored. The
 * human wording is what the visible page and the crawlable article show; this
 * is only for the machine-readable copy.
 *
 * Takes the UPPER bound of a range — a devotee planning a day needs the
 * longest it might run, and understating it is the error that costs someone a
 * missed appointment. Returns null on anything it cannot read confidently,
 * because omitting the property is always better than asserting a wrong one.
 */
function isoDuration(text) {
  if (typeof text !== 'string') return null;
  const numbers = [...text.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  if (!numbers.length) return null;
  const value = Math.max(...numbers);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (/\bmin/i.test(text)) return `PT${Math.round(value)}M`;
  if (/\bhour|\bhr\b/i.test(text)) {
    // "2.5 hours" -> PT2H30M; whole hours stay PT2H.
    const hours = Math.floor(value);
    const mins = Math.round((value - hours) * 60);
    return `PT${hours}H${mins ? `${mins}M` : ''}` .replace(/^PT0H/, 'PT');
  }
  if (/\bday/i.test(text)) return `P${Math.round(value)}D`;
  return null;
}

function serviceMeta(service) {
  const path = `/services/${service.slug}`;
  const title = withSiteName(service.meta_title || `${service.name} — Puja & Havan Service`);
  const description = service.meta_description || service.short_description
    || `${service.name}: traditional significance, process and samagri, with verified Pandits available to perform it at your temple, online, or at home.`;
  const image = service.image_url ? absoluteUrl(service.image_url) : DEFAULT_OG_IMAGE;

  const structuredData = [
    organizationSchema(),
    websiteSchema(),
    webPageSchema({ path, name: title, aboutId: serviceEntityId(path) }),
    breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Services', path: '/services' }, { name: service.name, path }]),
    {
      '@type': 'Service', '@id': serviceEntityId(path),
      name: service.name, url: absoluteUrl(path),
      ...((service.desc || service.short_description) ? { description: service.desc || service.short_description } : {}),
      ...(image ? { image } : {}),
      // Referenced by @id, not a re-embedded copy — the full Organization
      // node is already present once in this same graph.
      provider: { '@id': organizationId() },
      // The catalogue is national and every ritual is offered in Hindi and
      // English; stating it lets a search engine answer "near me" and
      // language-qualified queries without guessing from the address.
      serviceType: 'Puja & Havan',
      areaServed: { '@type': 'Country', name: 'India' },
      availableLanguage: ['hi', 'en'],
      // Only when the admin has actually ticked it. Claiming remote
      // availability for a ritual that is not offered that way would be a
      // structured-data claim the page itself contradicts.
      ...(service.is_online_available ? {
        availableChannel: {
          '@type': 'ServiceChannel',
          name: 'Online puja / havan',
          serviceUrl: absoluteUrl('/online-havan'),
          ...(service.online_note ? { description: service.online_note } : {}),
        },
      } : {}),
    },
  ];

  // The vidhi as a HowTo: the steps a devotee is actually walked through, with
  // the samagri as its supplies and the stated duration as its total time.
  // This is the one part of a service page that is genuinely procedural, and
  // until now none of it was machine-readable — the Service node above carries
  // a name and a paragraph, and said nothing about what happens during the
  // ritual or what it needs.
  const steps = Array.isArray(service.process) ? service.process.filter((p) => p && p.title) : [];
  if (steps.length) {
    const supplies = Array.isArray(service.samagri)
      ? service.samagri
        .map((x) => (typeof x === 'string' ? x : x?.item))
        .filter((name) => typeof name === 'string' && name.trim())
      : [];
    structuredData.push({
      '@type': 'HowTo', '@id': `${absoluteUrl(path)}#vidhi`,
      name: `${service.name} — puja vidhi`,
      ...(isoDuration(service.dur) ? { totalTime: isoDuration(service.dur) } : {}),
      ...(supplies.length ? {
        supply: supplies.map((name) => ({ '@type': 'HowToSupply', name: name.trim() })),
      } : {}),
      step: steps.map((p, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: String(p.title).trim(),
        ...(p.detail ? { text: String(p.detail).trim() } : {}),
      })),
    });
  }
  if (Array.isArray(service.faqs) && service.faqs.length) {
    structuredData.push({
      '@type': 'FAQPage', '@id': `${absoluteUrl(path)}#faq`,
      mainEntity: service.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    });
  }

  return { title, description, canonicalPath: path, ogImage: image, noindex: !isServiceIndexable(service), structuredData };
}

/** Mirrors PanditProfile.tsx's <Seo>/personSchema. `pandit` is exactly what
 *  pandits.repository.js's getBySlug() already returns. Uses the plain
 *  English name — no server-side Hindi-name toggle exists. No separate
 *  webPageSchema node — ProfilePage is itself a WebPage subtype and already
 *  carries isPartOf, matching structuredData.ts's personSchema(). */
function panditMeta(pandit) {
  const path = `/pandits/${pandit.slug}`;
  const name = pandit.name;
  const title = withSiteName(pandit.meta_title || `${withPanditHonorific(name)} — Puja & Havan Services in ${pandit.city}`);
  const description = pandit.meta_description
    || `${name}, a verified Pandit in ${pandit.city}${pandit.state ? `, ${pandit.state}` : ''} with ${pandit.exp} years of experience. Contact directly on WhatsApp or call — no middleman, no commission.`;
  const image = pandit.img ? absoluteUrl(pandit.img) : DEFAULT_OG_IMAGE;

  const person = {
    '@type': 'Person', '@id': personId(path), name,
    ...(image ? { image } : {}),
    ...(pandit.city ? { address: { '@type': 'PostalAddress', addressLocality: pandit.city, addressRegion: pandit.state, addressCountry: 'IN' } } : {}),
  };
  if (pandit.reviews > 0 && pandit.rating) {
    person.aggregateRating = { '@type': 'AggregateRating', ratingValue: Number(pandit.rating), reviewCount: pandit.reviews };
  }

  return {
    title, description, canonicalPath: path, ogImage: image,
    noindex: !isPanditIndexable(pandit),
    structuredData: [
      organizationSchema(),
      websiteSchema(),
      breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'Pandits', path: '/pandits' }, { name, path }]),
      {
        '@type': 'ProfilePage', '@id': `${absoluteUrl(path)}#profilepage`,
        url: absoluteUrl(path), isPartOf: { '@id': websiteId() }, mainEntity: person,
      },
    ],
  };
}

/** Static directory/utility pages (no DB lookup, no per-request params) —
 *  same title/description text as each page's own <Seo> call
 *  (Services.tsx/Temples.tsx/Pandits.tsx/AiRecommender.tsx/HowItWorks.tsx),
 *  copied verbatim rather than re-derived, so the server-injected and
 *  client-rendered tags can never drift on wording. Services/Temples/Pandits
 *  emit no structuredData — mirrors the client exactly, which emits none for
 *  these three either (docs/SEO_ARCHITECTURE.md §8: "no change to list/
 *  utility pages"); inventing schema here just to raise a count would violate
 *  "structured data must match visible content". */
function servicesMeta() {
  const title = 'All Puja & Havan Services — Book a Pandit';
  const description = '33+ traditional rituals, from daily aarti to Griha Pravesh, Rudrabhishek and Satyanarayan Katha — with samagri lists and verified Pandits who perform each service.';
  return { title, description, canonicalPath: '/services', ogImage: DEFAULT_OG_IMAGE, structuredData: [] };
}

function templesMeta() {
  const title = 'Temples Across India — Puja, Havan & Pandits';
  const description = 'Browse temples across India by city and deity. See available puja and havan services at each temple, and connect directly with verified Pandits associated with it.';
  return { title, description, canonicalPath: '/temples', ogImage: DEFAULT_OG_IMAGE, structuredData: [] };
}

function panditsMeta() {
  const title = 'Find a Pandit — Verified Profiles Across India';
  const description = 'Search verified Pandits by city, service and language. Compare profiles, ratings and experience, then contact directly on WhatsApp or call — no middleman, no commission.';
  return { title, description, canonicalPath: '/pandits', ogImage: DEFAULT_OG_IMAGE, structuredData: [] };
}

/** Mirrors AiRecommender.tsx's <Seo>/useStructuredData call, including the
 *  same AI_FAQS array (kept in sync by hand — small, rarely-changed, and
 *  duplicating the "structured data must match visible content" rule this
 *  whole file already follows for services.faqs above). */
function aiRecommenderMeta() {
  const path = '/ai-recommender';
  const title = 'AI Pooja Guide — Which Puja Do I Need?';
  const description = 'Describe your situation in Hindi or English and get a traditional ritual recommendation, with the verified Pandits who perform it.';
  const AI_FAQS = [
    { q: 'Is this a chatbot booking a pandit for me?', a: 'No — it only suggests relevant services and Pandits. You still contact and arrange everything directly.' },
    { q: 'How are suggestions chosen?', a: "From PanditSuggest's own catalogue of services and Pandit profiles — nothing is invented or sourced from outside the platform." },
    { q: 'Does it guarantee results from a puja?', a: 'No. Traditional significance is explained honestly; no outcome is ever promised.' },
  ];
  return {
    title, description, canonicalPath: path, ogImage: DEFAULT_OG_IMAGE,
    structuredData: [
      organizationSchema(),
      websiteSchema(),
      webPageSchema({ path, name: title, aboutId: `${absoluteUrl(path)}#faq` }),
      {
        '@type': 'FAQPage', '@id': `${absoluteUrl(path)}#faq`,
        mainEntity: AI_FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      },
    ],
  };
}

/** Mirrors HowItWorks.tsx's <Seo>/useStructuredData call. */
function howItWorksMeta() {
  const path = '/how-it-works';
  const title = 'How PanditSuggest Works';
  const description = 'Four steps to find and contact a verified Pandit directly — no booking fee, no assigned stranger, no middleman.';
  return {
    title, description, canonicalPath: path, ogImage: DEFAULT_OG_IMAGE,
    structuredData: [
      organizationSchema(),
      websiteSchema(),
      webPageSchema({ path, name: title }),
      breadcrumbSchema([{ name: 'Home', path: '/' }, { name: 'How It Works', path }]),
    ],
  };
}

/**
 * Mirrors OnlineHavan.tsx's <Seo>/useStructuredData call.
 *
 * This page had NO server-side metadata at all until now — nginx served it
 * from the plain SPA catch-all, so anything that does not run JavaScript got
 * a document with no title, no description, no canonical, no Open Graph and
 * no JSON-LD. It was also missing from sitemap.xml. That is a poor outcome
 * for the page that explains the single thing the business is most often
 * asked about, so it is treated here like the entity pages: real metadata,
 * a real FAQPage, and (via crawlableContent.js) its real words in the body.
 *
 * The title/description below are copied from the page's own <Seo> props and
 * the FAQs from data/onlineHavanContent.js, which is transcribed from the
 * page's own copy — so what a crawler is told and what a visitor reads are
 * the same claims.
 */
function onlineHavanMeta() {
  const path = '/online-havan';
  const title = 'Online Havan & Puja — the full process, start to finish';
  const description = 'How an online havan is really performed: the ritual hour by hour, '
    + 'what your sankalp needs, what you do at home during the live call, and what '
    + 'reaches your door afterwards.';
  return {
    title, description, canonicalPath: path, ogImage: DEFAULT_OG_IMAGE,
    structuredData: [
      organizationSchema(),
      websiteSchema(),
      webPageSchema({ path, name: title, aboutId: `${absoluteUrl(path)}#faq` }),
      breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Services', path: '/services' },
        { name: 'Online Havan', path },
      ]),
      {
        '@type': 'Service', '@id': `${absoluteUrl(path)}#service`,
        name: 'Online Havan & Puja',
        url: absoluteUrl(path),
        description,
        serviceType: 'Online puja & havan',
        areaServed: { '@type': 'Country', name: 'India' },
        availableLanguage: ['hi', 'en'],
        provider: { '@id': organizationId() },
        availableChannel: {
          '@type': 'ServiceChannel',
          name: 'Live video sankalp',
          serviceUrl: absoluteUrl(path),
        },
      },
      {
        '@type': 'FAQPage', '@id': `${absoluteUrl(path)}#faq`,
        mainEntity: ONLINE_HAVAN.FAQS.map((f) => ({
          '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };
}


/**
 * The route shapes that had NO server-side metadata at all until now.
 *
 * Each of these was served straight from nginx's SPA catch-all, so the first
 * thing a crawler saw was the same empty shell for every one of them: no
 * title, no description and — the part that actually costs indexing — no
 * `rel="canonical"`. Google's own Page Indexing report calls that result
 * "Duplicate without user-selected canonical", which is precisely what a set
 * of URLs serving byte-identical HTML looks like from the outside.
 *
 * `/services/:slug/pandits` is the biggest of them: there is one per service,
 * so the catalogue alone produced a page each, all identical before JS ran.
 *
 * Titles and descriptions are copied from each page's own client-side <Seo>
 * props, so the server and the rendered page agree.
 */
function blogMeta() {
  const path = '/blog';
  const title = 'Spiritual Blog';
  const description = 'Rituals explained without mystique — practical puja guides, samagri explainers and honest notes on how PanditSuggest works.';
  return {
    title: withSiteName(title), description, canonicalPath: path, ogImage: DEFAULT_OG_IMAGE,
    structuredData: [organizationSchema(), websiteSchema(), webPageSchema({ path, name: title })],
  };
}

function aboutMeta() {
  const path = '/about';
  const title = 'About Us';
  const description = 'PanditSuggest is a directory, not a booking agent — you contact Pandits directly and keep 100% of your dakshina. Learn how our four-step verification process works.';
  return {
    title: withSiteName(title), description, canonicalPath: path, ogImage: DEFAULT_OG_IMAGE,
    structuredData: [organizationSchema(), websiteSchema(), webPageSchema({ path, name: title, aboutId: organizationId() })],
  };
}

function contactMeta() {
  const path = '/contact';
  const title = 'Contact Us';
  const description = 'Get in touch with the PanditSuggest team, or browse frequently asked questions about finding and contacting a Pandit.';
  return {
    title: withSiteName(title), description, canonicalPath: path, ogImage: DEFAULT_OG_IMAGE,
    structuredData: [organizationSchema(), websiteSchema(), webPageSchema({ path, name: title })],
  };
}

function templeMapMeta() {
  const path = '/temple-map';
  const title = 'Temple Map — Explore Temples Across India';
  const description = 'An interactive map of temples across India. Find one near you and see the Pandits and puja services associated with it.';
  return {
    title: withSiteName(title), description, canonicalPath: path, ogImage: DEFAULT_OG_IMAGE,
    structuredData: [organizationSchema(), websiteSchema(), webPageSchema({ path, name: title })],
  };
}

/**
 * /privacy and /terms render the same React component, which is exactly why
 * they need explicit and DIFFERENT canonicals: two URLs serving one component
 * is the textbook case Google resolves by picking one and dropping the other.
 */
function legalMeta(kind) {
  const isPrivacy = kind === 'privacy';
  const path = isPrivacy ? '/privacy' : '/terms';
  const title = isPrivacy ? 'Privacy Policy' : 'Terms of Use';
  const description = isPrivacy
    ? 'How PanditSuggest collects, uses and protects your personal data.'
    : 'The terms governing your use of PanditSuggest.';
  return {
    title: withSiteName(title), description, canonicalPath: path, ogImage: DEFAULT_OG_IMAGE,
    structuredData: [organizationSchema(), websiteSchema(), webPageSchema({ path, name: title })],
  };
}

/** Mirrors ServicePandits.tsx's <Seo>. `service` is services.repository.js's getBySlug(). */
function servicePanditsMeta(service) {
  const path = `/services/${service.slug}/pandits`;
  const count = Number(service.pandit_count) || 0;
  const title = `Pandits who perform ${service.name}`;
  const description = `Browse ${count > 0 ? `all ${count} ` : ''}verified Pandits who perform ${service.name}. `
    + 'Compare experience, languages and reviews, then contact directly on WhatsApp or call — no middleman, no commission.';
  return {
    title: withSiteName(title), description, canonicalPath: path,
    ogImage: service.image_url ? absoluteUrl(service.image_url) : DEFAULT_OG_IMAGE,
    // A list with nobody on it is a thin page; let it be found through the
    // service page instead of standing on its own in the index.
    noindex: count === 0,
    structuredData: [
      organizationSchema(), websiteSchema(),
      webPageSchema({ path, name: title, aboutId: serviceEntityId(`/services/${service.slug}`) }),
      breadcrumbSchema([
        { name: 'Home', path: '/' },
        { name: 'Services', path: '/services' },
        { name: service.name, path: `/services/${service.slug}` },
        { name: 'Pandits', path },
      ]),
    ],
  };
}

module.exports = {
  homeMeta, templeMeta, serviceMeta, panditMeta, absoluteUrl,
  servicesMeta, templesMeta, panditsMeta, aiRecommenderMeta, howItWorksMeta,
  onlineHavanMeta,
  blogMeta, aboutMeta, contactMeta, templeMapMeta, legalMeta, servicePanditsMeta,
};
