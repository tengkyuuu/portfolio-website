import { useEffect, useState } from "react";
import type { TabId } from "../components/Nav";

/**
 * Real loading work that has to finish before a given tab can be shown:
 * - global fonts (Source Serif 4, Inter, Material Symbols) for every tab
 * - per-tab images (only the Home tab actually has images right now)
 *
 * If/when a tab grows real async data (fetch, IndexedDB, dynamic import),
 * wire it in here so the loader appears for that work too.
 */

function imageSrcsForTab(tab: TabId): string[] {
  if (tab === "top") {
    return [
      "/james.jpg",
      "/james-shades.jpg",
      "/james-dark.jpg",
      "/james-dark-peace.jpg",
    ];
  }
  if (tab === "work") {
    // First image of each project's figure — the rest of a carousel lazy-loads.
    return [
      "/projects/physiopano-app.png",
      "/projects/physiopano-admin-landing.png",
    ];
  }
  return [];
}

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve(); // don't block the UI on a missing asset
    img.src = src;
  });
}

let fontsReadyPromise: Promise<void> | null = null;
function getFontsReady(): Promise<void> {
  if (fontsReadyPromise) return fontsReadyPromise;
  if (typeof document === "undefined" || !document.fonts) {
    fontsReadyPromise = Promise.resolve();
  } else {
    fontsReadyPromise = document.fonts.ready.then(() => undefined);
  }
  return fontsReadyPromise;
}

/**
 * True once everything required for the current tab has finished loading.
 * Resets to false when `active` changes, so each tab gets its own readiness check.
 */
export function useTabReady(active: TabId): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    let cancelled = false;

    const work: Promise<unknown>[] = [getFontsReady()];
    for (const src of imageSrcsForTab(active)) {
      work.push(preloadImage(src));
    }

    Promise.all(work).then(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [active]);

  return ready;
}

/**
 * Debounces a `loading` boolean so the loader UI only appears if loading
 * lasts longer than `threshold` ms. Avoids flashing the loader on fast loads.
 */
export function useDelayedLoading(loading: boolean, threshold = 200): boolean {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!loading) {
      setShow(false);
      return;
    }
    const t = setTimeout(() => setShow(true), threshold);
    return () => clearTimeout(t);
  }, [loading, threshold]);

  return show;
}
