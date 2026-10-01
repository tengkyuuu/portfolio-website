import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "node:crypto";

/**
 * /api/versions — content version history. All methods Bearer-auth.
 *
 *   GET               → list metadata (id, created_at, sections, byte_size), newest first
 *   GET  ?id=<uuid>   → the full content snapshot for one version
 *   POST ?id=<uuid>   → restore: back up current content (bypasses the
 *                       snapshot cooldown), overwrite site_content with
 *                       the snapshot, log content.restore.
 *
 * Self-contained (no api/_lib imports) — Vercel's tracer failed to bundle
 * shared helper folders in production, so each function carries its own.
 */

const CONTENT_TABLE = "site_content";
const VERSIONS_TABLE = "content_versions";
const ROW_ID = "default";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader("Cache-Control", "no-store");
  if (!isStoreConfigured()) {
    return res.status(503).json({
      error:
        "Content store is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    });
  }

  const actor = await authorize(req);
  if (!actor) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const rawId = req.query.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  try {
    const supabase = await getSupabase();

    if (req.method === "GET") {
      if (id) {
        if (!UUID_RE.test(id)) {
          return res.status(400).json({ error: "Invalid ?id=" });
        }
        const { data, error } = await supabase
          .from(VERSIONS_TABLE)
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: "Version not found." });
        return res.status(200).json(data);
      }
      const { data, error } = await supabase
        .from(VERSIONS_TABLE)
        .select("id, created_at, sections, byte_size")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return res.status(200).json({ items: data ?? [] });
    }

    if (req.method === "POST") {
      if (!id || !UUID_RE.test(id)) {
        return res.status(400).json({ error: "Invalid or missing ?id=" });
      }
      const { data: snap, error: snapErr } = await supabase
        .from(VERSIONS_TABLE)
        .select("content")
        .eq("id", id)
        .maybeSingle();
      if (snapErr) throw snapErr;
      if (!snap) return res.status(404).json({ error: "Version not found." });
      const snapshot = (snap as { content: unknown }).content;

      // Back up current content first so the restore itself is undoable.
      // Deliberately bypasses the publish cooldown.
      const { data: cur } = await supabase
        .from(CONTENT_TABLE)
        .select("content")
        .eq("id", ROW_ID)
        .maybeSingle();
      const prev = (cur as { content: unknown } | null)?.content ?? null;
      if (prev) {
        try {
          await supabase.from(VERSIONS_TABLE).insert({
            content: prev,
            sections: ["pre-restore backup"],
            byte_size: JSON.stringify(prev).length,
          });
        } catch {
          /* best-effort */
        }
      }

      const { error: putErr } = await supabase.from(CONTENT_TABLE).upsert({
        id: ROW_ID,
        content: snapshot,
        updated_at: new Date().toISOString(),
      });
      if (putErr) throw putErr;

      try {
        await supabase
          .from("activity_log")
          .insert({
            action: "content.restore",
            detail: { version_id: id, by: actor.name },
          });
      } catch {
        /* best-effort */
      }

      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({
      error: e instanceof Error ? e.message : "Server error",
    });
  }
}
