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
  if (!isStoreConfigured()) {
    return res.status(503).json({
      error:
        "Content store is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    });
  }

  const token = extractBearer(req.headers.authorization);
  if (!verifyToken(token)) {
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
          .insert({ action: "content.restore", detail: { version_id: id } });
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
