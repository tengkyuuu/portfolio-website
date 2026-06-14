import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isAuthConfigured } from "./_lib/auth";
import { hasContent, isStoreConfigured } from "./_lib/store";

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse
) {
  let contentExists = false;
  let storeError: string | null = null;
  if (isStoreConfigured()) {
    try {
      contentExists = await hasContent();
    } catch (e) {
      storeError = e instanceof Error ? e.message : "Unknown store error";
    }
  }

  return res.status(200).json({
    ok: true,
    authConfigured: isAuthConfigured(),
    storeConfigured: isStoreConfigured(),
    hasContent: contentExists,
    storeError,
    // Per-var presence (booleans only — no values leaked) so a glance at
    // /api/health tells you exactly which env var is missing on this deploy.
    env: {
      ADMIN_PASSWORD_HASH: Boolean(process.env.ADMIN_PASSWORD_HASH),
      VITE_ADMIN_PASSWORD_HASH: Boolean(process.env.VITE_ADMIN_PASSWORD_HASH),
      ADMIN_TOKEN_SECRET: Boolean(process.env.ADMIN_TOKEN_SECRET),
      SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
  });
}
