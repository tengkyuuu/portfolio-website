import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "node:crypto";

/**
 * /api/content
 *   GET      public — returns the published SiteContent JSON (404 if none)
 *   PUT      auth   — replaces the row (validates minimum shape)
 *   DELETE   auth   — drops the row
 *
 * Self-contained. Zero imports from api/_lib/* because Vercel's dependency
 * tracer wasn't reliably bundling that folder in production — 500s with
 * an HTML body (not our JSON). Small duplication vs shared helpers is
 * worth the deploy predictability.
 *
 * Supabase JS is loaded via dynamic import so the module resolution
 * happens inside the function body — same pattern that made /api/health
 * work while /api/content was failing.
 */

const TABLE = "site_content";
const ROW_ID = "default";

/* ---------------- inline auth helpers ---------------- */

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

function isContentShaped(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return Boolean(
    b.hero && b.about && Array.isArray(b.skills) && Array.isArray(b.projects)
  );
}

/* ---------------- version history ---------------- */

const SECTION_KEYS = [
  "hero",
  "about",
  "skills",
  "projects",
  "certs",
  "timeline",
  "contact",
] as const;

const SNAPSHOT_COOLDOWN_MS = 5 * 60_000; // one snapshot per editing session
const KEEP_VERSIONS = 20;

function changedSections(prev: unknown, next: unknown): string[] {
  const a = (prev ?? {}) as Record<string, unknown>;
  const b = (next ?? {}) as Record<string, unknown>;
  return SECTION_KEYS.filter(
    (k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])
  );
}

/**
 * Snapshot `prev` into content_versions + append an activity row.
 * Best-effort by design: a missing 004 migration or a full table must
 * never fail the publish itself, so every step swallows its own errors.
 */
async function recordHistory(
  supabase: Awaited<ReturnType<typeof getSupabase>>,
  prev: unknown,
  sections: string[]
): Promise<void> {
  try {
    if (prev) {
      const { data: newest } = await supabase
        .from("content_versions")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const newestAge = newest
        ? Date.now() - new Date((newest as { created_at: string }).created_at).getTime()
        : Infinity;
      if (newestAge > SNAPSHOT_COOLDOWN_MS) {
        await supabase.from("content_versions").insert({
          content: prev,
          sections,
          byte_size: JSON.stringify(prev).length,
        });
        // Prune beyond the newest KEEP_VERSIONS
        const { data: extra } = await supabase
          .from("content_versions")
          .select("id")
          .order("created_at", { ascending: false })
          .range(KEEP_VERSIONS, KEEP_VERSIONS + 100);
        if (extra && extra.length > 0) {
          await supabase
            .from("content_versions")
            .delete()
            .in(
              "id",
              (extra as { id: string }[]).map((r) => r.id)
            );
        }
        // Activity coalesces with the snapshot cadence so the log stays
        // readable — one "published" row per session, not per keystroke.
        await supabase.from("activity_log").insert({
          action: "content.publish",
          detail: { sections },
        });
      }
    }
  } catch {
    // History is best-effort — never block the publish.
  }
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
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
    if (req.method === "GET") {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from(TABLE)
        .select("content")
        .eq("id", ROW_ID)
        .maybeSingle();
      if (error) throw error;
      const content = (data as { content: unknown } | null)?.content ?? null;
      if (!content) return res.status(404).json({ error: "No content" });
      return res.status(200).json(content);
    }

    if (req.method === "PUT" || req.method === "DELETE") {
      const token = extractBearer(req.headers.authorization);
      if (!verifyToken(token)) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const supabase = await getSupabase();

      if (req.method === "PUT") {
        const body =
          typeof req.body === "string" ? safeJson(req.body) : req.body;
        if (!isContentShaped(body)) {
          return res.status(400).json({
            error: "Body must include hero, about, skills, projects.",
          });
        }

        // Read what we're about to replace so it can be versioned.
        const { data: cur } = await supabase
          .from(TABLE)
          .select("content")
          .eq("id", ROW_ID)
          .maybeSingle();
        const prev = (cur as { content: unknown } | null)?.content ?? null;
        const sections = prev ? changedSections(prev, body) : [];

        const { error } = await supabase.from(TABLE).upsert({
          id: ROW_ID,
          content: body,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;

        if (prev && sections.length > 0) {
          await recordHistory(supabase, prev, sections);
        }
        return res.status(200).json({ ok: true });
      }

      // DELETE
      const { error } = await supabase.from(TABLE).delete().eq("id", ROW_ID);
      if (error) throw error;
      try {
        await supabase
          .from("activity_log")
          .insert({ action: "content.reset", detail: null });
      } catch {
        /* best-effort */
      }
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, PUT, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({
      error: e instanceof Error ? e.message : "Server error",
    });
  }
}
