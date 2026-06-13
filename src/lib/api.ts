/**
 * Thin client for the content API (server/app.mjs).
 *
 * Every function distinguishes "server said no" from "no server reachable"
 * so the app can degrade gracefully to local-only mode (e.g. a static
 * deploy without the Node server).
 */

import type { SiteContent } from "./content";

export type PushResult = "ok" | "unauthorized" | "error" | "offline";

export type ServerLoginResult =
  | { reachable: true; ok: true; token: string }
  | { reachable: true; ok: false; status: number; error: string }
  | { reachable: false };

export async function serverLogin(password: string): Promise<ServerLoginResult> {
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      const { token } = (await res.json()) as { token: string };
      return { reachable: true, ok: true, token };
    }
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
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

export async function pushContent(
  content: SiteContent,
  token: string
): Promise<PushResult> {
  try {
    const res = await fetch("/api/content", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(content),
    });
    if (res.ok) return "ok";
    if (res.status === 401) return "unauthorized";
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
    if (res.status === 401) return "unauthorized";
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
