import type { VercelRequest, VercelResponse } from "@vercel/node";
import { checkPassword, isAuthConfigured, signToken } from "./_lib/auth";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAuthConfigured()) {
    return res.status(503).json({
      error:
        "Auth is not configured on this deployment. Set ADMIN_PASSWORD_HASH and ADMIN_TOKEN_SECRET in your environment.",
    });
  }

  const body =
    typeof req.body === "string" ? safeJson(req.body) : (req.body ?? {});
  const password = (body as { password?: unknown })?.password;
  if (typeof password !== "string" || !password) {
    return res.status(400).json({ error: "Password is required." });
  }

  if (!checkPassword(password)) {
    return res.status(401).json({ error: "Incorrect password." });
  }

  try {
    const token = signToken();
    return res.status(200).json({ token });
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
