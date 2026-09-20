import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../lib/icons";
import { usePandits, useStats, useHomeHero, usePanditCount } from "../../hooks/useData";
import { normPandits } from "../../lib/normalize";
import { CountUp } from "../ui/CountUp";
import { Img } from "../ui/Img";
import { SIZES, rungAtLeast } from "../../lib/img";
import { useLang } from "../../lib/i18n";
import "./HeroAstrotalk.css";
import "../ui/DataState.css";

const STAT_KEYS = ["home.statPandits", "home.statTemples", "home.statCeremonies", "home.statCities"];

export function HeroAstrotalk() {
  const { t, lang } = useLang();
  const { data: rawPandits } = usePandits({ perPage: 20 });
  const { data: rawStats } = useStats();
  const { data: panditCount } = usePanditCount();

  /**
   * The badge used to read a hardcoded "1,240+ pandits online now" — a number
   * that was never true and an "online now" claim nothing on the site tracks.
   * It is now the real count of verified, live pandits, rounded DOWN to the
   * nearest 10 so the "+" is always honest (427 real -> "420+").
   *
   * Null while the count is in flight. The badge itself still renders in that
   * gap: it sits directly above the H1, which is this page's measured mobile
   * LCP element, so mounting the badge late would push the H1 down and buy a
   * layout shift on exactly the element we care most about. Only the number
   * appears late, and its width changing shifts nothing vertically.
   */
  const trustedLabel = useMemo(() => {
    const n = panditCount?.trusted;
    if (!n || n < 10) return null;
    return `${(Math.floor(n / 10) * 10).toLocaleString("en-IN")}+`;
  }, [panditCount]);
  const pandits = useMemo(() => normPandits(rawPandits), [rawPandits]);
  // No hardcoded fallback. This used to claim "500+ Verified Pandits",
  // "100+ Temples Listed", "50+ Cities Covered" and "10K+ Happy Families"
  // whenever the API returned nothing — which, on the clean production
  // database, is always: the stats table is empty, as are pandits and temples.
  // Those are headline marketing numbers on the front page, and they were not
  // true. An empty stats row is rendered as no stats row at all.
  const stats = rawStats?.length ? rawStats : [];

  /**
   * Hero circles come from admin-uploaded images (Admin Panel -> Home Page).
   *
   * They used to be the three highest-ranked pandits, which quietly made the
   * front page a side effect of the ranking algorithm — promoting a pandit
   * changed the homepage, and every pandit's face was published there without
   * them choosing it. The top-3 pandits remain the fallback so the hero is
   * never empty before an admin uploads anything.
   */
  const { data: heroImages } = useHomeHero();
  const top3 = useMemo(
    () => [...pandits].sort((a, b) => b.rating - a.rating || b.reviews - a.reviews).slice(0, 3),
    [pandits],
  );

  const circles = useMemo(() => {
    if (heroImages?.length) {
      return heroImages.slice(0, 3).map((h) => ({
        key: h.id, src: h.image_url, alt: h.alt_text || "",
      }));
    }
    return top3.map((p) => ({
      key: p.id, src: p.img, alt: lang === "hi" && p.nameHi ? p.nameHi : p.name,
    }));
  }, [heroImages, top3, lang]);

  // order[i] is the visual position (0: center, 1: left, 2: right) for the i-th pandit in top3.
  const [order, setOrder] = useState([0, 1, 2]);

  useEffect(() => {
    const timer = setInterval(() => {
      // Shift array: left -> right -> center -> left
      setOrder(prev => [prev[1], prev[2], prev[0]]);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="hero-astro">
      <div className="shell">
        <div className="hero-astro__grid">
          
          {/* Left: Text Content
              These four elements are the first meaningful content on the
              page — the H1 is the measured mobile LCP element (Phase 12
              baseline, docs/SEO_ARCHITECTURE.md). They were previously
              wrapped in framer-motion entrance fades (initial opacity:0,
              animate to opacity:1), which meant nothing here painted until
              React mounted AND framer-motion's JS initialized AND the
              transition resolved — a JS-gated delay on exactly the content
              LCP measures, for a purely decorative one-time fade-in. Plain
              elements now: content is visible in the very first paint,
              gated only on CSS/fonts, not on a JS animation engine. */}
          <div className="hero-astro__content">
            <div className="hero-astro__badge">
              <span className="hero-astro__badge-dot" />
              {trustedLabel ? `${trustedLabel} ` : ""}{t("home.heroBadge")}
              <div className="hero-astro__badge-avatars">
                {/* ~26px each. Too small for srcset to be worth the markup —
                    every rung overshoots — so they take the narrowest rung
                    directly: 14KB in place of the 274KB master. */}
                {circles.map((c, i) => (
                  <img
                    key={c.key}
                    src={rungAtLeast(c.src, 320)}
                    alt=""
                    /* Measured at 113px from the top of the document — above
                       the fold on every viewport, so never lazy. */
                    decoding="async"
                    style={{ zIndex: 3 - i }}
                  />
                ))}
              </div>
            </div>

            <h1 className="hero-astro__title">
              {t("home.heroTitle1")} <br />
              <span className="gold-text">{t("home.heroTitleGold")}</span> {t("home.heroTitlePlatform")}
            </h1>

            <ul className="hero-astro__list">
              <li>
                <div className="hero-astro__check"><Icon name="check" size={14} /></div>
                {t("home.heroCheck1")}
              </li>
              <li>
                <div className="hero-astro__check"><Icon name="check" size={14} /></div>
                {t("home.heroCheck2")}
              </li>
            </ul>

            <div className="hero-astro__cta">
              <Link to="/pandits" className="btn btn-gold btn-lg btn-pill">
                {t("home.heroCta")} <Icon name="arrow-right" size={18} />
              </Link>
            </div>
          </div>

          {/* Right: Circular Portraits */}
          <div className="hero-astro__visual">
            <div className="hero-astro__circles">
              {circles.length
                ? circles.map((c, i) => {
                    const pos = order[i]; // 0: center, 1: left, 2: right
                    return (
                      <div key={c.key} className={`hero-astro__circle pos-${pos}`}>
                        <Img
                          src={c.src}
                          alt={c.alt}
                          sizes={SIZES.heroCircle}
                          /* All three are on screen immediately, so all three
                             are eager; only the centre one competes for high
                             priority. "auto" rather than undefined on the
                             sides is load-bearing — <Img> reads an absent
                             fetchPriority as "fall back to priority", which
                             would promote all three. */
                          priority
                          fetchPriority={pos === 0 ? "high" : "auto"}
                        />
                      </div>
                    );
                  })
                // Same 3 positions, filled with a shimmer placeholder instead
                // of an <img> — first paint shouldn't wait on usePandits()/
                // useHomeHero() any more than the rest of this hero does.
                : [0, 1, 2].map((pos) => (
                    <div key={pos} className={`hero-astro__circle pos-${pos}`} aria-hidden="true">
                      <div className="ds-skeleton" style={{ width: "100%", height: "100%", borderRadius: "50%" }} />
                    </div>
                  ))}
            </div>
          </div>
          
        </div>
      </div>

      {/* Stats Row — only when the API supplied real numbers. */}
      {stats.length > 0 && (
      <div className="hero-astro__stats-row">
        <div className="shell hero-astro__stats-inner">
          {stats.map((s, index) => (
            <div className="hero-astro__stat" key={s.label}>
              <div className="hero-astro__stat-num">
                <CountUp raw={s.num} />
              </div>
              <div className="hero-astro__stat-label">{t(STAT_KEYS[index])}</div>
              {index < stats.length - 1 && <div className="hero-astro__stat-divider" />}
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Live ticker REMOVED — it scrolled four hardcoded lines presented as
          real timestamped activity ("Rahul from Mumbai booked ... just now",
          "Priya from Pune left a 5-star review ..."). The database holds zero
          users, pandits, bookings and reviews, so all of it was fabricated
          social proof shown to real visitors. See components/ui/HeroTicker.tsx
          for what a real implementation would need. */}
    </section>
  );
}
