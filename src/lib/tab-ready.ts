import { useEffect, useState } from "react";
import type { TabId } from "../components/Nav";
import { getContent } from "./content";
import { publicDesigns } from "./gallery";

/**
 * Assets to warm before revealing a tab, with a bounded wait:
 * - global fonts (Source Serif 4, Inter, Material Symbols) for every tab
 * - per-tab images
 * Slow assets must never prevent the document from becoming usable.
 */

function imageSrcsForTab(tab: TabId): string[] {
  if (tab === "top") {
    return ["/no-shades.jpg", "/with-shades.png"];
  }
  if (tab === "work") {
    // First image of each project's figure — the rest of a carousel lazy-loads.
    return [
      "/projects/physiopano-app.webp",
      "/projects/physiopano-admin-landing.webp",
      "/projects/famecrm-landing.webp",
      "/projects/shm-landing.webp",
    ];
  }
  if (tab === "gallery") {
    // The first row is what's on screen when the tab opens; the rest
    // lazy-load. The wait is capped at 1.5s either way (see below).
    return publicDesigns(getContent().designs)
      .slice(0, 3)
      .map((d) => d.image)
      .filter(Boolean);
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
 * True once assets are ready, or the brief preload window has elapsed.
 * Resets to false when `active` changes, so each tab gets its own readiness check.
 */
export function useTabReady(active: TabId): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    let cancelled = false;
    const reveal = () => {
      if (!cancelled) setReady(true);
    };
    // Font requests can stay pending indefinitely on a weak connection.
    // The document can already render with fallback fonts and image boxes.
    const deadline = window.setTimeout(reveal, 1500);

    const work: Promise<unknown>[] = [getFontsReady()];
    for (const src of imageSrcsForTab(active)) {
      work.push(preloadImage(src));
    }

    const finish = () => {
      window.clearTimeout(deadline);
      reveal();
    };
    void Promise.all(work).then(finish, finish);

    return () => {
      cancelled = true;
      window.clearTimeout(deadline);
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
