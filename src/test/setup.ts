import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * jsdom ships no matchMedia, and several components ask it about
 * prefers-reduced-motion / prefers-color-scheme on mount. Default every
 * query to "no match" so tests exercise the full-motion path.
 */
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/**
 * jsdom keeps localStorage between test files in the same worker, and
 * content.ts reads it on every getContent(). Clearing after each test
 * keeps the cache-invalidation cases honest.
 */
afterEach(() => {
  cleanup();
  localStorage.clear();
});
