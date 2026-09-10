const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const { corsOrigin } = require('./config/env');
const { apiLimiter } = require('./middleware/security');
const { checkIpBan } = require('./middleware/ipBan');
const { normalizeIp } = require('./middleware/normalizeIp');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { verifyOrigin } = require('./middleware/originVerify');

const app = express();

// First: reject anything that did not come through CloudFront, when
// ORIGIN_SHARED_SECRET is configured — see middleware/originVerify.js.
// A no-op until that env var is set, so local dev is unaffected.
app.use(verifyOrigin);

app.use(express.static(path.join(__dirname, '../public')));

app.use(helmet({
  // Mostly a JSON API, so a page-oriented CSP buys nothing — but the default
  // same-origin Cross-Origin-Resource-Policy would break the supported
  // "frontend on :8080 fetching the backend directly on :4000, no nginx
  // proxy" dev setup (see README), so that one's relaxed explicitly rather
  // than left to helmet's default.
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  // NOT a JSON-only API any more: render.controller.js serves the real SPA
  // shell as HTML for /, /temples, /pandits, /services, /how-it-works,
  // /ai-recommender and every entity detail page (docs/SEO_ARCHITECTURE.md
  // Phase 7). Those responses inherit these headers, and helmet's default
  // Cross-Origin-Opener-Policy: same-origin SEVERS window.opener for any
  // popup the page opens.
  //
  // That silently broke "Sign in with Google": Google Identity Services
  // opens accounts.google.com in a popup and posts the credential back to
  // window.opener. With COOP same-origin the handle is null, so the popup
  // finishes the Google-side sign-in and then just sits there blank —
  // POST /api/auth/google is never even attempted (confirmed: zero such
  // requests in the access log while users were trying).
  //
  // It bites even on /login (which nginx serves statically, without these
  // headers), because this is a SPA: a visitor lands on "/", gets COOP from
  // the render proxy, and client-side navigation to /login reuses that same
  // document — headers and all.
  //
  // same-origin-allow-popups keeps the protection that matters (a
  // cross-origin opener still cannot get a handle on our window) while
  // letting popups WE open keep talking back to us.
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
}));
app.use(cors({ origin: corsOrigin }));
// Before anything that reads req.ip (ban check, logging, sessions) — see
// middleware/normalizeIp.js for why this has to happen at all.
app.use(normalizeIp);
// Ahead of rate limiting — a banned IP shouldn't even burn rate-limit quota.
app.use(checkIpBan);
app.use(apiLimiter);
// Razorpay webhook signature verification needs the exact raw bytes sent —
// carved out here, ahead of the general json() parser, so it doesn't get
// re-serialized first (see routes/payments.routes.js + controllers/payments.controller.js).
app.use('/api/payments/webhook', express.raw({ type: '*/*' }));
app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

/*
 * Visitor market detection, before the routes so every handler has req.geo.
 *
 * Reads CDN headers only — a client-supplied country is ignored, otherwise
 * anyone could curl their way into the international pandit pool. See
 * services/distribution/market.js for the trust boundary caveat.
 */
app.use('/api', require('./services/distribution/market').geoMiddleware);

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
