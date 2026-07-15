import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteInquiry as deleteInquiryApi,
  fetchInquiries,
  updateInquiry,
  type Inquiry,
  type InquiryStatus,
} from "../../lib/inquiry-api";
import { ReplyComposer } from "./ReplyComposer";
import { Button, Card, IconButton } from "./ui";

/**
 * Word "Reviewing Pane" style inquiry inbox.
 *
 *   Left column   →  filter chips + list of inquiry rows (unread bold, dot)
 *   Right column  →  selected inquiry balloon (Word comment style) + actions
 *
 * Polls /api/inquiries every 15s while the tab is visible. Refetches on
 * focus and on visibilitychange. New inquiries surface a subtle toast at
 * the bottom of the pane (also usable while another admin section is
 * open — see InboxWatcher below).
 */

const POLL_MS = 15_000;
const FILTERS: { id: InquiryStatus | "all"; label: string; icon: string }[] = [
  { id: "unread", label: "Unread", icon: "mark_email_unread" },
  { id: "read", label: "Read", icon: "drafts" },
  { id: "archived", label: "Archived", icon: "archive" },
  { id: "all", label: "All", icon: "inbox" },
];

type LoadState = "idle" | "loading" | "error";

export function InboxEditor() {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [status, setStatus] = useState<InquiryStatus | "all">("unread");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const [newSinceLoad, setNewSinceLoad] = useState(0);

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId]
  );

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoadState("loading");
      const result = await fetchInquiries(status);
      if (!result.ok) {
        if (result.kind === "unauthorized") {
          setErrorMsg("Your session expired. Sign out and back in.");
        } else if (result.kind === "offline") {
          setErrorMsg("Couldn't reach the server. Check your connection.");
        } else {
          setErrorMsg(result.message ?? "Couldn't load inquiries.");
        }
        setLoadState("error");
        return;
      }
      // Count anything new we hadn't seen last time — drives the toast.
      const newOnes = result.items.filter((i) => !seenIdsRef.current.has(i.id));
      const wasFirstLoad = seenIdsRef.current.size === 0;
      for (const i of result.items) seenIdsRef.current.add(i.id);
      if (!wasFirstLoad && newOnes.length > 0) {
        setNewSinceLoad((c) => c + newOnes.length);
      }
      setItems(result.items);
      setErrorMsg(null);
      setLoadState("idle");
    },
    [status]
  );

  // Initial + status-change load
  useEffect(() => {
    seenIdsRef.current = new Set();
    setNewSinceLoad(0);
    void load(false);
  }, [load]);

  // Polling while tab is visible
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
    };
  }, [load]);

  // Keyboard: J/K to move, Esc to deselect, r to reload
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.key === "Escape") {
        setSelectedId(null);
        setConfirmDelete(null);
        return;
      }
      if (e.key === "j" || e.key === "k") {
        if (items.length === 0) return;
        const idx = items.findIndex((i) => i.id === selectedId);
        const next =
          e.key === "j"
            ? items[Math.min(items.length - 1, idx + 1)]
            : items[Math.max(0, idx - 1)] ?? items[0];
        if (next) setSelectedId(next.id);
        return;
      }
      if (e.key === "r" && !e.metaKey && !e.ctrlKey) {
        void load(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, selectedId, load]);

  // When a row is selected AND unread, flip it to "read" automatically.
  useEffect(() => {
    if (!selected || selected.status !== "unread") return;
    void mutateStatus(selected.id, "read");
    // Optimistically update local copy
    setItems((prev) =>
      prev.map((i) =>
        i.id === selected.id ? { ...i, status: "read", read_at: new Date().toISOString() } : i
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  async function mutateStatus(id: string, next: InquiryStatus) {
    const result = await updateInquiry(id, next);
    if (!result.ok) {
      setErrorMsg(result.message ?? "Couldn't update the inquiry.");
      // Reload to reflect true state
      void load(true);
    }
  }

  async function doDelete(id: string) {
    const result = await deleteInquiryApi(id);
    if (!result.ok) {
      setErrorMsg(result.message ?? "Couldn't delete the inquiry.");
      return;
    }
    seenIdsRef.current.delete(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setConfirmDelete(null);
    if (selectedId === id) setSelectedId(null);
  }

  const unread = items.filter((i) => i.status === "unread").length;

  return (
    <Card
      title="Inbox"
      description="Messages sent through the Contact form. Polls every 15s while this tab is open — press R to refresh, J/K to move, Esc to deselect."
      actions={
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" icon="refresh" onClick={() => void load(false)}>
            Refresh
          </Button>
        </div>
      }
    >
      {/* Filter chips */}
      <div
        role="tablist"
        aria-label="Inquiry status"
        className="flex flex-wrap gap-1.5 mb-4 border-b border-rule pb-3"
      >
        {FILTERS.map((f) => {
          const isActive = status === f.id;
          const badge = f.id === "unread" ? unread : undefined;
          return (
            <button
              key={f.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setStatus(f.id);
                setSelectedId(null);
              }}
              className={
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm font-ui text-[12px] font-medium transition-colors " +
                (isActive
                  ? "bg-word-blue text-white"
                  : "text-ink-muted border border-rule bg-paper hover:bg-ribbon-hover")
              }
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                {f.icon}
              </span>
              {f.label}
              {badge !== undefined && badge > 0 && (
                <span
                  className={
                    "inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-sm font-ui text-[10px] font-bold tabular-nums " +
                    (isActive
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
      </div>

      {errorMsg && (
        <div className="mb-3 border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 rounded-sm px-3 py-2 font-ui text-[12px] text-red-700 dark:text-red-300 flex items-start gap-1.5">
          <span
            className="material-symbols-outlined shrink-0"
            style={{ fontSize: 14, marginTop: 1 }}
          >
            error
          </span>
          <span className="flex-1">{errorMsg}</span>
          <button
            className="text-red-700 dark:text-red-300 opacity-60 hover:opacity-100"
            onClick={() => setErrorMsg(null)}
            aria-label="Dismiss"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              close
            </span>
          </button>
        </div>
      )}

      {/* Reviewing Pane — two columns */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,340px)_1fr] gap-4 min-h-[400px]">
        {/* Left: list */}
        <div className="border border-rule rounded-sm bg-paper overflow-hidden max-h-[70svh] overflow-y-auto">
          {loadState === "loading" && items.length === 0 ? (
            <InboxSkeleton />
          ) : items.length === 0 ? (
            <InboxEmpty status={status} />
          ) : (
            <ul className="divide-y divide-rule">
              {items.map((inq) => (
                <InquiryRow
                  key={inq.id}
                  inquiry={inq}
                  active={inq.id === selectedId}
                  onSelect={() => setSelectedId(inq.id)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Right: detail balloon or empty state */}
        <div>
          {selected ? (
            <InquiryDetail
              inquiry={selected}
              onStatusChange={(next) => {
                setItems((prev) =>
                  prev.map((i) =>
                    i.id === selected.id
                      ? {
                          ...i,
                          status: next,
                          read_at:
                            next === "unread" ? null : i.read_at ?? new Date().toISOString(),
                          archived_at:
                            next === "archived" ? new Date().toISOString() : null,
                        }
                      : i
                  )
                );
                void mutateStatus(selected.id, next);
              }}
              confirming={confirmDelete === selected.id}
              onRequestDelete={() => setConfirmDelete(selected.id)}
              onCancelDelete={() => setConfirmDelete(null)}
              onConfirmDelete={() => void doDelete(selected.id)}
            />
          ) : (
            <div className="h-full min-h-[300px] grid place-items-center border border-dashed border-rule rounded-sm bg-row-alt">
              <div className="text-center px-6">
                <span
                  className="material-symbols-outlined text-ink-subtle"
                  style={{ fontSize: 32 }}
                >
                  mark_chat_read
                </span>
                <p className="mt-2 font-ui text-[12px] text-ink-subtle">
                  Select a message from the list to preview it here.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New-message toast */}
      {newSinceLoad > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 border border-word-blue bg-word-blue-light rounded-sm px-3 py-2 font-ui text-[12px] text-word-blue flex items-center gap-2"
        >
          <span
            className="material-symbols-outlined icon-fill"
            style={{ fontSize: 14 }}
          >
            notifications_active
          </span>
          <span className="flex-1">
            {newSinceLoad === 1
              ? "1 new inquiry"
              : `${newSinceLoad} new inquiries`}{" "}
            just arrived.
          </span>
          <button
            onClick={() => setNewSinceLoad(0)}
            className="opacity-70 hover:opacity-100"
            aria-label="Dismiss"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              close
            </span>
          </button>
        </div>
      )}
    </Card>
  );
}

/* -------------------------------- pieces -------------------------------- */

function InquiryRow({
  inquiry,
  active,
  onSelect,
}: {
  inquiry: Inquiry;
  active: boolean;
  onSelect: () => void;
}) {
  const isUnread = inquiry.status === "unread";
  return (
    <li>
      <button
        onClick={onSelect}
        aria-current={active ? "true" : undefined}
        className={
          "w-full text-left px-3 py-2.5 flex items-start gap-3 transition-colors " +
          (active
            ? "bg-word-blue-light"
            : isUnread
              ? "bg-paper hover:bg-ribbon-hover"
              : "bg-paper hover:bg-ribbon-hover")
        }
      >
        <span
          aria-hidden="true"
          className={
            "mt-1 shrink-0 w-2 h-2 rounded-full " +
            (isUnread ? "bg-word-blue" : "bg-transparent")
          }
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <div
              className={
                "truncate font-ui text-[13px] " +
                (isUnread ? "font-semibold text-ink" : "text-ink-muted")
              }
            >
              {inquiry.name}
            </div>
            <div className="shrink-0 font-ui text-[10px] text-ink-subtle tabular-nums">
              {timeAgo(inquiry.created_at)}
            </div>
          </div>
          <div
            className={
              "truncate font-ui text-[12px] " +
              (isUnread ? "text-ink" : "text-ink-subtle")
            }
          >
            {inquiry.subject ?? "(no subject)"}
          </div>
          <div className="truncate font-ui text-[11px] text-ink-subtle mt-0.5">
            {inquiry.message}
          </div>
        </div>
      </button>
    </li>
  );
}

function InquiryDetail({
  inquiry,
  onStatusChange,
  confirming,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  inquiry: Inquiry;
  onStatusChange: (next: InquiryStatus) => void;
  confirming: boolean;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [composing, setComposing] = useState(false);
  function copyEmail() {
    void navigator.clipboard.writeText(inquiry.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <article className="border border-rule rounded-sm bg-paper flex flex-col h-full">
      {/* Balloon header — Word "Reviewing" panel look */}
      <header className="border-b border-rule px-4 py-3 bg-row-alt">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="material-symbols-outlined icon-fill text-word-blue"
            style={{ fontSize: 16 }}
          >
            chat_bubble
          </span>
          <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-word-blue">
            Comment
          </span>
          <StatusChip status={inquiry.status} />
          <span className="ml-auto font-ui text-[10px] text-ink-subtle tabular-nums">
            {formatDate(inquiry.created_at)}
          </span>
        </div>
        <h3 className="font-doc text-[18px] font-bold text-ink leading-tight">
          {inquiry.subject ?? "(no subject)"}
        </h3>
        <p className="mt-1 font-ui text-[12px] text-ink-muted">
          From <span className="font-semibold text-ink">{inquiry.name}</span>{" "}
          &lt;
          <button onClick={copyEmail} className="hover:text-word-blue underline decoration-dotted underline-offset-2">
            {inquiry.email}
          </button>
          &gt;
          {copied && (
            <span className="ml-2 text-word-blue font-medium">Copied</span>
          )}
        </p>
      </header>

      {/* Body */}
      <div className="p-5 flex-1 overflow-y-auto max-h-[50svh]">
        <p className="font-doc text-[15px] leading-[1.7] text-ink whitespace-pre-wrap break-words">
          {inquiry.message}
        </p>
      </div>

      {/* Actions */}
      <footer className="border-t border-rule px-4 py-3 flex flex-wrap items-center gap-2 bg-row-alt">
        <Button variant="primary" icon="reply" onClick={() => setComposing(true)}>
          Reply
        </Button>
        {inquiry.status !== "read" && (
          <Button
            variant="secondary"
            icon="mark_email_read"
            onClick={() => onStatusChange("read")}
          >
            Mark read
          </Button>
        )}
        {inquiry.status !== "unread" && (
          <Button
            variant="secondary"
            icon="mark_email_unread"
            onClick={() => onStatusChange("unread")}
          >
            Mark unread
          </Button>
        )}
        {inquiry.status !== "archived" ? (
          <Button
            variant="secondary"
            icon="archive"
            onClick={() => onStatusChange("archived")}
          >
            Archive
          </Button>
        ) : (
          <Button
            variant="secondary"
            icon="unarchive"
            onClick={() => onStatusChange("read")}
          >
            Restore
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {confirming ? (
            <div
              role="alertdialog"
              aria-label="Confirm delete"
              className="flex items-center gap-2"
            >
              <span className="font-ui text-[11px] text-red-700 dark:text-red-400 italic">
                Delete permanently?
              </span>
              <Button variant="danger" onClick={onConfirmDelete}>
                Yes
              </Button>
              <Button variant="ghost" onClick={onCancelDelete}>
                No
              </Button>
            </div>
          ) : (
            <IconButton
              icon="delete"
              label="Delete inquiry"
              onClick={onRequestDelete}
              danger
            />
          )}
        </div>
      </footer>

      {composing && (
        <ReplyComposer inquiry={inquiry} onClose={() => setComposing(false)} />
      )}
    </article>
  );
}

function StatusChip({ status }: { status: InquiryStatus }) {
  const map: Record<
    InquiryStatus,
    { label: string; tone: string; icon: string }
  > = {
    unread: {
      label: "Unread",
      tone: "text-word-blue bg-word-blue-light",
      icon: "mark_email_unread",
    },
    read: {
      label: "Read",
      tone: "text-ink-muted bg-ribbon",
      icon: "drafts",
    },
    archived: {
      label: "Archived",
      tone: "text-ink-subtle bg-ribbon",
      icon: "archive",
    },
  };
  const meta = map[status];
  return (
    <span
      className={
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm font-ui text-[10px] font-semibold uppercase tracking-wider " +
        meta.tone
      }
    >
      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>
        {meta.icon}
      </span>
      {meta.label}
    </span>
  );
}

function InboxEmpty({ status }: { status: InquiryStatus | "all" }) {
  const copy: Record<InquiryStatus | "all", { title: string; hint: string }> = {
    unread: {
      title: "Inbox zero",
      hint: "No unread messages. Nothing needs your attention.",
    },
    read: {
      title: "No read messages",
      hint: "Once you open a message it moves here.",
    },
    archived: {
      title: "Nothing archived",
      hint: "Archive messages you want to keep but don't need to act on.",
    },
    all: {
      title: "No messages yet",
      hint: "When visitors use the contact form, their notes land here.",
    },
  };
  const c = copy[status];
  return (
    <div className="h-full grid place-items-center p-8">
      <div className="text-center">
        <span
          className="material-symbols-outlined text-ink-subtle"
          style={{ fontSize: 32 }}
        >
          inbox
        </span>
        <div className="mt-2 font-ui text-[13px] font-semibold text-ink">
          {c.title}
        </div>
        <p className="mt-1 font-ui text-[11px] text-ink-subtle max-w-[240px] mx-auto">
          {c.hint}
        </p>
      </div>
    </div>
  );
}

function InboxSkeleton() {
  return (
    <ul className="divide-y divide-rule">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="px-3 py-2.5 flex items-start gap-3">
          <span className="w-2 h-2 rounded-full bg-rule mt-1 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-1/3 bg-rule rounded-sm animate-pulse" />
            <div className="h-3 w-2/3 bg-rule rounded-sm animate-pulse" />
            <div className="h-2.5 w-3/4 bg-rule rounded-sm animate-pulse opacity-70" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------- utils --------------------------------- */

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.round((now - then) / 1000);
  if (s < 45) return "just now";
  if (s < 90) return "1m";
  const m = Math.round(s / 60);
  if (m < 55) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 22) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.round(mo / 12)}y`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}
