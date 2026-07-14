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

function extractBearer(h: string | string[] | undefined): string | null {
  const s = Array.isArray(h) ? h[0] : h;
  if (!s) return null;
  const m = s.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function verifyToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const secret = process.env.ADMIN_TOKEN_SECRET;
  if (!secret) return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("base64url");
  const a = new Uint8Array(Buffer.from(sig));
  const b = new Uint8Array(Buffer.from(expected));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as { exp: number };
    return payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
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
    const token = extractBearer(req.headers.authorization);
    if (!verifyToken(token)) {
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
