/** Fetches the frontend's live-built index.html over the internal Docker
 *  network and caches it briefly. Fetched live (never baked into the
 *  backend image) so this can never serve stale references to a previous
 *  frontend build's hashed JS/CSS bundle filenames after a redeploy. */

const FRONTEND_ORIGIN = process.env.FRONTEND_INTERNAL_URL || 'http://frontend:80';
/**
 * Ten seconds, not minutes — this is a redeploy-safety window, not a
 * performance budget.
 *
 * A frontend redeploy replaces index.html AND renames every hashed asset it
 * points at, deleting the old ones. For as long as this cache holds the
 * previous build's shell, "/" serves HTML asking for a bundle that now 404s:
 * a blank page, for every visitor, for the whole TTL. A five-minute TTL made
 * that a five-minute outage on every single frontend deploy — the exact
 * staleness the "fetched live, never baked in" note above exists to prevent.
 *
 * The saving it bought was never real: the fetch is one request to nginx on
 * the internal Docker network, and it is not on the critical path of
 * anything a visitor waits for beyond this same response.
 */
const TTL_MS = 10 * 1000;
const FETCH_TIMEOUT_MS = 2000;

let cache = null; // { html, fetchedAt }

async function getIndexHtml() {
  const now = Date.now();
  if (cache && (now - cache.fetchedAt) < TTL_MS) return cache.html;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    // /__spa-shell__, not "/" — nginx's `location = /` proxies "/" to this
    // same render endpoint, so fetching "/" here would bounce straight back
    // to the backend instead of reaching the static file (see docker/nginx/*.conf).
    const res = await fetch(`${FRONTEND_ORIGIN}/__spa-shell__`, { signal: controller.signal });
    if (!res.ok) throw new Error(`frontend returned HTTP ${res.status}`);
    const html = await res.text();
    cache = { html, fetchedAt: now };
    return html;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { getIndexHtml };
