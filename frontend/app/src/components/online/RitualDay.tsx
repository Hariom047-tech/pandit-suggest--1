import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "../../lib/icons";
import { useLang } from "../../lib/i18n";
import { RITUAL_DAY, pick } from "../../data/onlineHavan";

/**
 * The ritual day, walked one step at a time — the centre of the page.
 *
 * Every other explanation of an online havan on the internet is a numbered
 * list of five marketing steps ("choose, pay, join, receive"). What a devotee
 * actually wants to know is finer than that: at 7:20 in the morning, what is
 * the pandit doing, and what am I supposed to be doing at the same minute?
 * So the two are drawn side by side for every step — the kund on one side,
 * your own room on the other — and the rail above marks the steps a devotee
 * is genuinely expected to be on the call for.
 *
 * It advances on its own so the day plays out without demanding a click, and
 * stops the moment the reader takes over. Autoplay never restarts itself
 * after that: a panel that resumes moving while someone is reading it is
 * worse than one that never moved.
 */

const AUTOPLAY_MS = 9000;

export function RitualDay() {
  const { t, lang } = useLang();
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  /** Autoplay only ever runs before the reader touches the rail. */
  const [touched, setTouched] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

  const step = RITUAL_DAY[active];
  const total = RITUAL_DAY.length;

  useEffect(() => {
    if (!playing || touched) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setTimeout(() => {
      setActive((i) => (i + 1) % total);
    }, AUTOPLAY_MS);
    return () => window.clearTimeout(id);
  }, [active, playing, touched, total]);

  /* Keep the active bead in view on narrow screens, where the rail scrolls
     horizontally — otherwise autoplay walks off the right edge unseen. */
  useEffect(() => {
    const rail = railRef.current;
    const bead = rail?.querySelector<HTMLElement>(`[data-step="${active}"]`);
    if (!rail || !bead) return;
    if (rail.scrollWidth <= rail.clientWidth) return;
    rail.scrollTo({
      left: bead.offsetLeft - rail.clientWidth / 2 + bead.offsetWidth / 2,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [active]);

  const go = (i: number) => {
    setTouched(true);
    setPlaying(false);
    setActive((i + total) % total);
  };

  return (
    <div className="oh-day">
      {/* ── rail ── */}
      <div className="oh-day__railwrap">
        <div className="oh-day__rail" ref={railRef}>
          {/* The track is the row's child, not the scroll container's: an
              absolutely positioned child of a scroller resolves right:0
              against the visible width, so a track placed one level up would
              stop at the fold and drift out of line with the beads the moment
              the rail scrolls. */}
          <div className="oh-day__row" role="tablist" aria-label={t("onlineHavan.dayRailLabel")}>
            <div className="oh-day__track" aria-hidden="true">
              <motion.div
                className="oh-day__track-fill"
                animate={{ scaleX: total > 1 ? active / (total - 1) : 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>

            {RITUAL_DAY.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                id={`oh-day-tab-${s.id}`}
                aria-controls="oh-day-panel"
                data-step={i}
                aria-selected={i === active}
                className={`oh-day__bead${i === active ? " is-active" : ""}${i < active ? " is-done" : ""}`}
                onClick={() => go(i)}
              >
                <span className="oh-day__bead-dot">
                  {s.live && <span className="oh-day__bead-live" aria-hidden="true" />}
                  <span className="oh-day__bead-n">{i + 1}</span>
                </span>
                <span className="oh-day__bead-time">{pick(s.time, lang)}</span>
                <span className="oh-day__bead-name">{pick(s.sanskrit, lang)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── controls ── */}
      <div className="oh-day__controls">
        <button type="button" className="oh-day__nav" onClick={() => go(active - 1)} aria-label={t("onlineHavan.prevStep")}>
          <Icon name="chevron-left" size={18} />
        </button>
        <button
          type="button"
          className="oh-day__play"
          onClick={() => {
            setTouched(false);
            setPlaying((p) => !p);
          }}
        >
          <Icon name={playing && !touched ? "pause" : "play"} size={15} />
          {playing && !touched ? t("onlineHavan.pause") : t("onlineHavan.playDay")}
        </button>
        <span className="oh-day__counter">
          {t("onlineHavan.stepOf", { i: active + 1, n: total })}
        </span>
        <button type="button" className="oh-day__nav" onClick={() => go(active + 1)} aria-label={t("onlineHavan.nextStep")}>
          <Icon name="chevron-right" size={18} />
        </button>
      </div>

      {/* ── the step itself ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          className="oh-day__panel"
          id="oh-day-panel"
          role="tabpanel"
          aria-labelledby={`oh-day-tab-${step.id}`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <header className="oh-day__head">
            <div>
              <span className="oh-day__eyebrow">
                {pick(step.time, lang)} · {pick(step.sanskrit, lang)}
              </span>
              <h3 className="oh-day__title">{pick(step.name, lang)}</h3>
            </div>
            {step.live && (
              <span className="oh-day__livetag">
                <span className="oh-day__livetag-dot" />
                {t("onlineHavan.beOnCall")}
              </span>
            )}
          </header>

          {step.count && (
            <div className="oh-day__count">
              <span className="oh-day__count-value">{step.count.value}</span>
              <span className="oh-day__count-label">{pick(step.count.label, lang)}</span>
            </div>
          )}

          <div className="oh-day__split">
            <div className="oh-day__side oh-day__side--kund">
              <span className="oh-day__side-head">
                <span className="oh-day__side-icon">🔥</span>
                {t("onlineHavan.atTheKund")}
              </span>
              <p>{pick(step.pandit, lang)}</p>
            </div>
            <div className="oh-day__side oh-day__side--home">
              <span className="oh-day__side-head">
                <span className="oh-day__side-icon">🪔</span>
                {t("onlineHavan.atYourHome")}
              </span>
              <p>{pick(step.you, lang)}</p>
            </div>
          </div>

          {step.mantra && (
            <div className="oh-day__mantra">
              <span className="oh-day__mantra-label">{t("onlineHavan.mantraOfThisStep")}</span>
              <p className="oh-day__mantra-dev" lang="sa">{step.mantra.dev}</p>
              <p className="oh-day__mantra-roman">{step.mantra.roman}</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
