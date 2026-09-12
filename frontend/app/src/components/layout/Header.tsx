import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Icon } from "../../lib/icons";
import { useAuth } from "../../lib/Auth";
import { useLang } from "../../lib/i18n";
import { useHasTemples } from "../../hooks/useHasTemples";
import { useSiteImages } from "../../lib/siteImages";

/** A nav row. `temples: true` marks one that only exists once an admin has
 *  published a temple — until then it points at an empty directory, so it is
 *  filtered out of every nav below (see hooks/useHasTemples.ts). */
interface NavRow {
  to: string;
  labelKey: string;
  temples?: boolean;
}
/** A nav row that also carries an icon (the drawer extras and bottom bar). */
interface NavIconRow extends NavRow {
  icon: string;
}

// The site's primary navigation, and deliberately the set of pages we want
// search engines to treat as the site's main sections. Online Puja was
// reachable only from the drawer and two in-page CTAs — three links in the
// whole app — while Services and Pandits had the nav, the footer and a dozen
// CTAs each. A page the site itself barely links to is not one a search
// engine will offer as a shortcut to it.
const NAV: NavRow[] = [
  { to: "/", labelKey: "nav.home" },
  { to: "/temples", labelKey: "nav.temples", temples: true },
  { to: "/pandits", labelKey: "nav.pandits" },
  { to: "/services", labelKey: "nav.services" },
  { to: "/online-havan", labelKey: "nav.onlinePuja" },
  { to: "/blog", labelKey: "nav.blog" },
];

// "Pandit Ji AI" (/pandit-ji) was removed: two AI entry points meant two
// different answers to the same question, and only one of them was grounded in
// the knowledge base and real pandit data. The AI Pooja Guide surface still
// exists at /ai-recommender (linked from the drawer's bottom CTA) — it's just
// not duplicated as its own drawer-menu row.
const NAV_EXTRA: NavIconRow[] = [
  // Online Puja has moved into NAV above — the drawer renders NAV first and
  // NAV_EXTRA after it, so it is still in the menu, just not listed twice.
  { to: "/temple-map", labelKey: "nav.templeMap", icon: "map", temples: true },
  // Straight to the pandit sign-in screen, not the public /dashboard preview
  // page — someone tapping "Pandit Dashboard" from the menu wants to log in,
  // not read marketing copy about the dashboard.
  { to: "/pandit-login", labelKey: "nav.dashboard", icon: "layout-dashboard" },
  { to: "/about", labelKey: "nav.about", icon: "info" },
  { to: "/contact", labelKey: "nav.contact", icon: "mail" },
];

// The fifth slot is Temples once temples exist, and the visitor's own
// profile until then — a five-tab bar with a dead tab in it is worse than
// either, and "My Profile" is the thing people were reaching the drawer for
// on a phone anyway.
const BOTTOM: NavIconRow[] = [
  { to: "/", labelKey: "nav.home", icon: "diya" },
  { to: "/services", labelKey: "nav.services", icon: "flame" },
  { to: "/search", labelKey: "common.search", icon: "search" },
  { to: "/pandits", labelKey: "nav.pandits", icon: "users" },
  { to: "/temples", labelKey: "nav.temples", icon: "temple", temples: true },
];

/** The build's own logo. Used only until an admin uploads one into the
 *  `brand.logo` slot (Admin Panel -> Page Images -> Brand), and kept as the
 *  fallback so a header is never logo-less. */
const BUNDLED_LOGO = "/assets/img/logo-header.webp";

function Brand({ size }: { size?: string }) {
  const { srcOr } = useSiteImages();
  return (
    <Link className="brand" to="/" aria-label="PanditSuggest home">
      {/* alt="" on purpose. The link already says "Pandit Suggest" in text
          right next to it, so the image adds nothing a screen reader needs —
          and an alt on a linked image becomes part of that link's anchor
          text. This one said "PanditSuggest Logo", on every page, in the
          most-repeated internal link on the site, and Google used it to
          title pages it could not title any other way. */}
      <img src={srcOr("brand.logo", BUNDLED_LOGO)} alt="" width={60} height={60} style={{ objectFit: 'contain' }} />
      <span className="brand-name" style={size ? { fontSize: size } : undefined}>
        Pandit <span>Suggest</span>
      </span>
    </Link>
  );
}

/** Astrotalk-style "अA" compact dropdown language switcher */
export function LangSwitch({ compact }: { compact?: boolean }) {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className={`ls-wrap${compact ? " ls-wrap--compact" : ""}`}>
      {/* Trigger pill */}
      <button
        type="button"
        className="ls-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select language"
      >
        <span className="ls-btn__hi">अ</span>
        <span className="ls-btn__en">A</span>
      </button>

      {/* Dropdown — CSS-only transition (base.css's .ls-dropdown/.is-open),
          not framer-motion: this is a simple opacity/transform fade with no
          gesture or layout dependency, and framer-motion's JS was pure
          overhead here — always in the DOM, every page, gating nothing but
          costing initial-bundle weight (Phase 12, docs/SEO_ARCHITECTURE.md). */}
      <ul
        className={`ls-dropdown${open ? " is-open" : ""}`}
        role="listbox"
        aria-label="Language"
      >
        {/* English */}
        <li
          role="option"
          aria-selected={lang === "en"}
          className={`ls-option${lang === "en" ? " ls-option--active" : ""}`}
          onClick={() => { setLang("en"); setOpen(false); }}
        >
          <span className="ls-option__flag">🇮🇳</span>
          <span className="ls-option__label">English</span>
          {lang === "en" && <span className="ls-option__check">✓</span>}
        </li>

        {/* Hindi */}
        <li
          role="option"
          aria-selected={lang === "hi"}
          className={`ls-option${lang === "hi" ? " ls-option--active" : ""}`}
          onClick={() => { setLang("hi"); setOpen(false); }}
        >
          <span className="ls-option__flag">🙏</span>
          <span className="ls-option__label">हिंदी</span>
          {lang === "hi" && <span className="ls-option__check">✓</span>}
        </li>
      </ul>
    </div>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  const { user, loading } = useAuth();
  const { t } = useLang();
  const hasTemples = useHasTemples();

  // One filter, three navs.
  const nav = hasTemples ? NAV : NAV.filter((n) => !n.temples);
  const navExtra = hasTemples ? NAV_EXTRA : NAV_EXTRA.filter((n) => !n.temples);
  const bottom: NavIconRow[] = hasTemples
    ? BOTTOM
    : [
        ...BOTTOM.filter((n) => !n.temples),
        // Always /dashboard, not the header's `user ? dashboard : login` —
        // that would read `user` before the auth check has resolved and send
        // an already-signed-in visitor to the login screen. Dashboard.tsx
        // waits for the check itself and forwards a signed-out visitor to
        // /login with a `from`, so they land back here afterwards.
        { to: "/dashboard", labelKey: "nav.profile", icon: "user" },
      ];

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header className="site-header">
        <div className="shell header-inner">

          {/* ── MOBILE: hamburger on LEFT (Removed) ── */}

          <Brand />

          <nav className="main-nav" aria-label="Main">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => (isActive ? "is-active" : "")}>
                {t(n.labelKey)}
              </NavLink>
            ))}
          </nav>

          {/* RIGHT actions */}
          <div className="header-cta">
            {/* Desktop-only buttons.
                Now points at the AI Pooja Guide — the grounded assistant — not
                the removed /pandit-ji chat. The pulse animation is kept but
                honours prefers-reduced-motion, which the original did not: an
                infinitely pulsing CTA is exactly what that setting is for. */}
            <Link
              className="btn btn-sm hdr-desktop-only hdr-ai-cta"
              to="/ai-recommender"
            >
              <Icon name="sparkles" size={15} /> {t("nav.aiRecommender")}
            </Link>
            <style>{`
              .hdr-ai-cta {
                background: linear-gradient(135deg, #f3d47d, #d4a017);
                color: #fff;
                border: none;
                box-shadow: 0 4px 14px rgba(212,160,23,0.3);
                animation: pc-pulse 2s infinite;
              }
              @keyframes pc-pulse {
                0% { box-shadow: 0 0 0 0 rgba(212,160,23,0.6); }
                70% { box-shadow: 0 0 0 8px rgba(212,160,23,0); }
                100% { box-shadow: 0 0 0 0 rgba(212,160,23,0); }
              }
              @media (prefers-reduced-motion: reduce) {
                .hdr-ai-cta { animation: none; }
              }
            `}</style>
            {!loading && (
              <Link className="btn btn-outline btn-sm hdr-desktop-only" style={{ marginLeft: '8px' }} to={user ? "/dashboard" : "/login"}>
                <Icon name="user" size={17} /> {user ? t("nav.myProfile") : t("nav.login")}
              </Link>
            )}

            {/* Language switcher — visible on all screen sizes */}
            <LangSwitch />

            {/* Profile circle (Removed) */}

            {/* Desktop hamburger (hidden on mobile, replaced by left toggle) */}
            <button
              className="nav-toggle nav-toggle--right"
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="drawer"
              onClick={() => setOpen(true)}
            >
              <Icon name="menu" />
            </button>
          </div>
        </div>
      </header>

      {/* CSS-only transition — base.css's .scrim/.drawer already define the
          full opacity/transform transition (`.drawer.is-open { transform:
          translateX(0) }`, `.scrim.is-open { opacity: 1 }`); framer-motion's
          AnimatePresence here was doing the exact same animation a second
          time, on top of the CSS, purely as JS bundle weight (Phase 12,
          docs/SEO_ARCHITECTURE.md). Always rendered now — off-screen/
          invisible via the same CSS when closed — instead of conditionally
          mounted, matching how the CSS transition was already written. */}
      <div className={`scrim${open ? " is-open" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`drawer${open ? " is-open" : ""}`} id="drawer" aria-label="Menu">
        <div className="row-between">
          <Brand size="1.2rem" />
          <button className="nav-toggle" aria-label="Close menu" style={{ display: "flex" }} onClick={() => setOpen(false)}>
            <Icon name="x" />
          </button>
        </div>
        <nav className="drawer-links">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => (isActive ? "is-active" : "")} onClick={() => setOpen(false)}>
              {t(n.labelKey)}
            </NavLink>
          ))}
          {/* My Profile/Login heads the secondary group, below the real
              sections above. This used to pull navExtra[0] out ahead of it,
              which only made sense while that index happened to be Online
              Havan; that row is part of NAV now, so the special case is gone
              and the list renders whole. Mirrors the desktop header-cta's
              My Profile/Login link (same destination logic). */}
          {!loading && (
            <NavLink to={user ? "/dashboard" : "/login"} className={({ isActive }) => (isActive ? "is-active" : "")} onClick={() => setOpen(false)}>
              <Icon name="user" size={19} />
              {user ? t("nav.myProfile") : t("nav.login")}
            </NavLink>
          )}
          {navExtra.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? "is-active" : "")} onClick={() => setOpen(false)}>
              <Icon name={n.icon} size={19} />
              {t(n.labelKey)}
            </NavLink>
          ))}
        </nav>
        <Link className="btn btn-gold btn-block" to="/ai-recommender" style={{ marginTop: 22 }} onClick={() => setOpen(false)}>
          <Icon name="sparkles" size={18} /> {t("nav.whichPoojaDoINeed")}
        </Link>
      </aside>

      <nav className="bottom-nav" aria-label="Quick navigation">
        <ul>
          {bottom.map((n) => (
            <li key={n.to}>
              <NavLink to={n.to} end={n.to === "/"} className={({ isActive }) => (isActive ? "is-active" : "")}>
                <Icon name={n.icon} size={22} />
                <span>{t(n.labelKey)}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
