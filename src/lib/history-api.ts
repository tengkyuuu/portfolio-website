/**
 * Typed client for /api/versions + /api/activity. Discriminated unions so
 * the HistoryPanel can react to failure modes distinctly — same pattern
 * as inquiry-api.ts.
 */

import { getAdminToken } from "./auth";

export type VersionMeta = {
  id: string;
  created_at: string;
  sections: string[];
  byte_size: number | null;
};

export type ActivityRow = {
  id: string;
  action: string;
  detail: Record<string, unknown> | null;
  created_at: string;
};

type FailKind = "unauthorized" | "server" | "offline";

export type ListVersionsResult =
  | { ok: true; items: VersionMeta[] }
  | { ok: false; kind: FailKind; message?: string };

export type RestoreResult =
  | { ok: true }
  | { ok: false; kind: FailKind | "not_found"; message?: string };

export type ListActivityResult =
  | { ok: true; items: ActivityRow[] }
  | { ok: false; kind: FailKind; message?: string };

async function authedFetch(url: string, init?: RequestInit) {
  const token = getAdminToken();
  if (!token) return null;
  return fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function fetchVersions(): Promise<ListVersionsResult> {
  try {
    const res = await authedFetch("/api/versions");
    if (!res) return { ok: false, kind: "unauthorized" };
    if (res.status === 401) return { ok: false, kind: "unauthorized" };
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, kind: "server", message: body.error };
    }
    const data = (await res.json()) as { items: VersionMeta[] };
    return { ok: true, items: data.items };
  } catch {
    return { ok: false, kind: "offline" };
  }
}

export async function restoreVersion(id: string): Promise<RestoreResult> {
  try {
    const res = await authedFetch(
      `/api/versions?id=${encodeURIComponent(id)}`,
      { method: "POST" }
    );
    if (!res) return { ok: false, kind: "unauthorized" };
    if (res.status === 401) return { ok: false, kind: "unauthorized" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, kind: "server", message: body.error };
    }
    return { ok: true };
  } catch {
    return { ok: false, kind: "offline" };
  }
}

export async function fetchActivity(): Promise<ListActivityResult> {
  try {
    const res = await authedFetch("/api/activity");
    if (!res) return { ok: false, kind: "unauthorized" };
    if (res.status === 401) return { ok: false, kind: "unauthorized" };
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, kind: "server", message: body.error };
    }
    const data = (await res.json()) as { items: ActivityRow[] };
    return { ok: true, items: data.items };
  } catch {
    return { ok: false, kind: "offline" };
  }
}
