/**
 * Site-wide SEO constants — one place instead of duplicated strings across
 * every page (master SEO prompt, "Site-wide metadata engine" / "SEO
 * configuration" sections).
 *
 * VITE_SITE_URL lets a staging/preview deploy set its own origin for
 * canonical/OG URLs without code changes; production always resolves to the
 * real domain regardless of what the env var is (or isn't) set to.
 */
const envSiteUrl = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim();
const isProd = import.meta.env.PROD;

export const siteConfig = {
  name: "PanditSuggest",
  // Never let a staging/local override leak into a production build — only
  // trusted there, where it's used purely as a fallback if the env var is
  // somehow unset.
  url: (isProd ? undefined : envSiteUrl) || "https://www.panditsuggest.com",
  defaultTitle: "PanditSuggest — Connect with Trusted Pandits Across India",
  defaultDescription:
    "Browse temples across India, view verified Pandit profiles and contact them directly on WhatsApp or call. No middleman, no commission on your puja.",
  defaultOgImage: "/assets/img/logo-new.png",

  /**
   * The real contact details, in one place.
   *
   * The footer, the Contact page and the dictionary each carried their own
   * copy of a placeholder ("+91 90000 00000", "namaste@panditsuggest.in"), so
   * a devotee who tried the footer number and then the Contact page got two
   * different fictional ways to reach nobody. `phoneHref` is the dialable
   * E.164 form; `phone` is how it is shown.
   */
  contact: {
    email: "panditsuggest@gmail.com",
    phone: "+91 97555 59161",
    phoneHref: "+919755559161",
  },
};

/** Absolute URL for an OG/canonical tag — accepts a path or an already-full URL. */
export function absoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${siteConfig.url}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}
