/* Portfolio.docx service worker.
 *
 * Small, hand-rolled, no Workbox. Three caches:
 *
 *   1) SHELL  — precached at install: /, /index.html, /manifest, /icon.svg.
 *               Kept forever until this SW is replaced.
 *   2) API    — network-first with a bounded stale fallback for
 *               /api/content and /api/health. Any admin-write path is
 *               bypassed entirely.
 *   3) ASSETS — cache-first with a 30-day expiry for JS/CSS/font/image
 *               responses (both same-origin and Devicon/Google Fonts CDNs).
 *
 * CACHE_VERSION is bumped BY HAND. The browser only reinstalls this worker
 * when these bytes change, so a deploy that doesn't touch this file leaves
 * every existing cache in place. Bump it whenever the caching rules change
 * or a cached response needs purging from the field; installing then
 * purges the old caches on activate and open tabs get a "new version
 * available" prompt (see registerSW in main.tsx).
 *
 * Why API is network-first: /api/content feeds syncFromServer, which
 * overwrites the visitor's local content cache. Under
 * stale-while-revalidate a snapshot cached while the API was healthy kept
 * being served as a 200 after the API started failing, so every load
 * re-applied it over the freshly deployed defaults — content shipped in
 * the bundle stayed invisible. Now a failing API falls through to the
 * shipped defaults once the cached copy passes API_MAX_STALE_MS.
 */

const CACHE_VERSION = "v5";
const SHELL_CACHE = `pd-shell-${CACHE_VERSION}`;
const API_CACHE = `pd-api-${CACHE_VERSION}`;
const ASSET_CACHE = `pd-asset-${CACHE_VERSION}`;
const ASSET_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
/** How long a cached API response may stand in for an unreachable server. */
const API_MAX_STALE_MS = 24 * 60 * 60 * 1000; // 1 day

const SHELL_URLS = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg"];

/* ---------------- install: precache the shell ---------------- */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

/* ---------------- activate: purge old versions ---------------- */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((n) => n.startsWith("pd-") && !n.endsWith(CACHE_VERSION))
            .map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ---------------- messaging: manual skip-waiting trigger ---------------- */
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

/* ---------------- fetch: route per URL kind ---------------- */
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Never touch non-GETs — writes must reach the server.
  if (req.method !== "GET") return;

  // Skip cross-origin write endpoints and everything not-http (chrome://…)
  const url = new URL(req.url);
  if (!["http:", "https:"].includes(url.protocol)) return;

  // Admin writes (POST/PUT/DELETE) already skipped above; also don't
  // intercept the login endpoint — it must always hit fresh.
  if (url.pathname === "/api/login" || url.pathname.startsWith("/api/inquir")) {
    return;
  }

  // Public API (content, health): network-first, bounded stale fallback
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstAPI(req, API_CACHE, API_MAX_STALE_MS));
    return;
  }

  // Navigation requests → shell fallback for the SPA route
  if (req.mode === "navigate") {
    event.respondWith(networkFirstShell(req));
    return;
  }

  // Same-origin assets or well-known CDNs → cache-first with TTL
  const isAsset =
    url.origin === self.location.origin ||
    /(jsdelivr\.net|googleapis\.com|gstatic\.com|googleusercontent\.com)$/.test(
      url.hostname
    );
  if (isAsset) {
    event.respondWith(cacheFirstTTL(req, ASSET_CACHE, ASSET_TTL_MS));
    return;
  }
  // else: let the browser handle it normally
});

/* ---------------- strategies ---------------- */

/**
 * Network wins whenever it answers at all — including a 4xx/5xx, which is
 * real information the app knows how to handle (fetchRemoteContent treats
 * a non-ok as "no published content" and leaves the defaults alone). The
 * cache is only a fallback for an outright network failure, and only while
 * it is younger than maxStaleMs, so a dead API can't pin the site to an
 * old snapshot indefinitely.
 */
async function networkFirstAPI(req, cacheName, maxStaleMs) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cloned = res.clone();
      const body = await cloned.blob();
      const headers = new Headers(cloned.headers);
      headers.set("sw-cached-at", String(Date.now()));
      await cache.put(
        req,
        new Response(body, {
          status: cloned.status,
          statusText: cloned.statusText,
          headers,
        })
      );
    } else {
      // The endpoint answered but has nothing good to give — drop any
      // older success so it can't be replayed on the next offline load.
      await cache.delete(req);
    }
    return res;
  } catch {
    const cached = await cache.match(req);
    if (!cached) throw new Error("offline and uncached");
    const at = Number(cached.headers.get("sw-cached-at") || 0);
    if (!at || Date.now() - at > maxStaleMs) {
      await cache.delete(req);
      throw new Error("cached API response too stale");
    }
    return cached;
  }
}

async function networkFirstShell(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put("/", res.clone());
    }
    return res;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    return (await cache.match("/")) ?? (await cache.match("/index.html")) ?? Response.error();
  }
}

async function cacheFirstTTL(req, cacheName, ttlMs) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) {
    const dateHeader = cached.headers.get("sw-cached-at");
    const age = dateHeader ? Date.now() - Number(dateHeader) : 0;
    if (dateHeader && age < ttlMs) return cached;
  }
  try {
    const res = await fetch(req);
    if (res.ok) {
      // Wrap the response so we can attach a "cached at" timestamp header
      const cloned = res.clone();
      const body = await cloned.blob();
      const headers = new Headers(cloned.headers);
      headers.set("sw-cached-at", String(Date.now()));
      await cache.put(
        req,
        new Response(body, { status: cloned.status, statusText: cloned.statusText, headers })
      );
    }
    return res;
  } catch {
    return cached ?? Response.error();
  }
}
