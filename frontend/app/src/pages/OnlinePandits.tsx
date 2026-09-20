import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../lib/icons";
import { Seo } from "../lib/Seo";
import { useLang } from "../lib/i18n";
import { usePandits, useServices } from "../hooks/useData";
import { normPandits, normServices } from "../lib/normalize";
import { useFairRanking, useReportExposure } from "../lib/api";
import { PanditCard } from "../components/ui/PanditCard";
import { EmptyState } from "../components/ui/ReviewCard";
import { Pager, paginate } from "../components/ui/Pager";
import {
  useStructuredData,
  breadcrumbSchema,
  itemListSchema,
  organizationSchema,
  webPageSchema,
  websiteSchema,
} from "../lib/structuredData";

/**
 * /online-havan/pandits — the Pandit Jis who actually perform a puja or havan
 * for a devotee who cannot be there.
 *
 * This is where "Talk to a Pandit Ji" on /online-havan now lands. It used to
 * hand the reader the services grid filtered to `?online=1`, which answers a
 * different question than the one the button asks: someone who has just read
 * the whole ritual walkthrough has already decided WHAT they want done and is
 * asking WHO will do it. Sending them back to a catalogue of pujas made them
 * pick a ritual a second time before a single human being appeared.
 *
 * "Available online" here is `pandits.accepts_online` — the pandit's own
 * profile-level opt-in to remote work (db/07-online-puja.sql). Deliberately
 * NOT `pandit_services.offers_online`, the per-ritual flag that
 * panditsRepo.forServiceOnline() gates on: that one is admin-set per
 * pandit+service pair and is currently false for every row on the site, so a
 * listing built on it would be an empty page under a button that promises
 * pandits. The service chips below narrow by who performs the ritual at all,
 * and the page says in as many words that the Pandit Ji confirms the online
 * arrangement on the call — which is the truthful version of what this data
 * can support.
 */

const PER_PAGE = 12;

export default function OnlinePandits() {
  const { t, lang } = useLang();
  const [params, setParams] = useSearchParams();
  /** The ritual the devotee arrived with, when they came from a service page
   *  by way of /online-havan?service=<slug>. */
  const [service, setService] = useState(() => params.get("service") || "");
  const [page, setPage] = useState(1);

  const { data: rawPandits, loading } = usePandits({ online: true, perPage: 600 });
  const { data: rawServices } = useServices();
  /* `?online=true` is the filter; `acceptsOnline` is checked again here on
     purpose. An API that doesn't know the param yet (an older backend, a
     cached response) silently ignores it and answers with the whole
     directory — and a page that promises online pandits must not quietly
     start listing pandits who never agreed to work that way. */
  const pandits = useMemo(
    () => normPandits(rawPandits).filter((p) => p.acceptsOnline),
    [rawPandits],
  );
  const services = useMemo(() => normServices(rawServices), [rawServices]);

  /** Chips: rituals that can be done remotely AND that somebody on this page
   *  actually performs. A chip that filters to nobody is worse than no chip. */
  const chips = useMemo(
    () =>
      services.filter(
        (s) => s.onlineAvailable && pandits.some((p) => p.services.includes(s.id)),
      ),
    [services, pandits],
  );
  const selected = useMemo(() => services.find((s) => s.id === service) || null, [services, service]);
  const selectedName = (lang === "hi" ? selected?.hi?.name : null) || selected?.name || "";

  /* Same fair-rotation engine as every other pandit listing on the site,
     keyed to the chosen ritual so the rotation is the one that ritual's own
     page would have used. */
  const fairScores = useFairRanking(undefined, service || undefined);
  const listed = useMemo(() => {
    const list = service ? pandits.filter((p) => p.services.includes(service)) : pandits;
    return [...list].sort((a, b) => {
      if (fairScores) {
        const diff = (fairScores.get(b.id) ?? -Infinity) - (fairScores.get(a.id) ?? -Infinity);
        if (diff) return diff;
      }
      return b.rating - a.rating;
    });
  }, [pandits, service, fairScores]);

  const { page: clampedPage, pages, slice } = useMemo(
    () => paginate(listed, page, PER_PAGE),
    [listed, page],
  );
  useReportExposure(slice.map((p) => p.id), { service: service || undefined });

  /** Keep the URL honest — this listing is shareable, and a devotee who
   *  picked a ritual should be able to send that exact page to someone. */
  useEffect(() => {
    const current = params.get("service") || "";
    if (current === service) return;
    const next = new URLSearchParams(params);
    if (service) next.set("service", service);
    else next.delete("service");
    setParams(next, { replace: true });
    // `params`/`setParams` are stable enough for this to key off the choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service]);

  const title = selected
    ? t("onlinePandits.titleFor", { name: selectedName })
    : t("onlinePandits.title");

  useStructuredData([
    organizationSchema(),
    websiteSchema(),
    webPageSchema({ path: "/online-havan/pandits", name: "Pandit Jis available for online puja & havan" }),
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Services", path: "/services" },
      { name: "Online Havan", path: "/online-havan" },
      { name: "Pandits", path: "/online-havan/pandits" },
    ]),
    listed.length
      ? itemListSchema({
          path: "/online-havan/pandits",
          name: "Pandits available for online puja & havan",
          items: listed.map((p) => ({ name: p.name, path: `/pandits/${p.id}` })),
        })
      : null,
  ]);

  return (
    <>
      <Seo
        title="Pandit Jis available for online puja & havan"
        description="Verified Pandit Jis who perform puja and havan for devotees who cannot be present — your sankalp taken at the kund, on a live call. Speak to them directly on WhatsApp or call; PanditSuggest takes no commission."
        path="/online-havan/pandits"
        // Nothing to index while nobody has opted in to remote work.
        noindex={!loading && listed.length === 0}
      />

      {/* ═══════════════════ HEAD ═══════════════════ */}
      <section className="opp-head">
        <div className="shell">
          <Link className="opp-back" to={service ? `/online-havan?service=${service}` : "/online-havan"}>
            <Icon name="chevron-left" size={15} /> {t("onlinePandits.back")}
          </Link>
          <span className="opp-eyebrow">
            <span className="opp-eyebrow__dot" />
            {t("onlinePandits.eyebrow")}
          </span>
          <h1 className="opp-title">{title}</h1>
          <p className="opp-sub">{t("onlinePandits.sub")}</p>
          <p className="opp-count">
            {t(listed.length === 1 ? "onlinePandits.countOne" : "onlinePandits.count", {
              count: listed.length,
            })}
          </p>
        </div>
      </section>

      {/* ═══════════════════ WHICH PUJA ═══════════════════ */}
      {chips.length > 0 && (
        <nav className="opp-chips" aria-label={t("onlinePandits.filterLabel")}>
          <div className="shell opp-chips__shell">
            <button
              type="button"
              className={`opp-chip${service ? "" : " is-on"}`}
              onClick={() => { setService(""); setPage(1); }}
            >
              {t("onlinePandits.allPujas")}
            </button>
            {chips.map((s) => (
              <button
                type="button"
                key={s.id}
                className={`opp-chip${service === s.id ? " is-on" : ""}`}
                onClick={() => { setService(s.id === service ? "" : s.id); setPage(1); }}
              >
                {(lang === "hi" ? s.hi?.name : null) || s.name}
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* ═══════════════════ THE PANDIT JIS ═══════════════════ */}
      <section className="section opp-list" id="list">
        <div className="shell">
          {listed.length ? (
            <>
              <div className="grid g-3 grid-2up-mobile">
                {slice.map((p, i) => (
                  <PanditCard
                    p={p}
                    key={p.id}
                    index={i}
                    sourceSurface="online_pandits"
                    serviceSlug={service || undefined}
                  />
                ))}
              </div>
              <div className="text-c" style={{ marginTop: 30 }}>
                <Pager
                  page={clampedPage}
                  pages={pages}
                  onChange={(p) => {
                    setPage(p);
                    document.getElementById("list")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                />
              </div>
            </>
          ) : (
            !loading && (
              <EmptyState
                msg={service ? t("onlinePandits.emptyService", { name: selectedName }) : t("onlinePandits.empty")}
              />
            )
          )}

          {/* The honest caveat. Availability here is the Pandit Ji's own
              profile-level opt-in to working remotely — the date, the vidhi
              and whether THIS ritual suits a remote sankalp are settled on
              the call, exactly as /online-havan's gate says. */}
          <p className="opp-note">{t("onlinePandits.note")}</p>
        </div>
      </section>
    </>
  );
}
