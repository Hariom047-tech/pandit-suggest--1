import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../lib/icons";
import { Seo } from "../lib/Seo";
import { useLang } from "../lib/i18n";
import { useServices } from "../hooks/useData";
import { normServices } from "../lib/normalize";
import { LiveSankalpScene } from "../components/online/LiveSankalpScene";
import { RitualDay } from "../components/online/RitualDay";
import { SankalpPreview } from "../components/online/SankalpPreview";
import {
  AVOID_AT_HOME,
  COMPARISON,
  DELIVERABLES,
  DO_AT_HOME,
  FAQS,
  JOURNEY,
  MUHURAT,
  PILLARS,
  SAMAGRI,
  TEMPLE_FACTS,
  TRUST_CHECKS,
  pick,
} from "../data/onlineHavan";
import {
  useStructuredData,
  breadcrumbSchema,
  faqPageSchema,
  organizationSchema,
  webPageSchema,
  websiteSchema,
} from "../lib/structuredData";

/**
 * /online-havan — how a havan performed for you at a temple you are not
 * standing in actually works, start to finish.
 *
 * Reached from the "Online puja / havan available" card on a service page and
 * from the Online filter on /services. That card used to be the end of the
 * road: it said online was possible and then had nothing more to say, which
 * is the exact point at which a devotee decides the whole thing sounds like a
 * scam. This page is the answer to the question the card provokes — what is
 * done, by whom, at what hour, with what said over the fire, and what comes
 * back to me afterwards.
 *
 * The content is editorial and lives in data/onlineHavan.ts. The two
 * deliberately un-generic pieces of it are the ritual-day walkthrough (what
 * the pandit is doing and what you are doing, at the same minute) and the
 * sankalp that assembles itself as the reader types — see those components.
 *
 * `?service=<slug>` is carried in from whichever service page linked here, so
 * every CTA can hand the devotee back to the pandits who perform that
 * specific puja rather than dumping them in the full directory.
 */

/** In-page jump targets — the page is long by design, so it is navigable. */
const JUMPS = [
  { id: "how", key: "jumpHow" },
  { id: "journey", key: "jumpJourney" },
  { id: "day", key: "jumpDay" },
  { id: "sankalp", key: "jumpSankalp" },
  { id: "home", key: "jumpHome" },
  { id: "compare", key: "jumpCompare" },
  { id: "faq", key: "jumpFaq" },
] as const;

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default function OnlineHavan() {
  const { t, lang } = useLang();
  const [params] = useSearchParams();
  const fromService = params.get("service");
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const { data: rawServices } = useServices();
  const services = useMemo(() => normServices(rawServices), [rawServices]);
  /** Only pujas an admin has actually marked as available online. */
  const onlineServices = useMemo(
    () => services.filter((s) => s.onlineAvailable).slice(0, 6),
    [services],
  );
  /** The puja this devotee arrived from, when they arrived from one. */
  const source = useMemo(
    () => (fromService ? services.find((s) => s.id === fromService) || null : null),
    [services, fromService],
  );

  /** Back to the pandits for the puja they came from, or the online list. */
  const panditsHref = fromService ? `/services/${fromService}/pandits` : "/services?online=1";

  useStructuredData([
    organizationSchema(),
    websiteSchema(),
    webPageSchema({ path: "/online-havan", name: "Online Havan & Puja — How It Works" }),
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Services", path: "/services" },
      { name: "Online Havan", path: "/online-havan" },
    ]),
    faqPageSchema(FAQS.map((f) => ({ q: f.q.en, a: f.a.en })), "/online-havan"),
  ]);

  return (
    <>
      <Seo
        title="Online Havan & Puja — the full process, start to finish"
        description="How an online havan is really performed: the ritual hour by hour, what your sankalp needs, what you do at home during the live call, and what reaches your door afterwards."
        path="/online-havan"
      />

      {/* ═══════════════════ HERO ═══════════════════ */}
      <section className="oh-hero">
        <div className="oh-hero__glow" aria-hidden="true" />
        <div className="shell oh-hero__shell">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link to="/">{t("nav.home")}</Link> <span>/</span>{" "}
            <Link to="/services">{t("nav.services")}</Link> <span>/</span> {t("onlineHavan.crumb")}
          </nav>

          <div className="oh-hero__grid">
            <div className="oh-hero__copy">
              <span className="oh-hero__pill">
                <span className="oh-hero__pill-dot" />
                {t("onlineHavan.pill")}
              </span>
              <h1 className="oh-hero__title">
                {t("onlineHavan.title1")}{" "}
                <span className="gold-text">{t("onlineHavan.titleGold")}</span>{" "}
                {t("onlineHavan.title2")}
              </h1>
              <p className="oh-hero__sub">{t("onlineHavan.sub")}</p>
              {source && (
                <p className="oh-hero__from">
                  {t("onlineHavan.arrivedFrom")} <Link to={`/services/${source.id}`}>{source.name}</Link>
                </p>
              )}
              <div className="oh-hero__cta">
                <a className="btn btn-gold" href="#day">
                  {t("onlineHavan.heroCta")} <Icon name="arrow-right" size={16} />
                </a>
                <Link className="btn btn-ghost" to={panditsHref}>
                  {t("onlineHavan.heroCta2")}
                </Link>
              </div>
            </div>

            <div className="oh-hero__scene">
              <LiveSankalpScene />
              <div className="oh-hero__scene-legend">
                <span><i className="oh-legend-dot oh-legend-dot--out" />{t("onlineHavan.legendOut")}</span>
                <span><i className="oh-legend-dot oh-legend-dot--back" />{t("onlineHavan.legendBack")}</span>
              </div>
            </div>
          </div>

          {/* the place the fire is actually lit */}
          <div className="oh-facts">
            {TEMPLE_FACTS.map((f, i) => (
              <Reveal className="oh-fact" delay={i * 0.07} key={f.label.en}>
                <span className="oh-fact__value">{pick(f.value, lang)}</span>
                <span className="oh-fact__label">{pick(f.label, lang)}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ JUMP NAV ═══════════════════ */}
      <nav className="oh-jump" aria-label={t("onlineHavan.jumpLabel")}>
        <div className="shell oh-jump__shell">
          {JUMPS.map((j) => (
            <a className="oh-jump__link" href={`#${j.id}`} key={j.id}>
              {t(`onlineHavan.${j.key}`)}
            </a>
          ))}
        </div>
      </nav>

      {/* ═══════════════════ WHAT IT ACTUALLY IS ═══════════════════ */}
      <section className="section oh-section" id="how">
        <div className="shell">
          <header className="oh-head">
            <span className="oh-head__eyebrow">{t("onlineHavan.howEyebrow")}</span>
            <h2 className="oh-head__title">{t("onlineHavan.howTitle")}</h2>
            <p className="oh-head__sub">{t("onlineHavan.howSub")}</p>
          </header>

          <div className="oh-pillars">
            {PILLARS.map((p, i) => (
              <Reveal className={`oh-pillar oh-pillar--${p.id}`} delay={i * 0.1} key={p.id}>
                <span className="oh-pillar__icon">{p.icon}</span>
                <h3 className="oh-pillar__title">{pick(p.title, lang)}</h3>
                <p className="oh-pillar__text">{pick(p.text, lang)}</p>
                <ul className="oh-pillar__points">
                  {p.points.map((pt) => (
                    <li key={pt.en}>
                      <Icon name="check" size={14} />
                      <span>{pick(pt, lang)}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>

          <Reveal className="oh-shastra">
            <span className="oh-shastra__icon">📜</span>
            <div>
              <h3>{t("onlineHavan.shastraTitle")}</h3>
              <p>{t("onlineHavan.shastraText")}</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════ BOOKING JOURNEY ═══════════════════ */}
      <section className="section oh-section" id="journey">
        <div className="shell">
          <header className="oh-head">
            <span className="oh-head__eyebrow">{t("onlineHavan.journeyEyebrow")}</span>
            <h2 className="oh-head__title">{t("onlineHavan.journeyTitle")}</h2>
            <p className="oh-head__sub">{t("onlineHavan.journeySub")}</p>
          </header>

          <ol className="oh-journey">
            {JOURNEY.map((j, i) => (
              <motion.li
                className="oh-journey__step"
                key={j.id}
                initial={{ opacity: 0, x: -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: (i % 4) * 0.08, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="oh-journey__marker">
                  <span className="oh-journey__icon"><Icon name={j.icon} size={18} /></span>
                  {i < JOURNEY.length - 1 && <span className="oh-journey__line" aria-hidden="true" />}
                </div>
                <div className="oh-journey__body">
                  <span className="oh-journey__when">{pick(j.when, lang)}</span>
                  <h3 className="oh-journey__title">{pick(j.title, lang)}</h3>
                  <p className="oh-journey__text">{pick(j.text, lang)}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>


      {/* ═══════════════════ THE RITUAL DAY ═══════════════════
          Deliberately AFTER the journey: it describes what a devotee will
          watch happen once a Pandit Ji has been chosen and spoken to, and
          reads as an instruction sheet if it arrives before that. The gate
          below says so in as many words. */}
      <section className="section oh-section oh-section--ritual" id="day">
        <div className="shell">
          <header className="oh-head">
            <span className="oh-head__eyebrow">{t("onlineHavan.dayEyebrow")}</span>
            <h2 className="oh-head__title">{t("onlineHavan.dayTitle")}</h2>
            <p className="oh-head__sub">{t("onlineHavan.daySub")}</p>
          </header>

          <Reveal className="oh-gate">
            <span className="oh-gate__icon"><Icon name="message-circle" size={20} /></span>
            <div className="oh-gate__body">
              <h3>{t("onlineHavan.gateTitle")}</h3>
              <p>{t("onlineHavan.gateText")}</p>
            </div>
            <Link className="btn btn-gold btn-sm oh-gate__cta" to={panditsHref}>
              {t("onlineHavan.gateCta")} <Icon name="arrow-right" size={15} />
            </Link>
          </Reveal>

          <RitualDay />
        </div>
      </section>

      {/* ═══════════════════ SANKALP ═══════════════════ */}
      <section className="section oh-section oh-section--cream" id="sankalp">
        <div className="shell">
          <header className="oh-head">
            <span className="oh-head__eyebrow">{t("onlineHavan.sankalpEyebrow")}</span>
            <h2 className="oh-head__title">{t("onlineHavan.sankalpTitle")}</h2>
            <p className="oh-head__sub">{t("onlineHavan.sankalpSub")}</p>
          </header>
          <SankalpPreview />
        </div>
      </section>

      {/* ═══════════════════ AT HOME ═══════════════════ */}
      <section className="section oh-section" id="home">
        <div className="shell">
          <header className="oh-head">
            <span className="oh-head__eyebrow">{t("onlineHavan.homeEyebrow")}</span>
            <h2 className="oh-head__title">{t("onlineHavan.homeTitle")}</h2>
            <p className="oh-head__sub">{t("onlineHavan.homeSub")}</p>
          </header>

          <div className="oh-rules">
            <Reveal className="oh-rules__col oh-rules__col--do">
              <h3><Icon name="check-circle" size={18} /> {t("onlineHavan.doTitle")}</h3>
              <ul>
                {DO_AT_HOME.map((r) => <li key={r.text.en}>{pick(r.text, lang)}</li>)}
              </ul>
            </Reveal>
            <Reveal className="oh-rules__col oh-rules__col--avoid" delay={0.1}>
              <h3><Icon name="alert-circle" size={18} /> {t("onlineHavan.avoidTitle")}</h3>
              <ul>
                {AVOID_AT_HOME.map((r) => <li key={r.text.en}>{pick(r.text, lang)}</li>)}
              </ul>
            </Reveal>
          </div>

          {/* what goes into the fire on your behalf */}
          <Reveal className="oh-samagri">
            <h3 className="oh-samagri__title">
              <span>🌿</span> {t("onlineHavan.samagriTitle")}
            </h3>
            <p className="oh-samagri__sub">{t("onlineHavan.samagriSub")}</p>
            <ul className="oh-samagri__list">
              {SAMAGRI.map((s) => (
                <li className={`oh-samagri__item${s.key ? " is-key" : ""}`} key={s.name.en}>
                  <span className="oh-samagri__name">{pick(s.name, lang)}</span>
                  <span className="oh-samagri__note">{pick(s.note, lang)}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════ WHAT YOU RECEIVE ═══════════════════ */}
      <section className="section oh-section oh-section--cream">
        <div className="shell">
          <header className="oh-head">
            <span className="oh-head__eyebrow">{t("onlineHavan.receiveEyebrow")}</span>
            <h2 className="oh-head__title">{t("onlineHavan.receiveTitle")}</h2>
          </header>
          <div className="oh-deliver">
            {DELIVERABLES.map((d, i) => (
              <Reveal className="oh-deliver__card" delay={i * 0.06} key={d.title.en}>
                <span className="oh-deliver__icon"><Icon name={d.icon} size={20} /></span>
                <h3>{pick(d.title, lang)}</h3>
                <p>{pick(d.text, lang)}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ COMPARISON + MUHURAT ═══════════════════ */}
      <section className="section oh-section" id="compare">
        <div className="shell">
          <header className="oh-head">
            <span className="oh-head__eyebrow">{t("onlineHavan.compareEyebrow")}</span>
            <h2 className="oh-head__title">{t("onlineHavan.compareTitle")}</h2>
            <p className="oh-head__sub">{t("onlineHavan.compareSub")}</p>
          </header>

          <Reveal className="oh-compare">
            <div className="oh-compare__scroll">
              <table className="oh-compare__table">
                <thead>
                  <tr>
                    <th scope="col">{t("onlineHavan.colAspect")}</th>
                    <th scope="col"><span className="oh-compare__h">🌐 {t("onlineHavan.colOnline")}</span></th>
                    <th scope="col"><span className="oh-compare__h">🛕 {t("onlineHavan.colInPerson")}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.aspect.en} className={row.same ? "is-same" : ""}>
                      <th scope="row">{pick(row.aspect, lang)}</th>
                      <td>
                        {row.same && <span className="oh-compare__same" aria-hidden="true">=</span>}
                        {pick(row.online, lang)}
                      </td>
                      <td>{pick(row.inPerson, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="oh-compare__foot">{t("onlineHavan.compareFoot")}</p>
          </Reveal>

          <Reveal className="oh-muhurat">
            <h3 className="oh-muhurat__title">
              <span>📅</span> {t("onlineHavan.muhuratTitle")}
            </h3>
            <div className="oh-muhurat__grid">
              {MUHURAT.map((m) => (
                <div className={`oh-muhurat__card${m.prime ? " is-prime" : ""}`} key={m.label.en}>
                  <span className="oh-muhurat__label">{pick(m.label, lang)}</span>
                  <span className="oh-muhurat__detail">{pick(m.detail, lang)}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════ TRUST ═══════════════════ */}
      <section className="section oh-section oh-section--cream">
        <div className="shell">
          <header className="oh-head">
            <span className="oh-head__eyebrow">{t("onlineHavan.trustEyebrow")}</span>
            <h2 className="oh-head__title">{t("onlineHavan.trustTitle")}</h2>
          </header>
          <div className="oh-trust">
            {TRUST_CHECKS.map((c, i) => (
              <Reveal className="oh-trust__card" delay={i * 0.08} key={c.title.en}>
                <span className="oh-trust__n">{i + 1}</span>
                <h3>{pick(c.title, lang)}</h3>
                <p>{pick(c.text, lang)}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ FAQ ═══════════════════ */}
      <section className="section oh-section" id="faq">
        <div className="shell">
          <header className="oh-head">
            <span className="oh-head__eyebrow">{t("onlineHavan.faqEyebrow")}</span>
            <h2 className="oh-head__title">{t("onlineHavan.faqTitle")}</h2>
          </header>
          <div className="oh-faq">
            {FAQS.map((f, i) => (
              <div className={`oh-faq__item${openFaq === i ? " is-open" : ""}`} key={f.q.en}>
                <button
                  type="button"
                  className="oh-faq__q"
                  aria-expanded={openFaq === i}
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span>{pick(f.q, lang)}</span>
                  <Icon name="chevron-down" size={18} />
                </button>
                {openFaq === i && (
                  <motion.div
                    className="oh-faq__a"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <p>{pick(f.a, lang)}</p>
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ PUJAS AVAILABLE ONLINE ═══════════════════ */}
      {onlineServices.length > 0 && (
        <section className="section oh-section oh-section--cream">
          <div className="shell">
            <header className="oh-head">
              <span className="oh-head__eyebrow">{t("onlineHavan.pujasEyebrow")}</span>
              <h2 className="oh-head__title">{t("onlineHavan.pujasTitle")}</h2>
            </header>
            <div className="oh-pujas">
              {onlineServices.map((s, i) => (
                <Reveal delay={i * 0.05} key={s.id}>
                  <Link className="oh-puja" to={`/services/${s.id}`}>
                    <span className="oh-puja__live">● {t("ohp.live")}</span>
                    <h3>{s.name}</h3>
                    {(s.tag || s.desc) && <p>{s.tag || s.desc}</p>}
                    <span className="oh-puja__go">
                      {t("common.learnMore")} <Icon name="arrow-right" size={14} />
                    </span>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════ CTA ═══════════════════ */}
      <section className="oh-cta">
        <div className="shell oh-cta__inner">
          <div>
            <h2>{t("onlineHavan.ctaTitle")}</h2>
            <p>{t("onlineHavan.ctaText")}</p>
          </div>
          <div className="oh-cta__buttons">
            <Link className="btn btn-gold" to={panditsHref}>
              {t("onlineHavan.ctaButton")} <Icon name="arrow-right" size={16} />
            </Link>
            <Link className="btn btn-ghost" to="/contact">
              {t("nav.contact")}
            </Link>
          </div>
        </div>
        <p className="oh-cta__note">{t("onlineHavan.disclaimer")}</p>
      </section>
    </>
  );
}
