/**
 * Admin auth.
 *
 * Primary path: POST /api/login — the server verifies the password against
 * ADMIN_PASSWORD_HASH (never shipped to the client) and issues a bearer
 * token used for content writes.
 *
 * Fallback path (no server reachable, e.g. a static deploy): the legacy
 * client-side check against the SHA-256 digest in `VITE_ADMIN_PASSWORD_HASH`.
 * In that mode edits persist to localStorage only — visitors won't see them.
 */

import { serverLogin } from "./api";

const AUTH_KEY = "jvc_admin_auth_v1";
const TOKEN_KEY = "jvc_admin_token_v1";
const MODE_KEY = "jvc_admin_mode_v1";

export type AuthMode = "server" | "local";

export type LoginResult =
  | { ok: true; mode: AuthMode }
  | { ok: false; error: string };

export async function login(password: string): Promise<LoginResult> {
  const result = await serverLogin(password);

  if (result.reachable) {
    if (result.ok) {
      sessionStorage.setItem(AUTH_KEY, "1");
      sessionStorage.setItem(TOKEN_KEY, result.token);
      sessionStorage.setItem(MODE_KEY, "server");
      return { ok: true, mode: "server" };
    }
    return { ok: false, error: result.error };
  }

  // No server — legacy local-only mode
  const ok = await checkPassword(password);
  if (!ok) return { ok: false, error: "Incorrect password." };
  sessionStorage.setItem(AUTH_KEY, "1");
  sessionStorage.setItem(MODE_KEY, "local");
  return { ok: true, mode: "local" };
}

export function getAdminToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
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
  const raw = import.meta.env.VITE_ADMIN_PASSWORD_HASH as string | undefined;
  return raw?.trim().toLowerCase() || undefined;
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
  return sessionStorage.getItem(AUTH_KEY) === "1";
}

export function setAdminAuthed(): void {
  sessionStorage.setItem(AUTH_KEY, "1");
}

export function clearAdminAuth(): void {
  sessionStorage.removeItem(AUTH_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(MODE_KEY);
}
