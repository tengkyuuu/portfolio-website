import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getChatSessionId,
  pollChatSession,
  type ChatMessage,
  type ChatMode,
} from "../lib/chat-api";

/**
 * Office Assistant — the Clippy homage. 📎
 *
 * Floating paperclip button (bottom-right, above the status bar) that opens a
 * Word-styled chat panel. Answers come from /api/chat, which grounds a small
 * model in the published site content.
 *
 * The button renders ONLY after GET /api/chat confirms the server has an API
 * key — an unconfigured deployment shows nothing at all.
 *
 * Two things James can do that the model can't: read the conversation, and
 * answer it himself. When he replies, the session flips to mode='human' and
 * the model goes quiet; this widget then polls for his messages and says so
 * plainly, because a visitor waiting on a person should know they're waiting
 * on a person.
 *
 * Persisted messages are keyed by their server id and held in one map, so the
 * poll is idempotent — re-fetching an overlapping window can't duplicate a
 * bubble. The only locally-owned message is the in-flight question, tracked
 * separately as `pending` and dropped once the server echoes it back.
 */

type Persisted = ChatMessage;

const GREETING =
  "Hi! 📎 It looks like you're browsing a portfolio. I can answer questions about James — his projects, skills, experience, or how to reach him. What would you like to know?";

const STARTERS = [
  "What projects has James built?",
  "What's his tech stack?",
  "Is he available for work?",
  "How do I contact him?",
];

/** Fast enough to feel live while the panel is open. */
const POLL_OPEN_MS = 6_000;
/** Slow background check so a reply still lights the button up. */
const POLL_CLOSED_MS = 25_000;

export function Assistant() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [byId, setById] = useState<Map<number, Persisted>>(() => new Map());
  const [mode, setMode] = useState<ChatMode>("ai");
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unseen, setUnseen] = useState(0);

  /**
   * Exchanges the server never confirmed.
   *
   * The transcript is normally server-owned, which is what makes polling
   * idempotent — but that also means a storage outage would blank the
   * conversation the visitor is looking at. When a POST succeeds and the
   * follow-up poll returns nothing, the write didn't land: keep the
   * exchange here so the panel still reads like a conversation. These have
   * no server id and are never merged into `byId`.
   */
  const [localOnly, setLocalOnly] = useState<{ role: "visitor" | "ai"; body: string }[]>(
    []
  );

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Newest created_at already merged — the poll's `after` cursor. */
  const cursorRef = useRef<string | null>(null);
  /** Mirror of the keys in `byId`, so a merge can count what's genuinely new
   *  without reading through stale state. */
  const idsRef = useRef<Set<number>>(new Set());
  /** Highest id the visitor has actually looked at, for the button badge. */
  const seenIdRef = useRef<number>(0);
  const sessionId = useMemo(() => getChatSessionId(), []);

  const messages = useMemo(
    () => [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [byId]
  );

  // Probe configuration once.
  useEffect(() => {
    let alive = true;
    fetch("/api/chat")
      .then((r) => (r.ok ? r.json() : { configured: false }))
      .then((d: { configured?: boolean }) => {
        if (alive) setConfigured(Boolean(d.configured));
      })
      .catch(() => {
        if (alive) setConfigured(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  /** Merge a poll result. Safe to call with overlapping windows. Returns how
   *  many messages were genuinely new. */
  const merge = useCallback((incoming: Persisted[], nextMode: ChatMode): number => {
    setMode(nextMode);
    if (incoming.length === 0) return 0;
    const fresh = incoming.filter((m) => !idsRef.current.has(m.id));
    if (fresh.length === 0) return 0;
    for (const m of fresh) idsRef.current.add(m.id);
    setById((prev) => {
      const next = new Map(prev);
      for (const m of fresh) next.set(m.id, m);
      return next;
    });
    for (const m of fresh) {
      if (!cursorRef.current || m.created_at > cursorRef.current) {
        cursorRef.current = m.created_at;
      }
    }
    return fresh.length;
  }, []);

  const sync = useCallback(
    async (full = false): Promise<number> => {
      const result = await pollChatSession(sessionId, full ? null : cursorRef.current);
      if (!result.ok) return 0;
      return merge(result.messages, result.mode);
    },
    [sessionId, merge]
  );

  // Restore the transcript once configuration is known, then keep it fresh.
  // Polling continues while closed (slower) so James's reply can badge the
  // button without the visitor having the panel open.
  useEffect(() => {
    if (configured !== true) return;
    void sync(true);
    const id = window.setInterval(
      () => {
        if (document.visibilityState === "visible") void sync();
      },
      open ? POLL_OPEN_MS : POLL_CLOSED_MS
    );
    return () => window.clearInterval(id);
  }, [configured, open, sync]);

  // Unseen counter for the closed-button dot: anything from James or the
  // assistant that arrived after the last id the visitor saw.
  useEffect(() => {
    if (open) {
      const top = messages.reduce((n, m) => Math.max(n, m.id), 0);
      seenIdRef.current = top;
      setUnseen(0);
      return;
    }
    setUnseen(
      messages.filter((m) => m.id > seenIdRef.current && m.role !== "visitor").length
    );
  }, [messages, open]);

  // Auto-scroll on new messages / typing indicator.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, localOnly, pending, thinking]);

  // Focus input when opening.
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || pending) return;
    setError(null);
    setInput("");
    setPending(question);
    // Only the model makes you wait; a human reply arrives whenever it does.
    setThinking(mode === "ai");
    try {
      // The model needs the conversation so far; the server needs the session
      // so it can persist the turn and decide whether to answer at all.
      const history = [
        ...messages.filter((m) => m.role !== "human"),
        ...localOnly,
      ].map((m) => ({
        role: m.role === "visitor" ? ("user" as const) : ("assistant" as const),
        content: m.body,
      }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          messages: [...history, { role: "user", content: question }].slice(-12),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        reply?: string | null;
        mode?: ChatMode;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? `The assistant hit an error (${res.status}).`);
        return;
      }
      if (data.mode === "human") setMode("human");

      setThinking(false);
      // The poll is authoritative: it returns the persisted question and any
      // answer with real ids, so the optimistic echo can go. If it returns
      // nothing, the write never landed — hold the exchange locally rather
      // than letting it disappear from under the visitor.
      const gained = await sync();
      if (gained === 0) {
        setLocalOnly((prev) => [
          ...prev,
          { role: "visitor", body: question },
          ...(data.reply ? [{ role: "ai" as const, body: data.reply }] : []),
        ]);
      }
    } catch {
      setError("Couldn't reach the assistant. Check your connection and try again.");
    } finally {
      setThinking(false);
      setPending(null);
    }
  }

  if (configured !== true) return null;

  const showStarters =
    messages.length === 0 && localOnly.length === 0 && !pending && !thinking;

  return (
    <>
      {/* Floating paperclip button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={
            unseen > 0
              ? `Open the Office Assistant — ${unseen} new message${unseen === 1 ? "" : "s"}`
              : "Open the Office Assistant"
          }
          title="Ask the Office Assistant"
          className="no-print fixed bottom-10 right-4 z-40 grid place-items-center w-12 h-12 rounded-full bg-word-blue hover:bg-word-blue-dark text-white shadow-lg transition-transform hover:scale-105"
        >
          <span className="text-[22px] leading-none" aria-hidden="true">
            📎
          </span>
          {unseen > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white font-ui text-[10px] font-bold tabular-nums ring-2 ring-paper"
            >
              {unseen}
            </span>
          )}
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Office Assistant"
          className="no-print fixed bottom-10 right-4 z-40 w-[min(380px,calc(100vw-2rem))] bg-paper border border-rule rounded-sm shadow-2xl flex flex-col overflow-hidden"
          style={{ height: "min(540px, calc(100svh - 8rem))" }}
        >
          {/* Header */}
          <header className="flex items-center gap-2 border-b border-rule bg-ribbon px-3 py-2">
            <span className="grid place-items-center w-7 h-7 rounded-full bg-word-blue text-white text-[14px]">
              {mode === "human" ? "🧑" : "📎"}
            </span>
            <div className="flex-1 min-w-0 leading-tight">
              <div className="font-ui text-[12px] font-semibold text-ink">
                {mode === "human" ? "James Calunsag" : "Office Assistant"}
              </div>
              <div className="font-ui text-[10px] text-ink-subtle">
                {mode === "human" ? "Replying personally" : "Ask about this document"}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="grid w-7 h-7 place-items-center rounded-sm text-ink-muted hover:bg-ribbon-hover hover:text-ink transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                close
              </span>
            </button>
          </header>

          {/* Messages */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
            <AssistantBubble avatar="📎" text={GREETING} />

            {messages.map((m) =>
              m.role === "visitor" ? (
                <VisitorBubble key={m.id} text={m.body} />
              ) : (
                <AssistantBubble
                  key={m.id}
                  avatar={m.role === "human" ? "🧑" : "📎"}
                  text={m.body}
                  byline={m.role === "human" ? "James" : undefined}
                />
              )
            )}

            {/* Exchanges the server never stored (see localOnly) */}
            {localOnly.map((m, i) =>
              m.role === "visitor" ? (
                <VisitorBubble key={`local-${i}`} text={m.body} />
              ) : (
                <AssistantBubble key={`local-${i}`} avatar="📎" text={m.body} />
              )
            )}

            {/* Optimistic echo of the in-flight question */}
            {pending && <VisitorBubble text={pending} />}

            {/* Typing indicator — only for the model */}
            {thinking && (
              <div className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="grid place-items-center w-6 h-6 rounded-full bg-word-blue-light text-[11px] shrink-0 mt-0.5"
                >
                  📎
                </span>
                <div
                  className="bg-row-alt border border-rule rounded-sm rounded-tl-none px-3 py-2"
                  role="status"
                  aria-label="Assistant is typing"
                >
                  <span className="inline-flex gap-1">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="w-1.5 h-1.5 rounded-full bg-ink-subtle animate-bounce"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            )}

            {/* Waiting on a person, not a model */}
            {mode === "human" && !pending && (
              <div
                role="status"
                className="border border-word-blue/30 bg-word-blue-light/50 rounded-sm px-2.5 py-1.5 font-ui text-[11px] text-ink-muted"
              >
                James is answering this conversation himself — replies may take a
                little longer than the assistant's.
              </div>
            )}

            {/* Starter chips */}
            {showStarters && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {STARTERS.map((q) => (
                  <button
                    key={q}
                    onClick={() => void send(q)}
                    className="font-ui text-[11px] font-medium text-word-blue border border-rule rounded-sm px-2 py-1 hover:bg-word-blue-light transition-colors text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 rounded-sm px-2.5 py-1.5 font-ui text-[11px] text-red-700 dark:text-red-300"
              >
                {error}
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="border-t border-rule p-2 flex items-center gap-1.5"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={mode === "human" ? "Message James…" : "Ask about James…"}
              maxLength={1500}
              disabled={pending !== null}
              className="flex-1 bg-paper border border-rule rounded-sm px-3 py-1.5 font-ui text-[13px] text-ink placeholder:text-ink-subtle outline-none focus:border-word-blue focus:ring-2 focus:ring-word-blue/20 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={pending !== null || !input.trim()}
              aria-label="Send"
              className="grid place-items-center w-8 h-8 rounded-sm bg-word-blue hover:bg-word-blue-dark text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                send
              </span>
            </button>
          </form>

          <div className="border-t border-rule bg-ribbon px-3 py-1 font-ui text-[9px] uppercase tracking-[0.14em] text-ink-subtle">
            {mode === "human"
              ? "You're talking to James directly"
              : "AI-generated — answers may be imperfect"}
          </div>
        </div>
      )}
    </>
  );
}

function AssistantBubble({
  avatar,
  text,
  byline,
}: {
  avatar: string;
  text: string;
  byline?: string;
}) {
  return (
    <div className="flex items-start gap-2 max-w-[92%]">
      <span
        aria-hidden="true"
        className="grid place-items-center w-6 h-6 rounded-full bg-word-blue-light text-[11px] shrink-0 mt-0.5"
      >
        {avatar}
      </span>
      <div>
        {byline && (
          <div className="font-ui text-[10px] font-semibold text-word-blue mb-0.5">
            {byline}
          </div>
        )}
        <div className="bg-row-alt border border-rule rounded-sm rounded-tl-none px-3 py-2 font-ui text-[13px] leading-relaxed text-ink whitespace-pre-wrap">
          {text}
        </div>
      </div>
    </div>
  );
}

function VisitorBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] bg-word-blue text-white rounded-sm rounded-tr-none px-3 py-2 font-ui text-[13px] leading-relaxed whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
}
