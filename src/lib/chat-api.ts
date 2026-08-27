/**
 * Client for the live-chat half of /api/chat.
 *
 * Two audiences share this module: the visitor's Assistant widget (public
 * calls, authenticated only by possession of the session uuid) and the admin
 * Chat panel (bearer token). Results are discriminated unions rather than
 * throws, matching inquiry-api.ts, so callers can distinguish offline from
 * unauthorized from a real server fault.
 */

import { getAdminToken } from "./auth";

export type ChatRole = "visitor" | "ai" | "human";
export type ChatMode = "ai" | "human";

export type ChatMessage = {
  id: number;
  session_id: string;
  role: ChatRole;
  body: string;
  created_at: string;
};

export type ChatSessionSummary = {
  id: string;
  mode: ChatMode;
  created_at: string;
  last_message_at: string;
  unread: number;
  lastRole: ChatRole | null;
  preview: string;
};

const SESSION_KEY = "jvc_chat_session_v1";

/** uuid v4. randomUUID needs a secure context, so keep a getRandomValues
 *  path for plain-http previews and older browsers. */
function mintSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
  const hex = [...b].map((n) => n.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

/**
 * The visitor's stable conversation id, minted on first use.
 *
 * Kept in localStorage so a reload rejoins the same conversation and James's
 * reply is still reachable. Falls back to a per-tab id when storage is
 * unavailable (private mode, storage disabled) — the chat still works, it
 * just won't survive a refresh.
 */
let cachedSessionId: string | null = null;

export function getChatSessionId(): string {
  if (cachedSessionId) return cachedSessionId;
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) {
      cachedSessionId = existing;
      return existing;
    }
    const next = mintSessionId();
    localStorage.setItem(SESSION_KEY, next);
    cachedSessionId = next;
    return next;
  } catch {
    // Storage is unavailable — hold the id in memory instead, or every call
    // would mint a new one and the poll would never find the conversation.
    cachedSessionId = mintSessionId();
    return cachedSessionId;
  }
}

/* ------------------------------ visitor side ----------------------------- */

export type PollResult =
  | { ok: true; mode: ChatMode; messages: ChatMessage[] }
  | { ok: false };

/**
 * Fetch anything added to this conversation since `after`.
 *
 * Omit `after` to pull the whole transcript — that is how the widget restores
 * history after a reload.
 */
export async function pollChatSession(
  sessionId: string,
  after?: string | null
): Promise<PollResult> {
  try {
    const qs = new URLSearchParams({ session: sessionId });
    if (after) qs.set("after", after);
    const res = await fetch(`/api/chat?${qs.toString()}`);
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { mode?: ChatMode; messages?: ChatMessage[] };
    return {
      ok: true,
      mode: data.mode === "human" ? "human" : "ai",
      messages: Array.isArray(data.messages) ? data.messages : [],
    };
  } catch {
    return { ok: false };
  }
}

/* ------------------------------- admin side ------------------------------ */

export type SessionListResult =
  | { ok: true; sessions: ChatSessionSummary[]; waitingCount: number }
  | { ok: false; kind: "unauthorized" | "server" | "offline"; message?: string };

export async function fetchChatSessions(): Promise<SessionListResult> {
  const token = getAdminToken();
  if (!token) return { ok: false, kind: "unauthorized" };
  try {
    const res = await fetch("/api/chat?sessions=1", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return { ok: false, kind: "unauthorized" };
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, kind: "server", message: body.error };
    }
    const data = (await res.json()) as {
      sessions: ChatSessionSummary[];
      waitingCount: number;
    };
    return { ok: true, sessions: data.sessions ?? [], waitingCount: data.waitingCount ?? 0 };
  } catch {
    return { ok: false, kind: "offline" };
  }
}

export type TranscriptResult =
  | { ok: true; mode: ChatMode; messages: ChatMessage[] }
  | { ok: false; kind: "unauthorized" | "server" | "offline"; message?: string };

/** Reading a transcript as admin also marks the session read. */
export async function fetchTranscript(sessionId: string): Promise<TranscriptResult> {
  const token = getAdminToken();
  if (!token) return { ok: false, kind: "unauthorized" };
  try {
    const res = await fetch(
      `/api/chat?session=${encodeURIComponent(sessionId)}&admin=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.status === 401) return { ok: false, kind: "unauthorized" };
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, kind: "server", message: body.error };
    }
    const data = (await res.json()) as { mode?: ChatMode; messages?: ChatMessage[] };
    return {
      ok: true,
      mode: data.mode === "human" ? "human" : "ai",
      messages: data.messages ?? [],
    };
  } catch {
    return { ok: false, kind: "offline" };
  }
}

export type ReplyResult =
  | { ok: true; message: ChatMessage }
  | { ok: false; kind: "unauthorized" | "not_found" | "server" | "offline"; message?: string };

export async function sendAdminReply(
  sessionId: string,
  text: string
): Promise<ReplyResult> {
  const token = getAdminToken();
  if (!token) return { ok: false, kind: "unauthorized" };
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "reply", sessionId, text }),
    });
    if (res.status === 401) return { ok: false, kind: "unauthorized" };
    if (res.status === 404) return { ok: false, kind: "not_found" };
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, kind: "server", message: body.error };
    }
    const data = (await res.json()) as { message: ChatMessage };
    return { ok: true, message: data.message };
  } catch {
    return { ok: false, kind: "offline" };
  }
}

/** Hand a taken-over session back to the assistant. */
export async function handBackToAI(
  sessionId: string
): Promise<{ ok: boolean; message?: string }> {
  const token = getAdminToken();
  if (!token) return { ok: false, message: "Not signed in." };
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "handback", sessionId }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, message: body.error ?? `Failed (${res.status}).` };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "Offline." };
  }
}
