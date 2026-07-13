/**
 * PWA install + service-worker lifecycle helpers.
 *
 * The registration lives here (not in main.tsx) so React components can
 * subscribe to two derived states:
 *
 *   • updateAvailable — a new SW has installed and is waiting to activate.
 *     UI shows a "Refresh to update" chip; accepting posts SKIP_WAITING.
 *   • installReady — a `beforeinstallprompt` event has been captured and
 *     we can offer an in-app "Install" button. Fires only on browsers
 *     that support A2HS via BIP (Chrome, Edge, Samsung Internet). Safari
 *     is intentionally excluded — the flow there is "share → add to
 *     home screen" and can't be scripted.
 */

const UPDATE_EVENT = "pd:pwa-update";
const INSTALL_EVENT = "pd:pwa-install";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let waitingWorker: ServiceWorker | null = null;
let deferredPrompt: BeforeInstallPromptEvent | null = null;

/**
 * Called once from main.tsx after React mounts. Registers the SW and
 * captures the install prompt. Safe to call in unsupported environments —
 * everything is behind feature detection.
 */
export function initPwa(): void {
  if (typeof window === "undefined") return;

  // Skip when running under Vite dev — SW breaks HMR.
  if (import.meta.env.DEV) return;

  // Capture the beforeinstallprompt event before Chrome's own banner surfaces.
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new CustomEvent(INSTALL_EVENT, { detail: true }));
  });

  // Clear the ready state once installed.
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    window.dispatchEvent(new CustomEvent(INSTALL_EVENT, { detail: false }));
  });

  if (!("serviceWorker" in navigator)) return;

  // Register during idle to avoid competing with initial render.
  const register = async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

      // A fresh SW is already waiting from a previous visit
      if (reg.waiting) armUpdate(reg.waiting);

      // Track newly-installing workers
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (
            installing.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            armUpdate(installing);
          }
        });
      });

      // When the SW changes, reload once so the new shell takes over.
      // Guarded so we don't loop on the initial activation of a page that
      // had no controller yet.
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    } catch (err) {
      // Registration is best-effort — never blocking.
      // eslint-disable-next-line no-console
      console.warn("[pwa] service worker registration failed", err);
    }
  };

  if ("requestIdleCallback" in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(register);
  } else {
    setTimeout(register, 800);
  }
}

function armUpdate(worker: ServiceWorker) {
  waitingWorker = worker;
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT, { detail: true }));
}

/** Accept a pending update — asks the waiting SW to activate + reloads. */
export function applyUpdate(): void {
  if (!waitingWorker) {
    window.location.reload();
    return;
  }
  waitingWorker.postMessage("SKIP_WAITING");
  // `controllerchange` handler in initPwa() reloads.
}

/**
 * Trigger the browser's install prompt if we've captured one. Returns
 * "accepted" | "dismissed" | "unavailable".
 */
export async function requestInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredPrompt) return "unavailable";
  const p = deferredPrompt;
  deferredPrompt = null; // BIP is single-use
  window.dispatchEvent(new CustomEvent(INSTALL_EVENT, { detail: false }));
  await p.prompt();
  const choice = await p.userChoice;
  return choice.outcome;
}

/** True once we've captured a usable install prompt this session. */
export function hasInstallPrompt(): boolean {
  return deferredPrompt !== null;
}

export { INSTALL_EVENT, UPDATE_EVENT };
