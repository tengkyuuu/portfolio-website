import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BlueSticker } from "./BlueSticker";
import { blueMood } from "../lib/blue";
import {
  getChatSessionId,
  pollChatSession,
  type ChatMessage,
  type ChatMode,
} from "../lib/chat-api";

type Persisted = ChatMessage;

const GREETING =
  "Hi, I'm Blue. It looks like you're browsing a portfolio - I can answer questions about James: his projects, skills, experience, or how to reach him. What would you like to know?";

const STARTERS = [
  "What projects has James built?",
  "What's his tech stack?",
  "Is he available for work?",
  "How do I contact him?",
];

const POLL_OPEN_MS = 6_000;
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
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const [localOnly, setLocalOnly] = useState<
    { role: "visitor" | "ai"; body: string; reaction?: string }[]
  >([]);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cursorRef = useRef<string | null>(null);
  const idsRef = useRef<Set<number>>(new Set());
  const seenIdRef = useRef<number>(0);
  const sessionId = useMemo(() => getChatSessionId(), []);

  const messages = useMemo(
    () =>
      [...byId.values()].sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
      ),
    [byId],
  );

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

  const merge = useCallback(
    (incoming: Persisted[], nextMode: ChatMode): number => {
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
    },
    [],
  );

  const sync = useCallback(
    async (full = false): Promise<Persisted[]> => {
      const result = await pollChatSession(
        sessionId,
        full ? null : cursorRef.current,
      );
      if (!result.ok) return [];
      merge(result.messages, result.mode);
      return result.messages;
    },
    [sessionId, merge],
  );

  useEffect(() => {
    if (configured !== true) return;
    void sync(true);
    const id = window.setInterval(
      () => {
        if (document.visibilityState === "visible") void sync();
      },
      open ? POLL_OPEN_MS : POLL_CLOSED_MS,
    );
    return () => window.clearInterval(id);
  }, [configured, open, sync]);

  useEffect(() => {
    if (open) {
      const top = messages.reduce((n, m) => Math.max(n, m.id), 0);
      seenIdRef.current = top;
      setUnseen(0);
      return;
    }
    setUnseen(
      messages.filter((m) => m.id > seenIdRef.current && m.role !== "visitor")
        .length,
    );
  }, [messages, open]);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }, [messages, localOnly, pending, thinking, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); window.setTimeout(() => document.querySelector<HTMLButtonElement>(".blue-launcher")?.focus(), 0); }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || pending) return;
    setError(null);
    setInput("");
    setPending(question);
    setThinking(mode === "ai");
    try {
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
          messages: [...history, { role: "user", content: question }].slice(
            -12,
          ),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        reply?: string | null;
        reaction?: string;
        mode?: ChatMode;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? `The assistant hit an error (${res.status}).`);
        return;
      }
      if (data.mode === "human") setMode("human");
      if (data.reply) setReactions(prev => ({ ...prev, [data.reply!]: blueMood(data.reaction) }));
      setThinking(false);
      const gained = await sync();
      if (gained.length === 0 || (data.reply && !gained.some(m => m.role === "ai" && m.body === data.reply))) {
        setLocalOnly((prev) => [
          ...prev,
          ...(gained.length === 0 ? [{ role: "visitor" as const, body: question }] : []),
          ...(data.reply ? [{ role: "ai" as const, body: data.reply, reaction: blueMood(data.reaction) }] : []),
        ]);
      }
    } catch {
      setError("Couldn't reach Blue. Check your connection and try again.");
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
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={
            unseen > 0
              ? `Open Blue - ${unseen} new message${unseen === 1 ? "" : "s"}`
              : "Open Blue"
          }
          title="Ask Blue"
          className="blue-launcher no-print fixed bottom-10 right-4 z-40 grid place-items-center w-12 h-12 transition-transform"
        >
          <BlueLogo />
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

      {open && (
        <div
          role="dialog"
          aria-label="Blue"
          className="no-print fixed bottom-10 right-4 z-40 w-[min(380px,calc(100vw-2rem))] bg-paper border border-rule rounded-sm shadow-2xl flex flex-col overflow-hidden"
          style={{ height: "min(540px, calc(100svh - 8rem))" }}
        >
          <header className="flex items-center gap-2 border-b border-rule bg-ribbon px-3 py-2">
            <span className="grid place-items-center w-7 h-7">
              <BlueLogo />
            </span>
            <div className="flex-1 min-w-0 leading-tight">
              <div className="font-ui text-[12px] font-semibold text-ink">
                Blue
              </div>
              <div className="font-ui text-[10px] text-ink-subtle">
                Ask about this document
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close Blue"
              className="grid w-7 h-7 place-items-center rounded-sm text-ink-muted hover:bg-ribbon-hover hover:text-ink transition-colors"
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 16 }}
              >
                close
              </span>
            </button>
          </header>

          <div
            ref={listRef}
            className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5"
          >
            <AssistantBubble text={GREETING} reaction="coffee" />

            {messages.map((m) =>
              m.role === "visitor" ? (
                <VisitorBubble key={m.id} text={m.body} />
              ) : (
                <AssistantBubble key={m.id} text={m.body} human={m.role === "human"} reaction={m.role === "ai" ? m.reaction || reactions[m.body] : undefined} />
              ),
            )}

            {localOnly.filter(m => !messages.some(saved => saved.role === m.role && saved.body === m.body)).map((m, i) =>
              m.role === "visitor" ? (
                <VisitorBubble key={`local-${i}`} text={m.body} />
              ) : (
                <AssistantBubble key={`local-${i}`} text={m.body} reaction={m.reaction} />
              ),
            )}

            {pending && <VisitorBubble text={pending} />}

            {thinking && (
              <div className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="grid place-items-center w-6 h-6 shrink-0 mt-0.5"
                >
                  <BlueLogo />
                </span>
                <div
                  className="bg-row-alt border border-rule rounded-sm rounded-tl-none px-3 py-2"
                  role="status"
                  aria-label="Blue is typing"
                >
                  <BlueSticker mood="searching" caption="Let me look into that…" />
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

            {mode === "human" && !pending && (
              <div
                role="status"
                className="border border-word-blue/30 bg-word-blue-light/50 rounded-sm px-2.5 py-1.5 font-ui text-[11px] text-ink-muted"
              >
                Blue has this conversation in the live inbox. Replies may take a
                little longer than usual.
              </div>
            )}

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
              aria-label="Message Blue"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Blue about James..."
              maxLength={1500}
              disabled={pending !== null}
              className="flex-1 bg-paper border border-rule rounded-sm px-3 py-1.5 font-ui text-[13px] text-ink placeholder:text-ink-subtle outline-none focus:border-word-blue focus:ring-2 focus:ring-word-blue/20 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={pending !== null || !input.trim()}
              aria-label="Send"
              className="grid place-items-center w-8 h-8 rounded-sm bg-word-blue hover:bg-word-blue-dark text-paper disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 16 }}
              >
                send
              </span>
            </button>
          </form>

          <div className="border-t border-rule bg-ribbon px-3 py-1 font-ui text-[9px] uppercase tracking-[0.14em] text-ink-subtle">
            Blue is the assistant for this portfolio
          </div>
        </div>
      )}
    </>
  );
}

function AssistantBubble({ text, reaction, human = false }: { text: string; reaction?: string; human?: boolean }) {
  return (
    <div className="flex items-start gap-2 max-w-[92%]">
      <span
        aria-hidden="true"
        className="grid place-items-center w-6 h-6 shrink-0 mt-0.5"
      >
        {human ? <span className="font-ui text-[10px] font-semibold">JV</span> : <BlueLogo />}
      </span>
      <div className="bg-row-alt border border-rule rounded-sm rounded-tl-none px-3 py-2 font-ui text-[13px] leading-relaxed text-ink whitespace-pre-wrap">
        {human && <span className="block text-[10px] font-semibold text-word-blue">James</span>}
        {text}
        {!human && reaction && <div className="mt-2"><BlueSticker mood={reaction} /></div>}
      </div>
    </div>
  );
}

function VisitorBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] bg-word-blue text-paper rounded-sm rounded-tr-none px-3 py-2 font-ui text-[13px] leading-relaxed whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
}

function BlueLogo() {
  return (
    <img
      src="/blue/coffee-blue.jpg"
      alt=""
      aria-hidden="true"
      className="blue-logo h-full w-full"
      draggable={false}
    />
  );
}
