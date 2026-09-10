import { useMemo, useState } from "react";
import { Icon } from "../../lib/icons";
import { useLang } from "../../lib/i18n";

/**
 * The sankalp, built in front of the reader.
 *
 * "Send us your name and gotra" tells a devotee nothing about why those five
 * fields matter. Typing them here and watching the actual sankalp vakya
 * assemble around them does: the sentence is the thing the acharya speaks
 * over the fire, and every blank in it is one of the fields being asked for.
 * Left empty it reads as the template with its placeholders showing, which is
 * already the explanation — nobody has to fill it in for the section to work.
 *
 * Nothing is sent anywhere and nothing is stored. This is a reading aid, not
 * a booking form: the actual details go to a Pandit Ji the devotee has chosen
 * and spoken to, which is the only place on this site they ever go.
 */

interface Fields {
  name: string;
  father: string;
  gotra: string;
  city: string;
  purpose: string;
}

const EMPTY: Fields = { name: "", father: "", gotra: "", city: "", purpose: "" };

export function SankalpPreview() {
  const { t } = useLang();
  const [f, setF] = useState<Fields>(EMPTY);
  const [copied, setCopied] = useState(false);

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setCopied(false);
    setF((prev) => ({ ...prev, [k]: e.target.value }));
  };

  const filled = useMemo(() => Object.values(f).some((v) => v.trim()), [f]);

  /* The plain-text version, for the devotee to paste into whatever chat they
     end up having with a Pandit Ji. Labels are bilingual on purpose: the
     pandit receiving it may read either. */
  const asText = useMemo(() => {
    const rows: [string, string][] = [
      ["नाम / Name", f.name],
      ["पिता का नाम / Father's name", f.father],
      ["गोत्र / Gotra", f.gotra],
      ["नगर / City", f.city],
      ["संकल्प / Purpose", f.purpose],
    ];
    return rows.map(([k, v]) => `${k}: ${v.trim() || "—"}`).join("\n");
  }, [f]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asText);
      setCopied(true);
    } catch {
      /* Clipboard blocked (insecure context, or the devotee declined the
         permission) — the details are on screen and can be read off it. */
      setCopied(false);
    }
  };

  /** A filled value, or the placeholder still showing through. */
  const slot = (value: string, placeholder: string) =>
    value.trim() ? (
      <span className="oh-sankalp__slot is-filled">{value.trim()}</span>
    ) : (
      <span className="oh-sankalp__slot">{placeholder}</span>
    );

  return (
    <div className="oh-sankalp">
      <div className="oh-sankalp__form">
        <h3 className="oh-sankalp__form-title">{t("onlineHavan.sankalpFormTitle")}</h3>
        <p className="oh-sankalp__form-sub">{t("onlineHavan.sankalpFormSub")}</p>

        <label className="oh-sankalp__field">
          <span>{t("onlineHavan.fName")}</span>
          <input type="text" value={f.name} onChange={set("name")} autoComplete="off" placeholder={t("onlineHavan.fNamePh")} />
        </label>
        <label className="oh-sankalp__field">
          <span>{t("onlineHavan.fFather")}</span>
          <input type="text" value={f.father} onChange={set("father")} autoComplete="off" placeholder={t("onlineHavan.fFatherPh")} />
        </label>
        <div className="oh-sankalp__row">
          <label className="oh-sankalp__field">
            <span>{t("onlineHavan.fGotra")}</span>
            <input type="text" value={f.gotra} onChange={set("gotra")} autoComplete="off" placeholder={t("onlineHavan.fGotraPh")} />
          </label>
          <label className="oh-sankalp__field">
            <span>{t("onlineHavan.fCity")}</span>
            <input type="text" value={f.city} onChange={set("city")} autoComplete="off" placeholder={t("onlineHavan.fCityPh")} />
          </label>
        </div>
        <label className="oh-sankalp__field">
          <span>{t("onlineHavan.fPurpose")}</span>
          <input type="text" value={f.purpose} onChange={set("purpose")} autoComplete="off" placeholder={t("onlineHavan.fPurposePh")} />
        </label>

        <p className="oh-sankalp__hint">
          <Icon name="info" size={14} /> {t("onlineHavan.gotraHelp")}
        </p>

        <div className="oh-sankalp__actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={copy} disabled={!filled}>
            <Icon name={copied ? "check" : "edit"} size={15} />
            {copied ? t("onlineHavan.copied") : t("onlineHavan.copyDetails")}
          </button>
          <span className="oh-sankalp__privacy">{t("onlineHavan.nothingSent")}</span>
        </div>
      </div>

      {/* ── the sentence itself ── */}
      <figure className="oh-sankalp__scroll">
        <div className="oh-sankalp__scroll-top" aria-hidden="true" />
        <span className="oh-sankalp__scroll-label">{t("onlineHavan.spokenAtTheFire")}</span>

        <blockquote className="oh-sankalp__vakya" lang="sa">
          <span className="oh-sankalp__om">॥ ॐ विष्णुर्विष्णुर्विष्णुः ॥</span>
          <p>
            अद्य श्रीमन्नाभिवर्तमानस्य श्रीश्वेतवाराहकल्पे … अस्मिन् वर्तमाने शुभ दिने,{" "}
            {slot(f.gotra, "____")} गोत्रोत्पन्नः, {slot(f.father, "____")} आत्मजः,{" "}
            {slot(f.name, "____")} नाम अहम्, {slot(f.city, "____")} निवासी,
          </p>
          <p>
            मम {slot(f.purpose, "____")} — तत्सिद्ध्यर्थं, श्री बगलामुखी देव्याः प्रीत्यर्थं
            हवनम् अहं करिष्ये॥
          </p>
        </blockquote>

        <figcaption className="oh-sankalp__caption">{t("onlineHavan.sankalpCaption")}</figcaption>
      </figure>
    </div>
  );
}
