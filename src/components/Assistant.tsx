import { useEffect, useRef, useState } from "react";

/**
 * Office Assistant — the Clippy homage. 📎
 *
 * Floating paperclip button (bottom-right, above the status bar) that
 * opens a Word-styled chat panel. Answers come from /api/chat, which
 * grounds a small model in the published site content.
 *
 * The button renders ONLY after GET /api/chat confirms the server has
 * an API key — an unconfigured deployment shows nothing at all.
 */

type Message = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "What projects has James built?",
  "What's his tech stack?",
  "Is he available for work?",
  "How do I contact him?",
];

const GREETING: Message = {
  role: "assistant",
  content:
    "Hi! 📎 It looks like you're browsing a portfolio. I can answer questions about James — his projects, skills, experience, or how to reach him. What would you like to know?",
};

export function Assistant() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Auto-scroll on new messages / typing indicator.
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  // Focus input when opening.
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || pending) return;
    setError(null);
    setInput("");
    const nextMessages: Message[] = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setPending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Skip the canned greeting — the server only needs the real exchange.
        body: JSON.stringify({
          messages: nextMessages.filter((m) => m !== GREETING).slice(-12),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        reply?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? `The assistant hit an error (${res.status}).`);
        return;
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply ?? "…" },
      ]);
    } catch {
      setError("Couldn't reach the assistant. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (configured !== true) return null;

  return (
    <>
      {/* Floating paperclip button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open the Office Assistant"
          title="Ask the Office Assistant"
          className="no-print fixed bottom-10 right-4 z-40 grid place-items-center w-12 h-12 rounded-full bg-word-blue hover:bg-word-blue-dark text-white shadow-lg transition-transform hover:scale-105"
        >
          <span className="text-[22px] leading-none" aria-hidden="true">
            📎
          </span>
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
              📎
            </span>
            <div className="flex-1 min-w-0 leading-tight">
              <div className="font-ui text-[12px] font-semibold text-ink">
                Office Assistant
              </div>
              <div className="font-ui text-[10px] text-ink-subtle">
                Ask about this document
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
            {messages.map((m, i) =>
              m.role === "assistant" ? (
                <div key={i} className="flex items-start gap-2 max-w-[92%]">
                  <span
                    aria-hidden="true"
                    className="grid place-items-center w-6 h-6 rounded-full bg-word-blue-light text-[11px] shrink-0 mt-0.5"
                  >
                    📎
                  </span>
                  <div className="bg-row-alt border border-rule rounded-sm rounded-tl-none px-3 py-2 font-ui text-[13px] leading-relaxed text-ink whitespace-pre-wrap">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] bg-word-blue text-white rounded-sm rounded-tr-none px-3 py-2 font-ui text-[13px] leading-relaxed whitespace-pre-wrap">
                    {m.content}
                  </div>
                </div>
              )
            )}

            {/* Typing indicator */}
            {pending && (
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

            {/* Starter chips */}
            {messages.length === 1 && !pending && (
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
              placeholder="Ask about James…"
              maxLength={1500}
              disabled={pending}
              className="flex-1 bg-paper border border-rule rounded-sm px-3 py-1.5 font-ui text-[13px] text-ink placeholder:text-ink-subtle outline-none focus:border-word-blue focus:ring-2 focus:ring-word-blue/20 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              aria-label="Send"
              className="grid place-items-center w-8 h-8 rounded-sm bg-word-blue hover:bg-word-blue-dark text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                send
              </span>
            </button>
          </form>

          <div className="border-t border-rule bg-ribbon px-3 py-1 font-ui text-[9px] uppercase tracking-[0.14em] text-ink-subtle">
            AI-generated — answers may be imperfect
          </div>
        </div>
      )}
    </>
  );
}
