const repo = require('../repositories/services.repository');
const panditsRepo = require('../repositories/pandits.repository');
const templesRepo = require('../repositories/temples.repository');
const { browsingMarketFor } = require('../services/distribution/market');
const { logActivityEvent, deviceTypeFromUserAgent, recentlyLogged } = require('../utils/activityLog');

/** How far back "popular right now" looks, and how many rows it hands back.
 *  30 days so the strip reflects this month's demand rather than a lifetime
 *  total; 24 rows so the homepage can pin, filter and still fill its 8. */
const POPULAR_WINDOW_DAYS = 30;
const POPULAR_LIMIT = 24;

/** GET /api/services?cat=&q= — no pagination; ~50 rows is small enough to send whole */
async function list(req, res) {
  const items = await repo.list({ q: req.query.q, cat: req.query.cat, online: req.query.online });
  res.json({ data: items, meta: { total: items.length } });
}

/** GET /api/services/:id — :id is the service's slug; includes the pandits
 *  and temples that offer it */
async function getById(req, res) {
  const service = await repo.getBySlug(req.params.id);
  if (!service) return res.status(404).json({ error: 'Service not found' });

  const { market } = browsingMarketFor(req, typeof req.query.country === 'string' ? req.query.country : null);
  const [pandits, temples, onlinePandits] = await Promise.all([
    panditsRepo.forService(service.slug, market),
    templesRepo.forService(service.slug),
    // Only the pandits an admin has explicitly allocated to perform THIS
    // service online — not everyone mapped to it.
    panditsRepo.forServiceOnline(service.slug, market),
  ]);
  res.json({ ...service, pandits, temples, onlinePandits });
}

/**
 * GET /api/services/popular — the online pujas devotees are actually using.
 *
 * Deliberately its own endpoint rather than a column on /services: this is
 * the only surface that needs it, the aggregate should not be paid for by
 * every catalogue listing and every SEO render, and a ranking that fails must
 * never take the service list down with it — the homepage simply falls back
 * to the admin's own order.
 */
async function popular(req, res) {
  const data = await repo.popularOnline({ days: POPULAR_WINDOW_DAYS, limit: POPULAR_LIMIT });
  res.json({ data, meta: { windowDays: POPULAR_WINDOW_DAYS, total: data.length } });
}

/**
 * POST /api/services/:id/view — "someone opened this puja's page".
 *
 * The write that makes /services/popular mean anything. Same contract as the
 * pandit profile view it mirrors: answer first, log after, never let the
 * telemetry slow down or fail the page, and dedup per visitor per hour so a
 * refresh is not a vote.
 */
async function trackView(req, res) {
  const serviceId = await repo.findIdBySlug(req.params.id);
  if (!serviceId) return res.status(404).json({ error: 'Service not found' });
  res.json({ ok: true });

  const userId = req.user?.id || null;
  const sessionKey = typeof req.body?.sk === 'string' ? req.body.sk.slice(0, 64) : null;
  (async () => {
    if (await recentlyLogged({ serviceId, eventType: 'SERVICE_VIEW', userId, sessionKey })) return;
    const browsing = browsingMarketFor(req);
    await logActivityEvent({
      userId,
      sessionKey,
      serviceId,
      eventType: 'SERVICE_VIEW',
      country: browsing.countryCode,
      market: browsing.market === 'UNKNOWN' ? null : browsing.market,
      locationSource: browsing.source,
      deviceType: deviceTypeFromUserAgent(req.headers['user-agent']),
    });
  })().catch((err) => console.error('[activity] service view tracking failed (non-fatal):', err.message));
}

/** GET /api/services/categories — the admin-curated "Most booked" strip. */
async function homeCategories(req, res) {
  res.json(await repo.homeCategories());
}

module.exports = {
  homeCategories, list, getById, popular, trackView };
