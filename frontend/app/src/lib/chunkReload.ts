/**
 * Recovers from "the chunk this tab is asking for no longer exists".
 *
 * Every page below the homepage is a lazy import, so its hashed filename
 * (Services-een9qPzj.js) is baked into whichever entry bundle the browser
 * happens to be running. A frontend redeploy renames every hashed asset and
 * deletes the old ones, so a tab still running the previous build — or one
 * that reloaded an HTML shell it had held on to — asks for a file that is now
 * a plain 404. React's lazy() turns that rejected import into a render error,
 * and ErrorBoundary shows "Yeh section load nahi ho paya" on a page that is
 * perfectly healthy for every other visitor.
 *
 * Seen live: 10 Sep 2026 11:05 UTC, a desktop Chrome on /services asking for
 * assets/Services-een9qPzj.js two hours after a rebuild had shipped
 * Services-Dr0NdGs8.js (frontend nginx access log, 404).
 *
 * The only real fix is to reload: that fetches the current index.html and
 * with it the current bundle names. Guarded by a sessionStorage timestamp so
 * a chunk that is genuinely missing — a half-finished deploy, say — shows the
 * error page instead of reloading in a loop.
 */

const KEY = "ps:chunk-reload-at";
const COOLDOWN_MS = 20_000;

/** The three wordings browsers use for a dynamic import that never arrived. */
export function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err ?? "");
  return /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|chunkloaderror/i.test(msg);
}

/** Returns false if it declined (already reloaded once just now). */
export function reloadForNewBuild(): boolean {
  let last = 0;
  // sessionStorage throws outright in some privacy modes, so never let the
  // guard itself be the thing that breaks the recovery.
  try { last = Number(sessionStorage.getItem(KEY)) || 0; } catch { /* no storage */ }
  if (Date.now() - last < COOLDOWN_MS) return false;
  try { sessionStorage.setItem(KEY, String(Date.now())); } catch { /* no storage */ }
  window.location.reload();
  return true;
}

// Vite fires this on window when a dynamic import's preload fails, just
// before the import promise rejects — handling it here recovers without the
// error ever reaching React. preventDefault() stops Vite rethrowing it; we
// only claim it when we are actually reloading, so the cooldown case still
// falls through to ErrorBoundary's message.
window.addEventListener("vite:preloadError", ((e: Event) => {
  if (reloadForNewBuild()) e.preventDefault();
}) as EventListener);
