#!/usr/bin/env node
/**
 * Postbuild SEO stamping.
 *
 * Three tags have to be absolute URLs and cannot be written by hand in
 * index.html, because the repo does not know its own domain:
 *
 *   • <link rel="canonical">  — without it, the same document served from
 *     a Vercel preview URL, a custom domain and the .vercel.app fallback
 *     are three competing copies as far as a crawler is concerned.
 *   • <meta property="og:url">
 *   • og:image / twitter:image — these are relative in the source, and
 *     LinkedIn and Facebook both refuse to resolve a relative image. The
 *     card renders blank, which is the failure this fixes.
 *   • the JSON-LD graph's @id values — an @id is the entity's identifier,
 *     so a relative one names a different entity on every host that serves
 *     the same build.
 *
 * The origin comes from SITE_URL, or from VERCEL_PROJECT_PRODUCTION_URL,
 * which Vercel injects automatically and which points at the production
 * domain rather than the per-deploy one. That ordering matters: a preview
 * deploy must not canonicalise itself, so previews inherit the production
 * origin on purpose.
 *
 * With no origin available this warns and leaves the relative tags alone.
 * A relative og:image renders no card; a wrong absolute one canonicalises
 * the whole site to somebody else's domain. Doing nothing is the safer of
 * the two failures, so an unset SITE_URL is not a build error.
 *
 * Runs BEFORE collect-metrics.mjs — it rewrites index.html, and metrics
 * records that file's size.
 */

import { mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
// SEO_DIST lets the test run this against a scratch copy of index.html.
const DIST = process.env.SEO_DIST ?? path.join(ROOT, "dist");
const INDEX = path.join(DIST, "index.html");

/**
 * `/` and `/credits` are publicly reachable. /resume and /status sit
 * behind RequireAuth and /admin is the editor, so listing any of those
 * would point crawlers at a login wall and invite soft-404s.
 */
const PUBLIC_ROUTES = ["/", "/credits"];
const PRIVATE_ROUTES = ["/admin", "/resume", "/status"];

function resolveOrigin() {
  const explicit = process.env.SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  return null;
}

if (!exists(INDEX)) {
  console.error("[seo] dist/index.html not found — run this after `vite build`.");
  process.exit(1);
}

const origin = resolveOrigin();
let html = readFileSync(INDEX, "utf8");

if (origin) {
  // Absolute-ise the social images. Matches only root-relative hrefs so
  // re-running over an already-stamped file is a no-op.
  html = html.replace(
    /(<meta\s+(?:property|name)="(?:og:image|twitter:image)"\s+content=")\/([^"]*)(")/g,
    (_m, head, rest, tail) => `${head}${origin}/${rest}${tail}`
  );

  // Every root-relative URL and node id inside the JSON-LD graph. Left
  // relative these still resolve against the page, so an unset SITE_URL
  // degrades rather than breaks; absolute is what search engines want,
  // and an @id has to be globally unique to be an entity at all — a
  // relative one identifies a different thing on every host that serves
  // this build.
  //
  // Scoped to the script block rather than run across the whole document:
  // "url" is a common enough key that a document-wide replace would be
  // waiting to catch something it was never meant to.
  html = html.replace(
    /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,
    (_m, open, json, close) =>
      open +
      json.replace(
        /("(?:@id|url|contentUrl|image|logo)":\s*")\/([^"]*)(")/g,
        (_j, head, rest, tail) => `${head}${origin}/${rest}${tail}`
      ) +
      close
  );

  // Canonical + og:url, injected once.
  if (!/rel="canonical"/.test(html)) {
    html = html.replace(
      /<\/head>/,
      `    <link rel="canonical" href="${origin}/" />\n` +
        `    <meta property="og:url" content="${origin}/" />\n` +
        `  </head>`
    );
  }

  writeFileSync(INDEX, html);
  writeFileSync(path.join(DIST, "sitemap.xml"), sitemap(origin));
  console.log(`[seo] stamped ${origin} — canonical, og:url, absolute images, sitemap.xml`);
} else {
  console.warn(
    "[seo] SITE_URL unset and no VERCEL_PROJECT_PRODUCTION_URL — " +
      "leaving relative tags and skipping sitemap.xml. " +
      "Social cards will not render until this is set."
  );
}

/**
 * Per-route documents. vercel.json rewrites every non-API path to
 * /index.html, so without this /credits is served the home page's head:
 * title, description and a canonical pointing at "/". Google reads that
 * canonical as "this page is a duplicate of the home page" and folds it
 * in, even though the sitemap lists /credits as its own URL. A static
 * file at dist/credits/index.html wins over the rewrite, so the route
 * gets its own head and the SPA still boots from the same bundle.
 */
const ROUTE_META = {
  "/credits": {
    title: "Image Credits — James Vincent Calunsag",
    description:
      "The handful of images on this site that aren't mine: where Blue's reaction stickers and launcher icon came from, and how the original artist can claim credit.",
  },
};

for (const [route, meta] of Object.entries(ROUTE_META)) {
  const dir = path.join(DIST, route.replace(/^\//, ""));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "index.html"), forRoute(html, route, meta));
}
console.log(`[seo] wrote per-route html for ${Object.keys(ROUTE_META).join(", ")}`);

function forRoute(source, route, { title, description }) {
  const attr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const setMeta = (doc, kind, key, value) =>
    doc.replace(
      new RegExp(`(<meta\\s+${kind}="${key}"\\s+content=")[^"]*(")`),
      (_m, head, tail) => `${head}${attr(value)}${tail}`
    );
  let doc = source.replace(/<title>[^<]*<\/title>/, `<title>${attr(title)}</title>`);
  doc = setMeta(doc, "name", "description", description);
  doc = setMeta(doc, "property", "og:title", title);
  doc = setMeta(doc, "property", "og:description", description);
  doc = setMeta(doc, "name", "twitter:title", title);
  doc = setMeta(doc, "name", "twitter:description", description);
  if (origin) {
    doc = doc.replace(
      /(<link rel="canonical" href=")[^"]*(")/,
      (_m, head, tail) => `${head}${origin}${route}${tail}`
    );
    doc = setMeta(doc, "property", "og:url", `${origin}${route}`);
  }
  return doc;
}

writeFileSync(path.join(DIST, "robots.txt"), robots(origin));
console.log(`[seo] wrote robots.txt${origin ? " with sitemap reference" : ""}`);

function sitemap(base) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = PUBLIC_ROUTES.map(
    (route) =>
      `  <url>\n` +
      `    <loc>${base}${route}</loc>\n` +
      `    <lastmod>${today}</lastmod>\n` +
      `    <changefreq>weekly</changefreq>\n` +
      `  </url>`
  ).join("\n");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urls}\n` +
    `</urlset>\n`
  );
}

function robots(base) {
  const lines = ["User-agent: *"];
  for (const route of PRIVATE_ROUTES) lines.push(`Disallow: ${route}`);
  // The API is JSON, not content. Crawling it burns the GitHub rate limit
  // that /api/github's cache exists to protect.
  lines.push("Disallow: /api/");
  lines.push("Allow: /");
  if (base) lines.push("", `Sitemap: ${base}/sitemap.xml`);
  return lines.join("\n") + "\n";
}

function exists(p) {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
}
