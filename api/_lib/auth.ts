import crypto from "node:crypto";

const TOKEN_TTL_SECONDS = 12 * 60 * 60; // 12h

/** SHA-256 hex digest of `text`. */
export function sha256Hex(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

/** True if `plain`'s SHA-256 matches the deployment's configured hash. */
export function checkPassword(plain: string): boolean {
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

/** Issue a stateless bearer token: base64url(payload) + "." + HMAC. */
export function signToken(): string {
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

/** Verify a bearer token's signature and expiry. */
export function verifyToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const secret = process.env.ADMIN_TOKEN_SECRET;
  if (!secret) return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("base64url");
  const a = new Uint8Array(Buffer.from(sig));
  const b = new Uint8Array(Buffer.from(expected));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as { exp: number };
    return payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function extractBearer(
  authHeader: string | string[] | undefined
): string | null {
  const h = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export function isAuthConfigured(): boolean {
  return Boolean(
    (process.env.ADMIN_PASSWORD_HASH ?? process.env.VITE_ADMIN_PASSWORD_HASH) &&
      process.env.ADMIN_TOKEN_SECRET
  );
}
