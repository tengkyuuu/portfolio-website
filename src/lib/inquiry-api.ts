/**
 * Thin, typed client for the inquiries endpoints.
 *
 * Each call returns a discriminated union so callers can react to failure
 * modes distinctly (validation vs rate-limit vs server error vs offline)
 * — that's the QA payoff for encoding these instead of throwing.
 */

import { getAdminToken } from "./auth";

export type InquiryStatus = "unread" | "read" | "archived";

export type Inquiry = {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: InquiryStatus;
  created_at: string;
  read_at: string | null;
  archived_at: string | null;
};

export type SubmitInquiryInput = {
  name: string;
  email: string;
  subject: string;
  message: string;
  /** Hidden honeypot field — must be empty for real users. */
  website?: string;
};

export type SubmitInquiryResult =
  | { ok: true }
  | { ok: false; kind: "validation"; errors: { field: string; message: string }[] }
  | { ok: false; kind: "rate_limit"; message: string }
  | { ok: false; kind: "server"; message: string }
  | { ok: false; kind: "offline" };

export async function submitInquiry(
  input: SubmitInquiryInput
): Promise<SubmitInquiryResult> {
  try {
    const res = await fetch("/api/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (res.status === 201 || res.status === 202) return { ok: true };

    // Try JSON first; if the response was HTML (Vercel default 500 page,
    // SPA fallback, etc.), fall through to a text peek so the user sees
    // *something* concrete instead of "Request failed (500)".
    const raw = await res.text();
    let body: { error?: string; details?: { field: string; message: string }[] } = {};
    try {
      body = raw ? (JSON.parse(raw) as typeof body) : {};
    } catch {
      /* raw isn't JSON — peek it below */
    }

    if (res.status === 400 && body.details) {
      return { ok: false, kind: "validation", errors: body.details };
    }
    if (res.status === 429) {
      return {
        ok: false,
        kind: "rate_limit",
        message: body.error ?? "Too many messages from this address.",
      };
    }
    return {
      ok: false,
      kind: "server",
      message:
        body.error ??
        (raw ? textPeek(raw, res.status) : `Request failed (${res.status}).`),
    };
  } catch {
    return { ok: false, kind: "offline" };
  }
}

/** Turn a non-JSON error body into something a human can read + act on. */
function textPeek(text: string, status: number): string {
  const stripped = text
    .replace(/<[^>]+>/g, " ") // drop tags
    .replace(/\s+/g, " ")
    .trim();
  const excerpt = stripped.slice(0, 180);
  return excerpt
    ? `Server returned ${status}: ${excerpt}${stripped.length > 180 ? "…" : ""}`
    : `Server returned ${status} with no body.`;
}

/* ---------------- admin-only calls ---------------- */

export type ListResult =
  | { ok: true; items: Inquiry[]; unreadCount: number }
  | { ok: false; kind: "unauthorized" | "server" | "offline"; message?: string };

export async function fetchInquiries(
  status: InquiryStatus | "all" = "all"
): Promise<ListResult> {
  const token = getAdminToken();
  if (!token) return { ok: false, kind: "unauthorized" };
  try {
    const res = await fetch(`/api/inquiries?status=${encodeURIComponent(status)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return { ok: false, kind: "unauthorized" };
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, kind: "server", message: body.error };
    }
    const data = (await res.json()) as { items: Inquiry[]; unreadCount: number };
    return { ok: true, items: data.items, unreadCount: data.unreadCount };
  } catch {
    return { ok: false, kind: "offline" };
  }
}

export type MutateResult =
  | { ok: true; inquiry?: Inquiry }
  | { ok: false; kind: "unauthorized" | "not_found" | "server" | "offline"; message?: string };

export async function updateInquiry(
  id: string,
  status: InquiryStatus
): Promise<MutateResult> {
  const token = getAdminToken();
  if (!token) return { ok: false, kind: "unauthorized" };
  try {
    const res = await fetch(
      `/api/inquiries?id=${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      }
    );
    if (res.status === 401) return { ok: false, kind: "unauthorized" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, kind: "server", message: body.error };
    }
    const inquiry = (await res.json()) as Inquiry;
    return { ok: true, inquiry };
  } catch {
    return { ok: false, kind: "offline" };
  }
}

export async function deleteInquiry(id: string): Promise<MutateResult> {
  const token = getAdminToken();
  if (!token) return { ok: false, kind: "unauthorized" };
  try {
    const res = await fetch(
      `/api/inquiries?id=${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
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
