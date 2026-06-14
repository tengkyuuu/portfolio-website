import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isAuthConfigured } from "./_lib/auth";
import { hasContent, isStoreConfigured } from "./_lib/store";

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse
) {
  let contentExists = false;
  if (isStoreConfigured()) {
    contentExists = await hasContent();
  }
  return res.status(200).json({
    ok: true,
    authConfigured: isAuthConfigured(),
    hasContent: contentExists,
  });
}
