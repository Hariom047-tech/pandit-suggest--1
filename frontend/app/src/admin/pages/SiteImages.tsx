import { useCallback, useEffect, useState } from "react";
import { getAdminBase, getToken } from "../lib/adminApi";

/**
 * Page images.
 *
 * The heroes on /pandits, /temples and /services, the homepage trust
 * portrait and its two backdrops, and the service tile fallbacks were all
 * URLs typed into the frontend source — changing one meant a code change and
 * a redeploy, and some of the files sat on the web server's own disk.
 *
 * Each is a named slot here. Uploading replaces the image in that slot; the
 * file goes to S3 like every other upload and the public page picks it up on
 * its next load. Clearing a slot restores the built-in default image, so a
 * slot can never be left blank on the live site.
 *
 * The slot catalog comes from the server (backend/src/config/siteImageSlots.js)
 * rather than being duplicated here — it is the same list the upload route
 * validates against.
 */

interface Slot {
  key: string;
  label: string;
  hint?: string;
  group: string;
  image_url: string | null;
  alt_text: string | null;
  updated_at: string | null;
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

export default function SiteImages() {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState("");
  /** Which slot is mid-request — keeps one upload from disabling every card. */
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const base = await getAdminBase();
      const res = await fetch(`${base}/site-images`, {
        headers: { Authorization: `Bearer ${getToken() ?? ""}` },
      });
      if (!res.ok) throw new Error("Could not load page images");
      setSlots(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load page images");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function upload(slot: Slot, file: File) {
    setBusyKey(slot.key); setError(""); setProgress(0);
    const form = new FormData();
    form.append("file", file);
    if (slot.alt_text) form.append("altText", slot.alt_text);

    try {
      const base = await getAdminBase();
      // XHR rather than fetch, for the same reason as GalleryManager: fetch
      // still reports no upload progress, and a silent multi-MB upload is
      // indistinguishable from a hang.
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${base}/site-images/${encodeURIComponent(slot.key)}`);
        xhr.setRequestHeader("Authorization", `Bearer ${getToken() ?? ""}`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) return resolve();
          let msg = `Upload failed (${xhr.status})`;
          try { msg = JSON.parse(xhr.responseText).error || msg; } catch { /* keep default */ }
          reject(new Error(msg));
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(form);
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusyKey(null); setProgress(null);
    }
  }

  async function call(path: string, method: string, body?: unknown) {
    const base = await getAdminBase();
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${getToken() ?? ""}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      throw new Error(j?.error || `Request failed (${res.status})`);
    }
  }

  async function reset(slot: Slot) {
    if (!confirm(`Remove the uploaded image for "${slot.label}"? The built-in default will be shown instead.`)) return;
    setBusyKey(slot.key); setError("");
    try { await call(`/site-images/${encodeURIComponent(slot.key)}`, "DELETE"); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not remove image"); }
    finally { setBusyKey(null); }
  }

  async function saveAlt(slot: Slot, altText: string) {
    if (altText === (slot.alt_text || "")) return;
    setBusyKey(slot.key); setError("");
    try { await call(`/site-images/${encodeURIComponent(slot.key)}`, "PATCH", { altText }); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not save alt text"); }
    finally { setBusyKey(null); }
  }

  const groups = (slots || []).reduce<Record<string, Slot[]>>((acc, s) => {
    (acc[s.group] ||= []).push(s);
    return acc;
  }, {});

  return (
    <>
      <div className="admin-page-head">
        <div>
          <h2 style={{ fontFamily: "var(--font-head)", fontSize: "1.4rem" }}>Page images</h2>
          <p>
            Hero and section images across the public site. Every upload is stored in S3 —
            nothing is written to the server. Max 8 MB each; JPG, PNG, WebP or AVIF.
          </p>
        </div>
      </div>

      {error && <div className="admin-login__error" style={{ marginBottom: 12 }}>{error}</div>}

      {!slots ? <p className="muted">Loading…</p> : Object.entries(groups).map(([group, groupSlots]) => (
        <div className="admin-panel" key={group} style={{ marginBottom: 18 }}>
          <div className="admin-panel__head"><h2>{group}</h2></div>
          <div className="admin-panel__body">
            <ul className="media-grid">
              {groupSlots.map((slot) => (
                <li key={slot.key} className="media-tile" style={{ display: "flex", flexDirection: "column" }}>
                  {slot.image_url
                    ? <img src={slot.image_url} alt="" loading="lazy" />
                    : (
                      <div className="media-tile__empty" style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        minHeight: 120, fontSize: ".8rem", opacity: .6, textAlign: "center", padding: 10,
                      }}>
                        Using the built-in default
                      </div>
                    )}

                  <div style={{ padding: "8px 10px" }}>
                    <strong style={{ fontSize: ".9rem" }}>{slot.label}</strong>
                    {slot.hint && (
                      <p style={{ fontSize: ".78rem", opacity: .7, margin: "4px 0 0" }}>{slot.hint}</p>
                    )}
                  </div>

                  <div className="media-tile__actions" style={{ flexWrap: "wrap", gap: 6 }}>
                    <label className="btn btn-gold btn-sm" style={{ cursor: busyKey ? "default" : "pointer" }}>
                      {slot.image_url ? "Replace" : "Upload"}
                      <input
                        type="file" hidden accept={ACCEPT} disabled={busyKey !== null}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (f) upload(slot, f);
                        }}
                      />
                    </label>
                    {slot.image_url && (
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busyKey !== null}
                        onClick={() => reset(slot)}>Use default</button>
                    )}
                  </div>

                  {/* Alt text is editable without re-uploading — a wrong
                      caption should not cost an upload round trip. Only
                      offered once there is an image to describe. */}
                  {slot.image_url && (
                    <div style={{ padding: "0 10px 10px" }}>
                      <input
                        className="input" defaultValue={slot.alt_text || ""}
                        placeholder="Alt text (for screen readers)"
                        disabled={busyKey !== null}
                        onBlur={(e) => saveAlt(slot, e.target.value.trim())}
                        style={{ width: "100%", fontSize: ".8rem" }}
                      />
                    </div>
                  )}

                  {busyKey === slot.key && progress !== null && (
                    <div className="media-progress" role="progressbar" aria-valuenow={progress}
                      aria-valuemin={0} aria-valuemax={100}>
                      <span style={{ width: `${progress}%` }} />
                      <small>{progress}%</small>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </>
  );
}
