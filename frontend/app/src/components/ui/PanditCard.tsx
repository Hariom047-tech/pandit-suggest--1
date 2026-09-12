import { Link } from "react-router-dom";
import type { Pandit } from "../../data/types";
// serviceName & panditDisplayName are now inline helpers
import { Icon } from "../../lib/icons";
import { onImgError } from "../../lib/format";
import { usePanditContact } from "../../lib/usePanditContact";
import { useLang } from "../../lib/i18n";
import { useInViewOnce } from "../../lib/useInViewOnce";
import { VerifiedName } from "./VerifiedName";

export function PanditCard({ p, index = 0, sourceSurface, serviceSlug }: {
  p: Pandit;
  index?: number;
  sourceSurface?: string;
  /** The puja this card is being shown under, on a service page. Travels with
   *  a Chat/Call press so the lead — and the homepage's popular-puja ranking —
   *  know which ritual it was about. */
  serviceSlug?: string;
}) {
  const { t, lang } = useLang();
  const displayName = lang === "hi" && p.nameHi ? p.nameHi : p.name;
  /**
   * Everything else this pandit has in Hindi (migration 0012), used only while
   * the reader is in Hindi and applied per field with `|| english`.
   *
   * Spoken languages are different: they are a fixed vocabulary stored in
   * pandit_languages ("English", "Hindi", "Sanskrit"), not prose an admin
   * wrote, so they come from the dictionary rather than the translator — and
   * any value not in that list falls through as itself.
   */
  const hi = lang === "hi" ? p.hi ?? null : null;
  const langLabel = (name: string) => {
    // t() echoes the key back when the dictionary has no entry, so a language
    // this map does not cover must be detected and passed through as itself
    // rather than rendered as the literal string "languages.Bhojpuri".
    const key = `languages.${name}`;
    const label = t(key);
    return label === key ? name : label;
  };
  const { ref, visible } = useInViewOnce<HTMLElement>();
  // One shared contact flow (see lib/usePanditContact.ts). This card sits
  // inside a <Link>, so the press must be stopped from navigating first.
  const { contact, isPending } = usePanditContact();

  const handleAction = (e: React.MouseEvent, type: "whatsapp" | "call") => {
    e.preventDefault();
    e.stopPropagation();
    contact({
      panditSlug: p.id,
      action: type,
      phone: p.phone,
      whatsapp: p.phone,
      waMessage: `Namaste ${p.name}, I found your profile on PanditSuggest. I would like to enquire about a puja.`,
      // Which page this card is rendered on, for the admin activity/lead
      // source-surface breakdown — see backend's SOURCE_SURFACE_MAP.
      // Falls back to the pre-existing generic value for any caller that
      // hasn't been updated to pass one.
      source: sourceSurface || "pandit_card",
      service: serviceSlug,
    });
  };

  return (
    <article
      ref={ref}
      className={`astro-card card-reveal${visible ? " is-visible" : ""}`}
      style={{ transitionDelay: `${Math.min(index, 6) * 50}ms` }}
    >
      <Link to={`/pandits/${p.id}`} className="astro-card__link-wrap">
        
        {/* Header: Avatar, Name, Tier */}
        <div className="astro-card__header">
          <div className="astro-card__avatar">
            <img src={p.img} alt={displayName} loading="lazy" onError={onImgError("pandit")} />
          </div>

          <div className="astro-card__header-info">
            <div className="astro-card__name-row">
              {/* The heading is a fixed-height box that centres whatever name
                  it is given (see .astro-card__name): one line sits in the
                  middle of the reserved space instead of at the top with the
                  rest of the space left dangling under it, and a two-line name
                  fills it exactly. Every card in a row still lines up, which
                  is what the reserved height was always for.

                  VerifiedName keeps the tick glued to the surname — removing
                  the space alone did not, because the SVG itself is a legal
                  break point. */}
              <h3 className="astro-card__name">
                <span className="astro-card__name-text">
                  <VerifiedName
                    name={displayName}
                    verified={p.verified}
                    title={t("common.verified")}
                    badgeClass="astro-card__verified"
                  />
                </span>
              </h3>
            </div>
            <div className="astro-card__meta-short">
              {p.exp} {t("common.yearsExp")} • {p.langs.slice(0, 2).map(langLabel).join(", ")}
            </div>
            {/* Always rendered, even when city is blank (e.g. a profile mid
                onboarding) — an empty row keeps every card the same height
                and the same internal alignment as one with a real city. */}
            <div className="astro-card__location">
              <Icon name="map-pin" size={12} />
              <span>{hi?.city || p.city || t("panditCard.locationUnknown")}</span>
            </div>
          </div>
        </div>

        {/* Services — a single-row horizontal slider (scrolls, never wraps)
            rather than the old 2-row wrap, so there's room to list more than
            just the first 3 without growing the card. */}
        <div className="astro-card__tags">
          {p.services.slice(0, 6).map((s) => (
            <span className="astro-card__tag" key={s}>{s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
          ))}
        </div>

        {/* Rating and Online Status */}
        <div className="astro-card__stats-row">
          {/* Stars only once there is something to average — the same rule the
              profile page already applies. "0.0" on a pandit nobody has
              reviewed yet reads as a BAD pandit rather than a new one.

              The count is printed as the number of reviews it actually is.
              It used to render as `{p.reviews}k+ orders`, which turned two
              reviews into a claim of two thousand orders — a number nothing in
              this system measures. */}
          <div className="astro-card__rating">
            {p.reviews > 0 ? (
              <>
                <span className="astro-card__star">★</span>{" "}
                <span className="astro-card__rating-num">{p.rating.toFixed(1)}</span>
                <span className="astro-card__orders">
                  ({p.reviews} {t("panditCard.reviews")})
                </span>
              </>
            ) : (
              <span className="astro-card__orders">{t("panditCard.newOnPlatform")}</span>
            )}
          </div>
          <div className="astro-card__online">
            <span className="astro-card__online-dot" /> {t("common.online")}
          </div>
        </div>

        {/* Footer: Price & Buttons */}
        <div className="astro-card__footer">
          <div className="astro-card__price-col">
            <div className="astro-card__price">{t("panditCard.dakshina")}</div>
            <div className="astro-card__free">{t("panditCard.viaCall")}</div>
          </div>

          <div className="astro-card__actions">
            <button
              type="button"
              className="btn btn-outline btn-sm astro-card__btn"
              onClick={(e) => handleAction(e, "whatsapp")}
              disabled={isPending(p.id, "whatsapp")}
              aria-label={`WhatsApp ${displayName}`}
            >
              <Icon name="whatsapp" size={14} /> {t("common.chat")}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm astro-card__btn astro-card__btn--green"
              onClick={(e) => handleAction(e, "call")}
              disabled={isPending(p.id, "call")}
              aria-label={`Call ${displayName}`}
            >
              <Icon name="phone" size={14} /> {t("common.call")}
            </button>
          </div>
        </div>

      </Link>
    </article>
  );
}
