import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "node:crypto";

/**
 * /api/login — admin sign-in, and the team of admins behind it.
 *
 *   POST                         public — { username?, password } → { token, user }
 *   GET    ?op=me                auth   — who this token belongs to, re-checked
 *   GET    ?op=team              owner  — list team admins
 *   POST   ?op=team              owner  — { username, name, email } → invite
 *   PATCH  ?op=team              owner  — { id, name?, password?, disabled? }
 *   DELETE ?op=team&id=<uuid>    owner  — remove
 *   POST   ?op=password          admin  — { current, next } → change own password
 *   GET    ?op=invite&token=…    public — validate an invite link → { name, username }
 *   POST   ?op=invite            public — { token, password } → { token, user }, redeeming it
 *
 * Two kinds of account. The owner signs in with the env-configured
 * password (ADMIN_PASSWORD_HASH) and no username: nothing stored in the
 * database can lock it out, and only it can manage the team. Team admins
 * live in admin_users (migration 006) with scrypt hashes, and can edit
 * everything except the team itself.
 *
 * Adding an admin never means the owner handling a password. ?op=team's
 * POST (migration 009) generates a random, unshared password to satisfy
 * the NOT NULL column, a one-time invite token, and emails (or hands
 * back, if Resend isn't set up) a link to /admin?invite=<token>. Only the
 * token's hash is stored — a database read can't grant a pending invite.
 * The invitee picks their own password through ?op=invite, which redeems
 * the token exactly once and signs them straight in.
 *
 * Team management lives here rather than in its own endpoint because every
 * file under api/ is a Serverless Function and the Hobby plan caps a
 * deployment at twelve (see CLAUDE.md).
 *
 * Self-contained. No imports from api/_lib/* — Vercel's dependency
 * tracer wasn't reliably bundling that folder in production, so each
 * function keeps its own copy of the small auth helpers.
 */

const TOKEN_TTL_SECONDS = 4 * 60 * 60;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

/** The name the owner signs in under. Reserved: no team admin can take it. */
const OWNER_USERNAME = "owner";
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;
const MIN_PASSWORD = 10;
const MAX_PASSWORD = 200;
const INVITE_EMAIL_RE = /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/;
const INVITE_TOKEN_RE = /^[A-Za-z0-9_-]{20,200}$/;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // a week to find the email
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const attempts = new Map<string, { count: number; first: number }>();

/* ---- admin session: identical in every authed handler (api/sessions.test.ts) ---- */

type Actor = { id: string; name: string; role: "owner" | "admin" };

function extractBearer(h: string | string[] | undefined): string | null {
  const s = Array.isArray(h) ? h[0] : h;
  if (!s) return null;
  const m = s.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/** Check the HMAC and expiry; the claims, or null. */
function readToken(
  token: string | null | undefined
): (Actor & { iat: number }) | null {
  const secret = process.env.ADMIN_TOKEN_SECRET;
  if (!token || !secret) return null;
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("base64url");
  const a = new Uint8Array(Buffer.from(token.slice(dot + 1)));
  const b = new Uint8Array(Buffer.from(expected));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      exp?: number;
      iat?: number;
      sub?: string;
      name?: string;
    };
    if (typeof p.exp !== "number" || p.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    const iat = typeof p.iat === "number" ? p.iat : 0;
    // Tokens minted before team accounts carry no subject, and only the
    // owner could sign in then.
    if (!p.sub || p.sub === "owner") {
      return { id: "owner", name: p.name || "Owner", role: "owner", iat };
    }
    return { id: p.sub, name: p.name || "Admin", role: "admin", iat };
  } catch {
    return null;
  }
}

/**
 * Who is calling, or null. The owner's token is trusted on its signature.
 * A team admin's is re-checked against admin_users on every call, so
 * removing, disabling or resetting an admin takes effect at once rather
 * than when their token expires. Fails closed: if the table can't be
 * read, a team token is refused.
 */
async function authorize(req: VercelRequest): Promise<Actor | null> {
  const claims = readToken(extractBearer(req.headers.authorization));
  if (!claims) return null;
  const { iat, ...actor } = claims;
  if (actor.role === "owner") return actor;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb
      .from("admin_users")
      .select("display_name, disabled, password_changed_at")
      .eq("id", actor.id)
      .maybeSingle();
    const row = data as {
      display_name: string;
      disabled: boolean;
      password_changed_at: string | null;
    } | null;
    if (error || !row || row.disabled) return null;
    // A password reset signs out every session issued before it.
    const changed = row.password_changed_at
      ? Math.floor(Date.parse(row.password_changed_at) / 1000)
      : 0;
    if (changed > iat) return null;
    return { ...actor, name: row.display_name };
  } catch {
    return null;
  }
}

/* ---- end admin session ---- */

/* ---------------- owner password ---------------- */

function sha256Hex(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function checkOwnerPassword(plain: string): boolean {
  const expected = (
    process.env.ADMIN_PASSWORD_HASH ??
    process.env.VITE_ADMIN_PASSWORD_HASH ??
    ""
  )
    .trim()
    .toLowerCase();
  if (!expected) return false;
  const got = sha256Hex(plain).toLowerCase();
  const a = new Uint8Array(Buffer.from(got, "hex"));
  const b = new Uint8Array(Buffer.from(expected, "hex"));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------------- team passwords (scrypt) ---------------- */

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function scrypt(
  plain: string,
  salt: Buffer,
  keylen: number,
  opts: { N: number; r: number; p: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(plain, salt, keylen, { ...opts, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key)
    );
  });
}

/** `scrypt$N$r$p$salt$hash`, both base64. Parameters travel with the hash
 *  so they can be raised later without invalidating existing accounts. */
export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const { N, r, p, keylen } = SCRYPT;
  const key = await scrypt(plain, salt, keylen, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64");
  if (expected.length === 0) return false;
  try {
    const got = await scrypt(plain, Buffer.from(saltB64, "base64"), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return crypto.timingSafeEqual(new Uint8Array(got), new Uint8Array(expected));
  } catch {
    return false;
  }
}

/** Compared against when the username doesn't exist, so a miss costs the
 *  same scrypt round as a hit and response time can't enumerate accounts. */
let decoyHash: Promise<string> | null = null;
function decoy(): Promise<string> {
  decoyHash ??= hashPassword(crypto.randomBytes(18).toString("base64"));
  return decoyHash;
}

/* ---------------- tokens ---------------- */

function signToken(sub: string, name: string): string {
  const secret = process.env.ADMIN_TOKEN_SECRET;
  if (!secret) throw new Error("ADMIN_TOKEN_SECRET is not set.");
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub, name, iat: now, exp: now + TOKEN_TTL_SECONDS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

function isAuthConfigured(): boolean {
  return Boolean(
    (process.env.ADMIN_PASSWORD_HASH ?? process.env.VITE_ADMIN_PASSWORD_HASH) &&
    process.env.ADMIN_TOKEN_SECRET,
  );
}

/* ---------------- rate limiting ---------------- */

function clientKey(req: VercelRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (first?.split(",")[0] || req.socket.remoteAddress || "unknown").trim();
}

function tooManyAttempts(key: string): boolean {
  const record = attempts.get(key);
  if (!record) return false;
  if (Date.now() - record.first > LOGIN_WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return record.count >= MAX_LOGIN_ATTEMPTS;
}

function recordFailedAttempt(key: string): void {
  const now = Date.now();
  const record = attempts.get(key);
  if (!record || now - record.first > LOGIN_WINDOW_MS) {
    attempts.set(key, { count: 1, first: now });
    return;
  }
  attempts.set(key, { count: record.count + 1, first: record.first });
}

function clearAttempts(key: string): void {
  attempts.delete(key);
}

/* ---------------- store ---------------- */

function isStoreConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function getSupabase() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

type Supabase = Awaited<ReturnType<typeof getSupabase>>;

/** Postgres "relation does not exist" — migration 006 hasn't been run. */
function isMissingTable(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return e?.code === "42P01" || e?.code === "PGRST205" || /admin_users/.test(e?.message ?? "");
}

const NO_TABLE =
  "Team accounts need the admin_users table. Run supabase/migrations/006_admin_users.sql in the Supabase SQL editor.";

async function logActivity(
  supabase: Supabase,
  action: string,
  detail: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from("activity_log").insert({ action, detail });
  } catch {
    /* history is best-effort */
  }
}

/* ---------------- validation ---------------- */

export function normalizeUsername(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

export function validateNewAdminInvite(body: unknown):
  | { ok: true; value: { username: string; name: string; email: string } }
  | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const username = normalizeUsername(b.username);
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!USERNAME_RE.test(username)) {
    return {
      ok: false,
      error:
        "Username must be 3–32 characters: lowercase letters, numbers, dots, dashes or underscores.",
    };
  }
  if (username === OWNER_USERNAME) {
    return { ok: false, error: `"${OWNER_USERNAME}" is reserved for the document owner.` };
  }
  if (!name || name.length > 60) {
    return { ok: false, error: "Display name must be 1–60 characters." };
  }
  if (!email || email.length > 254 || !INVITE_EMAIL_RE.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  return { ok: true, value: { username, name, email } };
}

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD) {
    return `Password must be at least ${MIN_PASSWORD} characters.`;
  }
  if (password.length > MAX_PASSWORD) {
    return `Password must be at most ${MAX_PASSWORD} characters.`;
  }
  return null;
}

/* ---------------- invite tokens + email ---------------- */

function generateInviteToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/** Only the hash is ever stored — a database read alone can't grant
 *  access to a pending invite. 32 random bytes has no brute-force
 *  surface, so a fast hash (not scrypt) is the right tool here. */
function hashInviteToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Mirrors invitationConfig()'s siteUrl resolution in api/inquiries.ts —
 *  duplicated rather than imported (see the file header: no api/_lib). */
function resolveSiteUrl(): string | null {
  try {
    const url = new URL(
      process.env.SITE_URL ||
        (process.env.VERCEL_PROJECT_PRODUCTION_URL
          ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
          : "")
    );
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!)
  );
}

function adminInviteEmail(name: string, inviteUrl: string) {
  const safeName = escapeHtml(name);
  const url = escapeHtml(inviteUrl);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#edf0f5;color:#283246;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:32px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:auto;background:white;border:1px solid #dbe1eb"><tr><td style="background:#244b87;padding:18px 28px;color:white;font-size:13px;font-weight:bold">W &nbsp; Portfolio.docx</td></tr><tr><td style="padding:34px 28px"><p style="font-size:10px;letter-spacing:2px;color:#2d5592">YOU'RE INVITED TO EDIT</p><h1 style="font-family:Georgia,serif;font-size:28px;font-weight:normal;margin:18px 0 24px">Hi ${safeName}, you're set up as an admin.</h1><p style="font-size:15px;line-height:1.8;margin-bottom:28px">Pick a password to finish setting up your account. This link works once and expires in 7 days.</p><a href="${url}" style="display:inline-block;background:#2d5592;color:white;padding:13px 20px;text-decoration:none;border-radius:4px;font-size:13px;font-weight:bold">Set your password →</a><p style="font-size:11px;color:#6b7280;margin-top:30px">If you weren't expecting this, you can ignore it — nothing happens until that link is used.</p></td></tr></table></td></tr></table></body></html>`;
  const text = `Hi ${name}, you've been added as an admin on Portfolio.docx.\n\nSet your password (this link works once, expires in 7 days): ${inviteUrl}\n\nIf you weren't expecting this, ignore it — nothing happens until that link is used.`;
  return { html, text };
}

/** Best-effort: a failed or unconfigured send isn't an error, the owner
 *  falls back to copying the link (see TeamPanel's HandoffCard). */
async function sendAdminInviteEmail(email: string, name: string, inviteUrl: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "You're invited to edit Portfolio.docx",
        ...adminInviteEmail(name, inviteUrl),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function firstQuery(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

const OWNER_USER = {
  id: "owner",
  username: OWNER_USERNAME,
  name: "Owner",
  role: "owner" as const,
};

/* ---------------- sign in ---------------- */

async function signIn(req: VercelRequest, res: VercelResponse, body: Record<string, unknown>) {
  if (!isAuthConfigured()) {
    return res.status(503).json({
      error:
        "Auth is not configured on this deployment. Set ADMIN_PASSWORD_HASH and ADMIN_TOKEN_SECRET in your environment.",
    });
  }

  const password = body.password;
  if (typeof password !== "string" || !password) {
    return res.status(400).json({ error: "Password is required." });
  }
  const username = normalizeUsername(body.username);

  const key = clientKey(req);
  if (tooManyAttempts(key)) {
    return res.status(429).json({
      error: "Too many sign-in attempts. Wait a few minutes, then try again.",
    });
  }

  if (!username || username === OWNER_USERNAME) {
    if (!checkOwnerPassword(password)) {
      recordFailedAttempt(key);
      return res.status(401).json({ error: "Incorrect password." });
    }
    try {
      clearAttempts(key);
      return res
        .status(200)
        .json({ token: signToken("owner", OWNER_USER.name), user: OWNER_USER });
    } catch (e) {
      return res.status(500).json({
        error: e instanceof Error ? e.message : "Server error",
      });
    }
  }

  if (!isStoreConfigured()) {
    return res
      .status(503)
      .json({ error: "Team accounts aren't available on this deployment." });
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("admin_users")
    .select("id, username, display_name, password_hash, disabled")
    .eq("username", username)
    .maybeSingle();
  if (error) {
    return res
      .status(isMissingTable(error) ? 503 : 500)
      .json({ error: isMissingTable(error) ? NO_TABLE : error.message });
  }
  const row = data as {
    id: string;
    username: string;
    display_name: string;
    password_hash: string;
    disabled: boolean;
  } | null;

  const ok = await verifyPassword(password, row?.password_hash ?? (await decoy()));
  if (!row || !ok) {
    recordFailedAttempt(key);
    return res.status(401).json({ error: "Incorrect username or password." });
  }
  // Only said after the password checks out, so it enumerates nothing.
  if (row.disabled) {
    return res
      .status(403)
      .json({ error: "This account has been disabled. Ask the document owner." });
  }

  clearAttempts(key);
  try {
    await supabase
      .from("admin_users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", row.id);
  } catch {
    /* a missed timestamp shouldn't block sign-in */
  }
  return res.status(200).json({
    token: signToken(row.id, row.display_name),
    user: { id: row.id, username: row.username, name: row.display_name, role: "admin" },
  });
}

/* ---------------- team ---------------- */

const TEAM_COLUMNS =
  "id, username, display_name, email, disabled, created_at, last_login_at, invite_expires_at";

async function team(
  req: VercelRequest,
  res: VercelResponse,
  actor: Actor,
  body: Record<string, unknown>
) {
  if (actor.role !== "owner") {
    return res.status(403).json({ error: "Only the document owner can manage the team." });
  }
  if (!isStoreConfigured()) {
    return res.status(503).json({ error: "No content store configured." });
  }
  const supabase = await getSupabase();

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("admin_users")
      .select(TEAM_COLUMNS)
      .order("created_at", { ascending: true });
    if (error) {
      return res
        .status(isMissingTable(error) ? 503 : 500)
        .json({ error: isMissingTable(error) ? NO_TABLE : error.message });
    }
    return res.status(200).json({ items: data ?? [] });
  }

  if (req.method === "POST") {
    const parsed = validateNewAdminInvite(body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const { username, name, email } = parsed.value;
    const siteUrl = resolveSiteUrl();
    if (!siteUrl) {
      return res.status(503).json({
        error: "Set SITE_URL to your public HTTPS website address before inviting an admin.",
      });
    }
    const token = generateInviteToken();
    const inviteLink = `${siteUrl}/admin?invite=${token}`;
    const { data, error } = await supabase
      .from("admin_users")
      .insert({
        username,
        display_name: name,
        email,
        // Satisfies the NOT NULL column until the invite is redeemed and
        // replaces it — nobody, including the owner, ever sees this one.
        password_hash: await hashPassword(crypto.randomBytes(24).toString("base64url")),
        invite_token_hash: hashInviteToken(token),
        invite_expires_at: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
        created_by: actor.name,
      })
      .select(TEAM_COLUMNS)
      .single();
    if (error) {
      if ((error as { code?: string }).code === "23505") {
        return res.status(409).json({ error: `The username "${username}" is taken.` });
      }
      return res
        .status(isMissingTable(error) ? 503 : 500)
        .json({ error: isMissingTable(error) ? NO_TABLE : error.message });
    }
    const emailSent = await sendAdminInviteEmail(email, name, inviteLink);
    await logActivity(supabase, "team.invite", { username, email, by: actor.name });
    return res.status(201).json({ ...data, inviteLink, emailSent });
  }

  const id = req.method === "DELETE" ? firstQuery(req.query.id) : body.id;
  if (typeof id !== "string" || !UUID_RE.test(id)) {
    return res.status(400).json({ error: "Invalid or missing admin id." });
  }

  if (req.method === "PATCH") {
    const patch: Record<string, unknown> = {};
    const changes: string[] = [];
    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name || name.length > 60) {
        return res.status(400).json({ error: "Display name must be 1–60 characters." });
      }
      patch.display_name = name;
      changes.push("name");
    }
    if (typeof body.disabled === "boolean") {
      patch.disabled = body.disabled;
      changes.push(body.disabled ? "disabled" : "enabled");
    }
    if (typeof body.password === "string") {
      const pw = validatePassword(body.password);
      if (pw) return res.status(400).json({ error: pw });
      patch.password_hash = await hashPassword(body.password);
      // Signs the admin out everywhere: authorize() refuses older tokens.
      patch.password_changed_at = new Date().toISOString();
      changes.push("password reset");
    }
    // A lost or never-arrived invite gets a fresh link rather than
    // deleting and recreating the whole account. The previous token stops
    // working the moment this one is written (the unique index means only
    // one hash can be live per row anyway).
    let freshInvite: { token: string; inviteLink: string } | null = null;
    if (body.resendInvite === true) {
      const siteUrl = resolveSiteUrl();
      if (!siteUrl) {
        return res.status(503).json({
          error: "Set SITE_URL to your public HTTPS website address before resending an invite.",
        });
      }
      const token = generateInviteToken();
      patch.invite_token_hash = hashInviteToken(token);
      patch.invite_expires_at = new Date(Date.now() + INVITE_TTL_MS).toISOString();
      freshInvite = { token, inviteLink: `${siteUrl}/admin?invite=${token}` };
      changes.push("invite resent");
    }
    if (changes.length === 0) {
      return res.status(400).json({ error: "Nothing to change." });
    }
    const { data, error } = await supabase
      .from("admin_users")
      .update(patch)
      .eq("id", id)
      .select(TEAM_COLUMNS)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Admin not found." });
    const row = data as { username: string; display_name: string; email: string | null };
    let emailSent: boolean | undefined;
    if (freshInvite && row.email) {
      emailSent = await sendAdminInviteEmail(row.email, row.display_name, freshInvite.inviteLink);
    }
    await logActivity(supabase, "team.update", {
      username: row.username,
      changes,
      by: actor.name,
    });
    return res.status(200).json({
      ...data,
      ...(freshInvite ? { inviteLink: freshInvite.inviteLink, emailSent: emailSent ?? false } : {}),
    });
  }

  if (req.method === "DELETE") {
    const { data, error } = await supabase
      .from("admin_users")
      .delete()
      .eq("id", id)
      .select("username")
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: "Admin not found." });
    await logActivity(supabase, "team.remove", {
      username: (data as { username: string }).username,
      by: actor.name,
    });
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST, PATCH, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}

/* ---------------- own password ---------------- */

async function changeOwnPassword(
  req: VercelRequest,
  res: VercelResponse,
  actor: Actor,
  body: Record<string, unknown>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (actor.role === "owner") {
    return res.status(400).json({
      error:
        "The owner password is set by ADMIN_PASSWORD_HASH in the hosting environment.",
    });
  }
  const current = typeof body.current === "string" ? body.current : "";
  const next = typeof body.next === "string" ? body.next : "";
  const pw = validatePassword(next);
  if (pw) return res.status(400).json({ error: pw });

  const key = `password:${actor.id}`;
  if (tooManyAttempts(key)) {
    return res.status(429).json({ error: "Too many attempts. Wait a few minutes." });
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("admin_users")
    .select("password_hash")
    .eq("id", actor.id)
    .maybeSingle();
  if (error || !data) return res.status(500).json({ error: "Couldn't load your account." });
  if (!(await verifyPassword(current, (data as { password_hash: string }).password_hash))) {
    recordFailedAttempt(key);
    return res.status(401).json({ error: "Your current password is incorrect." });
  }
  clearAttempts(key);

  const changedAt = new Date();
  const { error: upErr } = await supabase
    .from("admin_users")
    .update({
      password_hash: await hashPassword(next),
      password_changed_at: changedAt.toISOString(),
    })
    .eq("id", actor.id);
  if (upErr) return res.status(500).json({ error: upErr.message });
  await logActivity(supabase, "account.password", { by: actor.name });

  // Every older session is now refused, this one included, so hand back
  // a fresh token rather than signing the admin out of their own change.
  return res.status(200).json({ token: signToken(actor.id, actor.name) });
}

/* ---------------- accept invite ---------------- */

/**
 * Public — the invitee has no session yet; this is what grants them one.
 * GET validates the link and greets them by name; POST redeems it exactly
 * once, replacing the placeholder password with their own real one and
 * signing them straight in, the same way changeOwnPassword hands back a
 * fresh token after a self-service password change.
 */
async function handleInvite(
  req: VercelRequest,
  res: VercelResponse,
  body: Record<string, unknown>
) {
  const token =
    req.method === "GET"
      ? firstQuery(req.query.token)
      : typeof body.token === "string"
        ? body.token
        : undefined;
  if (!token || !INVITE_TOKEN_RE.test(token)) {
    return res.status(400).json({ error: "Invalid invite link." });
  }
  if (!isStoreConfigured()) {
    return res.status(503).json({ error: "No content store configured." });
  }
  const key = `invite:${clientKey(req)}`;
  if (tooManyAttempts(key)) {
    return res.status(429).json({ error: "Too many attempts. Wait a few minutes, then try again." });
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("admin_users")
    .select("id, display_name, username, invite_expires_at")
    .eq("invite_token_hash", hashInviteToken(token))
    .maybeSingle();
  const row = data as
    | { id: string; display_name: string; username: string; invite_expires_at: string | null }
    | null;
  if (error || !row || !row.invite_expires_at || Date.parse(row.invite_expires_at) <= Date.now()) {
    recordFailedAttempt(key);
    return res.status(410).json({
      error: "This invite link is invalid or has expired. Ask the document owner to send a new one.",
    });
  }

  if (req.method === "GET") {
    return res.status(200).json({ name: row.display_name, username: row.username });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const password = typeof body.password === "string" ? body.password : "";
  const pw = validatePassword(password);
  if (pw) return res.status(400).json({ error: pw });

  clearAttempts(key);
  const { error: upErr } = await supabase
    .from("admin_users")
    .update({
      password_hash: await hashPassword(password),
      password_changed_at: new Date().toISOString(),
      invite_token_hash: null,
      invite_expires_at: null,
    })
    .eq("id", row.id);
  if (upErr) return res.status(500).json({ error: upErr.message });
  await logActivity(supabase, "team.invite_accepted", { username: row.username });

  return res.status(200).json({
    token: signToken(row.id, row.display_name),
    user: { id: row.id, username: row.username, name: row.display_name, role: "admin" },
  });
}

/* ---------------- handler ---------------- */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const body = (
    typeof req.body === "string" ? safeJson(req.body) : (req.body ?? {})
  ) as Record<string, unknown> | null;
  const op = firstQuery(req.query.op);

  if (!op) {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }
    return signIn(req, res, body ?? {});
  }

  if (op === "invite") {
    try {
      return await handleInvite(req, res, body ?? {});
    } catch (e) {
      return res.status(500).json({ error: e instanceof Error ? e.message : "Server error" });
    }
  }

  const actor = await authorize(req);
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  try {
    if (op === "me") {
      if (actor.role === "owner") return res.status(200).json({ user: OWNER_USER });
      const supabase = await getSupabase();
      const { data } = await supabase
        .from("admin_users")
        .select("username")
        .eq("id", actor.id)
        .maybeSingle();
      return res.status(200).json({
        user: {
          id: actor.id,
          username: (data as { username: string } | null)?.username ?? "",
          name: actor.name,
          role: actor.role,
        },
      });
    }
    if (op === "team") return await team(req, res, actor, body ?? {});
    if (op === "password") return await changeOwnPassword(req, res, actor, body ?? {});
    return res.status(400).json({ error: `Unknown op "${op}".` });
  } catch (e) {
    return res.status(500).json({
      error: e instanceof Error ? e.message : "Server error",
    });
  }
}
