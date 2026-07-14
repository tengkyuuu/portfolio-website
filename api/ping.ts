import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Zero-import diagnostic endpoint. If /api/ping returns 200 with the
 * expected JSON but /api/content or /api/inquiries return 500 HTML,
 * we know the runtime + routing are fine and the fault is in the
 * Supabase code path. If /api/ping itself fails, something more
 * fundamental is broken (build failed to include node_modules,
 * runtime version mismatch, etc.).
 *
 * Kept separate from /api/health so it never depends on the Supabase
 * client — a broken import there would take down health too.
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    ok: true,
    node: process.version,
    now: new Date().toISOString(),
    vercelEnv: process.env.VERCEL_ENV ?? "local",
    vercelRegion: process.env.VERCEL_REGION ?? null,
  });
}
