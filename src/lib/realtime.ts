import { syncFromServer } from "./content";
import { getSupabaseClient } from "./supabase-client";

/**
 * Keep the live site in sync with the server's `site_content` row.
 *
 * Three layers, all run together so each backs the others up:
 *
 *   1. Supabase Realtime — primary path. Pushes a notification within ~ms
 *      of an admin save on any device.
 *   2. visibilitychange — refetch when the tab becomes visible (instant
 *      catch-up when the user tab-switches back from /admin).
 *   3. Polling — guards against dropped websocket connections, throttled
 *      tabs, or deployments without VITE_SUPABASE_* configured.
 *
 * `syncFromServer` is idempotent: if nothing changed, it's a no-op (no
 * re-render, no CONTENT_EVENT emitted).
 */

const POLL_INTERVAL_MS = 30_000;

export function startContentSync(): () => void {
  const cleanups: Array<() => void> = [];

  // Initial fetch happens elsewhere (App calls syncFromServer on mount);
  // these are the long-running watchers.

  // 1. Tab regains focus — catch up immediately (covers cross-tab editing).
  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      void syncFromServer();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("focus", onVisibility);
  cleanups.push(() => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("focus", onVisibility);
  });

  // 2. Supabase Realtime subscription (only if anon key is configured).
  const sb = getSupabaseClient();
  if (sb) {
    const channel = sb
      .channel("public:site_content")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_content" },
        () => {
          void syncFromServer();
        }
      )
      .subscribe();
    cleanups.push(() => {
      void channel.unsubscribe();
    });
  }

  // 3. Polling fallback while the tab is visible. Cheap (single row,
  // gzipped JSON) and survives a dropped websocket.
  const pollId = window.setInterval(() => {
    if (document.visibilityState === "visible") {
      void syncFromServer();
    }
  }, POLL_INTERVAL_MS);
  cleanups.push(() => window.clearInterval(pollId));

  return () => cleanups.forEach((c) => c());
}
