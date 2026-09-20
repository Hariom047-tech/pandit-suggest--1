import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function Layout() {
  const location = useLocation();
  /** The pathname the previous run of the effect below saw, so it can tell an
   *  in-page anchor jump from an arrival on a new route. */
  const prevPath = useRef<string | null>(null);

  /**
   * Scroll position on navigation: top of the new page, or the #hash it names.
   *
   * This used to be `window.scrollTo({top: 0})` keyed on `location.pathname`
   * alone, which broke both halves of a hash link:
   *
   *   - Clicking the footer's "FAQ" (-> /contact#faq) while already ON
   *     /contact changed only the hash, so the effect never re-ran and
   *     nothing moved at all — the visitor was left sitting in the footer
   *     where they had clicked, which looked like a dead link.
   *   - Arriving from another page scrolled to the top of /contact and
   *     ignored the #faq entirely.
   *
   * React Router does not honour fragments on its own, so this has to. Keyed
   * on the hash as well as the pathname, which is what makes the first case
   * fire.
   */
  useEffect(() => {
    const samePage = prevPath.current === location.pathname;
    prevPath.current = location.pathname;

    // `#` on its own (the footer's placeholder Sitemap link) decodes to "" and
    // is not a target — treat it as no hash rather than hunting for an
    // element with an empty id.
    const id = decodeURIComponent(location.hash.replace(/^#/, ""));
    if (!id) {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      return;
    }

    // The target usually is not in the DOM yet on a cross-page navigation —
    // the route's chunk is still loading, or the section renders behind data.
    // Retry on animation frames rather than guessing a timeout, and give up
    // after ~1s by falling back to the top of the page, so a stale or wrong
    // fragment can never strand the visitor mid-document.
    let frame = 0;
    let tries = 0;
    const settle = () => {
      const el = document.getElementById(id);
      if (el) {
        // No explicit behavior when the visitor is already on this page: the
        // global `html { scroll-behavior: smooth }` (base.css) then animates
        // the jump, and the reduced-motion override turns that off for anyone
        // who asked for less movement. Arriving from another route jumps
        // instantly instead — smooth-scrolling the length of a page someone
        // has not seen yet is slow, not polished.
        el.scrollIntoView(samePage ? undefined : { behavior: "instant" as ScrollBehavior });
        return;
      }
      if (tries++ < 60) {
        frame = requestAnimationFrame(settle);
      } else if (!samePage) {
        window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      }
    };
    settle();
    return () => cancelAnimationFrame(frame);
  }, [location.pathname, location.hash]);

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Header />
      <main id="main">
        <Outlet />
      </main>
      {location.pathname !== "/login" && <Footer />}
    </>
  );
}
