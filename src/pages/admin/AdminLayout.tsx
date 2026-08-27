import { useEffect, useMemo, useState } from "react";
import { SYNC_EVENT, type SyncStatus } from "../../lib/content";
import { clearAdminAuth } from "../../lib/auth";
import { fetchInquiries } from "../../lib/inquiry-api";
import { fetchChatSessions } from "../../lib/chat-api";
import { Button } from "./ui";

/**
 * Ask for desktop-notification permission. Call this from a click only —
 * browsers ignore (and users resent) prompts raised from background work.
 */
export async function requestChatNotifications(): Promise<void> {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "default") return;
  try {
    await Notification.requestPermission();
  } catch {
    /* Safari <16 uses the callback form; not worth a shim */
  }
}

/** Desktop ping for a visitor waiting on a live reply. No-op until granted. */
function notifyWaiting(count: number): void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return;
  }
  try {
    const n = new Notification(
      count === 1 ? "A visitor is waiting for a reply" : `${count} visitors are waiting`,
      {
        body: "Open the Chat panel in the admin console to answer.",
        icon: "/icon.svg",
        // Collapses repeats instead of stacking one per poll.
        tag: "jvc-chat-waiting",
      }
    );
    n.onclick = () => {
      window.focus();
      window.location.hash = "#chat";
      n.close();
    };
  } catch {
    /* some browsers throw when constructing outside a SW context */
  }
}

export type SectionId =
  | "hero"
  | "about"
  | "skills"
  | "projects"
  | "credentials"
  | "contact"
  | "inbox"
  | "chat"
  | "history"
  | "tools";

export const SECTIONS: { id: SectionId; label: string; icon: string; tab: string }[] = [
  { id: "hero", label: "Home", icon: "home", tab: "Home tab" },
  { id: "about", label: "About", icon: "person", tab: "About tab" },
  { id: "skills", label: "Skills", icon: "build", tab: "Skills tab" },
  { id: "projects", label: "Projects", icon: "folder", tab: "Projects tab" },
  { id: "credentials", label: "Credentials", icon: "school", tab: "Credentials tab" },
  { id: "contact", label: "Contact", icon: "mail", tab: "Contact tab" },
  { id: "inbox", label: "Inbox", icon: "inbox", tab: "Messages from the contact form" },
  { id: "chat", label: "Chat", icon: "forum", tab: "Live conversations — reply as yourself" },
  { id: "history", label: "History", icon: "history", tab: "Version history & track changes" },
  { id: "tools", label: "Tools", icon: "settings", tab: "Backup, import, danger zone" },
];

const INBOX_POLL_MS = 20_000;
const CHAT_POLL_MS = 15_000;

/** Only two sections carry counts; undefined means "no badge at all". */
function badgeFor(
  id: SectionId,
  inboxUnread: number,
  chatWaiting: number
): number | undefined {
  if (id === "inbox") return inboxUnread;
  if (id === "chat") return chatWaiting;
  return undefined;
}

function hashToSection(): SectionId {
  const h = window.location.hash.replace(/^#/, "");
  return (SECTIONS.find((s) => s.id === h)?.id ?? "hero") as SectionId;
}

type Props = {
  active: SectionId;
  onChange: (s: SectionId) => void;
  onLogout: () => void;
  children: React.ReactNode;
};

export function AdminLayout({ active, onChange, onLogout, children }: Props) {
  const [sync, setSync] = useState<SyncStatus | "idle">("idle");
  const [inboxUnread, setInboxUnread] = useState<number>(0);
  const [inboxToast, setInboxToast] = useState<{ count: number; ts: number } | null>(null);
  const [chatWaiting, setChatWaiting] = useState<number>(0);
  const [chatToast, setChatToast] = useState<{ count: number; ts: number } | null>(null);

  /* ------------------------------------------------------------
     Global inbox watcher: polls /api/inquiries every 20s so the
     sidebar unread badge stays fresh even while a different section
     is open. If the unread count grows while the user isn't already
     in the Inbox, surface a toast.
  ------------------------------------------------------------ */
  useEffect(() => {
    let cancelled = false;
    let lastUnread: number | null = null;

    async function tick() {
      const result = await fetchInquiries("unread");
      if (cancelled || !result.ok) return;
      const next = result.unreadCount;
      if (lastUnread !== null && next > lastUnread && active !== "inbox") {
        setInboxToast({ count: next - lastUnread, ts: Date.now() });
      }
      lastUnread = next;
      setInboxUnread(next);
    }

    void tick();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void tick();
    }, INBOX_POLL_MS);
    const onFocus = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [active]);

  /* ------------------------------------------------------------
     Chat watcher: same shape as the inbox one, but a visitor waiting
     on a live reply is more time-sensitive than a contact-form
     message, so this one also raises a desktop notification.

     Permission is never requested here — only from the Chat panel,
     on a real click (see requestChatNotifications). A prompt fired
     from a background poll is the kind users deny reflexively, and
     denial is permanent.
  ------------------------------------------------------------ */
  useEffect(() => {
    let cancelled = false;
    let lastWaiting: number | null = null;

    async function tick() {
      const result = await fetchChatSessions();
      if (cancelled || !result.ok) return;
      const next = result.waitingCount;
      if (lastWaiting !== null && next > lastWaiting && active !== "chat") {
        setChatToast({ count: next, ts: Date.now() });
        notifyWaiting(next);
      }
      lastWaiting = next;
      setChatWaiting(next);
    }

    void tick();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void tick();
    }, CHAT_POLL_MS);
    const onFocus = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [active]);

  // Auto-dismiss toasts after 6s
  useEffect(() => {
    if (!inboxToast) return;
    const t = window.setTimeout(() => setInboxToast(null), 6_000);
    return () => window.clearTimeout(t);
  }, [inboxToast]);

  useEffect(() => {
    if (!chatToast) return;
    const t = window.setTimeout(() => setChatToast(null), 6_000);
    return () => window.clearTimeout(t);
  }, [chatToast]);

  // Track real publish status: "saving" while the debounced push is pending,
  // then "saved" (server), "local" (no server / offline), or "error".
  useEffect(() => {
    let t: number | undefined;
    const onSync = (e: Event) => {
      const status = (e as CustomEvent<SyncStatus>).detail;
      setSync(status);
      if (t) window.clearTimeout(t);
      if (status === "saved") {
        t = window.setTimeout(() => setSync("idle"), 1800);
      }
    };
    window.addEventListener(SYNC_EVENT, onSync);
    return () => {
      window.removeEventListener(SYNC_EVENT, onSync);
      if (t) window.clearTimeout(t);
    };
  }, []);

  // Sync active section ⇄ URL hash
  useEffect(() => {
    if (window.location.hash.replace(/^#/, "") !== active) {
      window.history.replaceState(null, "", `#${active}`);
    }
  }, [active]);

  useEffect(() => {
    const onHash = () => onChange(hashToSection());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [onChange]);

  const activeMeta = useMemo(
    () => SECTIONS.find((s) => s.id === active) ?? SECTIONS[0],
    [active]
  );

  function handleLogout() {
    clearAdminAuth();
    onLogout();
  }

  return (
    <div className="min-h-svh bg-workspace text-ink">
      {/* Top bar — Word-style ribbon, lean version */}
      <header className="sticky top-0 z-30 h-12 bg-paper border-b border-rule flex items-center justify-between px-3 md:px-4">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="material-symbols-outlined icon-fill text-word-blue"
            style={{ fontSize: 20 }}
          >
            description
          </span>
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-ui text-[14px] font-semibold text-ink">
              Portfolio.docx
            </span>
            <span className="font-ui text-[12px] text-ink-subtle hidden sm:inline">
              · Admin Console
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SavedPill sync={sync} />
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 text-[12px] font-ui font-medium text-ink-muted hover:text-ink px-2.5 py-1 rounded-sm hover:bg-ribbon-hover transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              open_in_new
            </span>
            View live
          </a>
          <Button variant="ghost" icon="logout" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden md:block w-60 shrink-0 border-r border-rule bg-paper min-h-[calc(100svh-3rem)]">
          <nav className="p-3 flex flex-col gap-0.5 sticky top-12">
            {SECTIONS.map((s, i) => (
              <SidebarItem
                key={s.id}
                item={s}
                active={active === s.id}
                onClick={() => onChange(s.id)}
                topDivider={s.id === "tools" && i > 0}
                badge={badgeFor(s.id, inboxUnread, chatWaiting)}
              />
            ))}

            {/* Admin-gated standalone pages — live outside the console */}
            <div className="my-2 mx-2 h-px bg-rule" aria-hidden="true" />
            <p className="px-3 pb-1 font-ui text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
              Pages
            </p>
            <PageLink href="/resume" icon="description" label="Résumé builder" />
            <PageLink href="/status" icon="monitoring" label="System info" />
          </nav>
        </aside>

        {/* Mobile section picker */}
        <div className="md:hidden fixed bottom-3 left-3 right-3 z-20 bg-paper border border-rule rounded-sm shadow-lg p-2 flex gap-1 overflow-x-auto">
          {SECTIONS.map((s) => {
            const badge = badgeFor(s.id, inboxUnread, chatWaiting);
            return (
              <button
                key={s.id}
                onClick={() => onChange(s.id)}
                className={
                  "shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-sm font-ui text-[12px] font-medium transition-colors " +
                  (active === s.id
                    ? "bg-word-blue text-white"
                    : "text-ink-muted hover:bg-ribbon-hover")
                }
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  {s.icon}
                </span>
                {s.label}
                {badge !== undefined && badge > 0 && (
                  <span
                    className={
                      "inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-sm font-ui text-[10px] font-bold tabular-nums " +
                      (active === s.id
                        ? "bg-white/25 text-white"
                        : "bg-word-blue text-white")
                    }
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
          <a
            href="/resume"
            className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-sm font-ui text-[12px] font-medium text-ink-muted hover:bg-ribbon-hover"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              description
            </span>
            Résumé
          </a>
          <a
            href="/status"
            className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-sm font-ui text-[12px] font-medium text-ink-muted hover:bg-ribbon-hover"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              monitoring
            </span>
            Status
          </a>
        </div>

        {/* Global inbox toast — shown when a new inquiry arrives while the
             user is on a different section. */}
        {inboxToast && active !== "inbox" && (
          <div
            role="status"
            aria-live="polite"
            className="no-print fixed bottom-6 right-6 z-40 max-w-sm bg-paper border border-word-blue rounded-sm shadow-lg overflow-hidden"
          >
            <div className="flex items-center gap-2 border-b border-rule bg-word-blue-light px-3 py-1.5">
              <span
                className="material-symbols-outlined icon-fill text-word-blue"
                style={{ fontSize: 14 }}
              >
                notifications_active
              </span>
              <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-word-blue">
                New Comment
              </span>
            </div>
            <div className="p-3 flex items-start gap-3">
              <div className="flex-1">
                <p className="font-ui text-[13px] text-ink">
                  {inboxToast.count === 1
                    ? "A new inquiry just landed."
                    : `${inboxToast.count} new inquiries just landed.`}
                </p>
                <button
                  onClick={() => {
                    onChange("inbox");
                    setInboxToast(null);
                  }}
                  className="mt-1.5 font-ui text-[12px] font-medium text-word-blue hover:underline decoration-word-blue underline-offset-2"
                >
                  Open Inbox →
                </button>
              </div>
              <button
                onClick={() => setInboxToast(null)}
                className="opacity-60 hover:opacity-100"
                aria-label="Dismiss"
              >
                <span
                  className="material-symbols-outlined text-ink-muted"
                  style={{ fontSize: 16 }}
                >
                  close
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Live-chat toast — a visitor is holding for a reply. Offset above
             the inbox toast so both can be on screen at once. */}
        {chatToast && active !== "chat" && (
          <div
            role="status"
            aria-live="polite"
            className="no-print fixed right-6 z-40 max-w-sm bg-paper border border-word-blue rounded-sm shadow-lg overflow-hidden"
            style={{ bottom: inboxToast ? "13rem" : "1.5rem" }}
          >
            <div className="flex items-center gap-2 border-b border-rule bg-word-blue-light px-3 py-1.5">
              <span
                className="material-symbols-outlined icon-fill text-word-blue"
                style={{ fontSize: 14 }}
              >
                forum
              </span>
              <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-word-blue">
                Live Chat
              </span>
            </div>
            <div className="p-3 flex items-start gap-3">
              <div className="flex-1">
                <p className="font-ui text-[13px] text-ink">
                  {chatToast.count === 1
                    ? "A visitor is waiting for a reply."
                    : `${chatToast.count} visitors are waiting for a reply.`}
                </p>
                <button
                  onClick={() => {
                    onChange("chat");
                    setChatToast(null);
                  }}
                  className="mt-1.5 font-ui text-[12px] font-medium text-word-blue hover:underline decoration-word-blue underline-offset-2"
                >
                  Open Chat →
                </button>
              </div>
              <button
                onClick={() => setChatToast(null)}
                className="opacity-60 hover:opacity-100"
                aria-label="Dismiss"
              >
                <span
                  className="material-symbols-outlined text-ink-muted"
                  style={{ fontSize: 16 }}
                >
                  close
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Main */}
        <main className="flex-1 min-w-0 px-4 md:px-8 py-6 md:py-10 pb-24 md:pb-10 max-w-4xl">
          <div className="mb-6">
            <p className="font-ui text-[11px] uppercase tracking-[0.18em] text-ink-subtle">
              Editing
            </p>
            <h1 className="font-doc text-[28px] md:text-[32px] font-bold text-word-blue tracking-tight leading-tight">
              {activeMeta.label}
            </h1>
            <p className="font-ui text-[12px] text-ink-subtle mt-0.5">
              {activeMeta.tab} · changes save automatically
            </p>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

/** Sidebar link to an admin-gated standalone page (opens in this tab). */
function PageLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-2.5 px-3 py-2 rounded-sm font-ui text-[13px] text-ink-muted hover:bg-ribbon-hover hover:text-ink transition-colors"
    >
      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      <span
        className="material-symbols-outlined text-ink-subtle"
        style={{ fontSize: 13 }}
        aria-hidden="true"
      >
        open_in_new
      </span>
    </a>
  );
}

function SavedPill({ sync }: { sync: SyncStatus | "idle" }) {
  const view = {
    idle: { icon: "cloud_done", label: "Up to date", tone: "text-ink-subtle bg-transparent" },
    saving: { icon: "sync", label: "Publishing…", tone: "text-ink-muted bg-ribbon" },
    saved: { icon: "check_circle", label: "Published", tone: "text-word-blue bg-word-blue-light" },
    local: {
      icon: "cloud_off",
      label: "Saved locally only",
      tone: "text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/50",
    },
    error: {
      icon: "error",
      label: "Publish failed",
      tone: "text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-950/50",
    },
  }[sync];

  return (
    <span
      className={
        "hidden sm:inline-flex items-center gap-1 font-ui text-[11px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-sm transition-colors " +
        view.tone
      }
      title={
        sync === "local"
          ? "No server connection — edits persist in this browser only."
          : sync === "error"
            ? "The server rejected the update. Try signing out and back in."
            : undefined
      }
    >
      <span
        className={
          "material-symbols-outlined " +
          (sync === "saved" ? "icon-fill " : "") +
          (sync === "saving" ? "animate-spin" : "")
        }
        style={{ fontSize: 14 }}
      >
        {view.icon}
      </span>
      {view.label}
    </span>
  );
}

function SidebarItem({
  item,
  active,
  onClick,
  topDivider,
  badge,
}: {
  item: (typeof SECTIONS)[number];
  active: boolean;
  onClick: () => void;
  topDivider?: boolean;
  badge?: number;
}) {
  return (
    <>
      {topDivider && (
        <div className="my-2 mx-2 h-px bg-rule" aria-hidden="true" />
      )}
      <button
        onClick={onClick}
        aria-label={
          badge !== undefined && badge > 0
            ? `${item.label} — ${badge} unread`
            : item.label
        }
        className={
          "flex items-center gap-2.5 px-3 py-2 rounded-sm font-ui text-[13px] text-left transition-colors " +
          (active
            ? "bg-word-blue-light text-word-blue font-semibold"
            : "text-ink-muted hover:bg-ribbon-hover hover:text-ink")
        }
      >
        <span
          className={
            "material-symbols-outlined " + (active ? "icon-fill" : "")
          }
          style={{ fontSize: 18 }}
        >
          {item.icon}
        </span>
        <span className="flex-1 truncate">{item.label}</span>
        {badge !== undefined && badge > 0 && (
          <span
            aria-hidden="true"
            className={
              "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-sm font-ui text-[10px] font-bold tabular-nums " +
              (active
                ? "bg-word-blue text-white"
                : "bg-word-blue text-white")
            }
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>
    </>
  );
}

export { hashToSection };
