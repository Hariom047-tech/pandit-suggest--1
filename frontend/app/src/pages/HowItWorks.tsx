import { Link } from "react-router-dom";
import { Icon } from "../lib/icons";
import { Seo } from "../lib/Seo";
import { useLang } from "../lib/i18n";
import { useStructuredData, organizationSchema, websiteSchema, webPageSchema, breadcrumbSchema } from "../lib/structuredData";

/** Only the icon lives here now — the words come from the dictionary, so the
 *  page reads in whichever language the devotee has chosen. */
const STEPS = [
  { icon: "search", key: "step1" },
  { icon: "users", key: "step2" },
  { icon: "message-circle", key: "step3" },
  { icon: "check-circle", key: "step4" },
] as const;

export default function HowItWorks() {
  const { t } = useLang();
  useStructuredData([
    organizationSchema(),
    websiteSchema(),
    webPageSchema({ path: "/how-it-works", name: "How PanditSuggest Works" }),
    breadcrumbSchema([{ name: "Home", path: "/" }, { name: "How It Works", path: "/how-it-works" }]),
  ]);

  return (
    <>
      <Seo
        title="How PanditSuggest Works"
        description="Four steps to find and contact a verified Pandit directly — no booking fee, no assigned stranger, no middleman."
        path="/how-it-works"
      />
      <section className="page-hero">
        <img src="/assets/img/mandala.svg" className="watermark watermark--tl" alt="" />
        <div className="shell" style={{ position: "relative", zIndex: 1 }}>
          <nav className="crumbs" aria-label="Breadcrumb"><Link to="/">{t("nav.home")}</Link> <span>/</span> {t("howItWorks.crumb")}</nav>
          <h1 className="section-title" style={{ marginTop: 10 }}>{t("howItWorks.title")}</h1>
          <svg className="ornament" viewBox="0 0 190 16" aria-hidden="true"><path d="M6 8h64M120 8h64" fill="none" stroke="#d4a017" strokeWidth="1.6" /><path d="M84 8l11-6 11 6-11 6z" fill="none" stroke="#d4a017" strokeWidth="1.6" /></svg>
          <p className="section-sub">{t("howItWorks.sub")}</p>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <div className="grid g-4 hiw-steps-grid">
            {STEPS.map((s, i) => (
              <div className="card step" key={s.key}>
                <span className="step-n">0{i + 1}</span>
                <div className="step-ico"><Icon name={s.icon} size={30} /></div>
                <h3>{t(`howItWorks.${s.key}`)}</h3>
                <p>{t(`howItWorks.${s.key}Desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--cream">
        <div className="shell text-c">
          <h2 className="section-title">{t("howItWorks.ready")}</h2>
          <div className="row" style={{ justifyContent: "center", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
            <Link className="btn btn-gold btn-lg" to="/pandits">{t("howItWorks.findPandits")}</Link>
            <Link className="btn btn-outline btn-lg" to="/temples">{t("howItWorks.exploreTemples")}</Link>
            <Link className="btn btn-outline btn-lg" to="/about">{t("howItWorks.about")}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
