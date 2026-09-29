import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "node:crypto";

/**
 * /api/content
 *   GET              public — returns the published SiteContent JSON (404 if none)
 *   PUT              auth   — replaces the row (validates minimum shape)
 *   DELETE           auth   — drops the row
 *   POST ?op=upload  auth   — a signed URL for uploading one image to Storage
 *
 * Uploads ride on this endpoint rather than getting their own because
 * every file under api/ is a Serverless Function, and the Hobby plan caps
 * a deployment at twelve (see CLAUDE.md).
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

function isContentShaped(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return Boolean(
    b.hero && b.about && Array.isArray(b.skills) && Array.isArray(b.projects)
  );
}

/* ---------------- media uploads ---------------- */

const MEDIA_BUCKET = "media";
/** Mirrors allowed_mime_types on the bucket (migration 007). No SVG: it
 *  can carry script, and a signed URL doesn't bind the content type. */
const IMAGE_TYPES: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/avif": "avif",
};
const MEDIA_FOLDERS = new Set(["designs", "blog", "projects"]);

/**
 * POST ?op=upload — a signed URL the browser PUTs one image to, directly
 * into Supabase Storage. The server chooses the path, so a client can't
 * overwrite someone else's file or write outside the bucket; the file
 * itself never passes through this function (or its 4.5 MB body cap).
 */
async function signUpload(res: VercelResponse, body: unknown) {
  const b = (body ?? {}) as { contentType?: unknown; folder?: unknown };
  const ext = typeof b.contentType === "string" ? IMAGE_TYPES[b.contentType] : undefined;
  if (!ext) {
    return res.status(400).json({
      error: "Upload a WebP, JPEG, PNG, GIF or AVIF image.",
    });
  }
  const folder =
    typeof b.folder === "string" && MEDIA_FOLDERS.has(b.folder) ? b.folder : "misc";
  const path = `${folder}/${new Date().getUTCFullYear()}/${crypto.randomUUID()}.${ext}`;

  const supabase = await getSupabase();
  const bucket = supabase.storage.from(MEDIA_BUCKET);
  const { data, error } = await bucket.createSignedUploadUrl(path);
  if (error || !data) {
    // Almost always the bucket doesn't exist yet. 503 tells the client to
    // fall back to an inline image rather than failing the edit.
    return res.status(503).json({
      error:
        "Image storage isn't set up. Run supabase/migrations/007_media_bucket.sql in the Supabase SQL editor.",
    });
  }
  const { data: pub } = bucket.getPublicUrl(path);
  return res
    .status(200)
    .json({ signedUrl: data.signedUrl, path, publicUrl: pub.publicUrl });
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
  "posts",
  "designs",
] as const;

const SNAPSHOT_COOLDOWN_MS = 5 * 60_000; // one snapshot per editing session
const KEEP_VERSIONS = 20;

/** `?sections=posts,designs` → known section keys, or null for a whole
 *  document write. Unknown names are dropped, never written. */
function parseSections(raw: string | string[] | undefined): string[] | null {
  const s = Array.isArray(raw) ? raw.join(",") : raw;
  if (!s) return null;
  const known = new Set<string>(SECTION_KEYS);
  const keys = s.split(",").map((k) => k.trim()).filter((k) => known.has(k));
  return keys.length > 0 ? keys : null;
}

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
  sections: string[],
  by: string
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
      }

      // Activity coalesces to one "published" row per editing session so
      // the log stays readable — but per editor, not globally. Coalescing
      // on the snapshot cadence alone credited a second admin's edits,
      // made inside someone else's five minutes, to the first admin.
      const { data: last } = await supabase
        .from("activity_log")
        .select("detail, created_at")
        .eq("action", "content.publish")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const row = last as { detail: { by?: string } | null; created_at: string } | null;
      const sameSession =
        row !== null &&
        row.detail?.by === by &&
        Date.now() - new Date(row.created_at).getTime() < SNAPSHOT_COOLDOWN_MS;
      if (!sameSession) {
        await supabase.from("activity_log").insert({
          action: "content.publish",
          detail: { sections, by },
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

    if (req.method === "POST") {
      const op = Array.isArray(req.query.op) ? req.query.op[0] : req.query.op;
      if (op !== "upload") {
        return res.status(400).json({ error: "Unknown op." });
      }
      if (!(await authorize(req))) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const body = typeof req.body === "string" ? safeJson(req.body) : req.body;
      return await signUpload(res, body);
    }

    if (req.method === "PUT" || req.method === "DELETE") {
      const actor = await authorize(req);
      if (!actor) {
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

        // ?sections=a,b — take only those keys from the body and keep the
        // rest of the published row. An editor's autosave sends its whole
        // local copy, and that copy's other sections can be older than the
        // server's: another admin may have published since it was loaded.
        const scope = parseSections(req.query.sections);
        const next =
          scope && prev && typeof prev === "object"
            ? {
                ...(prev as Record<string, unknown>),
                ...Object.fromEntries(
                  scope.map((k) => [k, (body as Record<string, unknown>)[k]])
                ),
              }
            : body;
        const sections = prev ? changedSections(prev, next) : [];

        const { error } = await supabase.from(TABLE).upsert({
          id: ROW_ID,
          content: next,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;

        if (prev && sections.length > 0) {
          await recordHistory(supabase, prev, sections, actor.name);
        }
        return res.status(200).json({ ok: true });
      }

      // DELETE
      const { error } = await supabase.from(TABLE).delete().eq("id", ROW_ID);
      if (error) throw error;
      try {
        await supabase
          .from("activity_log")
          .insert({ action: "content.reset", detail: { by: actor.name } });
      } catch {
        /* best-effort */
      }
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, PUT, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({
      error: e instanceof Error ? e.message : "Server error",
    });
  }
}
