/**
 * Thin client for the content API (server/app.mjs).
 *
 * Every function distinguishes "server said no" from "no server reachable"
 * so the app can degrade gracefully to local-only mode (e.g. a static
 * deploy without the Node server).
 */

import type { SiteContent } from "./content";

export type PushResult = "ok" | "unauthorized" | "error" | "offline";

/** Who is signed in. The owner signs in with the env password; everyone
 *  else is a team admin the owner added (see api/login.ts). */
export type AdminUser = {
  id: string;
  username: string;
  name: string;
  role: "owner" | "admin";
};

export type ServerLoginResult =
  | { reachable: true; ok: true; token: string; user: AdminUser }
  | { reachable: true; ok: false; status: number; error: string }
  | { reachable: false };

/** Fired when the server refuses the stored session — expired, or the
 *  owner disabled, removed or reset this admin. The console listens and
 *  returns to the sign-in screen instead of failing every save quietly. */
export const AUTH_LOST_EVENT = "jvc:auth-lost";

export function clearStaleAdminAuth(): void {
  sessionStorage.removeItem("jvc_admin_auth_v1");
  sessionStorage.removeItem("jvc_admin_token_v1");
  sessionStorage.removeItem("jvc_admin_mode_v1");
  sessionStorage.removeItem("jvc_admin_expires_v1");
  sessionStorage.removeItem("jvc_admin_user_v1");
  window.dispatchEvent(new CustomEvent(AUTH_LOST_EVENT));
}

export async function serverLogin(
  password: string,
  username = "",
): Promise<ServerLoginResult> {
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, username }),
    });
    if (res.ok) {
      const { token, user } = (await res.json()) as {
        token: string;
        user?: AdminUser;
      };
      // A server from before team accounts answers with a bare token, and
      // only the owner could sign in to it.
      return {
        reachable: true,
        ok: true,
        token,
        user: user ?? { id: "owner", username: "owner", name: "Owner", role: "owner" },
      };
    }
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    return {
      reachable: true,
      ok: false,
      status: res.status,
      error: body?.error ?? "Login failed.",
    };
  } catch {
    return { reachable: false };
  }
}

/** Published content from the server, or null if none / no server. */
export async function fetchRemoteContent(): Promise<Partial<SiteContent> | null> {
  try {
    const res = await fetch("/api/content");
    if (!res.ok) return null;
    return (await res.json()) as Partial<SiteContent>;
  } catch {
    return null;
  }
}

/**
 * Publish content. With `sections`, the server takes only those keys from
 * the body and merges them into the published row, leaving every other
 * section as it is on the server — which may be newer than this copy.
 */
export async function pushContent(
  content: SiteContent,
  token: string,
  sections?: string[],
): Promise<PushResult> {
  const qs = sections?.length ? `?sections=${sections.map(encodeURIComponent).join(",")}` : "";
  try {
    const res = await fetch(`/api/content${qs}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(content),
    });
    if (res.ok) return "ok";
    if (res.status === 401) {
      clearStaleAdminAuth();
      return "unauthorized";
    }
    return "error";
  } catch {
    return "offline";
  }
}

export async function deleteRemoteContent(token: string): Promise<PushResult> {
  try {
    const res = await fetch("/api/content", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return "ok";
    if (res.status === 401) {
      clearStaleAdminAuth();
      return "unauthorized";
    }
    return "error";
  } catch {
    return "offline";
  }
}

export type ServerHealth = {
  ok: boolean;
  authConfigured: boolean;
  hasContent: boolean;
};

export async function fetchHealth(): Promise<ServerHealth | null> {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) return null;
    return (await res.json()) as ServerHealth;
  } catch {
    return null;
  }
}
