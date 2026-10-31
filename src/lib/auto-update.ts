/** Check the deployed build without requiring an update button or navigation. */
export function startAutomaticUpdates(buildId: string, reload = () => window.location.reload()): () => void {
  let pending = false;
  let reloading = false;
  let checking = false;
  let stopped = false;
  const safeToReload = () => {
    // These workspaces contain local drafts; take the new build on next visit.
    if (/^\/(admin|resume)(\/|$)/.test(location.pathname)) return false;
    if (document.visibilityState !== "visible") return false;
    if (document.activeElement?.matches("input, textarea, [contenteditable=true]")) return false;
    // Do not erase an unfinished contact message or chat prompt.
    return !Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'textarea, input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit])',
    )).some(field => field.value && field.offsetParent !== null);
  };
  const apply = () => {
    if (!stopped && pending && !reloading && safeToReload()) {
      reloading = true;
      reload();
    }
  };
  const check = async () => {
    if (stopped || checking || document.visibilityState !== "visible") return;
    checking = true;
    try {
      const response = await fetch("/release.json", { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      if (!response.ok) return;
      const release = await response.json() as { id?: string };
      if (typeof release.id === "string" && release.id && release.id !== buildId) {
        // Install the new worker/cache namespace before taking its new shell.
        if ("serviceWorker" in navigator) {
          await navigator.serviceWorker.getRegistration().then(reg => reg?.update()).catch(() => {});
        }
        pending = true;
        apply();
      }
    } catch {
      // Offline, or a host without a release manifest: keep the current page.
    } finally {
      checking = false;
    }
  };
  const poll = window.setInterval(() => void check(), 60_000);
  const retry = window.setInterval(apply, 2_000);
  document.addEventListener("visibilitychange", check);
  window.addEventListener("online", check);
  window.addEventListener("focus", check);
  void check();
  return () => {
    stopped = true;
    window.clearInterval(poll);
    window.clearInterval(retry);
    document.removeEventListener("visibilitychange", check);
    window.removeEventListener("online", check);
    window.removeEventListener("focus", check);
  };
}
