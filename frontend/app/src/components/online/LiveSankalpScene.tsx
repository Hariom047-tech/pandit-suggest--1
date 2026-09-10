import "./LiveSankalpScene.css";

/**
 * The whole idea of the page, drawn once: a devotee sitting at home on the
 * left, a lit havan kund at a temple on the right, and the link between them
 * carrying something in each direction.
 *
 * The two arcs are the point. Upward, from the home to the fire, travel the
 * sankalp beads — the name, gotra and purpose that tie the ritual to a person
 * who is not standing there. Downward, from the fire back to the home, travel
 * the return beads — bhasma, raksha sutra, prasad. A devotee who reads nothing
 * else on this page should still come away knowing that the fire is real, it
 * is elsewhere, and both directions of that exchange are what "online havan"
 * means.
 *
 * Inline SVG driven by CSS keyframes, for the same reasons as HavanFireScene:
 * no extra request and no rAF loop. Everything but the two dashed arcs
 * animates a transform or an opacity and so stays on the compositor; the arcs
 * march their stroke-dashoffset, which repaints two hairlines and nothing
 * else. All of it stops under prefers-reduced-motion — see the stylesheet.
 */

/** Beads are spaced along one shared path by animation-delay, not by geometry. */
const OUTBOUND = [0, 1.6, 3.2];
const RETURN = [0.8, 2.9];

/**
 * animateMotion is SMIL, not CSS — the stylesheet's prefers-reduced-motion
 * block cannot reach it, so the beads are simply parked on their arcs here
 * instead of travelling. Read at render like HavanScene3D reads the same
 * query; a devotee who flips the OS setting mid-visit gets it on the next
 * navigation, which is the tradeoff that keeps this a pure render.
 */
const still = typeof window !== "undefined"
  && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Where each bead sits when it is not travelling — points on its own arc. */
const OUT_PARKED = [
  { cx: 332, cy: 144 },
  { cx: 413, cy: 127 },
  { cx: 492, cy: 139 },
];
const BACK_PARKED = [
  { cx: 461, cy: 280 },
  { cx: 365, cy: 281 },
];

export function LiveSankalpScene() {
  return (
    <div className="lss" aria-hidden="true">
      <svg className="lss__svg" viewBox="0 0 820 330" role="img">
        <defs>
          <linearGradient id="lss-flame" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#ff8a1f" />
            <stop offset="55%" stopColor="#ffc247" />
            <stop offset="100%" stopColor="#fff3c4" />
          </linearGradient>
          <linearGradient id="lss-arc" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(212,160,23,0.08)" />
            <stop offset="50%" stopColor="rgba(212,160,23,0.55)" />
            <stop offset="100%" stopColor="rgba(212,160,23,0.08)" />
          </linearGradient>
          <radialGradient id="lss-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,178,44,0.55)" />
            <stop offset="100%" stopColor="rgba(255,178,44,0)" />
          </radialGradient>
        </defs>

        {/* ── ground line, shared by both sides so they read as one world ── */}
        <path className="lss-ground" d="M40 286 H780" />

        {/* ══════════ HOME, left ══════════ */}
        <g className="lss-home">
          {/* room */}
          <path className="lss-room" d="M78 286 V176 L168 116 L258 176 V286" />
          <path className="lss-roof" d="M62 182 L168 110 L274 182" />
          {/* the devotee, seated, facing the screen */}
          <g transform="translate(140 286)">
            <path className="lss-body" d="M-24 0 C-24 -8 -15 -14 0 -14 C15 -14 24 -8 24 0 Z" />
            <path className="lss-torso" d="M-11 -12 C-12 -29 -8 -39 0 -39 C8 -39 12 -29 11 -12 Z" />
            <circle className="lss-head" cx="0" cy="-46" r="8" />
            {/* folded hands — the posture the page keeps asking for */}
            <path className="lss-hands" d="M-3 -24 C0 -30 0 -30 3 -24" />
          </g>
          {/* the diya beside them */}
          <g transform="translate(196 286)">
            <path className="lss-diya" d="M-13 0 C-13 -7 -7 -10 0 -10 C7 -10 13 -7 13 0 Z" />
            <path className="lss-diya-flame" d="M0 -10 C6 -18 4 -25 0 -31 C-4 -25 -6 -18 0 -10 Z" />
          </g>
          {/* the phone on its stand, showing the kund */}
          <g transform="translate(112 214)">
            <rect className="lss-phone" x="-25" y="-38" width="50" height="76" rx="7" />
            <rect className="lss-screen" x="-20" y="-32" width="40" height="60" rx="3" />
            {/* the fire, as it appears on a small screen */}
            <path className="lss-screen-flame" d="M0 18 C10 6 7 -6 0 -16 C-7 -6 -10 6 0 18 Z" />
            <path className="lss-stand" d="M-9 38 L-14 50 H14 L9 38 Z" />
            <circle className="lss-live-dot" cx="-13" cy="-25" r="2.6" />
          </g>
        </g>

        {/* ══════════ THE LINK, middle ══════════ */}
        {/* Outbound: home → fire. Sankalp goes up. */}
        <path id="lss-path-out" className="lss-arc" d="M250 190 C360 108 470 108 566 178" />
        {/* Return: fire → home. Bhasma and prasad come back. */}
        <path id="lss-path-back" className="lss-arc lss-arc--back" d="M566 236 C470 300 360 300 250 240" />

        {OUTBOUND.map((d, i) => (
          <circle
            key={`o${d}`}
            className="lss-bead"
            r="5.5"
            {...(still ? OUT_PARKED[i] : null)}
            style={{ animationDelay: `${d}s` }}
          >
            {!still && (
              <animateMotion dur="4.8s" repeatCount="indefinite" begin={`${d}s`} calcMode="linear">
                <mpath href="#lss-path-out" xlinkHref="#lss-path-out" />
              </animateMotion>
            )}
          </circle>
        ))}
        {RETURN.map((d, i) => (
          <circle
            key={`b${d}`}
            className="lss-bead lss-bead--back"
            r="4.5"
            {...(still ? BACK_PARKED[i] : null)}
            style={{ animationDelay: `${d}s` }}
          >
            {!still && (
              <animateMotion dur="5.6s" repeatCount="indefinite" begin={`${d}s`} calcMode="linear">
                <mpath href="#lss-path-back" xlinkHref="#lss-path-back" />
              </animateMotion>
            )}
          </circle>
        ))}

        {/* ══════════ TEMPLE + KUND, right ══════════ */}
        <g className="lss-temple">
          {/* shikhara behind the kund, so the fire reads as being at a temple */}
          <path className="lss-shikhar" d="M596 286 V206 C596 168 620 128 648 96 C676 128 700 168 700 206 V286 Z" />
          <path className="lss-shikhar-line" d="M648 96 V286" />
          <circle className="lss-kalash" cx="648" cy="86" r="7" />
          <path className="lss-arch" d="M628 286 V240 C628 226 668 226 668 240 V286" />

          {/* the kund itself, in front */}
          <g transform="translate(566 286)">
            <ellipse className="lss-kund-glow" cx="0" cy="-16" rx="72" ry="30" fill="url(#lss-glow)" />
            <path className="lss-kund" d="M-46 0 L-34 -34 H34 L46 0 Z" />
            <path className="lss-kund-lip" d="M-36 -34 H36" />
            {/* three flames on one flare cycle, offset so the fire never
                pulses as a single block */}
            <path className="lss-flame lss-flame--c" d="M0 -34 C22 -62 15 -92 0 -118 C-15 -92 -22 -62 0 -34 Z" fill="url(#lss-flame)" />
            <path className="lss-flame lss-flame--l" d="M-16 -34 C-2 -54 -8 -74 -18 -90 C-28 -72 -30 -52 -16 -34 Z" fill="url(#lss-flame)" />
            <path className="lss-flame lss-flame--r" d="M16 -34 C30 -54 24 -74 14 -90 C4 -72 2 -52 16 -34 Z" fill="url(#lss-flame)" />
            {/* smoke, rising out of frame */}
            <circle className="lss-smoke lss-smoke--1" cx="-4" cy="-118" r="9" />
            <circle className="lss-smoke lss-smoke--2" cx="6" cy="-118" r="7" />
            <circle className="lss-smoke lss-smoke--3" cx="-1" cy="-118" r="11" />
          </g>
        </g>
      </svg>
    </div>
  );
}
