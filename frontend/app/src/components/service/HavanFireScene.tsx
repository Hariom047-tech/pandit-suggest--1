import "./HavanFireScene.css";

/**
 * The living havan at the head of the Havan tab.
 *
 * Four pandits seated around a kund, taking turns to offer aahuti; each time a
 * droplet of ghee lands the fire flares and a ripple spreads from the mouth of
 * the kund. That synchronisation is the whole idea — the fire reacts to the
 * offering instead of looping independently of it, which is what separates
 * this from a decorative gif.
 *
 * Deliberately an inline SVG driven by CSS keyframes, not Lottie and not
 * canvas: it costs no extra network request and no animation frame loop, and
 * every animated property is `transform` or `opacity`, so the whole scene
 * lives on the compositor and never triggers layout or paint. That is what
 * keeps it smooth on the low-end Android phones most devotees browse on.
 *
 * The turn-taking is pure CSS too: one 8s cycle per pandit, offset 2s apart,
 * against a 2s flare — so an aahuti lands on every flare with no JS clock.
 */

/** Kund mouth in scene coordinates — where every offering is aimed. */
const KUND = { x: 240, y: 226 };

type Seat = {
  id: string;
  /** Seat position in scene coordinates. */
  x: number;
  y: number;
  /** Scale doubles as depth cue — the back pair sit smaller and dimmer. */
  s: number;
  /** Mirrored so both sides face the fire from one set of paths. */
  flip: boolean;
  opacity: number;
  /** Offset into the shared 8s cycle: the turn this pandit takes. */
  delay: number;
};

/* Two rows so the kund reads as something people sit *around*, not behind.
   Delays deliberately criss-cross the circle (front-left, back-right,
   front-right, back-left) — a left-to-right sweep would read as a wave. */
const SEATS: Seat[] = [
  { id: "front-left", x: 112, y: 258, s: 1, flip: false, opacity: 1, delay: 0 },
  { id: "back-right", x: 312, y: 232, s: 0.78, flip: true, opacity: 0.72, delay: 2 },
  { id: "front-right", x: 368, y: 258, s: 1, flip: true, opacity: 1, delay: 4 },
  { id: "back-left", x: 168, y: 232, s: 0.78, flip: false, opacity: 0.72, delay: 6 },
];

function Pandit({ seat }: { seat: Seat }) {
  const { x, y, s, flip, opacity, delay } = seat;
  /* The droplet travels in the pandit's own (possibly mirrored, possibly
     scaled) coordinates, so the distance to the kund is resolved per seat and
     handed to CSS as a variable. Mirroring makes the two sides identical. */
  const dx = Math.abs(KUND.x - x) / s - 28;
  const dy = (KUND.y - y) / s + 20;

  return (
    <g
      transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}
      opacity={opacity}
    >
      {/* folded legs / dhoti */}
      <path className="hfs-base" d="M-27 0 C-27 -9 -17 -16 0 -16 C17 -16 27 -9 27 0 Z" />
      {/* torso */}
      <path className="hfs-torso" d="M-13 -13 C-14 -33 -9 -45 0 -45 C9 -45 14 -33 13 -13 Z" />
      {/* uttariya draped over the shoulders */}
      <path className="hfs-shawl" d="M-13 -31 C-6 -37 6 -37 13 -31 L11 -15 C4 -19 -4 -19 -11 -15 Z" />
      <circle className="hfs-head" cx="0" cy="-53" r="9" />
      {/* shikha */}
      <path className="hfs-tuft" d="M-8 -57 C-12 -60 -12 -65 -7 -65" />

      {/* The arm pivots at the shoulder: the path's bounding box starts
          exactly there, so fill-box + 0% 0% needs no magic numbers. */}
      <g className="hfs-arm" style={{ animationDelay: `${delay}s` }}>
        <path className="hfs-limb" d="M9 -34 C18 -32 25 -26 28 -20" />
      </g>

      <circle
        className="hfs-drop"
        cx="28"
        cy="-20"
        r="2.6"
        style={{
          animationDelay: `${delay}s`,
          // @ts-expect-error -- custom properties are valid inline style values
          "--hfs-dx": `${dx}px`,
          "--hfs-dy": `${dy}px`,
        }}
      />
    </g>
  );
}

/* Embers and smoke are data, not repeated markup — each only needs a start
   position and its own offset so the rise never looks like a marching row. */
const EMBERS = [
  { x: 226, r: 2.2, dur: 3.4, delay: 0 },
  { x: 248, r: 1.6, dur: 4.2, delay: 0.9 },
  { x: 236, r: 2.6, dur: 3.8, delay: 1.7 },
  { x: 256, r: 1.8, dur: 4.6, delay: 2.4 },
  { x: 220, r: 1.5, dur: 4.0, delay: 3.1 },
  { x: 244, r: 2.0, dur: 3.6, delay: 0.4 },
  { x: 232, r: 1.4, dur: 4.8, delay: 2.0 },
  { x: 262, r: 2.3, dur: 4.4, delay: 1.2 },
];

const SMOKE = [
  { x: 234, rx: 16, ry: 10, dur: 7.5, delay: 0 },
  { x: 250, rx: 13, ry: 8, dur: 8.5, delay: 2.6 },
  { x: 240, rx: 19, ry: 11, dur: 9.5, delay: 5.1 },
];

export function HavanFireScene() {
  return (
    <div className="hfs">
      <svg
        className="hfs__svg"
        viewBox="0 0 480 300"
        role="img"
        aria-label="Four pandits seated around a havan kund, offering aahuti into the sacred fire"
      >
        <defs>
          <radialGradient id="hfsGlow" cx="50%" cy="72%" r="55%">
            <stop offset="0%" stopColor="#ffb733" stopOpacity="0.5" />
            <stop offset="55%" stopColor="#ff9a2e" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#ff8c1a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="hfsOuter" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#f2600f" stopOpacity="0.85" />
            <stop offset="55%" stopColor="#f8842a" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#f9a03c" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="hfsMid" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#ff8410" stopOpacity="0.95" />
            <stop offset="60%" stopColor="#ffa62b" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#ffc65a" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="hfsInner" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#ffb52e" stopOpacity="1" />
            <stop offset="70%" stopColor="#ffd569" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ffe9a8" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="hfsCore" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#fff6d2" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#fff9e8" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="hfsKund" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b0682f" />
            <stop offset="100%" stopColor="#7d4419" />
          </linearGradient>
        </defs>

        {/* Warm light the fire casts on everything behind it. */}
        <ellipse className="hfs-glow" cx="240" cy="196" rx="150" ry="118" fill="url(#hfsGlow)" />

        {/* Smoke sits behind the seated figures so it reads as depth. */}
        {SMOKE.map((s, i) => (
          <ellipse
            key={i}
            className="hfs-smoke"
            cx={s.x}
            cy="196"
            rx={s.rx}
            ry={s.ry}
            style={{ animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` }}
          />
        ))}

        {/* Back row first, so the front pair overlap them correctly. */}
        {SEATS.filter((s) => s.s < 1).map((seat) => (
          <Pandit key={seat.id} seat={seat} />
        ))}

        {/* ── The kund ── */}
        <ellipse className="hfs-shadow" cx="240" cy="264" rx="86" ry="11" />
        <rect className="hfs-plinth" x="190" y="250" width="100" height="13" rx="4" />
        <path className="hfs-kund-body" d="M196 224 L284 224 L272 252 L208 252 Z" fill="url(#hfsKund)" />
        <path className="hfs-kund-rim" d="M240 214 L292 224 L240 234 L188 224 Z" />
        <path className="hfs-kund-mouth" d="M240 219 L279 225 L240 231 L201 225 Z" />
        {/* brick courses */}
        <path className="hfs-kund-line" d="M199 233 L281 233" />
        <path className="hfs-kund-line" d="M203 242 L277 242" />

        {/* Ripple that spreads from the mouth on each offering. */}
        <ellipse className="hfs-ripple" cx="240" cy="225" rx="34" ry="8" />

        {/* ── The fire ── */}
        <g className="hfs-fire">
          <path
            className="hfs-flame hfs-flame--outer"
            d="M240 86 C262 132 278 168 276 196 C274 220 258 232 240 232 C222 232 206 220 204 196 C202 168 218 132 240 86 Z"
            fill="url(#hfsOuter)"
          />
          <path
            className="hfs-flame hfs-flame--mid"
            d="M240 120 C255 155 266 180 264 200 C262 218 252 228 240 228 C228 228 218 218 216 200 C214 180 225 155 240 120 Z"
            fill="url(#hfsMid)"
          />
          <path
            className="hfs-flame hfs-flame--inner"
            d="M240 150 C250 175 256 192 255 206 C254 218 248 224 240 224 C232 224 226 218 225 206 C224 192 230 175 240 150 Z"
            fill="url(#hfsInner)"
          />
          <path
            className="hfs-flame hfs-flame--core"
            d="M240 175 C246 193 249 203 248 211 C247 219 244 222 240 222 C236 222 233 219 232 211 C231 203 234 193 240 175 Z"
            fill="url(#hfsCore)"
          />
        </g>

        {/* The flare the aahuti causes — brightest right as a droplet lands. */}
        <ellipse className="hfs-flare" cx="240" cy="214" rx="30" ry="20" />

        {EMBERS.map((e, i) => (
          <circle
            key={i}
            className="hfs-ember"
            cx={e.x}
            cy="214"
            r={e.r}
            style={{ animationDuration: `${e.dur}s`, animationDelay: `${e.delay}s` }}
          />
        ))}

        {/* Front row last — nearest the viewer, drawn over the fire's base. */}
        {SEATS.filter((s) => s.s === 1).map((seat) => (
          <Pandit key={seat.id} seat={seat} />
        ))}
      </svg>
    </div>
  );
}
