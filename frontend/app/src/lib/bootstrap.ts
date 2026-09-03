import { primeCache } from "./useApi";

/**
 * Server-embedded page data.
 *
 * The homepage hero's three circular images used to arrive at the end of a
 * strictly serial chain: HTML -> JS bundle -> GET /api/home-hero -> response
 * -> only THEN does the browser learn the image URLs and start downloading
 * them. Until that finished the hero showed a shimmer placeholder, so the
 * first thing a visitor saw on a brand-new visit was a loading state, even
 * though the images themselves sit on CloudFront and could have started
 * downloading the moment the HTML arrived.
 *
 * The server now writes those URLs straight into the HTML it already
 * server-renders for `/` (backend/src/controllers/render.controller.js),
 * next to a <link rel="preload"> for each one. Two things follow: the
 * browser starts fetching the images during HTML parse, before the JS
 * bundle has even been compiled; and React's first render already has the
 * URLs, so there is no skeleton frame and no API request at all.
 *
 * Everything here is an optimization, never a requirement. If the server
 * could not build the payload (DB down, nginx serving the static shell
 * directly), the object is simply absent and every hook falls back to its
 * normal fetch — the behaviour this replaced.
 */

interface BootstrapPayload {
  /** GET /api/home-hero — the three circular hero images. */
  homeHero?: unknown;
  /** GET /api/site-images — admin-managed page image slots. */
  siteImages?: unknown;
}

declare global {
  interface Window { __PS_BOOTSTRAP__?: BootstrapPayload }
}

/**
 * Primes the useApi cache under the very paths the hooks ask for, so no hook
 * needs to know that bootstrapping exists — useHomeHero() and useSiteImages()
 * are unchanged and simply find their data already there.
 *
 * Runs as an import side effect, and main.tsx imports this before it renders,
 * so the cache is warm before React's first pass. Reading a page-level global
 * is not something to do casually; it is done here, once, in one file, rather
 * than at any call site.
 */
function hydrate() {
  const payload = typeof window !== "undefined" ? window.__PS_BOOTSTRAP__ : undefined;
  if (!payload) return;
  if (payload.homeHero) primeCache("/home-hero", payload.homeHero);
  if (payload.siteImages) primeCache("/site-images", payload.siteImages);
}

hydrate();

export {};
