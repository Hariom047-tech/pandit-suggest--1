import { useCallback, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api, type ContactResult } from "./api";
import { toE164 } from "./format";
import { useAuth, saveContactIntent } from "./Auth";
import { useToast } from "../components/ui/Toast";

export type ContactAction = "call" | "whatsapp";

/**
 * THE contact flow. Every Call / WhatsApp button in the app goes through
 * this one hook — pandit profile, directory cards, temple pandit cards,
 * search results, saved pandits.
 *
 * Having exactly one implementation is a security property, not just tidiness:
 * guest handling, verification gating and the "server decides what a lead is"
 * rule are enforced once. A second copy-pasted version is how a component
 * quietly ends up opening WhatsApp without ever telling the backend, or
 * worse, deciding locally that something counted as a lead.
 *
 * Order of operations is deliberate: tell the backend FIRST, open the dialer
 * or WhatsApp only after it answers. Opening the link first would mean losing
 * the lead whenever the browser backgrounds the tab mid-request.
 */
export function usePanditContact() {
  const { isAuthenticated, isContactVerified, isActive, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const contact = useCallback(async (opts: {
    panditSlug: string;
    action: ContactAction;
    phone?: string | null;
    whatsapp?: string | null;
    /** Prefilled WhatsApp text. Preserves the greeting the old waLink() sent. */
    waMessage?: string;
    source?: string;
    /** Called with the server's verdict, e.g. so a profile page can refresh. */
    onResult?: (result: ContactResult) => void;
  }) => {
    const { panditSlug, action, phone, whatsapp, waMessage, source, onResult } = opts;
    const key = `${panditSlug}:${action}`;

    // Guards a double tap on the same button before the first request lands.
    // Backend concurrency protection exists too (advisory lock) — this just
    // avoids a pointless second round trip and a flickering spinner.
    if (pendingKey) return;

    // --- Guest: never a lead. Park the intent and send them to login. ---
    if (!isAuthenticated) {
      saveContactIntent({
        panditSlug,
        action: action === "call" ? "phone_call" : "whatsapp",
        returnTo: location.pathname + location.search,
      });
      toast("Pandit Ji se contact karne ke liye login karein.");
      // The pandit's own profile, NOT location.pathname: the press usually
      // comes off a card in a long directory or the homepage, and dropping
      // someone back onto that list after logging in means scrolling for the
      // pandit they had already chosen. `from` is the mechanism Login already
      // uses to decide where to go afterwards — it was simply never given
      // anything here, which is why every guest contact ended on /dashboard.
      navigate("/login", { state: { from: { pathname: `/pandits/${panditSlug}` } } });
      return;
    }

    if (!isActive) {
      toast("Aapka account abhi active nahi hai. Support se sampark karein.");
      return;
    }

    // --- Logged in but mobile not verified: never a lead. ---
    if (!isContactVerified) {
      saveContactIntent({
        panditSlug,
        action: action === "call" ? "phone_call" : "whatsapp",
        returnTo: location.pathname + location.search,
      });
      toast("Pandit Ji se direct contact karne ke liye apna mobile verify karein.");
      navigate("/dashboard?verify=mobile");
      return;
    }

    // Safari — iOS especially — only honours window.open from the SYNCHRONOUS
    // part of a user gesture. Everything above this line is synchronous, so we
    // are still inside the tap here; everything below awaits the backend first
    // (deliberately, see the note at the top), and by the time that resolves
    // the gesture is spent and the popup is blocked with no error of any kind.
    // So claim the tab now, while it is still allowed, and point it at WhatsApp
    // once the server has answered. Every early return below has to close it,
    // or a denied contact leaves a stray blank tab behind.
    //
    // No "noopener" in these options on purpose: with it, window.open returns
    // null and there is no handle left to navigate. The opener is severed
    // manually before navigating instead.
    const waTab = action === "whatsapp" ? window.open("", "_blank") : null;

    setPendingKey(key);
    let result: ContactResult | null = null;
    try {
      result = await api.trackClick(panditSlug, action, source);
      onResult?.(result);
    } catch {
      // The contact itself must not be held hostage by our analytics. If the
      // backend is unreachable the devotee still gets to call — they simply
      // do not generate a lead, which is the correct failure direction:
      // never invent a lead we could not persist.
      toast("Contact record nahi ho paya, par aap call kar sakte hain.");
    } finally {
      setPendingKey(null);
    }

    if (result && !result.contactAllowed) {
      if (result.reason === "user_not_verified") {
        toast("Pandit Ji se direct contact karne ke liye apna mobile verify karein.");
        navigate("/dashboard?verify=mobile");
      } else {
        toast("Abhi contact nahi ho paya. Thodi der baad try karein.");
      }
      waTab?.close();
      return;
    }

    // A pandit pressing their own button gets a clear, harmless message.
    if (result?.reason === "self_contact") {
      toast("Yeh aapki apni profile hai.");
      waTab?.close();
      return;
    }

    // wa.me wants the international number with no "+"; tel: is happiest with
    // full E.164 too, which also makes the button work for a devotee dialling
    // from outside India. Both fall back to the raw value if it will not parse,
    // so an unusual-but-real number is still handed on rather than swallowed.
    const rawWa = whatsapp || phone || "";
    const rawTel = phone || whatsapp || "";
    const waNumber = (toE164(rawWa) || rawWa).replace(/[^\d]/g, "");
    const telNumber = toE164(rawTel) || rawTel;
    const target = action === "call"
      ? (telNumber ? `tel:${telNumber}` : null)
      : (waNumber
          ? `https://wa.me/${waNumber}${waMessage ? `?text=${encodeURIComponent(waMessage)}` : ""}`
          : null);

    if (!target) {
      toast("Contact number abhi uplabdh nahi hai.");
      waTab?.close();
      return;
    }

    if (action === "call") {
      window.location.href = target;
    } else if (waTab) {
      // Sever the back-reference before navigating — the equivalent of the
      // "noopener" that could not be passed to window.open above.
      waTab.opener = null;
      waTab.location.replace(target);
    } else {
      // The tab was refused (a blocker, or a non-gesture caller). Try the
      // direct open anyway: on browsers that allow it this still works, and on
      // the ones that do not there was never a tab to be had.
      window.open(target, "_blank", "noopener,noreferrer");
    }
  }, [isAuthenticated, isActive, isContactVerified, navigate, location, toast, pendingKey, user?.id]);

  return {
    contact,
    /** True while THIS specific pandit+action is in flight, for button spinners. */
    isPending: (panditSlug: string, action: ContactAction) => pendingKey === `${panditSlug}:${action}`,
    isBusy: pendingKey !== null,
    /**
     * Shown next to the CTAs before contact. The devotee is told plainly that
     * pressing this shares their identity with the pandit — required by the
     * disclosure rule, and it is also simply how the product works.
     */
    disclosure: "Pandit Ji se contact karne par aapka naam aur verified mobile number unke saath share kiya ja sakta hai.",
  };
}
