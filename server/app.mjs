/**
 * Content API for the portfolio admin panel.
 *
 * Express app exposing:
 *   POST   /api/login    — password → short-lived bearer token
 *   GET    /api/content  — public; the published SiteContent JSON (404 if none)
 *   PUT    /api/content  — auth; replace published content (atomic file write)
 *   DELETE /api/content  — auth; remove published content (reset to defaults)
 *   GET    /api/health   — public; server + config status
 *
 * Content lives in server/data/content.json. Images are base64 data URLs
 * embedded in the JSON (the admin client compresses them before upload),
 * so a single JSON file is the whole database.
 *
 * The app is connect-compatible: it's mounted into Vite's dev server
 * (vite.config.ts) so `npm run dev` serves the API on the same port, and
 * reused by server/index.mjs in production. Unmatched routes fall through
 * to the next middleware (Vite / static files).
 */

import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "content.json");

/* ---------------------------------- env ---------------------------------- */

/** Minimal .env.local parser — avoids a dotenv dependency. */
function loadEnvLocal() {
  const file = path.join(ROOT, ".env.local");
  const out = {};
  try {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !line.trimStart().startsWith("#")) out[m[1]] = m[2];
    }
  } catch {
    /* no .env.local — rely on process.env */
  }
  return out;
}

const envFile = loadEnvLocal();
const env = (key) => process.env[key] ?? envFile[key];

/** Prefer the non-VITE name (never reaches the client bundle); accept the
 *  VITE_ one so the existing .env.local works without changes. */
const PASSWORD_HASH = (
  env("ADMIN_PASSWORD_HASH") ??
  env("VITE_ADMIN_PASSWORD_HASH") ??
  ""
)
  .trim()
  .toLowerCase();

/* -------------------------------- sessions ------------------------------- */

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12h
const sessions = new Map(); // token -> expiry epoch ms

function issueToken() {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + TOKEN_TTL_MS);
  return token;
}

function isValidToken(token) {
  if (!token) return false;
  const expiry = sessions.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function requireAuth(req, res, next) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  if (!isValidToken(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

/* --------------------------- login rate limiting -------------------------- */

const FAIL_WINDOW_MS = 10 * 60 * 1000;
const FAIL_MAX = 20;
let failedAttempts = []; // epoch ms of recent failures

function tooManyFailures() {
  const cutoff = Date.now() - FAIL_WINDOW_MS;
  failedAttempts = failedAttempts.filter((t) => t > cutoff);
  return failedAttempts.length >= FAIL_MAX;
}

/* --------------------------------- helpers -------------------------------- */

function sha256Hex(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function hashesMatch(inputHex, expectedHex) {
  const a = Buffer.from(inputHex, "hex");
  const b = Buffer.from(expectedHex, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Same minimal shape check the client's importContent does. */
function isContentShaped(body) {
  return (
    body &&
    typeof body === "object" &&
    body.hero &&
    body.about &&
    Array.isArray(body.skills) &&
    Array.isArray(body.projects)
  );
}

function writeContentAtomic(json) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, json, "utf8");
  fs.renameSync(tmp, DATA_FILE);
}

/* ---------------------------------- app ----------------------------------- */

export const apiApp = express();
apiApp.use(express.json({ limit: "30mb" })); // content JSON embeds base64 images

apiApp.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    authConfigured: Boolean(PASSWORD_HASH),
    hasContent: fs.existsSync(DATA_FILE),
  });
});

apiApp.post("/api/login", (req, res) => {
  if (!PASSWORD_HASH) {
    res.status(503).json({
      error:
        "No admin password configured. Set ADMIN_PASSWORD_HASH in .env.local.",
    });
    return;
  }
  if (tooManyFailures()) {
    res.status(429).json({ error: "Too many attempts. Try again later." });
    return;
  }
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!hashesMatch(sha256Hex(password), PASSWORD_HASH)) {
    failedAttempts.push(Date.now());
    res.status(401).json({ error: "Incorrect password." });
    return;
  }
  res.json({ token: issueToken() });
});

apiApp.get("/api/content", (_req, res) => {
  if (!fs.existsSync(DATA_FILE)) {
    res.status(404).json({ error: "No published content yet." });
    return;
  }
  res.type("application/json").send(fs.readFileSync(DATA_FILE, "utf8"));
});

apiApp.put("/api/content", requireAuth, (req, res) => {
  if (!isContentShaped(req.body)) {
    res.status(400).json({
      error: "JSON is missing required sections (hero, about, skills, projects).",
    });
    return;
  }
  writeContentAtomic(JSON.stringify(req.body));
  res.json({ ok: true });
});

apiApp.delete("/api/content", requireAuth, (_req, res) => {
  fs.rmSync(DATA_FILE, { force: true });
  res.json({ ok: true });
});
