import type { VercelRequest, VercelResponse } from "@vercel/node";

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
  _req: VercelRequest,
  res: VercelResponse
) {
  const envReport = {
    ADMIN_PASSWORD_HASH: Boolean(process.env.ADMIN_PASSWORD_HASH),
    VITE_ADMIN_PASSWORD_HASH: Boolean(process.env.VITE_ADMIN_PASSWORD_HASH),
    ADMIN_TOKEN_SECRET: Boolean(process.env.ADMIN_TOKEN_SECRET),
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY),
  };

  const authConfigured =
    (envReport.ADMIN_PASSWORD_HASH || envReport.VITE_ADMIN_PASSWORD_HASH) &&
    envReport.ADMIN_TOKEN_SECRET;

  const storeConfigured =
    envReport.SUPABASE_URL && envReport.SUPABASE_SERVICE_ROLE_KEY;

  let supabaseModule: "ok" | { error: string } = "ok";
  let siteContentProbe: TableProbe = { ok: false, error: "not attempted" };
  let inquiriesProbe: TableProbe = { ok: false, error: "not attempted" };

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
