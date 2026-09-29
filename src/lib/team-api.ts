/**
 * Typed client for team accounts — the ?op= routes on /api/login.
 *
 * Every call returns a discriminated union rather than throwing, like the
 * inquiry client: the Team panel shows a different thing for "not set up"
 * (migration 006 not run), "not allowed" and "server said no", and a
 * refused session is handed to clearStaleAdminAuth so the console drops
 * back to the sign-in screen.
 */

import { clearStaleAdminAuth, type AdminUser } from "./api";
import { getAdminToken } from "./auth";

export type TeamMember = {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  disabled: boolean;
  created_at: string;
  /** Non-null while the invite hasn't been redeemed — may be in the past. */
  invite_expires_at: string | null;
  last_login_at: string | null;
};

export type TeamResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: "unauthorized" | "forbidden" | "setup" | "server" | "offline"; message: string };

async function request<T>(
  method: string,
  op: string,
  init: { body?: unknown; query?: Record<string, string> } = {}
): Promise<TeamResult<T>> {
  const token = getAdminToken();
  if (!token) {
    return { ok: false, kind: "unauthorized", message: "Sign in again to continue." };
  }
  const qs = new URLSearchParams({ op, ...init.query }).toString();
  try {
    const res = await fetch(`/api/login?${qs}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (res.ok) return { ok: true, data: body as T };
    const message = body?.error ?? `Request failed (${res.status}).`;
    // A 401 on /api/login?op=password means the *current password* was
    // wrong, not that the session died; every other op's 401 is the session.
    if (res.status === 401 && op !== "password") {
      clearStaleAdminAuth();
      return { ok: false, kind: "unauthorized", message };
    }
    if (res.status === 403) return { ok: false, kind: "forbidden", message };
    if (res.status === 503) return { ok: false, kind: "setup", message };
    return { ok: false, kind: "server", message };
  } catch {
    return { ok: false, kind: "offline", message: "No connection to the server." };
  }
}

export function fetchMe() {
  return request<{ user: AdminUser }>("GET", "me");
}

export function listTeam() {
  return request<{ items: TeamMember[] }>("GET", "team");
}

export type InviteResult = TeamMember & { inviteLink: string; emailSent: boolean };

export function addTeamMember(input: { username: string; name: string; email: string }) {
  return request<InviteResult>("POST", "team", { body: input });
}

export function updateTeamMember(
  id: string,
  patch: { name?: string; disabled?: boolean; password?: string; resendInvite?: true }
) {
  return request<TeamMember & { inviteLink?: string; emailSent?: boolean }>("PATCH", "team", {
    body: { id, ...patch },
  });
}

export function removeTeamMember(id: string) {
  return request<{ ok: true }>("DELETE", "team", { query: { id } });
}

export function changeOwnPassword(current: string, next: string) {
  return request<{ token: string }>("POST", "password", { body: { current, next } });
}

/* ---------------- accept invite (no session yet) ---------------- */

export type InviteCheck =
  | { ok: true; name: string; username: string }
  | { ok: false; message: string };

/** Validate an invite link, before showing the "set your password" form. */
export async function checkInvite(token: string): Promise<InviteCheck> {
  try {
    const res = await fetch(`/api/login?op=invite&token=${encodeURIComponent(token)}`);
    const body = (await res.json().catch(() => null)) as
      | { name?: string; username?: string; error?: string }
      | null;
    if (res.ok && body?.name && body.username) {
      return { ok: true, name: body.name, username: body.username };
    }
    return { ok: false, message: body?.error ?? `Request failed (${res.status}).` };
  } catch {
    return { ok: false, message: "No connection to the server." };
  }
}

export type AcceptInviteResult =
  | { ok: true; token: string; user: AdminUser }
  | { ok: false; message: string };

/** Redeems the invite exactly once and signs the new admin straight in. */
export async function acceptInvite(token: string, password: string): Promise<AcceptInviteResult> {
  try {
    const res = await fetch("/api/login?op=invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const body = (await res.json().catch(() => null)) as
      | { token?: string; user?: AdminUser; error?: string }
      | null;
    if (res.ok && body?.token && body.user) {
      return { ok: true, token: body.token, user: body.user };
    }
    return { ok: false, message: body?.error ?? `Request failed (${res.status}).` };
  } catch {
    return { ok: false, message: "No connection to the server." };
  }
}

/** A readable one-time password for a new admin: 4 groups of 4 from an
 *  alphabet without look-alikes (no 0/O, 1/l/I), ~90 bits of entropy. */
export function generatePassword(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-");
}
