import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "node:crypto";

/**
 * GET /api/activity — Bearer-auth "Track Changes" feed, newest first.
 * Rows are written server-side by content/versions/inquiries handlers,
 * so the log can't be forgotten or forged by a client.
 */

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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: "Content store is not configured." });
  }
  if (!(await authorize(req))) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data, error } = await supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return res.status(200).json({ items: data ?? [] });
  } catch (e) {
    return res.status(500).json({
      error: e instanceof Error ? e.message : "Server error",
    });
  }
}
