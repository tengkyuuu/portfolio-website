import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "node:crypto";

/**
 * /api/inquiries
 *   POST                              public — submit an inquiry
 *   GET   ?status=<all|unread|…>      auth   — list
 *   PATCH ?id=<uuid>  body {status}   auth   — change status
 *   DELETE ?id=<uuid>                 auth   — hard delete
 *
 * Self-contained (no api/_lib imports) so Vercel bundles it reliably.
 * Supabase JS loaded via dynamic import inside the request handler —
 * matches the /api/health pattern that works in production.
 */

const TABLE = "inquiries";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PER_10_MIN = 5;

/* ---------------- inline auth ---------------- */

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

/* ---------------- inline store ---------------- */

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

/* ---------------- inline helpers ---------------- */

function clientIp(headers: Record<string, string | string[] | undefined>): string | null {
  const raw =
    (headers["x-forwarded-for"] as string | undefined) ??
    (headers["x-real-ip"] as string | undefined);
  if (!raw) return null;
  return raw.split(",")[0]?.trim() || null;
}

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const salt = process.env.ADMIN_TOKEN_SECRET ?? "";
  if (!salt) return null;
  return crypto
    .createHmac("sha256", salt)
    .update(ip)
    .digest("hex")
    .slice(0, 32);
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

type ValidationError = { field: string; message: string };

function validateBody(body: unknown): {
  ok: true;
  value: { name: string; email: string; subject: string | null; message: string };
  honeypotTripped: boolean;
} | { ok: false; errors: ValidationError[] } {
  if (!body || typeof body !== "object") {
    return { ok: false, errors: [{ field: "_root", message: "Body must be an object." }] };
  }
  const b = body as Record<string, unknown>;
  const errors: ValidationError[] = [];

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (name.length < 1) errors.push({ field: "name", message: "Name is required." });
  if (name.length > 100) errors.push({ field: "name", message: "Name is too long (max 100)." });

  const email = typeof b.email === "string" ? b.email.trim() : "";
  if (email.length < 3) errors.push({ field: "email", message: "Email is required." });
  else if (email.length > 200) errors.push({ field: "email", message: "Email is too long." });
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.push({ field: "email", message: "That doesn't look like a valid email." });

  const subjectRaw = typeof b.subject === "string" ? b.subject.trim() : "";
  const subject = subjectRaw.length > 0 ? subjectRaw : null;
  if (subject && subject.length > 200)
    errors.push({ field: "subject", message: "Subject is too long (max 200)." });

  const message = typeof b.message === "string" ? b.message.trim() : "";
  if (message.length < 1) errors.push({ field: "message", message: "Message is required." });
  else if (message.length > 5000)
    errors.push({ field: "message", message: "Message is too long (max 5,000)." });

  const honeypotTripped =
    typeof b.website === "string" && b.website.trim().length > 0;

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { name, email, subject, message }, honeypotTripped };
}

/* ---------------- handler ---------------- */

type Invitation = { recipients: string[]; subject: string; message: string; requestId: string };
const INVITE_EMAIL = /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/;

export function validateInvitation(body: unknown): Invitation | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.recipients) || b.recipients.length < 1 || b.recipients.length > 10) return null;
  if (b.recipients.some(email => typeof email !== "string" || email.length > 254 || !INVITE_EMAIL.test(email.trim()))) return null;
  if (typeof b.subject !== "string" || !b.subject.trim() || b.subject.length > 150 || /[\r\n]/.test(b.subject)) return null;
  if (typeof b.message !== "string" || !b.message.trim() || b.message.length > 3000) return null;
  if (typeof b.requestId !== "string" || !UUID_RE.test(b.requestId)) return null;
  return { recipients: [...new Set(b.recipients.map(email => (email as string).trim().toLowerCase()))], subject: b.subject.trim(), message: b.message.trim(), requestId: b.requestId };
}

function invitationConfig() {
  const missing: string[] = [];
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const replyTo = process.env.RESEND_REPLY_TO;
  if (!apiKey) missing.push("RESEND_API_KEY");
  if (!from || /[\r\n]/.test(from) || !INVITE_EMAIL.test(from.match(/<([^>]+)>$/)?.[1] ?? from)) missing.push("RESEND_FROM");
  if (replyTo && !INVITE_EMAIL.test(replyTo)) missing.push("RESEND_REPLY_TO");
  let siteUrl = "";
  try {
    const url = new URL(process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : ""));
    if (url.protocol !== "https:" || url.username || url.password) throw new Error();
    siteUrl = url.origin;
  } catch { missing.push("SITE_URL"); }
  return { apiKey, from, replyTo, siteUrl, missing };
}

function escapeEmail(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
}

export function invitationEmail(invite: Invitation, siteUrl: string) {
  const url = escapeEmail(siteUrl);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#edf0f5;color:#283246;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:32px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:auto;background:white;border:1px solid #dbe1eb"><tr><td style="background:#244b87;padding:18px 28px;color:white;font-size:13px;font-weight:bold">W &nbsp; Portfolio.docx</td></tr><tr><td style="padding:34px 28px"><p style="font-size:10px;letter-spacing:2px;color:#2d5592">YOU'RE INVITED</p><h1 style="font-family:Georgia,serif;font-size:32px;font-weight:normal;margin:18px 0 24px">Come have a look around.</h1><p style="font-size:15px;line-height:1.8;margin-bottom:28px">${escapeEmail(invite.message).replace(/\r?\n/g, "<br>")}</p><a href="${url}" style="display:inline-block;background:#2d5592;color:white;padding:13px 20px;text-decoration:none;border-radius:4px;font-size:13px;font-weight:bold">Explore the portfolio →</a><p style="font-size:11px;color:#6b7280;margin-top:30px">Projects, design, and the person behind the work.</p><p style="font-size:11px;overflow-wrap:anywhere"><a style="color:#2d5592" href="${url}">${url}</a></p></td></tr></table></td></tr></table></body></html>`;
  return { html, text: `You're invited to Portfolio.docx\n\n${invite.message}\n\nExplore the portfolio: ${siteUrl}` };
}

/** Called only after the production or local admin session has been checked. */
export async function handleInvitations(req: VercelRequest, res: VercelResponse, actor: Actor) {
  res.setHeader("Cache-Control", "no-store");
  const config = invitationConfig();
  if (req.method === "GET") return res.status(200).json({ configured: config.missing.length === 0, missing: config.missing, from: config.from || "", siteUrl: config.siteUrl });
  if (req.method !== "POST") { res.setHeader("Allow", "GET, POST"); return res.status(405).json({ error: "Method not allowed" }); }
  const body = typeof req.body === "string" ? safeJson(req.body) : req.body;
  const invite = validateInvitation(body);
  if (!invite) return res.status(400).json({ error: "Enter 1–10 valid email addresses, a subject (up to 150 characters), and a message (up to 3,000 characters)." });
  if (!config.siteUrl) return res.status(503).json({ error: "Set SITE_URL to your public HTTPS website address before previewing or sending invitations." });
  const email = invitationEmail(invite, config.siteUrl);
  if (body.preview === true) return res.status(200).json({ ...email, subject: invite.subject, recipients: invite.recipients, from: config.from || "Sender not configured", siteUrl: config.siteUrl });
  if (config.missing.length) return res.status(503).json({ error: `Configure ${config.missing.join(", ")} on the server before sending.` });
  try {
    const upstream = await fetch("https://api.resend.com/emails/batch", {
      method: "POST", signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `portfolio-invite/${actor.id}/${invite.requestId}` },
      body: JSON.stringify(invite.recipients.map(to => ({ from: config.from, to: [to], subject: invite.subject, ...email, ...(config.replyTo ? { reply_to: config.replyTo } : {}) }))),
    });
    const result = await upstream.json().catch(() => null) as { data?: { id?: string }[] } | null;
    if (!upstream.ok) {
      const error = upstream.status === 429 ? "Resend is limiting requests. Wait a moment, then retry." : upstream.status === 409 ? "This invitation changed after a send attempt. Check Resend before creating another invitation." : upstream.status === 401 || upstream.status === 403 ? "Resend rejected the sender or API key. Check your verified domain and server settings." : "Resend could not accept the invitations. Check the Resend dashboard, then retry.";
      return res.status(upstream.status === 429 ? 429 : 502).json({ error });
    }
    if (!result?.data || result.data.length !== invite.recipients.length || result.data.some(item => !item.id)) {
      return res.status(502).json({ error: "Resend's response was incomplete. Check the dashboard or retry this same invitation." });
    }
    return res.status(200).json({ ok: true, accepted: result.data.map((item, index) => ({ email: invite.recipients[index], id: item.id })) });
  } catch {
    return res.status(502).json({ error: "Could not confirm Resend's response. Retry this same invitation to avoid duplicates, or check the Resend dashboard." });
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.query.op === "invitations") {
    const actor = await authorize(req);
    if (!actor) return res.status(401).json({ error: "Unauthorized" });
    return handleInvitations(req, res, actor);
  }
  if (!isStoreConfigured()) {
    return res.status(503).json({
      error:
        "Content store is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    });
  }

  try {
    /* -------- POST (public) — create an inquiry -------- */
    if (req.method === "POST") {
      const body =
        typeof req.body === "string" ? safeJson(req.body) : (req.body ?? {});
      const parsed = validateBody(body);
      if (!parsed.ok) {
        return res.status(400).json({ error: "Validation failed", details: parsed.errors });
      }
      if (parsed.honeypotTripped) {
        // Silent success — don't feed bots iteration signal.
        return res.status(202).json({ ok: true });
      }

      const ip = clientIp(req.headers);
      const ipHash = hashIp(ip);
      const supabase = await getSupabase();

      if (ipHash) {
        try {
          const since = new Date(Date.now() - 10 * 60_000).toISOString();
          const { count } = await supabase
            .from(TABLE)
            .select("id", { count: "exact", head: true })
            .eq("ip_hash", ipHash)
            .gte("created_at", since);
          if ((count ?? 0) >= MAX_PER_10_MIN) {
            return res.status(429).json({
              error:
                "Too many messages from this address. Please try again in a few minutes.",
            });
          }
        } catch {
          // rate-limit failure shouldn't block a real visitor
        }
      }

      const uaRaw = req.headers["user-agent"];
      const userAgent = (Array.isArray(uaRaw) ? uaRaw[0] : uaRaw) ?? null;

      const { data, error } = await supabase
        .from(TABLE)
        .insert({
          name: parsed.value.name,
          email: parsed.value.email,
          subject: parsed.value.subject,
          message: parsed.value.message,
          ip_hash: ipHash,
          user_agent: userAgent ? userAgent.slice(0, 500) : null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return res.status(201).json({ ok: true, id: (data as { id: string }).id });
    }

    /* -------- GET / PATCH / DELETE all require auth -------- */
    const actor = await authorize(req);
    if (!actor) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const supabase = await getSupabase();

    if (req.method === "GET") {
      const rawStatus = req.query.status;
      const status = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;
      let q = supabase
        .from(TABLE)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (status && status !== "all") q = q.eq("status", status);
      const [{ data, error }, { count, error: countErr }] = await Promise.all([
        q,
        supabase
          .from(TABLE)
          .select("id", { count: "exact", head: true })
          .eq("status", "unread"),
      ]);
      if (error) throw error;
      if (countErr) throw countErr;
      return res.status(200).json({
        items: data ?? [],
        unreadCount: count ?? 0,
      });
    }

    // PATCH / DELETE need an id
    const rawId = req.query.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id || !UUID_RE.test(id)) {
      return res.status(400).json({ error: "Invalid or missing ?id=" });
    }

    if (req.method === "PATCH") {
      const body =
        typeof req.body === "string" ? safeJson(req.body) : (req.body ?? {});
      const status = (body as { status?: unknown })?.status;
      if (status !== "unread" && status !== "read" && status !== "archived") {
        return res.status(400).json({
          error: "status must be unread, read, or archived.",
        });
      }
      const patch: Record<string, unknown> = { status };
      const now = new Date().toISOString();
      if (status === "read") patch.read_at = now;
      if (status === "archived") patch.archived_at = now;
      if (status === "unread") patch.read_at = null;
      const { data, error } = await supabase
        .from(TABLE)
        .update(patch)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Inquiry not found." });
      try {
        await supabase
          .from("activity_log")
          .insert({
            action: "inquiry.status",
            detail: { id, status, by: actor.name },
          });
      } catch {
        /* history is best-effort */
      }
      return res.status(200).json(data);
    }

    if (req.method === "DELETE") {
      const { error, count } = await supabase
        .from(TABLE)
        .delete({ count: "exact" })
        .eq("id", id);
      if (error) throw error;
      if ((count ?? 0) === 0) {
        return res.status(404).json({ error: "Inquiry not found." });
      }
      try {
        await supabase
          .from("activity_log")
          .insert({ action: "inquiry.delete", detail: { id, by: actor.name } });
      } catch {
        /* history is best-effort */
      }
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({
      error: e instanceof Error ? e.message : "Server error",
    });
  }
}
