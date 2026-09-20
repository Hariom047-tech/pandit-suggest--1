import { useMemo, useRef, useState } from "react";
import { Img } from "../components/ui/Img";
import { SIZES } from "../lib/img";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../lib/icons";
import { useServices, useServiceCategories } from "../hooks/useData";
import { normServices } from "../lib/normalize";
import { EmptyState } from "../components/ui/ReviewCard";
import { SacredBackground } from "../components/ui/SacredBackground";
import { HeroTicker } from "../components/ui/HeroTicker";
import { useLang } from "../lib/i18n";
import { Seo } from "../lib/Seo";
import { useStructuredData, organizationSchema, websiteSchema, webPageSchema, breadcrumbSchema, itemListSchema } from "../lib/structuredData";
import { useSiteImages, type SiteImageSlot } from "../lib/siteImages";

/**
 * Category tile fallbacks, used only until a category carries its own image
 * (Admin -> Services -> Categories). A category slug with no slot here — a
 * new one an admin adds — falls back to the generic puja tile rather than to
 * a guessed `cat-<slug>.webp` URL that would 404.
 */
const CATEGORY_SLOTS: Record<string, SiteImageSlot> = {
  life: "services.cat_life",
  daily: "services.cat_daily",
  festival: "services.cat_festival",
  shanti: "services.cat_shanti",
};

export default function Services() {
  const { t, lang } = useLang();
  /** The Hindi name when the reader is in Hindi and one exists, else English. */
  const svcName = (s: { name: string; hi?: { name?: string } | null }) =>
    (lang === "hi" ? s.hi?.name : null) || s.name;
  const siteImg = useSiteImages();
  const categoryImage = (slug: string, own?: string | null) =>
    own || siteImg.src(CATEGORY_SLOTS[slug] || "services.fallback_puja");
  /** A service with no image of its own gets the havan or the generic tile. */
  const serviceFallback = (name: string) =>
    siteImg.src(name.toLowerCase().includes("havan") ? "services.fallback_havan" : "services.fallback_puja");
  const heroImg = siteImg.src("services.hero");
  const { data: rawServices } = useServices();
  const services = useMemo(() => normServices(rawServices), [rawServices]);

  /* ── Structured data ──
     This page had none at all — server-side or client-side — while every
     detail page beneath it carries a full graph, so a crawler understood
     each individual entry better than the catalogue listing them, and had
     nothing telling it what this page was called. Mirrors exactly what
     backend/src/utils/seoMeta.js injects for the same URL; the ItemList
     describes the rows actually rendered, so it is built from the same
     array the grid below maps over. */
  useStructuredData([
    organizationSchema(),
    websiteSchema(),
    webPageSchema({ path: "/services", name: "All Puja & Havan Services — Book a Pandit" }),
    breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Services", path: "/services" }]),
    services.length
      ? itemListSchema({
          path: "/services",
          name: "Puja and havan services",
          items: services.map((r) => ({ name: r.name, path: `/services/${r.id}` })),
        })
      : null,
  ]);

  /**
   * "Most booked" tiles, admin-curated.
   *
   * This was a literal array with invented pandit counts (186 / 257 / 251 /
   * 167) that could never be right, and four fixed stock images. Categories
   * now carry their own image and the counts are computed from
   * pandit_services, so the number on screen is either true or absent.
   *
   * The old array stays as a fallback only until an admin sets home_rank on
   * some categories — otherwise the strip would vanish on first deploy.
   */
  const { data: apiCategories } = useServiceCategories();

  const MOST_BOOKED = useMemo(() => {
    if (apiCategories?.length) {
      return apiCategories.map((c) => ({
        cat: c.slug,
        // Hindi name for a Hindi reader once the category has one; English
        // until then, and for everyone reading in English. Same rule the
        // service cards below already follow.
        label: (lang === "hi" ? (c as { content_hi?: { name?: string } | null }).content_hi?.name : null) || c.name,
        tagline: (lang === "hi" ? (c as { content_hi?: { tagline?: string } | null }).content_hi?.tagline : null) || c.tagline,
        img: categoryImage(c.slug, c.image_url),
        pandits: c.pandit_count,
        services: c.service_count,
      }));
    }
    // No categories from the API means there genuinely are none. This used to
    // fall back to four hardcoded tiles — Life Events / Daily Pooja / Festival
    // Specials / Shanti Remedies — each carrying a "Popular" badge and a
    // placeholder image, which rendered above an "All Services: 0 services
    // found" list. Advertising four popular categories on an empty catalogue is
    // a claim the site cannot back. Show nothing instead, exactly as the pandit
    // and temple directories already do when they are empty.
    return [];
  }, [apiCategories, t]);
  const [query] = useState("");
  /* Seeded from ?online=1 so the "See Pandit Jis" CTA on /online-havan can
     land a devotee on this grid already filtered, rather than on the full
     catalogue with the filter they asked for switched off. Read once — after
     that the chip owns the state, and toggling it off should not have to
     rewrite the URL to stick. */
  const [params] = useSearchParams();
  const [onlineOnly, setOnlineOnly] = useState(() => params.get("online") === "1");
  // Which "Most Booked" tile (if any) the grid below is currently filtered
  // to — those tiles used to be inert decoration with nothing to click
  // through to; this is what makes them do something.
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const allServicesRef = useRef<HTMLElement>(null);

  const filtered = useMemo(() => {
    return services.filter((s) => {
      if (query && !`${s.name} ${s.hi?.name ?? ""} ${s.tag} ${s.desc}`.toLowerCase().includes(query.toLowerCase())) return false;
      if (onlineOnly && !s.onlineAvailable) return false;
      if (categoryFilter && s.cat !== categoryFilter) return false;
      return true;
    });
  }, [services, query, onlineOnly, categoryFilter]);

  function selectCategory(cat: string) {
    setCategoryFilter((prev) => (prev === cat ? null : cat));
    allServicesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const onlineCount = useMemo(() => services.filter((s) => s.onlineAvailable).length, [services]);

  return (
    <div className="hp-sacred-section" style={{ minHeight: "100vh", position: "relative", overflow: "hidden" }}>
      <Seo
        title="All Puja & Havan Services — Book a Pandit"
        /* The real catalogue size once it has loaded, and no number at all
           before that — "33+" was hardcoded and wrong (there are 32). Same
           sentence the server injects for this URL (seoMeta.js's
           servicesMeta), which this overwrites when React mounts. */
        description={`${services.length ? `${services.length} traditional rituals` : "Traditional rituals"}, from daily aarti to Griha Pravesh, Rudrabhishek and Satyanarayan Katha — with samagri lists and verified Pandits who perform each service.`}
        path="/services"
      />
      <SacredBackground />
      <div style={{ position: "relative", zIndex: 1 }}>

        {/* ======================== HERO ======================== */}
        <section className="sp-hero">
          <div className="shell">
            <div className="sp-hero__grid">
              <div className="sp-hero__content">
                <h1 className="sp-hero__title">
                  {t("services.heroTitle1")} <br />
                  <span className="gold-text">{t("services.heroTitleGold")}</span>
                </h1>
                <ul className="sp-hero__list">
                  <li>
                    <div className="sp-hero__check"><Icon name="check" size={14} /></div>
                    {t("services.heroCheck1")}
                  </li>
                  <li>
                    <div className="sp-hero__check"><Icon name="check" size={14} /></div>
                    {t("services.heroCheck2")}
                  </li>
                  <li>
                    <div className="sp-hero__check"><Icon name="check" size={14} /></div>
                    {t("services.heroCheck3")}
                  </li>
                  <li>
                    <div className="sp-hero__check"><Icon name="check" size={14} /></div>
                    {t("services.heroCheck4")}
                  </li>
                </ul>
              </div>
              {/* The glow is a halo painted behind the photo — with no photo
                  to sit behind, the whole block is dropped. */}
              {heroImg && (
                <div className="sp-hero__img-wrap">
                  {/* fetchPriority high + no lazy: this is the page's LCP
                      candidate, and the server already preloads the matching
                      AVIF rung (render.controller.js servicesList). */}
                  <Img
                    src={heroImg}
                    alt={siteImg.alt("services.hero", "Pandit performing puja")}
                    className="sp-hero__img"
                    sizes={SIZES.pageHero}
                    priority
                  />
                  <div className="sp-hero__glow" />
                </div>
              )}
            </div>
          </div>

          {/* Scrolling ticker */}
          <HeroTicker />
        </section>

        {/* ======================== MOST BOOKED ========================
            Rendered only when the API actually returns categories. An empty
            catalogue shows no section at all rather than an empty heading. */}
        {MOST_BOOKED.length > 0 && (
        <section className="section" style={{ paddingTop: 40, paddingBottom: 30 }}>
          <div className="shell">
            <h2 className="sp-section-title">{t("services.mostBooked")}</h2>
            <div className="sp-booked-row">
              {MOST_BOOKED.map((mb) => (
                <button
                  key={mb.cat}
                  type="button"
                  className={`sp-booked-card${categoryFilter === mb.cat ? " is-active" : ""}`}
                  onClick={() => selectCategory(mb.cat)}
                  aria-pressed={categoryFilter === mb.cat}
                >
                  {/* All four sit above the fold on a desktop viewport and
                      were measured starting late because of loading="lazy". */}
                  <Img src={mb.img} alt={mb.label} className="sp-booked-card__img" sizes={SIZES.serviceCard} priority />
                  <div className="sp-booked-card__overlay" />
                  <span className="sp-booked-card__badge">⭐ {t("services.popular")}</span>
                  <div className="sp-booked-card__bottom">
                    <h4 className="sp-booked-card__name">{mb.label}</h4>
                    <div className="sp-booked-card__meta">
                      {/* Show a count only when there is a real one. A hardcoded
                          "257 Pandits" under a category with zero mapped
                          pandits is worse than showing nothing. */}
                      {mb.pandits > 0
                        ? <span>{mb.pandits} {t("services.pandits")}</span>
                        : mb.services > 0
                          ? <span>{mb.services} {mb.services === 1 ? t("services.serviceCountOne") : t("services.serviceCountMany")}</span>
                          : mb.tagline
                            ? <span>{mb.tagline}</span>
                            : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
        )}

        {/* ======================== ALL SERVICES GRID ======================== */}
        <section className="section" style={{ paddingTop: 10, paddingBottom: 50 }} ref={allServicesRef}>
          <div className="shell">
            <div className="sp-all-header">
              <div className="sp-all-header__left">
                <h2 className="sp-section-title" style={{ margin: 0 }}>{t("services.title")}</h2>
                <span className="muted sp-all-header__count">{filtered.length} {t("services.servicesFound")}</span>
              </div>
              {/* Set by clicking a "Most Booked" tile above — the only way
                  this grid can be scoped to one category. */}
              {categoryFilter && (
                <button
                  type="button"
                  className="sp-online-toggle sp-all-header__online is-on"
                  onClick={() => setCategoryFilter(null)}
                >
                  {MOST_BOOKED.find((mb) => mb.cat === categoryFilter)?.label || categoryFilter} ✕
                </button>
              )}
              {/* Rendered only when something is actually available online —
                  an "Online" filter that always returns nothing is worse
                  than no filter. */}
              {onlineCount > 0 && (
                <button
                  type="button"
                  className={`sp-online-toggle sp-all-header__online${onlineOnly ? " is-on" : ""}`}
                  aria-pressed={onlineOnly}
                  onClick={() => setOnlineOnly((v) => {
                    if (!v) setCategoryFilter(null);
                    return !v;
                  })}
                >
                  🌐 Online puja ({onlineCount})
                </button>
              )}
              {/* The chip filters; this explains. Two different questions —
                  "show me only these" and "how does that even work" — so the
                  chip keeps its job and the explainer gets its own link. */}
              {onlineCount > 0 && (
                <Link className="sp-online-howto" to="/online-havan">
                  {t("onlineHavan.servicesLink")} <Icon name="arrow-right" size={14} />
                </Link>
              )}
            </div>

            {filtered.length ? (
              <div className="sp-all-grid">
                {filtered.map((s, i) => (
                  <Link
                    to={`/services/${s.id}`}
                    className="sp-all-card"
                    key={s.id}
                  >
                    {/* With no image of its own and no fallback slot filled,
                        the card renders text on its gradient overlay rather
                        than a broken <img>. */}
                    {(s.img ? s.img.replace('.jpg', '_new.jpg') : serviceFallback(s.name)) && (
                      <Img
                        src={s.img ? s.img.replace('.jpg', '_new.jpg') : serviceFallback(s.name)}
                        alt={svcName(s)}
                        className="sp-all-card__img"
                        sizes={SIZES.serviceCard}
                        /* The grid is 4 columns on desktop and 2 on a phone,
                           so the first four cards are the most that can be
                           on screen at once — beyond that lazy is right. */
                        priority={i < 4}
                        onError={(e) => {
                          const fb = serviceFallback(s.name);
                          if (fb) (e.target as HTMLImageElement).src = fb;
                        }}
                      />
                    )}
                    <div className="sp-all-card__overlay" />
                    <div className="sp-all-card__bottom">
                      <h4 className="sp-all-card__name">{svcName(s)}</h4>
                      <p className="sp-all-card__tag">{s.tag}</p>
                      <div className="sp-all-card__meta">
                        <span className="sp-all-card__meta-dur"><Icon name="clock" size={13} /> {s.dur}</span>
                        <span className="sp-all-card__meta-pandits"><Icon name="users" size={13} /> {s.pandits} {t("services.pandits")}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState msg={t("services.noServiceMatch")} />
            )}
          </div>
        </section>

        {/* ======================== TRUST FOOTER ======================== */}
        <section className="sp-trust-footer">
          <div className="shell">
            <div className="sp-trust-footer__inner">
              <p className="sp-trust-footer__text" dangerouslySetInnerHTML={{ __html: t("services.trustText") }} />
              <div className="sp-trust-footer__badges">
                <span className="sp-trust-badge">{t("services.verifiedPandits")}</span>
                <span className="sp-trust-badge">{t("services.authenticRituals")}</span>
                <span className="sp-trust-badge">{t("services.ratingBadge")}</span>
                <span className="sp-trust-badge">{t("services.panIndia")}</span>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
