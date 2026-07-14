import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "node:crypto";

/**
 * POST /api/login — verify password against ADMIN_PASSWORD_HASH,
 * return a 12h HMAC-signed bearer token.
 *
 * Self-contained. No imports from api/_lib/* — Vercel's dependency
 * tracer wasn't reliably bundling that folder in production, so each
 * function keeps its own copy of the small auth helpers.
 */

const TOKEN_TTL_SECONDS = 12 * 60 * 60;

function sha256Hex(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function checkPassword(plain: string): boolean {
  const expected = (
    process.env.ADMIN_PASSWORD_HASH ??
    process.env.VITE_ADMIN_PASSWORD_HASH ??
    ""
  )
    .trim()
    .toLowerCase();
  if (!expected) return false;
  const got = sha256Hex(plain).toLowerCase();
  const a = new Uint8Array(Buffer.from(got, "hex"));
  const b = new Uint8Array(Buffer.from(expected, "hex"));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function signToken(): string {
  const secret = process.env.ADMIN_TOKEN_SECRET;
  if (!secret) throw new Error("ADMIN_TOKEN_SECRET is not set.");
  const payload = { exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

function isAuthConfigured(): boolean {
  return Boolean(
    (process.env.ADMIN_PASSWORD_HASH ?? process.env.VITE_ADMIN_PASSWORD_HASH) &&
      process.env.ADMIN_TOKEN_SECRET
  );
}

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

  const body = typeof req.body === "string" ? safeJson(req.body) : (req.body ?? {});
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
