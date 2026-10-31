/** PWA installation and automatic service-worker activation. */
import { startAutomaticUpdates } from "./auto-update";

const INSTALL_EVENT = "pd:pwa-install";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

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

  startAutomaticUpdates(import.meta.env.VITE_BUILD_ID);

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
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });

      // A fresh SW is already waiting from a previous visit
      if (reg.waiting) reg.waiting.postMessage("SKIP_WAITING");

      // Track newly-installing workers
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (
            installing.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            installing.postMessage("SKIP_WAITING");
          }
        });
      });

      // The release watcher owns reloads, so activation cannot interrupt drafts.
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

export { INSTALL_EVENT };
