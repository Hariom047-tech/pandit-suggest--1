/**
 * useApi — Generic data-fetching hook for the PanditSuggest platform.
 *
 * Provides loading/error/data states, automatic abort-on-unmount,
 * simple in-memory caching, and refetch capability.
 *
 * Usage:
 *   const { data, loading, error, refetch } = useApi<Temple[]>('/temples?city=Ujjain');
 *   const { data: p } = useApi<Pandit>(`/pandits/${slug}`, { enabled: !!slug });
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "./api";

/* ── simple in-memory cache ── */
interface CacheEntry<T> { data: T; ts: number; }
const cache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL = 60_000;               // 60 s

/** A cache entry still inside its TTL, or undefined. */
function readCache<T>(path: string | null, cacheTtl: number, noCache: boolean): T | undefined {
  if (!path || noCache || cacheTtl <= 0) return undefined;
  const hit = cache.get(path) as CacheEntry<T> | undefined;
  return hit && Date.now() - hit.ts < cacheTtl ? hit.data : undefined;
}

/**
 * Puts a value into the cache without a network request.
 *
 * Used by lib/bootstrap.ts to hand useApi the data the server already
 * embedded in the HTML — the hook then has it on its FIRST render, so the
 * hero images paint with no request and no skeleton. See that file.
 */
export function primeCache<T>(path: string, data: T) {
  cache.set(path, { data, ts: Date.now() });
}

export interface UseApiOptions {
  /** Set false to skip fetching (useful for dependent queries). */
  enabled?: boolean;
  /** Cache time-to-live in ms (default 60 000). Set 0 to disable. */
  cacheTtl?: number;
  /** If true, never use cache — always hit the network. */
  noCache?: boolean;
}

export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApi<T>(
  path: string | null,
  opts: UseApiOptions = {},
): UseApiResult<T> {
  const { enabled = true, cacheTtl = DEFAULT_TTL, noCache = false } = opts;
  // Seeded from the cache SYNCHRONOUSLY, not in the effect below. A cache hit
  // applied in useEffect still leaves the first render empty, and the browser
  // may well paint that empty frame — which is exactly the skeleton flash the
  // homepage hero used to show even when the data was already in hand.
  const seeded = readCache<T>(path, cacheTtl, noCache);
  const [data, setData] = useState<T | null>(seeded ?? null);
  const [loading, setLoading] = useState(seeded === undefined);
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);                // prevents stale writes

  const fetchData = useCallback(() => {
    if (!path || !enabled) { setLoading(false); return; }

    const hit = readCache<T>(path, cacheTtl, noCache);
    if (hit !== undefined) {
      setData(hit);
      setLoading(false);
      setError(null);
      return;
    }

    const seq = ++seqRef.current;
    setLoading(true);
    setError(null);

    api
      .get<T>(path)
      .then((result) => {
        if (seq !== seqRef.current) return;   // stale
        setData(result);
        setError(null);
        if (cacheTtl > 0) cache.set(path, { data: result, ts: Date.now() });
      })
      .catch((err) => {
        if (seq !== seqRef.current) return;
        setError(err?.message || "Something went wrong");
      })
      .finally(() => {
        if (seq !== seqRef.current) return;
        setLoading(false);
      });
  }, [path, enabled, cacheTtl, noCache]);

  useEffect(() => {
    fetchData();
    return () => { seqRef.current++; };      // cancel on unmount / dep change
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/** Submit data via POST and return the result (no caching). */
export function useApiMutation<TPayload, TResult = unknown>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (path: string, payload: TPayload): Promise<TResult | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.post<TResult>(path, payload);
        return result;
      } catch (err: any) {
        setError(err?.message || "Request failed");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { mutate, loading, error };
}

/** Clear the entire fetch cache (e.g. after a write operation). */
export function clearApiCache(pathPrefix?: string) {
  if (!pathPrefix) { cache.clear(); return; }
  for (const key of cache.keys()) {
    if (key.startsWith(pathPrefix)) cache.delete(key);
  }
}
