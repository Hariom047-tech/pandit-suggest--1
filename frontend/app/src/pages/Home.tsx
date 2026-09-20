import { useState, useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { Img } from "../components/ui/Img";
import { SIZES } from "../lib/img";
import { Link } from "react-router-dom";
import { HeroAstrotalk } from "../components/hero/HeroAstrotalk";
import { SacredBackground } from "../components/ui/SacredBackground";
import { Icon } from "../lib/icons";
import { PanditCard } from "../components/ui/PanditCard";
import { TempleCard } from "../components/ui/TempleCard";
import { ReviewCard } from "../components/ui/ReviewCard";

import { usePandits, useTemples, useServices, useReviews, useFaqs, usePopularOnlineServices } from "../hooks/useData";
import { normPandits, normTemples, normServices, normReviews } from "../lib/normalize";
import { useFairRanking, useReportExposure } from "../lib/api";
import { useLang } from "../lib/i18n";
import "../styles/home-sections.css";
import { serviceEmoji } from "../lib/serviceEmoji";
import { Seo } from "../lib/Seo";
import { useSiteImages } from "../lib/siteImages";
import { useStructuredData, organizationSchema, websiteSchema, webPageSchema, organizationId, faqPageSchema } from "../lib/structuredData";

/**
 * Home-local replacement for the shared `Reveal`/`whileInView` framer-motion
 * pattern used below the fold on this page — deliberately NOT a change to
 * the shared `components/ui/Reveal.tsx` (used sitewide, e.g. About.tsx);
 * that's a separate, bigger-blast-radius decision. This one keeps Home's
 * own bundle free of framer-motion (Phase 12, docs/SEO_ARCHITECTURE.md) —
 * Home is eagerly loaded (not route-split), so anything it imports is on
 * the critical path for every visit, and none of this below-the-fold,
 * scroll-triggered decoration needs to be there.
 */
function InViewFade({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { rootMargin: "0px 0px -60px 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={`ohp-reveal${visible ? " is-visible" : ""}${className ? ` ${className}` : ""}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/** Same accordion pattern as Contact.tsx's FaqItem — kept as its own local
 *  copy rather than extracted into a shared component, matching how small,
 *  page-specific pieces like this already work elsewhere in this codebase. */
function FaqItem({ q, a, defaultOpen = false }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`acc-item${open ? " is-open" : ""}`}>
      <button className="acc-q" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span>{q}</span><Icon name="chevron-down" />
      </button>
      <div className="acc-a" style={{ maxHeight: open ? 420 : 0 }}>
        <p>{a}</p>
      </div>
    </div>
  );
}

/**
 * The puja that always holds the first tile of the online-havan strip.
 *
 * Maa Baglamukhi Havan at Nalkheda is what this business is known for and
 * what most visitors arrive looking for, so it is not left to compete with
 * the rest on view counts — a quiet week must not be able to push it out of
 * sight. Everything after it is ordered by real demand.
 *
 * A slug that no longer exists (renamed, deactivated, taken off online) pins
 * nothing and the strip simply orders itself normally — no blank tile, no
 * error.
 */
const PINNED_ONLINE_PUJA = "maa-baglamukhi-havan";

/** How many cards the strip shows. Eight fills two full rows on desktop
 *  (4-up) and four on a phone (2-up), with no ragged last row either way. */
const ONLINE_PUJA_COUNT = 8;

export default function Home() {
  const { t, lang } = useLang();
  /** Hindi name for a Hindi reader, English otherwise. */
  const svcName = (s: { name: string; hi?: { name?: string } | null }) =>
    (lang === "hi" ? s.hi?.name : null) || s.name;
  const siteImg = useSiteImages();
  const trustImg = siteImg.src("home.trust");
  /**
   * A service with no image of its own falls back to the admin-managed tile
   * slot. Without this the tile rendered <img> with no src at all, which a
   * browser draws as the raw alt text over the gradient — which is what the
   * homepage was showing for every service an admin had not given a photo.
   */
  const serviceTileImg = (s: { img?: string; name: string }) =>
    s.img || siteImg.src(s.name.toLowerCase().includes("havan") ? "services.fallback_havan" : "services.fallback_puja");
  const epujaBg = siteImg.src("home.epuja_bg");
  const reviewsBg = siteImg.src("home.reviews_bg");
  const fairScores = useFairRanking();
  const { data: rawFaqs } = useFaqs("HOME");
  const displayFaqs = rawFaqs || [];
  useStructuredData([
    organizationSchema(),
    websiteSchema(),
    webPageSchema({
      path: "/", name: "PanditSuggest — Connect with Trusted Pandits Across India",
      aboutId: organizationId(),
    }),
    faqPageSchema(displayFaqs, "/"),
  ]);

  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 620);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 620);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  /* ── Fetch data from API ── */
  const { data: rawPandits } = usePandits({ perPage: 20 });
  const { data: rawTemples } = useTemples({ perPage: 20, sort: "reviews" });
  const { data: rawServices } = useServices();
  // Best-effort: if this never arrives the strip below simply keeps the
  // admin's ordering, which is what it showed before any of this existed.
  const { data: popularOnline } = usePopularOnlineServices();
  const { data: rawReviews } = useReviews();

  const pandits = useMemo(() => normPandits(rawPandits), [rawPandits]);
  // Real platform-wide count, not this page's 20-row fetch — meta.total is
  // the paginator's total across every pandit, same value the Pandits page
  // itself would show. Falls back to what's on hand while that's loading.
  const panditsTotal = useMemo(() => {
    if (!rawPandits) return pandits.length;
    return Array.isArray(rawPandits) ? rawPandits.length : rawPandits.meta.total;
  }, [rawPandits, pandits.length]);
  const temples = useMemo(() => normTemples(rawTemples), [rawTemples]);
  const services = useMemo(() => normServices(rawServices), [rawServices]);
  /**
   * The homepage puja grid: which services, and in which order.
   *
   * Both halves are the admin's, from the service editor — "Show on home
   * page" picks them, "Home position" orders them (low first). Until this
   * existed the order was whatever the catalogue returned, which is
   * alphabetical by name, so an admin could feature a puja but never move it.
   *
   * Name is the tiebreaker rather than leaving equal positions to the
   * server's row order: every service starts at position 0, so without it a
   * freshly ticked set of pujas would sit in an order nobody chose and that
   * could change between requests.
   */
  const featuredServices = useMemo(
    () => services
      .filter((s) => s.popular)
      .sort((a, b) => (a.homePosition ?? 0) - (b.homePosition ?? 0) || a.name.localeCompare(b.name))
      .slice(0, 6),
    [services],
  );

  /**
   * The "Popular Pujas" strip in the online-havan section — 8 cards, ordered
   * by what devotees are ACTUALLY doing.
   *
   * Three rules, in this order:
   *
   *   1. PINNED_ONLINE_PUJA is always first. Maa Baglamukhi is not one puja
   *      among many here — it is the ritual this business is built on and the
   *      reason most visitors arrive — so it holds the first tile no matter
   *      what the numbers say. Nothing else is pinned.
   *   2. Then real demand: /services/popular ranks the rest by views plus
   *      contacts over the last 30 days (see the backend's popularOnline).
   *      It is a rolling window, so the strip follows the season instead of
   *      freezing whatever was popular the month the site launched.
   *   3. Then the admin's own order, which is ALL there is today: nothing has
   *      been viewed yet, so `rank` is empty and every card falls through to
   *      "Mark as popular" → "Home position" → name, exactly as before. The
   *      strip fills with 8 sensible pujas from day one and re-sorts itself
   *      as traffic arrives, with nothing for anyone to switch on.
   *
   * Was four hardcoded cards whose names, descriptions and durations lived in
   * the i18n dictionary (ohp.puja1Name … puja4Dur) — editing one meant a code
   * change and a redeploy, and the four slugs were fixed regardless of what
   * the database actually contained.
   */
  const onlinePujas = useMemo(() => {
    // slug -> position in the real-usage ranking. A puja nobody has touched is
    // not in the map at all and sorts after every puja that is.
    const rank = new Map((popularOnline?.data || []).map((row, i) => [row.slug, i]));
    const rankOf = (slug: string) => rank.get(slug) ?? Number.MAX_SAFE_INTEGER;
    const pinned = (slug: string) => (slug === PINNED_ONLINE_PUJA ? 0 : 1);

    return services
      .filter((s) => s.onlineAvailable)
      .sort((a, b) =>
        pinned(a.id) - pinned(b.id)
        || rankOf(a.id) - rankOf(b.id)
        // No usage data for either one yet: the admin's order decides.
        || Number(Boolean(b.popular)) - Number(Boolean(a.popular))
        || (a.homePosition ?? 0) - (b.homePosition ?? 0)
        || a.name.localeCompare(b.name))
      .slice(0, ONLINE_PUJA_COUNT);
  }, [services, popularOnline]);
  const reviews = useMemo(() => normReviews(rawReviews), [rawReviews]);

  const topPandits = useMemo(() => {
    return [...pandits]
      .sort((a, b) => {
        if (fairScores) {
          const diff = (fairScores.get(b.id) ?? -Infinity) - (fairScores.get(a.id) ?? -Infinity);
          if (diff) return diff;
        }
        return b.rating - a.rating || b.reviews - a.reviews;
      })
      .slice(0, isMobile ? 8 : 6);
  }, [pandits, fairScores, isMobile]);

  // The featured strip is a real impression — 6-8 pandits above the fold on the
  // busiest page on the site. Not counting it would let whoever lands here
  // accumulate free visibility.
  useReportExposure(topPandits.map((p) => p.id));

  const popularTemples = useMemo(() =>
    [...temples].sort((a, b) => b.reviews - a.reviews).slice(0, isMobile ? 8 : 9),
  [temples, isMobile]);

  return (
    <div className="hp-sacred-section" style={{ minHeight: "100vh", position: "relative", overflow: "hidden" }}>
      <Seo
        title="PanditSuggest — Connect with Trusted Pandits Across India"
        description="Find a verified Pandit for any puja, havan or anushthan — at your home, online, or at a temple. Compare Pandit profiles by city, language and experience, and contact them directly on WhatsApp or call — no middleman, no commission."
        path="/"
      />
      <SacredBackground />
      <div style={{ position: "relative", zIndex: 1 }}>
        <HeroAstrotalk />

        {/* ============================== SERVICES ============================== */}
      {/* Same rule as the temples section below: a heading with nothing under
          it is worse than no heading. Services are embedded in the HTML by the
          render layer, so this is a guard against an empty catalogue rather
          than against a slow one. */}
      {services.length > 0 && (
      <section className="section" style={{ position: "relative", overflow: "hidden" }}>
        <div className="shell" style={{ position: "relative", zIndex: 1 }}>
          <h2 className="section-title">{t("home.servicesTitle")}</h2>
          <svg className="ornament" viewBox="0 0 190 16" aria-hidden="true"><path d="M6 8h64M120 8h64" fill="none" stroke="#d4a017" strokeWidth="1.6" /><path d="M84 8l11-6 11 6-11 6z" fill="none" stroke="#d4a017" strokeWidth="1.6" /></svg>
          <p className="section-sub">{t("home.servicesSub")}</p>
          
          <div className="hp-services-grid">
                {/* `priority` only ever existed on the bundled content.ts records —
                    the API does not return it, so this filter silently emptied the
                    entire grid once the site read from the database. Admin-managed
                    "Mark as popular" drives it now, falling back to the first six
                    services so the section is never blank. */}
                {(featuredServices.length ? featuredServices : services.slice(0, 6))
                  .map((s, i) => (
                    <Link to={`/services/${s.id}`} key={s.id} className="hp-service-tile regular">
                      {serviceTileImg(s) && (
                        <Img src={serviceTileImg(s)} alt={svcName(s)} className="hp-service-tile__img" sizes={SIZES.homeTile} priority={i < 3} />
                      )}
                      <div className="hp-service-tile__overlay" />
                      <div className="hp-service-tile__content">
                        <h3 className="hp-service-tile__title">{svcName(s)}</h3>
                        <p className="hp-service-tile__desc">{s.desc.substring(0, 80)}...</p>
                        <div className="hp-service-tile__link">{t("home.findPandits")} <Icon name="arrow-right" size={16} /></div>
                      </div>
                    </Link>
                ))}
          </div>

          <div className="text-c" style={{ marginTop: 36 }}>
            <Link className="btn btn-gold btn-lg" to="/services">{t("home.seeAllServices")}</Link>
          </div>
        </div>
      </section>
      )}

      {/* =========================== FEATURED PANDITS =========================== */}
      {topPandits.length > 0 && (
      <section className="section">
        <div className="shell">
          <div className="row-between" style={{ marginBottom: 34, flexWrap: "wrap" }}>
            <div>
              <span className="eyebrow">{t("home.featuredEyebrow")}</span>
              <h2 className="section-title section-title--left" style={{ marginTop: 8 }}>{t("home.featuredTitle")}</h2>
            </div>
          </div>
          <div className="grid g-3 hp-cards-2up">
            {topPandits.map((p, i) => <PanditCard p={p} key={p.id} index={i} sourceSurface="home" />)}
          </div>
          <div className="text-c" style={{ marginTop: 32 }}>
            <Link className="btn btn-outline" to="/pandits">{t("home.allPandits", { count: panditsTotal })}</Link>
          </div>
        </div>
      </section>
      )}

      {/* ==================== ONLINE HAVAN & PUJA SEVA ==================== */}
      <section className="ohp-section">

        {/* ——— HERO HEADER ——— */}
        <div className="ohp-hero">
          {epujaBg && (
            <div
              className="ohp-hero-bg"
              style={{ "--site-img-epuja": `url('${epujaBg}')` } as CSSProperties}
            />
          )}
          <div className="shell ohp-hero-inner">
            <InViewFade>
              {/* The same badge shape the page hero uses for "verified
                  pandits" — a live dot and a plain statement of fact. It is
                  what tells a scrolling reader this band is different from
                  the cream sections either side of it. */}
              <span className="ohp-pill"><i className="ohp-pill-dot" />{t("ohp.pill")}</span>
              <span className="eyebrow">{t("ohp.eyebrow")}</span>
              {/* Split the same way the page hero splits its own headline —
                  dark, gold, dark — so the two read as the same family of
                  statement rather than a heading and a subheading. */}
              <h2 className="ohp-hero-title">
                {t("ohp.heroTitle1")} <span className="gold-text">{t("ohp.heroTitleGold")}</span>{t("ohp.heroTitle2")}
              </h2>
              <p className="ohp-hero-sub">{t("ohp.heroSub")}</p>
              {/* Goes to /online-havan, where the whole ritual is laid out —
                  the hour-by-hour journey, what a sankalp needs, what the
                  reader actually does during the live call, what arrives
                  afterwards. This section can only summarise that in four
                  steps; someone whose interest peaks at the headline is
                  exactly the person with questions, and this is the page that
                  answers them. It used to jump down to the puja grid, which is
                  still right below for anyone ready to book instead of read.

                  Same anchor text the site already uses for this destination
                  (the /services explainer link and the server-rendered link
                  list in render.controller.js), so every route to the page
                  reads as the same promise. */}
              <Link className="btn btn-gold btn-lg ohp-hero-cta" to="/online-havan">
                {t("ohp.heroCta")} <Icon name="arrow-right" size={16} />
              </Link>
            </InViewFade>
          </div>
        </div>

        {/* ——— HOW IT WORKS ——— */}
        <div className="ohp-steps-wrap">
          <div className="shell">
            <h3 className="ohp-heading">{t("ohp.howItWorks")}</h3>
            <svg className="ornament" viewBox="0 0 190 16" aria-hidden="true"><path d="M6 8h64M120 8h64" fill="none" stroke="#d4a017" strokeWidth="1.6" /><path d="M84 8l11-6 11 6-11 6z" fill="none" stroke="#d4a017" strokeWidth="1.6" /></svg>

            <div className="ohp-steps">
              {[
                { num: "①", icon: "om", title: t("ohp.step1Title"), desc: t("ohp.step1Desc") },
                { num: "②", icon: "edit", title: t("ohp.step2Title"), desc: t("ohp.step2Desc") },
                { num: "③", icon: "video", title: t("ohp.step3Title"), desc: t("ohp.step3Desc") },
                { num: "④", icon: "heart", title: t("ohp.step4Title"), desc: t("ohp.step4Desc") },
              ].map((s, i) => (
                <InViewFade className="ohp-step" delay={i * 100} key={i}>
                  <div className="ohp-step-circle"><span>{s.num}</span></div>
                  <h4>{s.title}</h4>
                  <p>{s.desc}</p>
                </InViewFade>
              ))}
            </div>
          </div>
        </div>

        {/* ——— POPULAR PUJAS (admin-managed) ——— */}
        {onlinePujas.length > 0 && (
        <div className="ohp-pujas-wrap" id="online-pujas">
          <div className="shell">
            <h3 className="ohp-heading">{t("ohp.popularPujas")}</h3>
            <svg className="ornament" viewBox="0 0 190 16" aria-hidden="true"><path d="M6 8h64M120 8h64" fill="none" stroke="#d4a017" strokeWidth="1.6" /><path d="M84 8l11-6 11 6-11 6z" fill="none" stroke="#d4a017" strokeWidth="1.6" /></svg>

            <div className="ohp-puja-grid">
              {onlinePujas.map((s, i) => (
                <InViewFade className="ohp-puja-card" delay={i * 80} key={s.id}>
                  {s.img
                    ? <Img className="ohp-puja-img" src={s.img} alt={svcName(s)} sizes={SIZES.card} loading="lazy" />
                    : <span className="ohp-puja-emoji">{serviceEmoji(s.icon)}</span>}
                  {/* The name gets a fixed three-line box that CENTRES what
                      it holds (see .ohp-puja-name): one-line and three-line
                      puja names now occupy exactly the same height, so every
                      "Inquire Now" in the grid sits on the same line instead
                      of riding up and down with the length of the name. */}
                  <h4 className="ohp-puja-name">
                    <span className="ohp-puja-name-text">{svcName(s)}</span>
                  </h4>
                  {(s.tag || s.desc) && (
                    <p className="ohp-puja-desc">{s.tag || s.desc}</p>
                  )}
                  <div className="ohp-puja-meta">
                    {s.dur && <span className="ohp-puja-dur"><Icon name="clock" size={13} /> {s.dur}</span>}
                    <span className="ohp-puja-live">● {t("ohp.live")}</span>
                  </div>
                  <Link className="btn btn-gold btn-sm ohp-puja-btn" to={`/services/${s.id}`}>
                    Inquire Now
                  </Link>
                </InViewFade>
              ))}
            </div>
          </div>
        </div>
        )}

        {/* ——— SANKALP INFO ——— */}
        <div className="ohp-sankalp-wrap">
          <div className="shell">
            <InViewFade>
              <div className="ohp-sankalp-card">
                <h3 className="ohp-heading" style={{ marginBottom: 6 }}>{t("ohp.sankalpInfo")}</h3>
                <p className="ohp-sankalp-subtitle">{t("ohp.sankalpSubtitle")}</p>

                <div className="ohp-sankalp-grid">
                  <ul className="ohp-sankalp-list">
                    <li><Icon name="user" size={15} /> <span>{t("ohp.sankalpFullName")}</span></li>
                    <li><Icon name="user" size={15} /> <span>{t("ohp.sankalpFatherName")}</span></li>
                    <li><Icon name="star" size={15} /> <span>{t("ohp.sankalpGotra")}</span></li>
                  </ul>
                  <ul className="ohp-sankalp-list">
                    <li><Icon name="check-circle" size={15} /> <span>{t("ohp.sankalpPurpose")}</span></li>
                    <li><Icon name="map-pin" size={15} /> <span>{t("ohp.sankalpCity")}</span></li>
                    <li><Icon name="phone" size={15} /> <span>{t("ohp.sankalpWhatsapp")}</span></li>
                  </ul>
                </div>

                <div className="ohp-sankalp-help">
                  {t("ohp.sankalpHelp")}
                </div>
              </div>
            </InViewFade>
          </div>
        </div>

        {/* ——— WHAT YOU RECEIVE ——— */}
        <div className="ohp-receive-wrap">
          <div className="shell">
            <h3 className="ohp-heading">{t("ohp.whatYouReceive")}</h3>
            <svg className="ornament" viewBox="0 0 190 16" aria-hidden="true"><path d="M6 8h64M120 8h64" fill="none" stroke="#d4a017" strokeWidth="1.6" /><path d="M84 8l11-6 11 6-11 6z" fill="none" stroke="#d4a017" strokeWidth="1.6" /></svg>

            <div className="ohp-receive-row">
              {[
                { icon: "video", label: t("ohp.receive1") },
                { icon: "check-circle", label: t("ohp.receive2") },
                { icon: "heart", label: t("ohp.receive3") },
                { icon: "play-circle", label: t("ohp.receive4") },
                { icon: "award", label: t("ohp.receive5") },
                { icon: "package", label: t("ohp.receive6") },
              ].map((r, i) => (
                <InViewFade className="ohp-receive-item" delay={i * 60} key={i}>
                  <div className="ohp-receive-icon"><Icon name={r.icon} size={22} /></div>
                  <span>{r.label}</span>
                </InViewFade>
              ))}
            </div>
          </div>
        </div>

      </section>

      {/* =========================== POPULAR TEMPLES =========================== */}
      {/* Rendered only when there is at least one temple to put in it.
          With none, the section still drew its eyebrow, its heading and an
          "On the map" / "All temples" pair of buttons above an empty grid —
          a homepage promising a directory the site cannot show yet, and two
          links straight into a blank page. Same rule the online-puja strip
          and the FAQ block below already follow. It comes back on its own
          the moment an admin adds a temple; nothing else has to be switched
          on. */}
      {popularTemples.length > 0 && (
      <section className="section" style={{ position: "relative" }}>
        <img src="/assets/img/lotus.svg" className="watermark watermark--tr" alt="" style={{ width: 260 }} />
        <div className="shell">
          <div className="row-between" style={{ marginBottom: 34, flexWrap: "wrap" }}>
            <div>
              <span className="eyebrow">{t("home.templesEyebrow")}</span>
              <h2 className="section-title section-title--left" style={{ marginTop: 8 }}>{t("home.templesTitle")}</h2>
            </div>
            <div className="row" style={{ gap: 10 }}>
              <Link className="btn btn-ghost" to="/temple-map">{t("home.onTheMap")}</Link>
              <Link className="btn btn-outline" to="/temples">{t("home.allTemples")}</Link>
            </div>
          </div>
          <div className="grid g-3 hp-cards-2up">
            {popularTemples.map((t, i) => <TempleCard t={t} key={t.id} index={i} />)}
          </div>
        </div>
      </section>
      )}

      {/* ============================ ADVANCED TESTIMONIALS CAROUSEL ============================ */}
      {/* No reviews yet means no testimonials heading — an empty carousel under
          "what devotees say" reads as a site nobody has used. */}
      {reviews.length > 0 && (
      <section className="hp-reviews-section">
        {/* The 3D transparent Pandit background */}
        {reviewsBg && (
          <div
            className="hp-reviews-bg"
            style={{ "--site-img-reviews": `url('${reviewsBg}')` } as CSSProperties}
          />
        )}
        
        <div className="hp-reviews-header">
          <h2 className="section-title">{t("home.testimonialsTitle")}</h2>
          <svg className="ornament" viewBox="0 0 190 16" aria-hidden="true"><path d="M6 8h64M120 8h64" fill="none" stroke="#d4a017" strokeWidth="1.6" /><path d="M84 8l11-6 11 6-11 6z" fill="none" stroke="#d4a017" strokeWidth="1.6" /></svg>
        </div>

        <div className="hp-reviews-carousel">
          {reviews.map((r) => (
            <ReviewCard key={r.name} r={r} />
          ))}
        </div>
      </section>
      )}

      {/* ============================== WHY PANDITSUGGEST ============================== */}
      {/* Visible-HTML explanation of the platform for a first-time visitor
          and a non-JS crawler (master SEO prompt Part 11,
          docs/SEO_ARCHITECTURE.md §16). Opens on the real reason a family is
          here (a griha pravesh, a wedding, a prayer for someone they love)
          rather than a directory disclaimer — the trust facts (verified,
          direct contact, no commission) follow after the "why", not instead
          of a "who". Same voice as About.tsx's mission section.

          Sits here at the foot of the page, not under the hero: a visitor
          who has already scrolled past the pujas, temples and reviews is
          the one weighing up whether to trust us, and this answers that —
          so it reads as the closing argument, immediately before the FAQ
          picks up the questions it leaves. */}
      <section className="section hp-trust" style={{ position: "relative" }}>
        <div className="shell">
          <div className="grid g-2 hp-trust-top" style={{ alignItems: "center" }}>
            <div>
              <span className="eyebrow">{t("homeTrust.eyebrow")}</span>
              <h2 className="section-title section-title--left" style={{ fontSize: "clamp(1.6rem,2.8vw,2.2rem)", marginTop: 10 }}>
                {t("homeTrust.title")}
              </h2>
              <p className="section-sub" style={{ textAlign: "left", margin: "16px 0 0" }}>
                {t("homeTrust.para1")}
              </p>
              <p className="section-sub" style={{ textAlign: "left", margin: "12px 0 0" }}>
                {t("homeTrust.para2")}
                {" "}<Link to="/how-it-works" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{t("homeTrust.howItWorks")}</Link>
              </p>
            </div>

            {/* The frame is a decorative ring around the photo, so it goes
                with the photo when the slot is empty rather than sitting
                there as an empty circle. */}
            {trustImg && (
              <div className="hp-trust-art" aria-hidden="true">
                <div className="hp-trust-art__frame">
                  <Img
                    src={trustImg}
                    alt=""
                    className="hp-trust-art__img"
                    sizes="420px"
                    loading="lazy"
                    width={420} height={420}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Three columns instead of four while the temple directory is
              empty — the Temples card is dropped on the same rule as the
              section above, and a four-column grid with a hole in it would
              read as a broken card rather than a deliberate one. */}
          <div className={`grid ${temples.length > 0 ? "g-4" : "g-3"} hp-whatis-grid`} style={{ marginTop: 40 }}>
            <Link to="/pandits" className="card card--hover card-pad">
              <span className="hp-whatis-card__icon"><Icon name="users" size={24} /></span>
              <h3 className="hp-whatis-card__title">{t("homeTrust.findPandits")}</h3>
              <p className="muted hp-whatis-card__desc">{t("homeTrust.findPanditsDesc")}</p>
            </Link>
            {temples.length > 0 && (
              <Link to="/temples" className="card card--hover card-pad">
                <span className="hp-whatis-card__icon"><Icon name="temple" size={24} /></span>
                <h3 className="hp-whatis-card__title">{t("homeTrust.exploreTemples")}</h3>
                <p className="muted hp-whatis-card__desc">{t("homeTrust.exploreTemplesDesc")}</p>
              </Link>
            )}
            <Link to="/services" className="card card--hover card-pad">
              <span className="hp-whatis-card__icon"><Icon name="sparkles" size={24} /></span>
              <h3 className="hp-whatis-card__title">{t("homeTrust.services")}</h3>
              <p className="muted hp-whatis-card__desc">{t("homeTrust.servicesDesc")}</p>
            </Link>
            <Link to="/ai-recommender" className="card card--hover card-pad">
              <span className="hp-whatis-card__icon"><Icon name="sparkles" size={24} /></span>
              <h3 className="hp-whatis-card__title">{t("homeTrust.aiRecommender")}</h3>
              <p className="muted hp-whatis-card__desc">{t("homeTrust.aiRecommenderDesc")}</p>
            </Link>
          </div>
        </div>
      </section>

      {/* ============================ FAQ ============================ */}
      {displayFaqs.length > 0 && (
        <section className="section section--cream" id="faq">
          <div className="shell" style={{ maxWidth: 860 }}>
            <h2 className="section-title">{t("homeTrust.faqTitle")}</h2>
            <svg className="ornament" viewBox="0 0 190 16" aria-hidden="true"><path d="M6 8h64M120 8h64" fill="none" stroke="#d4a017" strokeWidth="1.6" /><path d="M84 8l11-6 11 6-11 6z" fill="none" stroke="#d4a017" strokeWidth="1.6" /></svg>
            <div style={{ marginTop: 34 }}>
              {displayFaqs.map((f, i) => <FaqItem q={f.q} a={f.a} key={f.q} defaultOpen={i === 0} />)}
            </div>
          </div>
        </section>
      )}

      </div>
    </div>
  );
}
