import type { SyntheticEvent } from "react";
import { parsePhoneNumberFromString } from "libphonenumber-js";

// waLink()/telLink() lived here and were called by nobody — every Call and
// WhatsApp button goes through usePanditContact now. They are gone rather than
// fixed because waLink built exactly the broken link this file's toE164() now
// exists to prevent: it stripped the "+" off a stored number and handed wa.me
// a 10-digit string it rejects. Leaving a dead copy of the bug next to the fix
// is how it gets copied back in.

/**
 * A stored number is either E.164 ("+919399608793") or a bare local one
 * ("9399608793") — the admin form and the devotee's profile both accept
 * either, and pandits.whatsapp_number is usually the bare form.
 *
 * That difference is invisible to tel: (a local number dials fine in-country)
 * but fatal to wa.me and to OTP delivery, which need the full international
 * number. IN as the default country matches the login form's own default.
 *
 * Returns null when the number will not parse, so callers can decide between
 * falling back to the raw value and refusing outright.
 */
export function toE164(raw: string | null | undefined): string | null {
  const parsed = parsePhoneNumberFromString((raw || "").trim(), "IN");
  return parsed?.isValid() ? parsed.number : null;
}

export const PLACEHOLDER = {
  pandit: "/assets/img/pandit-placeholder.svg",
  temple: "/assets/img/temple-placeholder.svg",
  hero: "/assets/img/hero-temple.svg",
};

export function onImgError(kind: keyof typeof PLACEHOLDER) {
  return (e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    img.onerror = null;
    img.src = PLACEHOLDER[kind];
  };
}
