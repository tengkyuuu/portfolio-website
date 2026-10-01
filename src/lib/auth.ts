/**
 * Admin auth.
 *
 * Primary path: POST /api/login — the server verifies the password against
 * ADMIN_PASSWORD_HASH (never shipped to the client) and issues a bearer
 * token used for content writes.
 *
 * Sign-in requires the API; unavailable verification never grants a session.
 */

import { serverLogin, type AdminUser } from "./api";

export type { AdminUser };

const AUTH_KEY = "jvc_admin_auth_v1";
const TOKEN_KEY = "jvc_admin_token_v1";
const MODE_KEY = "jvc_admin_mode_v1";
const EXPIRES_KEY = "jvc_admin_expires_v1";
const USER_KEY = "jvc_admin_user_v1";
const CLIENT_TTL_MS = 4 * 60 * 60 * 1000;

const OWNER: AdminUser = { id: "owner", username: "owner", name: "Owner", role: "owner" };

export type AuthMode = "server" | "local";

export type LoginResult =
  { ok: true; mode: AuthMode } | { ok: false; error: string };

export async function login(password: string, username = ""): Promise<LoginResult> {
  if (!password) return { ok: false, error: "Enter your password." };
  const name = username.trim().toLowerCase();

  const result = await serverLogin(password, name);

  // A real server accepted the password.
  if (result.reachable && result.ok) {
    establishSession(result.token, result.user);
    return { ok: true, mode: "server" };
  }

  // A real API explicitly rejected the sign-in — trust it, no fallback.
  // 403 is a disabled team account; 429 is the rate limit.
  if (
    result.reachable &&
    !result.ok &&
    (result.status === 401 || result.status === 403 || result.status === 429)
  ) {
    return { ok: false, error: result.error || "Incorrect password." };
  }

  return {
    ok: false,
    error: result.reachable ? result.error : "The sign-in server is unavailable. Please try again later.",
  };
}

export function getAdminToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

/** Signs a session in as a real admin — used both by a normal password
 *  sign-in and by redeeming an invite link, which ends the same way. */
export function establishSession(token: string, user: AdminUser): void {
  sessionStorage.setItem(AUTH_KEY, "1");
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(MODE_KEY, "server");
  sessionStorage.setItem(EXPIRES_KEY, String(Date.now() + CLIENT_TTL_MS));
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

/** Replace the stored token — after changing your own password, the
 *  server refuses every older token, this session's included. */
export function setAdminToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(EXPIRES_KEY, String(Date.now() + CLIENT_TTL_MS));
}

/** The signed-in user. A session from before team accounts has no record
 *  and was necessarily the owner's. */
export function getAdminUser(): AdminUser {
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<AdminUser>) : null;
    if (parsed?.id && parsed.name && (parsed.role === "owner" || parsed.role === "admin")) {
      return {
        id: parsed.id,
        username: parsed.username ?? "",
        name: parsed.name,
        role: parsed.role,
      };
    }
  } catch {
    /* fall through */
  }
  return OWNER;
}

export function setAdminUser(user: AdminUser): void {
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getAuthMode(): AuthMode | null {
  return sessionStorage.getItem(MODE_KEY) as AuthMode | null;
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function getExpectedHash(): string | undefined {
  // Password verification belongs to the API. Never compile even a hash
  // of an admin password into a downloadable browser bundle.
  return undefined;
}

/** Constant-time string compare for hex strings of equal length. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function checkPassword(input: string): Promise<boolean> {
  const expected = getExpectedHash();
  if (!expected) return false;
  const hash = await sha256Hex(input);
  return constantTimeEqual(hash, expected.toLowerCase());
}

export function isAdminAuthed(): boolean {
  if (sessionStorage.getItem(AUTH_KEY) !== "1") return false;
  const expires = Number(sessionStorage.getItem(EXPIRES_KEY));
  if (!Number.isFinite(expires) || expires <= Date.now()) {
    clearAdminAuth();
    return false;
  }
  return true;
}

export function setAdminAuthed(): void {
  sessionStorage.setItem(AUTH_KEY, "1");
  sessionStorage.setItem(EXPIRES_KEY, String(Date.now() + CLIENT_TTL_MS));
}

export function clearAdminAuth(): void {
  sessionStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(MODE_KEY);
  sessionStorage.removeItem(EXPIRES_KEY);
  sessionStorage.removeItem(USER_KEY);
}
