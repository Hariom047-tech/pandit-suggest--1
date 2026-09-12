import { Link } from "react-router-dom";
import { Icon } from "../lib/icons";
import { useLang } from "../lib/i18n";
import { Seo } from "../lib/Seo";

export default function NotFound() {
  const { t } = useLang();
  return (
    <div className="notfound">
      {/* A description of its own, not the site-wide fallback. With none,
          this page inherited siteConfig.defaultDescription — marketing copy
          for the whole site — and that is the text Google printed under a
          404 URL it had indexed (/index.html, now redirected in nginx). */}
      <Seo
        title="Page Not Found"
        description="This page does not exist on PanditSuggest. Browse verified Pandits or the full list of puja and havan services instead."
        noindex
      />
      <div className="om-mark"><Icon name="om" size={72} /></div>
      <h1 className="section-title" style={{ marginTop: 14 }}>{t("notFound.title")}</h1>
      <p className="section-sub">{t("notFound.text")}</p>
      <div className="row" style={{ justifyContent: "center", gap: 12, marginTop: 26, flexWrap: "wrap" }}>
        <Link className="btn btn-gold btn-lg" to="/">{t("notFound.backHome")}</Link>
        <Link className="btn btn-outline btn-lg" to="/pandits">{t("common.findAPandit")}</Link>
      </div>
    </div>
  );
}
