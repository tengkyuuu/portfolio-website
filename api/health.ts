import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "node:crypto";

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


/**
 * Diagnostic endpoint. Deliberately inlines the Supabase probe
 * (instead of importing _lib/store or _lib/inquiries) so that a
 * broken helper module can't take down health too — this endpoint
 * needs to keep answering even when everything else is dying.
 *
 * Reports:
 *   • runtime info                       — node, region, env
 *   • which env vars are configured       — bool per var
 *   • per-table Supabase probe (SELECT LIMIT 1)
 *       - "ok"       → table exists, credentials valid
 *       - "missing"  → 42P01 relation does not exist
 *       - "denied"   → 42501 permission denied
 *       - {error}    → raw message otherwise
 *
 * Point the browser at /api/health when the app is misbehaving —
 * the JSON tells you exactly what to fix.
 */

type TableProbe =
  | { ok: true }
  | { ok: false; error: string; code?: string; hint?: string };

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const envReport = {
    ADMIN_PASSWORD_HASH: Boolean(process.env.ADMIN_PASSWORD_HASH),
    VITE_ADMIN_PASSWORD_HASH: Boolean(process.env.VITE_ADMIN_PASSWORD_HASH),
    ADMIN_TOKEN_SECRET: Boolean(process.env.ADMIN_TOKEN_SECRET),
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    GEMINI_API_KEY: Boolean(process.env.GEMINI_API_KEY),
  };

  const authConfigured =
    (envReport.ADMIN_PASSWORD_HASH || envReport.VITE_ADMIN_PASSWORD_HASH) &&
    envReport.ADMIN_TOKEN_SECRET;

  const storeConfigured =
    envReport.SUPABASE_URL && envReport.SUPABASE_SERVICE_ROLE_KEY;

  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  // Login needs only readiness. Schema errors and runtime details are private.
  if (!req.headers.authorization) return res.status(200).json({ ok: true, authConfigured, storeConfigured });
  if (!(await authorize(req))) return res.status(401).json({ error: "Unauthorized" });

  let supabaseModule: "ok" | { error: string } = "ok";
  let siteContentProbe: TableProbe = { ok: false, error: "not attempted" };
  let inquiriesProbe: TableProbe = { ok: false, error: "not attempted" };
  // Chat tables ship in migration 005. Probing them here is the only
  // cheap way to tell "migration not run yet" apart from "store down" —
  // /api/chat answers 200 with an empty transcript for both.
  let chatSessionsProbe: TableProbe = { ok: false, error: "not attempted" };
  let chatMessagesProbe: TableProbe = { ok: false, error: "not attempted" };
  // site_visits (migration 010) is written by the browser on the anon
  // key, never by this handler — probed here anyway since a missing
  // table or a broken RLS policy would otherwise just look like the
  // footer's visit count silently never appearing.
  let siteVisitsProbe: TableProbe = { ok: false, error: "not attempted" };

  if (storeConfigured) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.SUPABASE_URL as string,
        process.env.SUPABASE_SERVICE_ROLE_KEY as string,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );
      siteContentProbe = await probe(supabase, "site_content");
      inquiriesProbe = await probe(supabase, "inquiries");
      chatSessionsProbe = await probe(supabase, "chat_sessions");
      chatMessagesProbe = await probe(supabase, "chat_messages");
      siteVisitsProbe = await probe(supabase, "site_visits");
    } catch (e) {
      supabaseModule = {
        error: e instanceof Error ? e.message : "Failed to import @supabase/supabase-js",
      };
    }
  }

  return res.status(200).json({
    ok: true,
    node: process.version,
    vercelEnv: process.env.VERCEL_ENV ?? "local",
    vercelRegion: process.env.VERCEL_REGION ?? null,
    authConfigured,
    storeConfigured,
    env: envReport,
    supabaseModule,
    tables: {
      site_content: siteContentProbe,
      inquiries: inquiriesProbe,
      chat_sessions: chatSessionsProbe,
      chat_messages: chatMessagesProbe,
      site_visits: siteVisitsProbe,
    },
  });
}

// Accept the real Supabase client type but keep this file dep-free of type
// imports by using `any` at the boundary — probe just calls `.from(...).select`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function probe(supabase: any, table: string): Promise<TableProbe> {
  try {
    const { error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true })
      .limit(1);
    if (!error) return { ok: true };
    return {
      ok: false,
      error: error.message ?? String(error),
      code: (error as { code?: string }).code,
      hint: (error as { hint?: string }).hint,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown probe error",
    };
  }
}
