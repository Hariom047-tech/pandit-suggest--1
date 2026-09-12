import { Link } from "react-router-dom";
import { siteConfig } from "../../lib/siteConfig";
import { useMemo, useState, type FormEvent } from "react";
import { Icon } from "../../lib/icons";
import { api } from "../../lib/api";
import { useToast } from "../ui/Toast";
import { useLang } from "../../lib/i18n";
import { useHasTemples } from "../../hooks/useHasTemples";
import { useServices } from "../../hooks/useData";
import { normServices } from "../../lib/normalize";
import { useSiteImages } from "../../lib/siteImages";

const SOCIALS: [string, string][] = [
  ["facebook", "Facebook"],
  ["instagram", "Instagram"],
  ["youtube", "YouTube"],
  ["twitter", "X"],
  ["linkedin", "LinkedIn"],
];

/**
 * The site's main sections, deliberately the same four the header nav
 * carries and in the same order.
 *
 * They use the `nav.*` keys, not the old footer-only ones: this column said
 * "Pandit Directory" and "All Services" while the header said "Pandits" and
 * "Services", so every page had two different names for the same URL. One
 * label per destination, defined once, is a clearer statement of what each
 * page is called — to a reader and to a crawler reading link text.
 *
 * The two temple rows are dropped until an admin has published a temple —
 * same rule as the header nav (hooks/useHasTemples.ts). A footer is the one
 * place a link to an empty directory survives longest, because nothing about
 * it looks broken.
 */
const EXPLORE: [string, string][] = [
  ["/temples", "nav.temples"],
  ["/pandits", "nav.pandits"],
  ["/services", "nav.services"],
  ["/online-havan", "nav.onlinePuja"],
  ["/ai-recommender", "nav.aiRecommender"],
  ["/temple-map", "nav.templeMap"],
];
const EXPLORE_TEMPLE_PATHS = new Set(["/temples", "/temple-map"]);

const COMPANY: [string, string][] = [
  ["/about", "footer.aboutUs"],
  ["/how-it-works", "footer.howItWorks"],
  ["/blog", "footer.spiritualBlog"],
  ["/contact", "footer.contact"],
];

const SUPPORT: [string, string][] = [
  ["/dashboard", "footer.panditDashboard"],
  ["/contact#faq", "footer.faq"],
  ["/about#verify", "footer.verificationProcess"],
];

interface FooterLink { href: string; label: string }

/** One collapsible link column. A native <details>/<summary> — collapsed by
 *  default (compact on a phone-length footer), no JS needed for the
 *  toggle; base.css forces it permanently open (and hides the chevron) from
 *  tablet width up, where there's room to just show the links.
 *
 *  Takes labels already resolved, not dictionary keys: the Havan column's
 *  labels are service names out of the catalogue, which have no key to look
 *  up. Each caller translates what it has. */
function FooterAccordion({ title, links }: { title: string; links: FooterLink[] }) {
  if (!links.length) return null;
  return (
    <details className="footer-acc">
      <summary className="footer-acc__head">
        {title}
        <Icon name="chevron-down" size={16} className="footer-acc__chevron" />
      </summary>
      <div className="footer-acc__body">
        {links.map((l) => <Link key={l.href} to={l.href}>{l.label}</Link>)}
      </div>
    </details>
  );
}

export function Footer() {
  const [email, setEmail] = useState("");
  const toast = useToast();
  const { t, lang } = useLang();
  // Same admin-managed slot the header reads, same bundled fallback — the two
  // must never show different logos. See Header.tsx's BUNDLED_LOGO.
  const { srcOr } = useSiteImages();
  const hasTemples = useHasTemples();
  const explore = hasTemples ? EXPLORE : EXPLORE.filter(([href]) => !EXPLORE_TEMPLE_PATHS.has(href));

  /**
   * The havans in the catalogue, as their own footer column.
   *
   * Read from the live catalogue rather than a hardcoded list of slugs: a
   * havan an admin adds appears here, and one they deactivate disappears
   * instead of leaving the footer pointing at a page that is gone. Matched on
   * the name, which is what actually distinguishes a havan from a puja in
   * this catalogue — there is no havan flag on the row.
   *
   * Capped, because this is a footer column and not a second directory; the
   * full list is one click away at /services.
   */
  const { data: rawServices } = useServices();
  const havans = useMemo(() => {
    const rows = normServices(rawServices).filter((s) => /havan/i.test(s.name));
    return rows.slice(0, 6).map((s) => ({
      href: `/services/${s.id}`,
      label: (lang === "hi" ? s.hi?.name : null) || s.name,
    }));
  }, [rawServices, lang]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const done = () => {
      toast(t("footer.subscribedToast"));
      setEmail("");
    };
    try {
      await api.subscribe(email);
    } catch {
      /* soft-fail: still confirm if backend is offline */
    }
    done();
  }

  return (
    <footer className="site-footer">
      <div className="shell footer-top">
        <div className="footer-col footer-col--brand">
          <Link className="brand" to="/" aria-label="PanditSuggest home">
            {/* alt="" — decorative, see the matching note in Header.tsx. */}
            <img src={srcOr("brand.logo", "/assets/img/logo-header.webp")} alt="" width={60} height={60} style={{ objectFit: 'contain' }} />
            <span className="brand-name" style={{ fontSize: "1.3rem" }}>Pandit <span>Suggest</span></span>
          </Link>
          <p className="muted" style={{ marginTop: 14, maxWidth: 330 }}>
            {t("footer.tagline")}
          </p>
          {/* Linked, not just printed: a footer number is most often read on
              a phone, where tapping it should dial. */}
          <ul className="footer-contact">
            <li>
              <Icon name="phone" size={14} />
              <a href={`tel:${siteConfig.contact.phoneHref}`}>{siteConfig.contact.phone}</a>
            </li>
            <li>
              <Icon name="mail" size={14} />
              <a href={`mailto:${siteConfig.contact.email}`}>{siteConfig.contact.email}</a>
            </li>
          </ul>
          <div className="socials">
            {SOCIALS.map(([icon, label]) => (
              <a key={icon} href="#" aria-label={label} title={label}><Icon name={icon} size={18} /></a>
            ))}
          </div>
        </div>

        <FooterAccordion title={t("footer.explore")} links={explore.map(([href, k]) => ({ href, label: t(k) }))} />
        {/* Renders nothing at all until the catalogue has loaded and has a
            havan in it — FooterAccordion returns null for an empty list. */}
        <FooterAccordion title={t("footer.havanTypes")} links={havans} />
        <FooterAccordion title={t("footer.company")} links={COMPANY.map(([href, k]) => ({ href, label: t(k) }))} />
        <FooterAccordion title={t("footer.support")} links={SUPPORT.map(([href, k]) => ({ href, label: t(k) }))} />

        <div className="footer-col footer-col--newsletter">
          <h4>{t("footer.weeklyMail")}</h4>
          <p className="muted">{t("footer.newsletterTitle")}</p>
          <form className="footer-newsletter-form" onSubmit={onSubmit}>
            <label className="sr-only" htmlFor="nlMail">{t("footer.emailAddressLabel")}</label>
            <input className="input" id="nlMail" type="email" required placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn btn-gold" type="submit"><Icon name="send" size={17} /> {t("footer.subscribe")}</button>
          </form>
        </div>
      </div>

      <div className="shell footer-bottom">
        <span>{t("footer.copyright")}</span>
        <span className="row footer-bottom__legal">
          <Link to="/privacy">{t("footer.privacy")}</Link>
          <Link to="/terms">{t("footer.terms")}</Link>
          <a href="#">{t("footer.sitemap")}</a>
        </span>
      </div>
    </footer>
  );
}
