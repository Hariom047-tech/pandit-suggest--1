/**
 * useHasTemples — "has an admin published a temple yet?"
 *
 * The temple directory is real, finished, and completely empty until someone
 * adds the first temple in the admin panel. Every entry point into it — the
 * header nav, the drawer menu, the bottom bar, the footer, the homepage's
 * "Explore Temples" card, the /temples and /temple-map routes themselves —
 * would otherwise lead a visitor to a page with nothing on it. So each of
 * those asks this hook first and simply isn't rendered while the answer is
 * no. The moment a temple exists they all come back on their own; nothing
 * has to be switched back by hand.
 *
 * The data-driven temple surfaces (the homepage's popular-temples section,
 * a service's "temples offering this puja", a pandit's associated temples,
 * search results) already hide themselves on an empty list and need no gate
 * of their own.
 *
 * One request for the whole app: every caller asks for the same `/temples
 * ?perPage=1` path, so useApi's cache serves all but the first, and the TTL
 * is long because the answer flips once in the site's lifetime.
 *
 * The last answer is remembered in localStorage purely to avoid a visible
 * pop-in: on a site that HAS temples, a repeat visitor's bottom bar renders
 * the temple tab on the first frame instead of growing a fifth item a
 * moment later. It is only ever a seed — the fetch still decides.
 */

import { useEffect, useState } from "react";
import { useApi } from "../lib/useApi";
import type { ApiTemple, PaginatedResult } from "./useData";

const PATH = "/temples?perPage=1";
const STORAGE_KEY = "ps_has_temples";
/** 10 min. A directory that is about to have its first row is the one case
 *  where a visitor might be waiting on this, and a reload is enough. */
const TTL = 600_000;

function readSeed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Private mode / storage disabled — the fetch answers on its own.
    return false;
  }
}

function writeSeed(value: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    /* ignore — this is an optimization, never a requirement */
  }
}

export interface TemplePresence {
  /** At least one temple is published — or, until the answer arrives, the
   *  last answer this browser saw (false on a first visit). */
  hasTemples: boolean;
  /** The answer above came from the server, not from the seed. Anything
   *  that would throw a visitor off the page — the route guards in App.tsx —
   *  must wait for this; a nav link that simply isn't drawn yet need not. */
  resolved: boolean;
}

export function useTemplePresence(): TemplePresence {
  const [seeded] = useState(readSeed);
  const { data } = useApi<PaginatedResult<ApiTemple> | ApiTemple[]>(PATH, { cacheTtl: TTL });

  const known = data
    ? (Array.isArray(data) ? data.length : data.meta?.total ?? data.data?.length ?? 0) > 0
    : null;

  useEffect(() => {
    if (known !== null) writeSeed(known);
  }, [known]);

  return { hasTemples: known ?? seeded, resolved: known !== null };
}

/** True once at least one temple is published. False while we don't know:
 *  hiding a link that should be there for one moment is a far smaller cost
 *  than showing a link to an empty directory. */
export function useHasTemples(): boolean {
  return useTemplePresence().hasTemples;
}
