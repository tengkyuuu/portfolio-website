import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "node:crypto";

/**
 * Lighthouse scores storage for the /status dashboard.
 *
 *   GET  /api/lighthouse — public; last stored scores (404 until the
 *        GitHub Action has run at least once).
 *   POST /api/lighthouse — writes scores. Auth: the raw ADMIN_TOKEN_SECRET
 *        as a bearer token (the GitHub Action holds it as a repo secret —
 *        it can't mint HMAC session tokens, so raw-equality is the contract
 *        here, checked in constant time).
 *
 * Storage reuses the site_content table (id='lighthouse') — no migration.
 */

const ROW_ID = "lighthouse";

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

type Scores = {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
};

function validateScores(body: unknown): Scores | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const keys = ["performance", "accessibility", "bestPractices", "seo"] as const;
  const out: Partial<Scores> = {};
  for (const k of keys) {
    const v = Number(b[k]);
    if (!Number.isFinite(v) || v < 0 || v > 100) return null;
    out[k] = Math.round(v);
  }
  return out as Scores;
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
      if (!content) return res.status(404).json({ error: "No Lighthouse data yet." });
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
      return res.status(200).json(content);
    }

    if (req.method === "POST") {
      if (!secretMatches(req.headers.authorization)) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const body =
        typeof req.body === "string" ? safeJson(req.body) : (req.body ?? {});
      const scores = validateScores(body);
      if (!scores) {
        return res.status(400).json({
          error: "Body must include performance, accessibility, bestPractices, seo (0-100).",
        });
      }
      const b = body as Record<string, unknown>;
      const payload = {
        scores,
        url: typeof b.url === "string" ? b.url.slice(0, 300) : null,
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
