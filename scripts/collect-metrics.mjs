#!/usr/bin/env node
/**
 * Postbuild bundle-size collector.
 *
 * Walks dist/assets, records raw + gzip sizes for every JS/CSS chunk,
 * and dumps a summary to dist/metrics.json. The Status page fetches
 * that JSON at runtime so the dashboard is honest — not made-up numbers.
 *
 * Also captures build metadata from Vercel env vars when available
 * (commit SHA, branch, deploy time) so the dashboard can attribute
 * numbers to a specific commit.
 */

import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const ASSETS = path.join(DIST, "assets");
const OUT = path.join(DIST, "metrics.json");

if (!existsSync(DIST)) {
  console.error("[metrics] dist/ not found — run this after `vite build`.");
  process.exit(1);
}

const assetFiles = existsSync(ASSETS)
  ? readdirSync(ASSETS)
      .filter((f) => /\.(js|css)$/i.test(f))
      .map((f) => path.join(ASSETS, f))
  : [];

const bundles = assetFiles.map((abs) => {
  const buf = readFileSync(abs);
  const raw = buf.length;
  const gzip = gzipSync(buf, { level: 9 }).length;
  return {
    name: path.basename(abs),
    kind: /\.js$/i.test(abs) ? "js" : "css",
    rawBytes: raw,
    gzipBytes: gzip,
  };
});

const totals = bundles.reduce(
  (acc, b) => {
    acc.rawBytes += b.rawBytes;
    acc.gzipBytes += b.gzipBytes;
    return acc;
  },
  { rawBytes: 0, gzipBytes: 0 }
);

// index.html size (usually small; still worth showing)
const indexPath = path.join(DIST, "index.html");
let indexBytes = 0;
if (existsSync(indexPath)) indexBytes = statSync(indexPath).size;

const now = new Date().toISOString();

// Git / Vercel metadata. Fall back to `git rev-parse` when Vercel env
// isn't present (local dev builds).
const commitSha =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  safeExec("git rev-parse HEAD") ??
  null;
const commitShortSha = commitSha ? commitSha.slice(0, 7) : null;
const commitRef =
  process.env.VERCEL_GIT_COMMIT_REF ??
  safeExec("git rev-parse --abbrev-ref HEAD") ??
  null;
const commitMessage =
  process.env.VERCEL_GIT_COMMIT_MESSAGE ??
  safeExec("git log -1 --pretty=%s") ??
  null;
const environment = process.env.VERCEL_ENV ?? "local";

const payload = {
  generatedAt: now,
  environment,
  commit: {
    sha: commitSha,
    shortSha: commitShortSha,
    ref: commitRef,
    message: commitMessage,
  },
  bundles,
  totals,
  indexHtmlBytes: indexBytes,
};

writeFileSync(OUT, JSON.stringify(payload, null, 2));
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(
  `[metrics] wrote ${OUT} — ${bundles.length} bundle(s), ${kb(totals.rawBytes)} raw / ${kb(totals.gzipBytes)} gzip`
);

function existsSync(p) {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
}

function safeExec(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}
