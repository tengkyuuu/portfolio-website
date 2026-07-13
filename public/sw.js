/* Portfolio.docx service worker.
 *
 * Small, hand-rolled, no Workbox. Three caches:
 *
 *   1) SHELL  — precached at install: /, /index.html, /manifest, /icon.svg.
 *               Kept forever until this SW is replaced.
 *   2) API    — stale-while-revalidate for /api/content and /api/health.
 *               Any admin-write path is bypassed entirely.
 *   3) ASSETS — cache-first with a 30-day expiry for JS/CSS/font/image
 *               responses (both same-origin and Devicon/Google Fonts CDNs).
 *
 * The cache version bumps whenever this file changes — commit a new build
 * ⇒ SW installs ⇒ old caches purged on activate ⇒ open tabs get a "new
 * version available" prompt (see registerSW in main.tsx).
 */

const CACHE_VERSION = "v3";
const SHELL_CACHE = `pd-shell-${CACHE_VERSION}`;
const API_CACHE = `pd-api-${CACHE_VERSION}`;
const ASSET_CACHE = `pd-asset-${CACHE_VERSION}`;
const ASSET_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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

  // Public API (content, health): stale-while-revalidate
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(staleWhileRevalidate(req, API_CACHE));
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

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached ?? (await network);
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
