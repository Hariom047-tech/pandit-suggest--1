import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link, useParams } from "react-router-dom";
import { Icon } from "../lib/icons";
import { useService, useServices, usePandits, useTemples } from "../hooks/useData";
import { normService, normServices, normPandits, normTemples } from "../lib/normalize";
// Aliased: this file already binds `api` to the raw service payload further
// down, and that local shadows the whole function scope.
import { api as apiClient, useFairRanking, useReportExposure } from "../lib/api";
import { useUrlTab } from "../hooks/useUrlTab";
import { Loading, ErrorState } from "../components/ui/DataState";
import { getServiceMeta } from "../data/serviceMeta";
import { PanditCard } from "../components/ui/PanditCard";
import { TempleCard } from "../components/ui/TempleCard";
import { ServiceCard } from "../components/ui/ServiceCard";
import { EmptyState } from "../components/ui/ReviewCard";
import { SacredBackground } from "../components/ui/SacredBackground";
import { HavanSection } from "../components/service/HavanSection";
import { getHavanStructure } from "../data/havanStructure";
import { Seo } from "../lib/Seo";
import { useStructuredData, breadcrumbSchema, serviceSchema, faqPageSchema, organizationSchema, websiteSchema, webPageSchema, serviceId } from "../lib/structuredData";
import { isServiceIndexable } from "../lib/indexability";
import { useLang } from "../lib/i18n";

type Tab = "overview" | "havan" | "samagri" | "pandits" | "reviews";
const TAB_KEYS: readonly Tab[] = ["overview", "samagri", "pandits", "reviews"];
/** Only for services sold as a havan/anushthan tier ladder — see below. */
const TAB_KEYS_HAVAN: readonly Tab[] = ["overview", "havan", "samagri", "pandits", "reviews"];

export default function ServiceDetail() {
  const { id } = useParams();
  const { t, lang } = useLang();
  const { data: rawService, loading, error } = useService(id || "");
  const { data: rawServices } = useServices();
  // 600: "limit" was never a real API param (silently ignored, falling back
  // to a 12-row default) — see Pandits.tsx for the full explanation.
  const { data: rawPandits } = usePandits({ perPage: 600 });
  // Server-side filtered by the temples list endpoint's own `service` param
  // (temples.repository.js's list()) — NOT client-filtered from an unfiltered
  // batch: the temples LIST endpoint's row shape has no `services` field at
  // all (only the single-temple detail endpoint joins that), so filtering an
  // unfiltered `useTemples({perPage:50})` batch by `t.services.includes(...)`
  // always evaluated against an empty array and silently returned nothing,
  // regardless of real temple-service relationships. Found while wiring this
  // list up for the first time (docs/SEO_ARCHITECTURE.md, Phase 6).
  const { data: rawTemplesForService } = useTemples({ service: id, perPage: 6 });

  const s = useMemo(() => rawService ? normService(rawService) : null, [rawService]);
  const services = useMemo(() => normServices(rawServices), [rawServices]);
  const allPandits = useMemo(() => normPandits(rawPandits), [rawPandits]);
  const temples = useMemo(() => normTemples(rawTemplesForService), [rawTemplesForService]);

  /**
   * The havan/anushthan tier ladder for this service, or null.
   *
   * Most pujas are not sold as tiers, so "havan" is only a valid `?tab=` value
   * for the ones that are — a service without a ladder falls back to Overview
   * rather than rendering an empty tab, and never shows the tab button at all.
   */
  const havanStructure = useMemo(() => getHavanStructure(s), [s]);

  // URL-backed, not component memory — see useUrlTab. This is the actual fix
  // for the "Pandits tab → refresh → back to Overview" bug: activeTab used
  // to live only in useState, which a full reload always destroys, and
  // nothing in this file ever restored it from anywhere.
  const [activeTab, setActiveTab] = useUrlTab<Tab>(havanStructure ? TAB_KEYS_HAVAN : TAB_KEYS, "overview");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Fair, market-aware rotation instead of a frozen rating sort — same
  // engine and pattern as /pandits and the temple detail page, scoped to
  // this service. Always enabled (not just on the Pandits tab): a small
  // preview now renders on Overview too (docs/SEO_ARCHITECTURE.md, Phase 6 —
  // a service page must link to pandits who perform it without requiring a
  // tab click first), and it must go through the same rotation as the full
  // tab, never a separate "SEO ranking".
  const fairScores = useFairRanking(undefined, s?.id, { enabled: Boolean(s) });
  const pandits = useMemo(() => {
    if (!s) return [];
    const list = allPandits.filter((p) => p.services.includes(s.id));
    return [...list].sort((a, b) => {
      if (fairScores) {
        const diff = (fairScores.get(b.id) ?? -Infinity) - (fairScores.get(a.id) ?? -Infinity);
        if (diff) return diff;
      }
      return b.rating - a.rating;
    });
  }, [allPandits, s, fairScores]);
  const previewPandits = useMemo(() => pandits.slice(0, 6), [pandits]);

  /**
   * The only rating a service can honestly show.
   *
   * `reviewable_type` is pandit | temple | platform — a service is not
   * reviewable and `services` carries no rating, review or booking column.
   * The hero and the Reviews tab used to print "4.9", "2,450+ reviews" and
   * "2,450+ Bookings" as literals: numbers nothing in this system measures,
   * shown to devotees deciding who to trust with a puja.
   *
   * What IS real is the reviews devotees left on the pandits who perform this
   * puja. Weighted by each pandit's review count so one 5-star pandit with a
   * single review cannot outvote ten reviews spread across the rest. Zero
   * reviews yields null, and every caller below then shows nothing rather
   * than a 0.0 that reads as a bad service.
   */
  const panditRating = useMemo(() => {
    const rated = pandits.filter((p) => p.reviews > 0);
    const count = rated.reduce((n, p) => n + p.reviews, 0);
    if (!count) return null;
    const weighted = rated.reduce((sum, p) => sum + p.rating * p.reviews, 0);
    return { average: weighted / count, count, pandits: rated.length };
  }, [pandits]);
  // Exposure reporting must always match exactly what's visible right now —
  // the Overview preview or the full Pandits tab (its own top 6), never
  // both, never neither. The Havan tab renders no pandit cards at all, so it
  // reports none: crediting six pandits with an impression nobody saw would
  // feed the fair-rotation engine an event that never happened.
  const visiblePandits = activeTab === "havan"
    ? []
    : activeTab === "pandits" ? pandits.slice(0, 6) : previewPandits;
  useReportExposure(visiblePandits.map((p) => p.id), {
    service: s?.id,
    enabled: Boolean(s),
  });

  /**
   * "Someone opened this puja." The one write behind the homepage's
   * popular-online-pujas order — without it that strip can only ever show the
   * admin's own guess at what is popular.
   *
   * Keyed on the slug, not the loaded object, so React StrictMode's double
   * mount and every re-render after it do not each count as a visit; the
   * server dedups per visitor per hour on top of that. Failure is ignored on
   * purpose — a devotee reading about a puja must never see an analytics
   * error, and a lost view is worth nothing.
   */
  useEffect(() => {
    if (!s?.id) return;
    apiClient.trackServiceView(s.id).catch(() => {});
  }, [s?.id]);

  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 620);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 620);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Hook call must be unconditional (before the loading/error early returns
  // below) — see docs/SEO_ARCHITECTURE.md. Passing null until data arrives.
  useStructuredData(s ? (() => {
    const apiRaw = rawService as { faqs?: { q: string; a: string }[]; short_description?: string | null; image_url?: string | null; meta_title?: string | null } | null;
    const staticFallback = getServiceMeta(s.id);
    const faqsForSchema = apiRaw?.faqs?.length ? apiRaw.faqs : [];
    return [
      organizationSchema(),
      websiteSchema(),
      webPageSchema({
        path: `/services/${s.id}`,
        name: apiRaw?.meta_title || `${s.name} — Puja & Havan Service`,
        aboutId: serviceId(`/services/${s.id}`),
      }),
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Services", path: "/services" },
        { name: s.name, path: `/services/${s.id}` },
      ]),
      serviceSchema({
        name: s.name, path: `/services/${s.id}`,
        description: s.desc || apiRaw?.short_description || staticFallback.tagline,
        image: apiRaw?.image_url || staticFallback.heroImg,
      }),
      faqPageSchema(faqsForSchema),
    ];
  })() : null);

  if (loading) return <div className="section"><div className="shell"><Loading lines={1} type="detail" /></div></div>;
  if (error || !s) return <div className="section"><div className="shell"><ErrorState message={error || "Service not found"} /></div></div>;

  const allRelated = services.filter((x) => x.id !== s.id && x.cat === s.cat);
  const related = allRelated.slice(0, isMobile ? 6 : 4);
  const hasMoreRelated = allRelated.length > (isMobile ? 6 : 4);
  /**
   * Admin-managed content, from the API. `serviceMeta` is no longer the source
   * of truth — it survives only as a fallback so the 32 services seeded before
   * this feature existed do not suddenly render empty sections. Once a service
   * has admin content, none of the static table is used for it.
   */
  const api = rawService as unknown as {
    benefits?: { title: string; detail?: string; icon?: string }[];
    process?: { step?: number; title: string; detail?: string; duration?: string }[];
    faqs?: { q: string; a: string }[];
    samagri?: ({ item: string; qty?: string } | string)[];
    image_url?: string | null;
    is_online_available?: boolean;
    online_note?: string | null;
    onlinePandits?: { id: string; slug?: string; name: string; img?: string; city?: string }[];
    recommended_muhurat?: string | null;
    short_description?: string | null;
    meta_title?: string | null;
    meta_description?: string | null;
    /** services.content_hi — see migration 0011. Every key optional. */
    content_hi?: {
      name?: string; shortDescription?: string; description?: string;
      estimatedDuration?: string; recommendedMuhurat?: string; onlineNote?: string;
      metaTitle?: string; metaDescription?: string;
      benefits?: { title?: string; detail?: string }[];
      process?: { title?: string; detail?: string; duration?: string }[];
      faqs?: { q?: string; a?: string }[];
      samagri?: { item?: string }[];
    } | null;
  } | null;

  const staticMeta = getServiceMeta(s.id);

  /**
   * The Hindi an admin's save produced (services.content_hi, migration 0011),
   * used only while the reader has Hindi selected.
   *
   * Applied field by field with `|| english` rather than swapping the whole
   * document: a translation can legitimately be missing a key — the model
   * skipped it, the field was added after the last save, or a human deleted a
   * bad rendering — and the reader should get English for that one field
   * rather than a blank section.
   */
  const hi = lang === "hi" ? api?.content_hi ?? null : null;
  /** Hindi for row i of a list, but only when the two line up. */
  const hiRow = <T,>(rows: T[] | undefined, i: number): T | undefined =>
    (Array.isArray(rows) ? rows[i] : undefined);

  const benefits = (api?.benefits?.length
    // The icon an admin chose for this benefit, falling back to the om only
    // when none was picked — it used to be hardcoded here, so every benefit
    // on every service carried the same glyph no matter what it was about.
    ? api.benefits.map((b, i) => ({
        icon: b.icon?.trim() || "🕉️",
        title: hiRow(hi?.benefits, i)?.title || b.title,
        detail: hiRow(hi?.benefits, i)?.detail || b.detail,
      }))
    : staticMeta.benefits.map((b) => ({ ...b, detail: undefined as string | undefined })));

  const process = (api?.process?.length
    ? api.process.map((p, i) => ({
        step: p.step ?? i + 1,
        title: hiRow(hi?.process, i)?.title || p.title,
        desc: hiRow(hi?.process, i)?.detail || p.detail || "",
        duration: hiRow(hi?.process, i)?.duration || p.duration,
      }))
    : staticMeta.process.map((p) => ({ ...p, duration: undefined as string | undefined })));

  const faqs = api?.faqs?.length
    ? api.faqs.map((f, i) => ({
        q: hiRow(hi?.faqs, i)?.q || f.q,
        a: hiRow(hi?.faqs, i)?.a || f.a,
      }))
    : [];

  // samagri arrives as [{item, qty}] from the admin editor, but older seeded
  // rows are a plain string[]. Normalise both to a display string.
  const samagriItems: string[] = (api?.samagri?.length
    ? api.samagri.map((x, i) => {
        const hiItem = hiRow(hi?.samagri, i)?.item;
        if (typeof x === "string") return hiItem || x;
        // The quantity is a number and a unit; it is not translated, so the
        // Hindi name is joined onto the English quantity rather than dropped.
        return [hiItem || x.item, x.qty].filter(Boolean).join(" — ");
      })
    : (s.samagri || []));

  const heroImg = api?.image_url || staticMeta.heroImg;
  const tagline = hi?.shortDescription || api?.short_description || staticMeta.tagline;
  const serviceName = hi?.name || s.name;
  const serviceDesc = hi?.description || s.desc;
  const onlineNote = hi?.onlineNote || api?.online_note;

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    ...(havanStructure ? [{ key: "havan" as Tab, label: "Havan" }] : []),
    { key: "pandits", label: "Pandits" },
    { key: "samagri", label: "Samagri" },
    { key: "reviews", label: "Reviews" },
  ];

  return (
    <div className="hp-sacred-section" style={{ minHeight: "100vh", position: "relative", overflow: "hidden" }}>
      <Seo
        title={hi?.metaTitle || api?.meta_title || `${s.name} — Puja & Havan Service`}
        description={hi?.metaDescription || api?.meta_description || tagline || `${s.name}: traditional significance, process and samagri, with verified Pandits available to perform it at your temple, online, or at home.`}
        path={`/services/${s.id}`}
        image={heroImg}
        noindex={!isServiceIndexable(s)}
      />
      <SacredBackground />
      <div style={{ position: "relative", zIndex: 1 }}>

        {/* ======================== SPLIT HERO ======================== */}
        <section className="sd-hero">
          <div className="shell">
            {/* No admin-uploaded image (services.image_url) -> no hardcoded
                stand-in photo. Single-column (info card only) instead of the
                usual two-column grid, same collapse already used on mobile. */}
            <div className="sd-hero__grid" style={heroImg ? undefined : { gridTemplateColumns: "1fr", maxWidth: 640, margin: "0 auto" }}>
              {/* Left: Image */}
              {heroImg && (
                <div className="sd-hero__img-wrap">
                  <img src={heroImg} alt={serviceName} className="sd-hero__img" fetchPriority="high" />
                  <div className="sd-hero__img-overlay" />
                </div>
              )}

              {/* Right: Info Card */}
              <div className="sd-hero__info">
                <h1 className="sd-hero__title">{serviceName}</h1>
                {panditRating && (
                  <div className="sd-hero__rating">
                    <span className="sd-hero__star">★</span>
                    <strong>{panditRating.average.toFixed(1)}</strong>
                    <span className="sd-hero__reviews">
                      ({panditRating.count} {panditRating.count === 1 ? "review" : "reviews"})
                    </span>
                  </div>
                )}
                <p className="sd-hero__tagline">{tagline}</p>

                <div className="sd-hero__highlights">
                  <div className="sd-hero__hl-row">
                    <span className="sd-hero__hl-icon">⏱</span>
                    <span>Duration: {s.dur}</span>
                  </div>
                  <div className="sd-hero__hl-row">
                    <span className="sd-hero__hl-icon">📿</span>
                    <span>Complete Samagri Kit Included</span>
                  </div>
                  <div className="sd-hero__hl-row">
                    <span className="sd-hero__hl-icon">🔥</span>
                    <span>Includes Havan & Vastu Shanti</span>
                  </div>
                  <div className="sd-hero__hl-row">
                    <span className="sd-hero__hl-icon">👨‍🦳</span>
                    <span>Verified Vedic Pandits</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ======================== TAB NAV ======================== */}
        <nav className="sd-tabs">
          <div className="shell">
            <div className="sd-tabs__list">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  className={`sd-tabs__btn ${activeTab === t.key ? "sd-tabs__btn--active" : ""}`}
                  onClick={() => setActiveTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* ======================== TAB CONTENT ======================== */}

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <section className="section" style={{ paddingTop: 48, paddingBottom: 40 }}>
            <div className="shell">
              <div className="sd-main">
                {/* Text-heavy sections read better in a narrower, centered
                    column than the full shell width — but the pandit/temple
                    card grids below need the full shell width to render at
                    the same card size used everywhere else on the site, so
                    only these four sections get the narrow wrapper. */}
                <div style={{ maxWidth: 860, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>
                  {/* Spiritual Significance */}
                  <div className="sd-card">
                    <h2 className="sd-card__title">
                      <span className="sd-card__title-icon">🕉️</span>
                      Spiritual Significance
                    </h2>
                    <p className="sd-card__text">{serviceDesc}</p>
                    <p className="sd-card__text" style={{ marginTop: 12 }}>
                      This sacred ceremony has been performed for centuries in the Hindu tradition. It is believed to purify the space, remove negative energies, and invite divine blessings for everyone involved. The mantras chanted during the puja create powerful vibrations that bring peace and positive energy.
                    </p>
                  </div>

                  {/* Benefits — Premium Scroll Strip */}
                  {api?.is_online_available && (
                    <div className="sd-online-card">
                      <h3>🌐 Online puja / havan available</h3>
                      <p>{onlineNote || "Yeh puja video call par live karvai ja sakti hai — sankalp aapke naam se."}</p>
                      {api.onlinePandits?.length ? (
                        <>
                          <span className="sd-online-card__label">
                            {api.onlinePandits.length} Pandit ji online available
                          </span>
                          <div className="sd-online-card__pandits">
                            {api.onlinePandits.slice(0, 6).map((op) => (
                              <Link key={op.id} to={`/pandits/${op.slug || op.id}`} className="sd-online-pandit">
                                <img src={op.img || "/assets/img/pandits/default.jpg"} alt="" />
                                <span>{op.name}</span>
                              </Link>
                            ))}
                          </div>
                        </>
                      ) : (
                        <span className="sd-online-card__label">
                          Online ke liye Pandit ji jald hi allocate honge.
                        </span>
                      )}

                      {/* The card used to stop here — "online is possible",
                          and nothing about what that actually involves, which
                          is the exact point a devotee decides it sounds like
                          a scam. /online-havan is the rest of the answer, and
                          it carries this service through so its CTAs can hand
                          the devotee back to the pandits who perform it. */}
                      <Link className="sd-online-card__cta" to={`/online-havan?service=${s.id}`}>
                        <span className="sd-online-card__cta-icon">🔥</span>
                        <span className="sd-online-card__cta-body">
                          <span className="sd-online-card__cta-title">{t("onlineHavan.cardCta")}</span>
                          <span className="sd-online-card__cta-sub">{t("onlineHavan.cardCtaSub")}</span>
                        </span>
                        <Icon name="arrow-right" size={18} />
                      </Link>
                    </div>
                  )}

                  <div className="sd-benefits-section">
                    <div className="sd-benefits-header">
                      <h2 className="sd-card__title" style={{ margin: 0 }}>
                        <span className="sd-card__title-icon">✨</span>
                        Benefits
                      </h2>
                      <span className="sd-benefits-count">{benefits.length} blessings</span>
                    </div>
                    <div className="sd-benefits-strip">
                      {benefits.map((b) => (
                        <div className="sd-benefit-chip" key={b.title}>
                          <div className="sd-benefit-chip__glow" />
                          <div className="sd-benefit-chip__icon">{b.icon}</div>
                          <span className="sd-benefit-chip__label">{b.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── Puja Process — Sacred Journey Timeline ── */}
                  <div className="sd-journey-wrap">
                    {/* Warm cream + golden glow background */}
                    <div className="sd-journey-bg" />
                    <div className="sd-journey-glow" />

                    <div className="sd-journey-head">
                      <span className="sd-journey-head__icon">🪔</span>
                      <div>
                        <h2 className="sd-journey-title">Sacred Journey</h2>
                        <p className="sd-journey-sub">{process.length} steps · Complete Vidhi</p>
                      </div>
                    </div>

                    <div className="sd-journey-steps">
                      {process.map((p, i) => (
                        <motion.div
                          className="sd-journey-step"
                          key={p.step}
                          initial={{ opacity: 0, x: -28 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true, margin: "-30px" }}
                          transition={{ duration: 0.55, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                        >
                          {/* Connector line */}
                          {i < process.length - 1 && (
                            <motion.div
                              className="sd-journey-connector"
                              initial={{ scaleY: 0 }}
                              whileInView={{ scaleY: 1 }}
                              viewport={{ once: true }}
                              transition={{ duration: 0.6, delay: i * 0.12 + 0.3 }}
                              style={{ transformOrigin: "top" }}
                            />
                          )}

                          {/* Badge */}
                          <motion.div
                            className="sd-journey-badge"
                            initial={{ scale: 0, rotate: -30 }}
                            whileInView={{ scale: 1, rotate: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.4, delay: i * 0.12, type: "spring", stiffness: 200 }}
                          >
                            <span className="sd-journey-badge__num">{p.step}</span>
                            <div className="sd-journey-badge__ring" />
                          </motion.div>

                          {/* Content card */}
                          <motion.div
                            className="sd-journey-card"
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.4, delay: i * 0.12 + 0.1 }}
                            whileHover={{ scale: 1.02 }}
                          >
                            <h4 className="sd-journey-card__title">{p.title}</h4>
                            <p className="sd-journey-card__desc">{p.desc}</p>
                            <span className="sd-journey-card__step-label">Step {p.step} of {process.length}</span>
                          </motion.div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Pandits who perform this service — always in the DOM on the
                    default tab (not gated behind the Pandits tab click), so
                    the service page always links out to real pandit profiles
                    (docs/SEO_ARCHITECTURE.md, Phase 6). Runs through the same
                    fair-rotation engine as the full tab — see fairScores/
                    visiblePandits above, never a separate order. */}
                {previewPandits.length > 0 && (
                  <div>
                    <div className="row-between sd-pandits-preview-head">
                      <h2 className="sd-card__title" style={{ margin: 0 }}>
                        <span className="sd-card__title-icon">🙏</span>
                        Pandits who perform this puja
                      </h2>
                      <Link
                        className="row" style={{ color: "var(--gold-deep)", fontWeight: 600, fontSize: ".9rem" }}
                        to={`/services/${s.id}/pandits`}
                      >
                        All {pandits.length} <Icon name="chevron-right" size={16} />
                      </Link>
                    </div>
                    <div className="grid g-3 grid-2up-mobile" style={{ marginTop: 14 }}>
                      {previewPandits.map((p, i) => <PanditCard p={p} key={p.id} index={i} sourceSurface="service_detail_preview" serviceSlug={s.id} />)}
                    </div>
                  </div>
                )}

                {/* Temples where this service is offered — the `temples`
                    filtered list was already computed but never rendered
                    anywhere; a real, cheap internal-linking gap (Phase 6). */}
                {temples.length > 0 && (
                  <div>
                    <h2 className="sd-card__title">
                      <span className="sd-card__title-icon">🛕</span>
                      Temples offering this puja
                    </h2>
                    <div className="grid g-3 grid-2up-mobile" style={{ marginTop: 14 }}>
                      {temples.slice(0, 3).map((tp, i) => <TempleCard t={tp} key={tp.id} index={i} />)}
                    </div>
                  </div>
                )}

                {/* FAQ — back in the narrow readable column, same as the
                    text sections above. Only rendered when there are real,
                    admin-entered FAQs (services.faqs) - an empty heading
                    above blank space reads as a broken page. */}
                {faqs.length > 0 && (
                  <div style={{ maxWidth: 860, width: "100%", margin: "0 auto" }}>
                    <div className="sd-card">
                      <h2 className="sd-card__title">
                        <span className="sd-card__title-icon">❓</span>
                        Frequently Asked Questions
                      </h2>
                      <div className="sd-faq">
                        {faqs.map((f, i) => (
                          <div className={`sd-faq__item ${openFaq === i ? "sd-faq__item--open" : ""}`} key={i}>
                            <button className="sd-faq__q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                              <span>{f.q}</span>
                              <Icon name={openFaq === i ? "chevron-up" : "chevron-down"} size={18} />
                            </button>
                            {openFaq === i && <p className="sd-faq__a">{f.a}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* HAVAN TAB */}
        {activeTab === "havan" && havanStructure && (
          <section className="section" style={{ paddingTop: 48, paddingBottom: 40 }}>
            <div className="shell">
              <HavanSection
                structure={havanStructure}
                serviceId={s.id}
                panditCount={pandits.length}
              />
            </div>
          </section>
        )}

        {/* SAMAGRI TAB */}
        {activeTab === "samagri" && (
          <section className="section" style={{ paddingTop: 48, paddingBottom: 40 }}>
            <div className="shell" style={{ maxWidth: 860 }}>
              <div className="sd-card">
                <h2 className="sd-card__title">
                  <span className="sd-card__title-icon">📿</span>
                  Required Samagri for {serviceName}
                </h2>
                <p className="muted" style={{ margin: "8px 0 20px" }}>
                  Standard list — confirm with pandit ji who arranges what. Many pandits bring the full kit for a small extra amount.
                </p>
                <div className="sd-samagri-grid">
                  {samagriItems.map((x) => (
                    <div className="sd-samagri-item" key={x}>
                      <span className="sd-samagri-check">✓</span>
                      <span>{x}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* PANDITS TAB */}
        {activeTab === "pandits" && (
          <section className="section" style={{ paddingTop: 48, paddingBottom: 40 }}>
            <div className="shell">
              <h2 className="section-title" style={{ fontSize: "clamp(1.5rem,2.6vw,2rem)", marginBottom: 32 }}>
                Pandits who perform {serviceName}
              </h2>
              {pandits.length ? (
                <>
                  <div className="grid g-3 grid-2up-mobile">{pandits.slice(0, 9).map((p, i) => <PanditCard p={p} key={p.id} index={i} sourceSurface="service_detail" serviceSlug={s.id} />)}</div>
                  {pandits.length > 9 && (
                    <div className="text-c" style={{ marginTop: 26 }}>
                      <Link className="btn btn-outline" to={`/services/${s.id}/pandits`}>See all {pandits.length} pandits</Link>
                    </div>
                  )}
                </>
              ) : (
                <EmptyState msg="No pandit has listed this service yet. Try the directory or send an enquiry." />
              )}
            </div>
          </section>
        )}

        {/* REVIEWS TAB */}
        {activeTab === "reviews" && (
          <section className="section" style={{ paddingTop: 48, paddingBottom: 40 }}>
            <div className="shell" style={{ maxWidth: 660 }}>
              {/* Real numbers only. The "Bookings" stat is gone rather than
                  recalculated: this platform does not take bookings — a
                  devotee contacts the pandit directly — so there has never
                  been anything behind that figure to count. */}
              <div className="sd-card text-c" style={{ padding: "50px 30px" }}>
                {panditRating ? (
                  <>
                    <div style={{ fontSize: "3rem", marginBottom: 12 }}>⭐</div>
                    <h2 style={{ fontSize: "1.4rem", marginBottom: 8 }}>
                      {panditRating.average.toFixed(1)} out of 5
                    </h2>
                    <p className="muted">
                      From {panditRating.count} {panditRating.count === 1 ? "review" : "reviews"} across{" "}
                      {panditRating.pandits} {panditRating.pandits === 1 ? "pandit" : "pandits"} who perform {serviceName}
                    </p>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: "3rem", marginBottom: 12 }}>🪔</div>
                    <h2 style={{ fontSize: "1.4rem", marginBottom: 8 }}>No reviews yet</h2>
                    <p className="muted">
                      After your puja you can leave the first review for the Pandit Ji who performs it.
                    </p>
                  </>
                )}
                <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 40 }}>
                  <div><strong style={{ fontSize: "1.6rem", color: "var(--gold-deep)" }}>{pandits.length}</strong><br /><span className="muted">Pandits</span></div>
                  {/* A "0 Temples" counter is not a fact worth printing —
                      it just tells a devotee the directory is empty. The
                      tile appears with the first temple that offers this
                      puja, like the section further up the page. */}
                  {temples.length > 0 && (
                    <div><strong style={{ fontSize: "1.6rem", color: "var(--gold-deep)" }}>{temples.length}</strong><br /><span className="muted">Temples</span></div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ======================== RELATED SERVICES ======================== */}
        <section className="section section--cream" style={{ paddingTop: 40 }}>
          <div className="shell">
            <div className="row-between" style={{ marginBottom: 26, flexWrap: "wrap", gap: 12 }}>
              <h2 className="section-title section-title--left" style={{ fontSize: "clamp(1.5rem,2.6vw,2rem)", marginBottom: 0 }}>Related services</h2>
              {hasMoreRelated && (
                <Link className="btn btn-outline btn-sm" to="/services">See All</Link>
              )}
            </div>
            <div className="grid g-4 svc-related-grid">
              {related.map((r, i) => <ServiceCard s={r} key={r.id} index={i} variant="grid" />)}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
