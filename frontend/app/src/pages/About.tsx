import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../lib/icons";
import { useStats } from "../hooks/useData";
import { Reveal, RevealStagger, revealItem } from "../components/ui/Reveal";
import { CountUp } from "../components/ui/CountUp";
import { motion } from "framer-motion";
import { WriteReview } from "../components/ui/WriteReview";
import { useReviews } from "../hooks/useData";
import { normReviews } from "../lib/normalize";
import { ReviewCard } from "../components/ui/ReviewCard";
import { Seo } from "../lib/Seo";
import { useHasTemples } from "../hooks/useHasTemples";
import { useLang } from "../lib/i18n";

// Only the icon and the key stay here; every word lives in the dictionary so
// the page reads in whichever language the devotee has chosen. Same shape the
// HowItWorks page already used for its four steps.
const VERIFY_STEPS = [
  { icon: "inbox", key: "step1" },
  { icon: "video", key: "step2" },
  { icon: "temple", key: "step3" },
  { icon: "award", key: "step4" },
  { icon: "star", key: "step5" },
] as const;

/** Us / them, as dictionary key stems: about.diffNa and about.diffNb. */
const DIFF_KEYS = ["diff1", "diff2", "diff3", "diff4", "diff5", "diff6", "diff7"] as const;

/** The revenue rows — key stem gives about.revNk (label) and about.revNv. */
const REVENUE_KEYS = ["rev1", "rev2", "rev3", "rev4"] as const;

export default function About() {
  const { t } = useLang();
  const hasTemples = useHasTemples();
  // Reviews of PanditSuggest itself, not of any one pandit or temple.
  const { data: rawPlatformReviews } = useReviews("platform");
  const platformReviews = useMemo(() => normReviews(rawPlatformReviews), [rawPlatformReviews]);

  const { data: stats } = useStats();
  // No hardcoded fallback — see components/hero/HeroAstrotalk.tsx for the same
  // fix. These claimed "500+ Verified Pandits" and "10K+ Happy Families"
  // whenever the API returned nothing, which on the clean production database
  // is always. Unverifiable numbers on an About page are exactly the kind a
  // visitor is entitled to take literally.
  const displayStats = stats?.length ? stats : [];
  return (
    <>
      <Seo
        title="About Us"
        description="PanditSuggest is a directory, not a booking agent — you contact Pandits directly and keep 100% of your dakshina. Learn how our four-step verification process works."
        path="/about"
      />
      <section className="page-hero">
        <img src="/assets/img/mandala.svg" className="watermark watermark--tl" alt="" />
        <img src="/assets/img/mandala.svg" className="watermark watermark--tr" alt="" />
        <div className="shell" style={{ position: "relative", zIndex: 1 }}>
          <nav className="crumbs" aria-label="Breadcrumb"><Link to="/">{t("common.home")}</Link> <span>/</span> {t("about.crumb")}</nav>
          <h1 className="section-title" style={{ marginTop: 10 }}>{t("about.heroTitle1")}<br /><span className="gold-text">{t("about.heroTitleGold")}</span></h1>
          <svg className="ornament" viewBox="0 0 190 16" aria-hidden="true"><path d="M6 8h64M120 8h64" fill="none" stroke="#d4a017" strokeWidth="1.6" /><path d="M84 8l11-6 11 6-11 6z" fill="none" stroke="#d4a017" strokeWidth="1.6" /></svg>
          <p className="section-sub">{t("about.heroSub")}</p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 52 }}>
        <div className="shell grid g-2" style={{ alignItems: "start", gap: 40 }}>
          <div>
            <span className="eyebrow">{t("about.missionEyebrow")}</span>
            <h2 className="section-title section-title--left" style={{ fontSize: "clamp(1.6rem,2.8vw,2.2rem)", marginTop: 10 }}>{t("about.missionTitle")}</h2>
            <p style={{ marginTop: 16, color: "#4d4a45" }}>{t("about.missionP1")}</p>
            <p style={{ marginTop: 14, color: "#4d4a45" }}>{t("about.missionP2")}</p>
            <p style={{ marginTop: 14, color: "#4d4a45" }}>{t("about.missionP3")}</p>
          </div>
          <div className="stack" style={{ gap: 18 }}>
            <div className="card card-pad card--cream">
              <h3 style={{ fontSize: "1.2rem" }}>{t("about.doTitle")}</h3>
              <ul className="dot-list" style={{ marginTop: 10 }}>
                {["do1", "do2", "do3", "do4"].map((k) => <li key={k}>{t(`about.${k}`)}</li>)}
              </ul>
            </div>
            <div className="card card-pad">
              <h3 style={{ fontSize: "1.2rem" }}>{t("about.neverTitle")}</h3>
              <ul className="dot-list" style={{ marginTop: 10 }}>
                {["never1", "never2", "never3", "never4"].map((k) => <li key={k}>{t(`about.${k}`)}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {displayStats.length > 0 && (
      <section className="section section--cream section--tight">
        <div className="shell">
          <div className="grid g-4 about-stats-grid">
            {displayStats.map((s) => (
              <div className="card card-pad text-c" key={s.label}>
                <span style={{ color: "var(--gold)" }}><Icon name={s.icon || "star"} size={40} /></span>
                <div style={{ marginTop: 10 }}><CountUp raw={s.num} /></div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      <section className="section" id="verify" style={{ position: "relative" }}>
        <img src="/assets/img/lotus.svg" className="watermark watermark--bl" alt="" style={{ width: 240 }} />
        <div className="shell">
          <h2 className="section-title">{t("about.verifyTitle")}</h2>
          <svg className="ornament" viewBox="0 0 190 16" aria-hidden="true"><path d="M6 8h64M120 8h64" fill="none" stroke="#d4a017" strokeWidth="1.6" /><path d="M84 8l11-6 11 6-11 6z" fill="none" stroke="#d4a017" strokeWidth="1.6" /></svg>
          <p className="section-sub">{t("about.verifySub")}</p>
          <RevealStagger className="grid g-3 about-verify-grid" style={{ marginTop: 40 }}>
            {VERIFY_STEPS.map((s, i) => (
              <motion.article className="card step" key={s.key} variants={revealItem}>
                <span className="step-n">0{i + 1}</span>
                <div className="step-ico"><Icon name={s.icon} size={30} /></div>
                <h3>{t(`about.${s.key}h`)}</h3>
                <p>{t(`about.${s.key}p`)}</p>
              </motion.article>
            ))}
          </RevealStagger>
        </div>
      </section>

      <section className="section section--cream">
        <div className="shell">
          <h2 className="section-title">{t("about.vsTitle")}</h2>
          <svg className="ornament" viewBox="0 0 190 16" aria-hidden="true"><path d="M6 8h64M120 8h64" fill="none" stroke="#d4a017" strokeWidth="1.6" /><path d="M84 8l11-6 11 6-11 6z" fill="none" stroke="#d4a017" strokeWidth="1.6" /></svg>
          <div style={{ marginTop: 34, maxWidth: 900, marginLeft: "auto", marginRight: "auto" }}>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>{t("about.vsUs")}</th><th>{t("about.vsThem")}</th></tr></thead>
                <tbody>
                  {DIFF_KEYS.map((k) => (
                    <tr key={k}>
                      <td><span className="meta-line" style={{ color: "var(--text)" }}><Icon name="check-circle" size={16} /> {t(`about.${k}a`)}</span></td>
                      <td className="muted">{t(`about.${k}b`)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell" style={{ maxWidth: 840 }}>
          <h2 className="section-title section-title--left" style={{ fontSize: "clamp(1.5rem,2.6vw,2rem)" }}>{t("about.moneyTitle")}</h2>
          <p className="muted" style={{ marginTop: 14 }}>{t("about.moneySub")}</p>
          <div className="grid g-2" style={{ marginTop: 24, gap: 16 }}>
            {REVENUE_KEYS.map((k) => (
              <div className="pg-item" key={k}><div className="k">{t(`about.${k}k`)}</div><div className="v" style={{ fontSize: "1rem" }}>{t(`about.${k}v`)}</div></div>
            ))}
          </div>
          <Reveal className="usp-band" style={{ marginTop: 26 }}>
            <p style={{ margin: 0 }}>
              <strong style={{ fontFamily: "var(--font-head)" }}>{t("about.lineLabel")}</strong>{" "}
              <span className="muted">{t("about.lineText")}</span>
            </p>
          </Reveal>
        </div>
      </section>

      <section className="section section--cream section--tight">
        <div className="shell">
          <div className="cta-band">
            <img src="/assets/img/mandala.svg" className="watermark watermark--br" alt="" />
            <div>
              <h2>{t("about.joinTitle")}</h2>
              <p>{t("about.joinSub")}</p>
            </div>
            <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
              {/* Hidden until the temple directory has something in it — see
                  hooks/useHasTemples.ts. The mission copy above stays: it
                  describes what the platform is for, not a page to visit. */}
              {hasTemples && (
                <Link className="btn btn-outline btn-lg" to="/temples">{t("about.exploreTemples")}</Link>
              )}
              <Link className="btn btn-outline btn-lg" to="/dashboard">{t("about.listAsPandit")}</Link>
            </div>
          </div>
        </div>
      </section>
      <section className="section section--cream">
        <div className="shell">
          <h2 className="section-title">{t("about.reviewsTitle")}</h2>
          <svg className="ornament" viewBox="0 0 190 16" aria-hidden="true"><path d="M6 8h64M120 8h64" fill="none" stroke="#d4a017" strokeWidth="1.6" /><path d="M84 8l11-6 11 6-11 6z" fill="none" stroke="#d4a017" strokeWidth="1.6" /></svg>

          <div className="text-c" style={{ marginTop: 20 }}>
            <WriteReview targetType="platform" targetName="PanditSuggest" />
          </div>

          {platformReviews.length > 0 && (
            <div className="scroll-x" style={{ marginTop: 26 }}>
              {platformReviews.map((r) => <ReviewCard r={r} key={r.name + r.text.slice(0, 12)} />)}
            </div>
          )}
        </div>
      </section>

    </>
  );
}
