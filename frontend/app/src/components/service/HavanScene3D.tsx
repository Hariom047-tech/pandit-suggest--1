import { useEffect, useRef } from "react";
import "./HavanScene3D.css";

/**
 * The havan scene at the head of the Havan tab: a photoreal subject with a
 * real, moving fire drawn over the kund.
 *
 * Why this and not WebGL. True 3D would mean a rigged, textured GLTF of a
 * seated pandit — an asset that has to be modelled, plus ~150KB of three.js
 * and megabytes of geometry and textures before anything appears. On the
 * mid-range Android most devotees browse on that is seconds of blank card.
 * The artwork behind this component is already a 3D render, so the depth is
 * real; what was missing was motion and parallax, and those cost almost
 * nothing to add:
 *
 *   · the flames are drawn here, not baked into the artwork, so they actually
 *     move — tongues rise, sway, and flare when an offering lands
 *   · a droplet falls from the pandit's hand into the kund every 2s, and the
 *     fire surges as it lands: the aahuti drives the fire
 *   · layers sit at different translateZ under a perspective, so a slow
 *     ambient drift (and the pointer, where there is one) parallaxes them
 *     against each other — which is what the eye actually reads as 3D
 *
 * Everything animates on transform/opacity alone, so it stays on the
 * compositor. The blurs are static filters on layers whose transforms
 * animate, so each is rasterised once rather than per frame.
 *
 * Note there is no mix-blend-mode anywhere: this card's background is cream,
 * and screen-blending warm tones onto near-white erases them. The fire is
 * saturated gradient plus soft blur, which is what reads as volumetric on a
 * light backdrop.
 *
 * Positions of the kund and the pandit's hand differ per artwork, so both are
 * CSS custom properties (--hs3-fx/fy, --hs3-hx/hy). The defaults are measured
 * against the current trust-portrait render; a new upload can retune them
 * without touching this file.
 */

/**
 * Flame tongues — three, not five: a real havan flame is one body of fire with
 * a couple of licks off it, and five overlapping tongues read as a bonfire.
 *
 * Every measurement is a PERCENTAGE of the fire box, which is itself a
 * percentage of the artwork. Absolute pixels were the main reason this looked
 * wrong: the image is fluid, so a 46px tongue was huge next to a 320px phone
 * render and small next to a 520px one. Now the fire keeps its proportion to
 * the kund at every width.
 *
 * Durations share no common factor, so the fire never visibly loops. `sway`
 * drifts each tongue sideways as it rises, in alternating directions.
 */
const TONGUES = [
  { x: -5, w: 44, h: 54, blur: 7, dur: 2.6, delay: 0, sway: 5, hue: "a" },
  { x: 7, w: 33, h: 66, blur: 6, dur: 2.15, delay: 0.9, sway: -6, hue: "b" },
  { x: -1, w: 25, h: 41, blur: 5, dur: 1.85, delay: 1.6, sway: 4, hue: "c" },
];

const EMBERS = [
  { x: -22, r: 2.5, dur: 3.6, delay: 0 },
  { x: 10, r: 2, dur: 4.4, delay: 0.8 },
  { x: -6, r: 3, dur: 4.0, delay: 1.6 },
  { x: 22, r: 2.2, dur: 4.8, delay: 2.3 },
];

const SMOKE = [
  { x: -8, dur: 7.5, delay: 0 },
  { x: 12, dur: 8.5, delay: 2.8 },
  { x: 0, dur: 9.5, delay: 5.4 },
];

export function HavanScene3D({ src, alt }: { src: string; alt: string }) {
  const stage = useRef<HTMLDivElement>(null);

  /**
   * Pointer parallax, on pointer devices only.
   *
   * Deliberately not the gyroscope: iOS gates DeviceOrientation behind an
   * explicit permission prompt that needs a user gesture, and putting a
   * permission dialog in front of a decorative animation is a bad trade. On
   * phones the ambient drift below carries the depth instead.
   *
   * Writes two CSS variables and lets CSS do the transform — no per-frame
   * React state, and the work is coalesced into one rAF per pointer burst.
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
        // -1..1 from the centre of the card.
        const px = ((e.clientX - r.left) / r.width - 0.5) * 2;
        const py = ((e.clientY - r.top) / r.height - 0.5) * 2;
        el.style.setProperty("--hs3-px", String(Math.max(-1, Math.min(1, px))));
        el.style.setProperty("--hs3-py", String(Math.max(-1, Math.min(1, py))));
      });
    };
    const reset = () => {
      el.style.setProperty("--hs3-px", "0");
      el.style.setProperty("--hs3-py", "0");
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
    <div className="hs3" ref={stage}>
      <div className="hs3__stage">
        {/* Depth is built back-to-front: each layer's translateZ is what the
            ambient drift and the pointer parallax act on. */}
        <div className="hs3__halo" aria-hidden="true" />

        {SMOKE.map((s, i) => (
          <span
            key={`sm${i}`}
            className="hs3__smoke"
            aria-hidden="true"
            style={{
              // @ts-expect-error -- custom properties are valid style values
              "--x": `${s.x}px`,
              animationDuration: `${s.dur}s`,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}

        <img className="hs3__subject" src={src} alt={alt} decoding="async" />

        {/* Warm light the fire throws back onto the subject, pulsing with it. */}
        <div className="hs3__light" aria-hidden="true" />

        {/* ── The fire, anchored on the kund ── */}
        <div className="hs3__fire" aria-hidden="true">
          <span className="hs3__fire-base" />
          {TONGUES.map((t, i) => (
            <span
              key={`t${i}`}
              className={`hs3__tongue hs3__tongue--${t.hue}`}
              style={{
                // @ts-expect-error -- custom properties are valid style values
                "--x": `${t.x}%`,
                "--w": `${t.w}%`,
                "--h": `${t.h}%`,
                "--sway": `${t.sway}%`,
                filter: `blur(${t.blur}px)`,
                animationDuration: `${t.dur}s`,
                animationDelay: `${t.delay}s`,
              }}
            />
          ))}
          <span className="hs3__core" />
          {/* Surges as each offering lands. */}
          <span className="hs3__flare" />
        </div>

        {EMBERS.map((e, i) => (
          <span
            key={`em${i}`}
            className="hs3__ember"
            aria-hidden="true"
            style={{
              // @ts-expect-error -- custom properties are valid style values
              "--x": `${e.x}px`,
              "--r": `${e.r}px`,
              animationDuration: `${e.dur}s`,
              animationDelay: `${e.delay}s`,
            }}
          />
        ))}

        {/* The aahuti itself: ghee leaving the pandit's hand for the kund. */}
        <span className="hs3__offering" aria-hidden="true" />
      </div>
    </div>
  );
}
