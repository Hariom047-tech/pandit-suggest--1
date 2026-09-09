import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Icon } from "../../lib/icons";
import { CountUp } from "../ui/CountUp";
import { HavanFireScene } from "./HavanFireScene";
import { HavanScene3D } from "./HavanScene3D";
import { useSiteImages } from "../../lib/siteImages";
import type { AnushthanTier, HavanStructure, HavanTier } from "../../data/havanStructure";

/**
 * The Havan tab on the service detail page.
 *
 * Two ladders, drawn so the rung is the thing you read first: the havan tiers
 * differ only by how many special jadi-buti are offered, and the anushthan
 * tiers only by the japa count, so both get a dial that fills in proportion
 * to that number. Every card carries the same fields in the same order, which
 * is what makes three otherwise near-identical vidhi lists comparable at a
 * glance.
 *
 * Motion follows the Sacred Journey timeline on the Overview tab — the same
 * staggered whileInView reveal, golden badges and drawn connector — so the
 * two tabs read as one page. Every keyframe animation added for it is turned
 * off under prefers-reduced-motion in service-detail.css.
 */

/** Dials are drawn relative to the top rung, not to an arbitrary round number. */
function maxOf<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((n, row) => Math.max(n, pick(row)), 0) || 1;
}

/**
 * The proportion ring shared by both ladders.
 *
 * pathLength animates 0 → fill on scroll-in, so the ring draws itself the way
 * the timeline connector does rather than appearing already full.
 */
function Dial({
  fill,
  delay,
  dashed,
  children,
}: {
  /** 0–1. */
  fill: number;
  delay: number;
  /** The "no special jadi-buti" tier: a dotted outline, nothing to fill. */
  dashed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="sd-dial">
      <svg className="sd-dial__svg" viewBox="0 0 100 100" aria-hidden="true">
        <circle className="sd-dial__track" cx="50" cy="50" r="43" />
        {dashed ? (
          <circle className="sd-dial__dashed" cx="50" cy="50" r="43" />
        ) : (
          <motion.circle
            className="sd-dial__fill"
            cx="50"
            cy="50"
            r="43"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: fill }}
            viewport={{ once: true }}
            transition={{ duration: 1.1, delay, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </svg>
      <div className="sd-dial__center">{children}</div>
    </div>
  );
}

function HavanTierCard({ tier, index, total, peak }: { tier: HavanTier; index: number; total: number; peak: number }) {
  const isTop = index === total - 1;
  return (
    <motion.article
      className={`sd-havan-tier${isTop ? " sd-havan-tier--top" : ""}`}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, delay: index * 0.13, ease: [0.22, 1, 0.36, 1] }}
    >
      {isTop && <span className="sd-havan-tier__ribbon">Most elaborate</span>}

      <Dial fill={tier.jadiButi / peak} delay={index * 0.13 + 0.2} dashed={tier.jadiButi === 0}>
        {tier.jadiButi === 0 ? (
          <>
            <span className="sd-dial__glyph">🪔</span>
            <span className="sd-dial__unit">standard</span>
          </>
        ) : (
          <>
            <span className="sd-dial__value">
              <CountUp raw={String(tier.jadiButi)} />
            </span>
            <span className="sd-dial__unit">jadi-buti</span>
          </>
        )}
      </Dial>

      {/* The rung, spelled out — three dots filled to this tier's position. */}
      <div className="sd-havan-tier__rungs" role="img" aria-label={`Tier ${index + 1} of ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`sd-havan-tier__rung${i <= index ? " is-on" : ""}`} />
        ))}
      </div>

      <h4 className="sd-havan-tier__name">{tier.name}</h4>
      <p className="sd-havan-tier__subtitle">{tier.subtitle}</p>

      <p className="sd-havan-tier__key">
        <span className="sd-havan-tier__key-icon">◆</span>
        {tier.keyFeature}
      </p>

      <p className="sd-havan-tier__desc">{tier.description}</p>

      <div className="sd-havan-tier__includes">
        <span className="sd-havan-tier__includes-label">Includes</span>
        <ul className="sd-chips">
          {tier.includes.map((x) => (
            <li className="sd-chip" key={x}>
              {x}
            </li>
          ))}
        </ul>
      </div>
    </motion.article>
  );
}

function AnushthanStep({ tier, index, total, peak }: { tier: AnushthanTier; index: number; total: number; peak: number }) {
  return (
    <motion.div
      className="sd-anush-step"
      initial={{ opacity: 0, x: -28 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.55, delay: index * 0.12, ease: [0.22, 1, 0.36, 1] }}
    >
      {index < total - 1 && (
        <motion.div
          className="sd-anush-connector"
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: index * 0.12 + 0.3 }}
          style={{ transformOrigin: "top" }}
        />
      )}

      <motion.div
        className="sd-anush-bead"
        initial={{ scale: 0, rotate: -30 }}
        whileInView={{ scale: 1, rotate: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: index * 0.12, type: "spring", stiffness: 200 }}
      >
        <span className="sd-anush-bead__num">{index + 1}</span>
        <div className="sd-anush-bead__ring" />
      </motion.div>

      <motion.div
        className="sd-anush-card"
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: index * 0.12 + 0.1 }}
      >
        <div className="sd-anush-card__head">
          <div className="sd-anush-card__count">
            <span className="sd-anush-card__japa">
              <CountUp raw={tier.japaLabel} />
            </span>
            <span className="sd-anush-card__japa-unit">mantra japa</span>
          </div>
          <span className="sd-anush-card__plus">+ Havan</span>
        </div>

        <h4 className="sd-anush-card__title">{tier.name}</h4>
        <p className="sd-anush-card__summary">{tier.summary}</p>

        {/* Scale of the japa count against the largest anushthan offered —
            "5,25,000" means little until you can see it beside 36,000. */}
        <div className="sd-anush-card__meter" aria-hidden="true">
          <motion.span
            className="sd-anush-card__meter-fill"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: tier.japa / peak }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, delay: index * 0.12 + 0.25, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        <ul className="sd-chips sd-chips--sm">
          {tier.includes.map((x) => (
            <li className="sd-chip" key={x}>
              {x}
            </li>
          ))}
        </ul>
      </motion.div>
    </motion.div>
  );
}

export function HavanSection({
  structure,
  serviceId,
  panditCount,
}: {
  structure: HavanStructure;
  serviceId: string;
  /** Drives the closing CTA's label; the CTA is dropped when nobody lists it. */
  panditCount: number;
}) {
  const { deity, havan, anushthan } = structure;
  /**
   * The scene at the head of the tab.
   *
   * Prefers artwork uploaded for this tab specifically; falls back to the
   * homepage trust portrait, which is the same subject (a pandit at a kund)
   * and means the 3D scene works the moment this ships rather than after an
   * upload. With neither, the drawn SVG scene stands in — never a broken
   * <img>, per the site-images contract.
   */
  const { src, alt } = useSiteImages();
  const sceneImg = src("services.havan_scene") || src("home.trust");
  const sceneAlt = sceneImg
    ? alt("services.havan_scene", alt("home.trust", `Pandit performing ${deity} havan`))
    : "";
  const havanPeak = maxOf(havan, (t) => t.jadiButi);
  const japaPeak = maxOf(anushthan, (t) => t.japa);

  return (
    <div className="sd-havan">
      {/* ── Intro band ── */}
      <div className="sd-havan-intro">
        <div className="sd-havan-intro__glow" />
        {sceneImg ? <HavanScene3D src={sceneImg} alt={sceneAlt} /> : <HavanFireScene />}
        <div className="sd-havan-intro__copy">
          <span className="sd-havan-intro__eyebrow">{deity}</span>
          <h2 className="sd-havan-intro__title">Havan &amp; Anushthan</h2>
          <p className="sd-havan-intro__text">{structure.intro}</p>
        </div>
      </div>

      {/* ── Havan ladder ── */}
      <section className="sd-havan-block">
        <header className="sd-havan-block__head">
          <span className="sd-havan-block__icon">🔥</span>
          <div>
            <h3 className="sd-havan-block__title">Havan Categories</h3>
            <p className="sd-havan-block__sub">
              {havan.length} types · graded by jadi-buti
            </p>
          </div>
        </header>
        <p className="sd-havan-block__intro">{structure.havanIntro}</p>

        <div className="sd-havan-tiers">
          {havan.map((tier, i) => (
            <HavanTierCard key={tier.id} tier={tier} index={i} total={havan.length} peak={havanPeak} />
          ))}
        </div>
      </section>

      {/* ── Anushthan ladder ── */}
      <section className="sd-havan-block sd-havan-block--anush">
        <div className="sd-havan-block__bg" />
        <header className="sd-havan-block__head">
          <span className="sd-havan-block__icon">📿</span>
          <div>
            <h3 className="sd-havan-block__title">Anushthan Categories</h3>
            <p className="sd-havan-block__sub">
              {anushthan.length} tiers · graded by japa count
            </p>
          </div>
        </header>
        <p className="sd-havan-block__intro">{structure.anushthanIntro}</p>

        <div className="sd-anush-steps">
          {anushthan.map((tier, i) => (
            <AnushthanStep key={tier.id} tier={tier} index={i} total={anushthan.length} peak={japaPeak} />
          ))}
        </div>
      </section>

      {/* ── The whole ladder on one screen ── */}
      <section className="sd-havan-matrix">
        <h3 className="sd-havan-matrix__title">
          <span className="sd-card__title-icon">📋</span>
          At a glance
        </h3>
        <div className="sd-havan-matrix__scroll">
          <table className="sd-havan-matrix__table">
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Service</th>
                <th scope="col">Primary difference</th>
              </tr>
            </thead>
            <tbody>
              {havan.map((t, i) => (
                <tr key={t.id}>
                  {i === 0 && (
                    <th scope="rowgroup" rowSpan={havan.length} className="sd-havan-matrix__group">
                      {deity} <span>&rsaquo;</span> Havan
                    </th>
                  )}
                  <td>{t.name}</td>
                  <td className="sd-havan-matrix__diff">{t.cardLabel}</td>
                </tr>
              ))}
              {anushthan.map((t, i) => (
                <tr key={t.id}>
                  {i === 0 && (
                    <th scope="rowgroup" rowSpan={anushthan.length} className="sd-havan-matrix__group">
                      {deity} <span>&rsaquo;</span> Anushthan
                    </th>
                  )}
                  <td>{t.japaLabel} Mantra Japa</td>
                  <td className="sd-havan-matrix__diff">+ Havan</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Hand off to the people who actually perform it ── */}
      {panditCount > 0 && (
        <div className="sd-havan-cta">
          <div>
            <h3 className="sd-havan-cta__title">Not sure which one fits your sankalp?</h3>
            <p className="sd-havan-cta__text">
              {panditCount} verified {panditCount === 1 ? "Pandit Ji" : "Pandit Jis"} perform this puja and can
              advise on the right tier for your situation.
            </p>
          </div>
          <Link className="btn btn-gold" to={`/services/${serviceId}/pandits`}>
            Talk to a Pandit Ji <Icon name="arrow-right" size={16} />
          </Link>
        </div>
      )}
    </div>
  );
}
