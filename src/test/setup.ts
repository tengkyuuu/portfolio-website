import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

/**
 * Never let a test open a real network connection. Vitest loads the same
 * .env.local Vite does, so once VITE_SUPABASE_URL/ANON_KEY are configured
 * for local dev, getSupabaseClient() starts returning a real client here
 * too — and Nav.tsx's live-presence hook then opens a genuine WebSocket to
 * Supabase mid-test. The test finishes and tears down jsdom before that
 * connection resolves, and the late event fires into a torn-down realm:
 * an uncaught exception that fails the whole run's exit code even though
 * every named test passed (see api/limits.test.ts's sibling problem —
 * a green run isn't proof of a healthy one). Tests must be hermetic
 * regardless of what happens to be sitting in a local env file.
 */
vi.mock("../lib/supabase-client", () => ({
  getSupabaseClient: () => null,
  isRealtimeConfigured: () => false,
}));

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
