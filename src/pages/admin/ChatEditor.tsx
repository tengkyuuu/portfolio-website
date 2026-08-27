import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchChatSessions,
  fetchTranscript,
  handBackToAI,
  sendAdminReply,
  type ChatMessage,
  type ChatSessionSummary,
} from "../../lib/chat-api";
import { requestChatNotifications } from "./AdminLayout";
import { Button, Card, Textarea } from "./ui";

/**
 * Chat — read what visitors asked the Office Assistant, and answer them
 * yourself.
 *
 * Two panes: sessions on the left (newest activity first, unread badged),
 * transcript plus a reply box on the right. Both poll, because Vercel
 * Functions can't hold a socket open — the interval is the whole realtime
 * story here, and it's deliberately slower when the tab is hidden.
 *
 * Sending a reply flips the session to mode='human' server-side, which stops
 * the model answering it. The "Hand back to the assistant" button is the only
 * way out of that, so it stays visible on every taken-over session.
 */

const SESSIONS_POLL_MS = 15_000;
const TRANSCRIPT_POLL_MS = 8_000;

export function ChatEditor() {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mode, setMode] = useState<"ai" | "human">("ai");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [alertsState, setAlertsState] = useState<NotificationPermission | "unsupported">(
    () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission)
  );
  const transcriptRef = useRef<HTMLDivElement>(null);

  const loadSessions = useCallback(async () => {
    const result = await fetchChatSessions();
    if (!result.ok) {
      setLoadError(
        result.kind === "unauthorized"
          ? "Session expired — sign in again."
          : result.kind === "offline"
            ? "Offline — can't reach the server."
            : (result.message ?? "Couldn't load conversations.")
      );
      setLoadedOnce(true);
      return;
    }
    setLoadError(null);
    setSessions(result.sessions);
    setLoadedOnce(true);
  }, []);

  const loadTranscript = useCallback(async (id: string) => {
    const result = await fetchTranscript(id);
    if (!result.ok) return;
    setMessages(result.messages);
    setMode(result.mode);
  }, []);

  // Session list poll.
  useEffect(() => {
    void loadSessions();
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadSessions();
    }, SESSIONS_POLL_MS);
    return () => window.clearInterval(t);
  }, [loadSessions]);

  // Transcript poll for whichever session is open.
  useEffect(() => {
    if (!selected) return;
    void loadTranscript(selected);
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadTranscript(selected);
    }, TRANSCRIPT_POLL_MS);
    return () => window.clearInterval(t);
  }, [selected, loadTranscript]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function submitReply() {
    const text = draft.trim();
    if (!text || !selected || sending) return;
    setSending(true);
    setReplyError(null);
    const result = await sendAdminReply(selected, text);
    setSending(false);
    if (!result.ok) {
      setReplyError(
        result.kind === "unauthorized"
          ? "Session expired — sign in again."
          : result.kind === "not_found"
            ? "That conversation no longer exists."
            : result.kind === "offline"
              ? "Offline — your reply wasn't sent."
              : (result.message ?? "Couldn't send the reply.")
      );
      return;
    }
    setDraft("");
    setMessages((prev) => [...prev, result.message]);
    setMode("human");
    void loadSessions();
  }

  async function giveBackToAI() {
    if (!selected) return;
    const result = await handBackToAI(selected);
    if (!result.ok) {
      setReplyError(result.message ?? "Couldn't hand the session back.");
      return;
    }
    setMode("ai");
    void loadSessions();
  }

  const waiting = sessions.filter((s) => s.unread > 0).length;

  return (
    <Card
      title="Chat"
      description={
        loadedOnce && sessions.length > 0
          ? `${sessions.length} conversation${sessions.length === 1 ? "" : "s"}${
              waiting > 0 ? ` · ${waiting} waiting on you` : ""
            }`
          : "Conversations visitors had with the Office Assistant."
      }
      actions={
        <div className="flex items-center gap-1.5">
          {alertsState === "default" && (
            <Button
              variant="secondary"
              icon="notifications"
              onClick={() => {
                void requestChatNotifications().then(() => {
                  if (typeof Notification !== "undefined") {
                    setAlertsState(Notification.permission);
                  }
                });
              }}
            >
              Enable alerts
            </Button>
          )}
          <Button variant="ghost" icon="refresh" onClick={() => void loadSessions()}>
            Refresh
          </Button>
        </div>
      }
    >
      {loadError && (
        <div
          role="alert"
          className="mb-3 border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 rounded-sm px-3 py-2 font-ui text-[12px] text-red-700 dark:text-red-300"
        >
          {loadError}
        </div>
      )}

      {loadedOnce && sessions.length === 0 && !loadError ? (
        <p className="font-ui text-[13px] text-ink-subtle italic">
          No conversations yet. When someone talks to the Office Assistant, the
          thread shows up here and you can answer it yourself.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)] gap-4">
          {/* Session list */}
          <ul className="space-y-1.5 lg:max-h-[520px] lg:overflow-y-auto lg:pr-1">
            {sessions.map((s) => {
              const isActive = s.id === selected;
              return (
                <li key={s.id}>
                  <button
                    onClick={() => setSelected(s.id)}
                    className={
                      "w-full text-left border rounded-sm px-2.5 py-2 transition-colors " +
                      (isActive
                        ? "border-word-blue bg-word-blue-light"
                        : "border-rule bg-paper hover:bg-ribbon-hover")
                    }
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="font-ui text-[11px] font-semibold text-ink tabular-nums">
                        #{s.id.slice(0, 8)}
                      </span>
                      {s.mode === "human" && (
                        <span className="font-ui text-[9px] font-bold uppercase tracking-wider text-word-blue border border-word-blue/40 rounded-sm px-1">
                          You
                        </span>
                      )}
                      <span className="flex-1" />
                      {s.unread > 0 && (
                        <span className="grid place-items-center min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white font-ui text-[9px] font-bold tabular-nums">
                          {s.unread}
                        </span>
                      )}
                    </div>
                    <p className="font-ui text-[11px] text-ink-muted line-clamp-2 leading-snug">
                      {s.lastRole === "visitor" ? "" : "↩ "}
                      {s.preview || "…"}
                    </p>
                    <p className="font-ui text-[10px] text-ink-subtle mt-0.5">
                      {relativeTime(s.last_message_at)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Transcript + reply */}
          <div className="border border-rule rounded-sm bg-row-alt flex flex-col min-h-[320px]">
            {!selected ? (
              <p className="m-auto font-ui text-[12px] text-ink-subtle italic px-4 text-center">
                Pick a conversation to read it and reply.
              </p>
            ) : (
              <>
                <div className="flex items-center gap-2 border-b border-rule px-3 py-2">
                  <span className="font-ui text-[11px] font-semibold text-ink">
                    #{selected.slice(0, 8)}
                  </span>
                  <span className="font-ui text-[10px] text-ink-subtle">
                    {mode === "human"
                      ? "You're answering this one"
                      : "The assistant is answering"}
                  </span>
                  <span className="flex-1" />
                  {mode === "human" && (
                    <Button variant="ghost" icon="smart_toy" onClick={() => void giveBackToAI()}>
                      Hand back to the assistant
                    </Button>
                  )}
                </div>

                <div
                  ref={transcriptRef}
                  className="flex-1 overflow-y-auto px-3 py-3 space-y-2 max-h-[380px]"
                >
                  {messages.length === 0 ? (
                    <p className="font-ui text-[12px] text-ink-subtle italic">
                      Nothing in this conversation yet.
                    </p>
                  ) : (
                    messages.map((m) => <Bubble key={m.id} message={m} />)
                  )}
                </div>

                <div className="border-t border-rule p-2 space-y-1.5">
                  {replyError && (
                    <div
                      role="alert"
                      className="font-ui text-[11px] text-red-700 dark:text-red-300"
                    >
                      {replyError}
                    </div>
                  )}
                  <Textarea
                    value={draft}
                    onChange={setDraft}
                    rows={3}
                    placeholder="Reply as yourself — this stops the assistant answering this conversation."
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-ui text-[10px] text-ink-subtle">
                      {draft.length > 0 ? `${draft.length} characters` : "Visible to the visitor"}
                    </span>
                    <Button
                      variant="primary"
                      icon="send"
                      onClick={() => void submitReply()}
                      disabled={sending || draft.trim().length === 0}
                    >
                      {sending ? "Sending…" : "Send reply"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  if (message.role === "visitor") {
    return (
      <div className="flex items-start gap-2 max-w-[92%]">
        <span
          aria-hidden="true"
          className="grid place-items-center w-6 h-6 rounded-full bg-ribbon border border-rule text-[11px] shrink-0 mt-0.5"
        >
          👤
        </span>
        <div className="bg-paper border border-rule rounded-sm rounded-tl-none px-3 py-2 font-ui text-[12px] leading-relaxed text-ink whitespace-pre-wrap">
          {message.body}
        </div>
      </div>
    );
  }
  const mine = message.role === "human";
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%]">
        <div
          className={
            "font-ui text-[9px] font-bold uppercase tracking-wider mb-0.5 text-right " +
            (mine ? "text-word-blue" : "text-ink-subtle")
          }
        >
          {mine ? "You" : "📎 Assistant"}
        </div>
        <div
          className={
            "rounded-sm rounded-tr-none px-3 py-2 font-ui text-[12px] leading-relaxed whitespace-pre-wrap " +
            (mine
              ? "bg-word-blue text-white"
              : "bg-paper border border-rule text-ink-muted")
          }
        >
          {message.body}
        </div>
      </div>
    </div>
  );
}

/** Compact "2m ago" style stamp; falls back to a date past a week. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days <= 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
