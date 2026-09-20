import { useCallback, useEffect, useRef, useState } from "react";
import { Img } from "../ui/Img";
import { SIZES } from "../../lib/img";
import { Link } from "react-router-dom";
import { Icon } from "../../lib/icons";
import { useLang } from "../../lib/i18n";
import { serviceEmoji } from "../../lib/serviceEmoji";
import type { Service } from "../../data/types";

/**
 * The pujas offered online, as the homepage already draws them.
 *
 * Deliberately reuses the homepage's own .ohp-puja-card and its children
 * rather than restyling a second card: a devotee who scrolls the "मुख्य
 * पूजाएँ" strip on the home page and then lands here should be looking at the
 * same object, at the same size, not at this page's private idea of a service
 * card. Every class below is the homepage's; the only thing this file adds is
 * the track those cards sit in.
 *
 * A horizontal scroll-snap track, not a grid — so the strip carries however
 * many pujas an admin has ticked as available online instead of being capped
 * at whatever fits four columns. Swipe on touch; the arrows appear only where
 * there is a mouse and only while there is somewhere left to scroll.
 */

/** Matches the 18px gap the homepage grid uses between cards. */
const GAP = 18;

export function OnlinePujaSlider({ services }: { services: Service[] }) {
  const { t, lang } = useLang();
  const track = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  /* An arrow that cannot move anything is worse than no arrow, so both are
     driven by where the track actually is — including after a resize, which
     is what turns a scrollable strip into a non-scrollable one and back. */
  const sync = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft >= max - 1);
  }, []);

  useEffect(() => {
    sync();
    const el = track.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sync, services.length]);

  const nudge = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>(".ohp-puja-card");
    const step = card ? card.offsetWidth + GAP : el.clientWidth * 0.8;
    el.scrollBy({
      left: dir * step,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  };

  return (
    <div className="oh-slider">
      <button
        type="button"
        className="oh-slider__arrow oh-slider__arrow--prev"
        onClick={() => nudge(-1)}
        disabled={atStart}
        aria-label={t("onlineHavan.sliderPrev")}
      >
        <Icon name="chevron-left" size={20} />
      </button>

      <div className="oh-slider__track" ref={track} onScroll={sync}>
        {services.map((s) => (
          <div className="ohp-puja-card oh-slider__card" key={s.id}>
            {s.img
              ? <Img className="ohp-puja-img" src={s.img} alt={(lang === "hi" ? s.hi?.name : null) || s.name} sizes={SIZES.card} loading="lazy" />
              : <span className="ohp-puja-emoji">{serviceEmoji(s.icon)}</span>}
            <h4 className="ohp-puja-name">{(lang === "hi" ? s.hi?.name : null) || s.name}</h4>
            {(s.tag || s.desc) && <p className="ohp-puja-desc">{s.tag || s.desc}</p>}
            <div className="ohp-puja-meta">
              {s.dur && <span className="ohp-puja-dur"><Icon name="clock" size={13} /> {s.dur}</span>}
              <span className="ohp-puja-live">● {t("ohp.live")}</span>
            </div>
            <Link className="btn btn-gold btn-sm ohp-puja-btn" to={`/services/${s.id}`}>
              {t("ohp.enquire")}
            </Link>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="oh-slider__arrow oh-slider__arrow--next"
        onClick={() => nudge(1)}
        disabled={atEnd}
        aria-label={t("onlineHavan.sliderNext")}
      >
        <Icon name="chevron-right" size={20} />
      </button>
    </div>
  );
}
