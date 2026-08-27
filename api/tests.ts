import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "node:crypto";

/**
 * Test-suite results for the /status dashboard.
 *
 *   GET  /api/tests — public; last stored run (404 until the GitHub Action
 *        has run at least once).
 *   POST /api/tests — writes a run. Auth: the raw ADMIN_TOKEN_SECRET as a
 *        bearer token, matching the contract /api/lighthouse already uses —
 *        a GitHub Action holds it as a repo secret and can't mint HMAC
 *        session tokens, so this is raw equality checked in constant time.
 *
 * Storage reuses the site_content table (id='tests') — no migration, same
 * trick as the Lighthouse row.
 */

const ROW_ID = "tests";

function isStoreConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function getSupabase() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

function secretMatches(header: string | string[] | undefined): boolean {
  const secret = process.env.ADMIN_TOKEN_SECRET;
  if (!secret) return false;
  const s = Array.isArray(header) ? header[0] : header;
  const m = s?.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const got = Buffer.from(m[1].trim());
  const want = Buffer.from(secret);
  return (
    got.length === want.length &&
    crypto.timingSafeEqual(new Uint8Array(got), new Uint8Array(want))
  );
}

type Run = {
  total: number;
  passed: number;
  failed: number;
  files: number;
  durationMs: number | null;
  coverage: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  } | null;
};

function int(v: unknown, max = 100_000): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  return Math.round(n);
}

function pct(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 10) / 10;
}

function validateRun(body: unknown): Run | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;

  const total = int(b.total);
  const passed = int(b.passed);
  const failed = int(b.failed);
  const files = int(b.files, 10_000);
  if (total === null || passed === null || failed === null || files === null) return null;
  if (passed + failed > total) return null;

  let coverage: Run["coverage"] = null;
  if (b.coverage && typeof b.coverage === "object") {
    const c = b.coverage as Record<string, unknown>;
    const statements = pct(c.statements);
    const branches = pct(c.branches);
    const functions = pct(c.functions);
    const lines = pct(c.lines);
    if (
      statements !== null &&
      branches !== null &&
      functions !== null &&
      lines !== null
    ) {
      coverage = { statements, branches, functions, lines };
    }
  }

  return {
    total,
    passed,
    failed,
    files,
    durationMs: int(b.durationMs, 60 * 60 * 1000),
    coverage,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isStoreConfigured()) {
    return res.status(503).json({ error: "Content store is not configured." });
  }

  try {
    const supabase = await getSupabase();

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("site_content")
        .select("content")
        .eq("id", ROW_ID)
        .maybeSingle();
      if (error) throw error;
      const content = (data as { content: unknown } | null)?.content ?? null;
      if (!content) return res.status(404).json({ error: "No test data yet." });
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
      return res.status(200).json(content);
    }

    if (req.method === "POST") {
      if (!secretMatches(req.headers.authorization)) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const body = typeof req.body === "string" ? safeJson(req.body) : (req.body ?? {});
      const run = validateRun(body);
      if (!run) {
        return res.status(400).json({
          error: "Body must include total, passed, failed, files (non-negative integers).",
        });
      }
      const b = body as Record<string, unknown>;
      const payload = {
        ...run,
        commit: typeof b.commit === "string" ? b.commit.slice(0, 40) : null,
        fetchedAt: new Date().toISOString(),
      };
      const { error } = await supabase.from("site_content").upsert({
        id: ROW_ID,
        content: payload,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
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

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
