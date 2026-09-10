import { useEffect, useRef } from "react";
import "./SankalpDiorama3D.css";

/**
 * The hero scene: a devotee's home on the left, the temple's havan kund on
 * the right, and the sankalp travelling between them — built as a real 3D
 * diorama rather than the flat SVG this replaces.
 *
 * WHY CSS 3D AND NOT WEBGL. The same trade HavanScene3D already made on the
 * Havan tab, for the same audience: true 3D here would mean modelled, textured
 * GLTF geometry plus ~150KB of three.js before a single pixel appears, on the
 * mid-range Android most devotees browse on. What actually reads as "three
 * dimensional" to an eye is perspective projection, occlusion, contact shadows
 * and parallax — and CSS gives all four for free:
 *
 *   · one `perspective` on the stage, `preserve-3d` all the way down, so every
 *     layer is genuinely projected rather than pretending with a drop shadow
 *   · the home and the temple are BUILT, not drawn: each is a front face plus
 *     a side face turned on rotateY and shaded darker, so they have real
 *     corners that swing as the scene turns
 *   · the kund is a true open box — four walls turned outward around a mouth
 *     laid flat on rotateX — so you look down into the fire, not at it
 *   · the ground is a plane on rotateX(74deg) carrying a contact shadow under
 *     each object, which is the single strongest cue that things stand in a
 *     space instead of floating in a stack
 *   · the sankalp beads travel in Z as well as X and Y, so they pass in front
 *     of the home and behind the temple's shikhara on the way
 *
 * The whole thing drifts on its own, and follows the pointer where there is
 * one — parallax between layers at different depths is what sells it. Every
 * animated property is a transform or an opacity, so it composites and never
 * lays out. All motion stops under prefers-reduced-motion, where the diorama
 * still stands correctly in perspective; it just holds still.
 */

/** Beads carrying the sankalp to the fire, and prasad back. Staggered by delay. */
const OUT = [0, 1.5, 3];
const BACK = [0.7, 2.6];

/** Fire tongues: one body with a couple of licks, per HavanScene3D's note. */
const TONGUES = [
  { cls: "is-c", dur: 2.4, delay: 0 },
  { cls: "is-l", dur: 2.05, delay: 0.7 },
  { cls: "is-r", dur: 2.25, delay: 1.3 },
];

const SMOKE = [0, 1.9, 3.7];

export function SankalpDiorama3D() {
  const stage = useRef<HTMLDivElement>(null);

  /**
   * Pointer parallax, pointer devices only — the gyroscope is deliberately not
   * used, for the reason HavanScene3D gives: iOS gates DeviceOrientation
   * behind a permission prompt, and a permission dialog in front of a
   * decorative scene is a bad trade. Phones get the ambient drift instead.
   *
   * Writes two CSS variables and lets CSS own the transform, coalesced into
   * one rAF per pointer burst — no per-frame React state.
   */
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const onMove = (e: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const px = ((e.clientX - r.left) / r.width - 0.5) * 2;
        const py = ((e.clientY - r.top) / r.height - 0.5) * 2;
        el.style.setProperty("--sd3-px", String(Math.max(-1, Math.min(1, px))));
        el.style.setProperty("--sd3-py", String(Math.max(-1, Math.min(1, py))));
      });
    };
    const reset = () => {
      el.style.setProperty("--sd3-px", "0");
      el.style.setProperty("--sd3-py", "0");
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", reset);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", reset);
    };
  }, []);

  return (
    <div className="sd3" ref={stage} aria-hidden="true">
      <div className="sd3__world">
        {/* Sky, furthest back — the warm light everything else sits in. */}
        <div className="sd3__sky" />

        {/* The floor. Laid flat on rotateX, and every contact shadow is its
            child, so the shadows lie ON the ground rather than under a box. */}
        <div className="sd3__ground">
          <span className="sd3__shadow sd3__shadow--home" />
          <span className="sd3__shadow sd3__shadow--temple" />
          <span className="sd3__shadow sd3__shadow--kund" />
        </div>

        {/* ══════════ THE HOME, left ══════════ */}
        <div className="sd3__home">
          <div className="sd3__wall sd3__wall--front" />
          <div className="sd3__wall sd3__wall--side" />
          <div className="sd3__roof sd3__roof--front" />
          <div className="sd3__roof sd3__roof--side" />

          {/* the devotee, seated, and the diya beside them */}
          <div className="sd3__devotee">
            <span className="sd3__devotee-head" />
            <span className="sd3__devotee-body" />
          </div>
          <div className="sd3__diya">
            <span className="sd3__diya-bowl" />
            <span className="sd3__diya-flame" />
          </div>

          {/* the phone on its stand, the live kund on its screen */}
          <div className="sd3__phone">
            <span className="sd3__phone-screen">
              <span className="sd3__phone-fire" />
            </span>
            <span className="sd3__phone-live" />
          </div>
        </div>

        {/* ══════════ THE TEMPLE, right ══════════ */}
        <div className="sd3__temple">
          <div className="sd3__shikhar sd3__shikhar--front" />
          <div className="sd3__shikhar sd3__shikhar--side" />
          <span className="sd3__kalash" />
          <div className="sd3__door" />
        </div>

        {/* ══════════ THE KUND, front right ══════════
            A true open box: the mouth lies flat on rotateX and the four walls
            stand around it, so the fire is seen down inside the vessel. */}
        <div className="sd3__kund">
          <div className="sd3__kund-mouth" />
          <div className="sd3__kund-wall sd3__kund-wall--f" />
          <div className="sd3__kund-wall sd3__kund-wall--b" />
          <div className="sd3__kund-wall sd3__kund-wall--l" />
          <div className="sd3__kund-wall sd3__kund-wall--r" />

          <div className="sd3__fire">
            {TONGUES.map((t) => (
              <span
                key={t.cls}
                className={`sd3__tongue ${t.cls}`}
                style={{ animationDuration: `${t.dur}s`, animationDelay: `${t.delay}s` }}
              />
            ))}
            {SMOKE.map((d, i) => (
              <span key={`s${i}`} className="sd3__smoke" style={{ animationDelay: `${d}s` }} />
            ))}
          </div>
          <span className="sd3__firelight" />
        </div>

        {/* ══════════ THE LINK ══════════
            Beads travel in Z as well as X and Y, so they pass in front of the
            home and behind the shikhara on the way across. */}
        {OUT.map((d) => (
          <span key={`o${d}`} className="sd3__bead sd3__bead--out" style={{ animationDelay: `${d}s` }} />
        ))}
        {BACK.map((d) => (
          <span key={`b${d}`} className="sd3__bead sd3__bead--back" style={{ animationDelay: `${d}s` }} />
        ))}
      </div>
    </div>
  );
}
