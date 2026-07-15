import { useCallback, useEffect, useState } from "react";
import { syncFromServer } from "../../lib/content";
import {
  fetchActivity,
  fetchVersions,
  restoreVersion,
  type ActivityRow,
  type VersionMeta,
} from "../../lib/history-api";
import { Button, Card } from "./ui";

/**
 * Word "Version History" (File → Info) + "Track Changes" panes.
 *
 *   Versions card — snapshots taken before each publish (coalesced to one
 *   per 5-minute editing session, server keeps the 20 newest). Restore
 *   backs up current content first, so a restore is itself undoable.
 *
 *   Activity card — server-written audit rows: publishes, restores,
 *   resets, inquiry status changes / deletions.
 */

export function HistoryPanel() {
  return (
    <>
      <VersionsCard />
      <ActivityCard />
    </>
  );
}

/* ------------------------------ versions ------------------------------ */

function VersionsCard() {
  const [items, setItems] = useState<VersionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoredAt, setRestoredAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchVersions();
    if (!result.ok) {
      setError(describeFailure(result.kind, result.message));
      setLoading(false);
      return;
    }
    setItems(result.items);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function doRestore(id: string) {
    setConfirming(null);
    setRestoring(id);
    const result = await restoreVersion(id);
    setRestoring(null);
    if (!result.ok) {
      setError(describeFailure(result.kind, result.message));
      return;
    }
    // Pull the restored content into the local cache so every editor
    // section refreshes (they all listen for CONTENT_EVENT).
    await syncFromServer();
    setRestoredAt(id);
    setTimeout(() => setRestoredAt(null), 2500);
    void load(); // the pre-restore backup now appears at the top
  }

  return (
    <Card
      title="Version History"
      description="Snapshots taken before each publish — one per editing session, newest first, 20 kept. Restoring backs up the current content first."
      actions={
        <Button variant="ghost" icon="refresh" onClick={() => void load()}>
          Refresh
        </Button>
      }
    >
      {error && (
        <ErrorNote message={error} onDismiss={() => setError(null)} />
      )}

      {loading && items.length === 0 ? (
        <SkeletonRows />
      ) : items.length === 0 ? (
        <EmptyNote
          icon="history"
          title="No versions yet"
          hint="Versions appear after your next published edit. If this deployment is new, run supabase/migrations/004_history.sql first."
        />
      ) : (
        <ol className="relative border-l border-rule ml-2 space-y-4">
          {items.map((v, i) => {
            const isRestoring = restoring === v.id;
            const justRestored = restoredAt === v.id;
            return (
              <li key={v.id} className="relative pl-5">
                <span
                  aria-hidden="true"
                  className={
                    "absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-paper " +
                    (i === 0 ? "bg-word-blue" : "bg-rule-strong")
                  }
                />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-ui text-[13px] font-semibold text-ink">
                    {relTime(v.created_at)}
                  </span>
                  <span className="font-ui text-[11px] text-ink-subtle tabular-nums">
                    {absTime(v.created_at)}
                  </span>
                  {v.byte_size != null && (
                    <span className="font-ui text-[11px] text-ink-subtle tabular-nums">
                      · {fmtBytes(v.byte_size)}
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-1.5">
                    {confirming === v.id ? (
                      <>
                        <span className="font-ui text-[11px] italic text-ink-muted">
                          Overwrite live content?
                        </span>
                        <Button variant="primary" onClick={() => void doRestore(v.id)}>
                          Restore
                        </Button>
                        <Button variant="ghost" onClick={() => setConfirming(null)}>
                          Cancel
                        </Button>
                      </>
                    ) : justRestored ? (
                      <span className="inline-flex items-center gap-1 font-ui text-[11px] font-semibold text-word-blue">
                        <span className="material-symbols-outlined icon-fill" style={{ fontSize: 14 }}>
                          check_circle
                        </span>
                        Restored
                      </span>
                    ) : (
                      <Button
                        variant="secondary"
                        icon={isRestoring ? "hourglass_top" : "history"}
                        onClick={() => setConfirming(v.id)}
                        disabled={isRestoring}
                      >
                        {isRestoring ? "Restoring…" : "Restore"}
                      </Button>
                    )}
                  </div>
                </div>
                {v.sections.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {v.sections.map((s) => (
                      <span
                        key={s}
                        className="font-ui text-[10px] uppercase tracking-wider text-ink-muted bg-ribbon border border-rule rounded-sm px-1.5 py-0.5"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

/* ------------------------------ activity ------------------------------ */

const ACTION_META: Record<string, { icon: string; describe: (d: Record<string, unknown> | null) => string }> = {
  "content.publish": {
    icon: "cloud_upload",
    describe: (d) => {
      const sections = Array.isArray(d?.sections) ? (d?.sections as string[]) : [];
      return sections.length > 0
        ? `Published content — changed ${sections.join(", ")}`
        : "Published content";
    },
  },
  "content.restore": {
    icon: "history",
    describe: () => "Restored an earlier version",
  },
  "content.reset": {
    icon: "restart_alt",
    describe: () => "Reset content to defaults",
  },
  "inquiry.status": {
    icon: "mark_email_read",
    describe: (d) => `Marked an inquiry as ${String(d?.status ?? "…")}`,
  },
  "inquiry.delete": {
    icon: "delete",
    describe: () => "Deleted an inquiry",
  },
};

function ActivityCard() {
  const [items, setItems] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchActivity();
    if (!result.ok) {
      setError(describeFailure(result.kind, result.message));
      setLoading(false);
      return;
    }
    setItems(result.items);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card
      title="Track Changes"
      description="Every content publish, restore, reset, and inbox action — written server-side, so the trail can't be skipped."
      actions={
        <Button variant="ghost" icon="refresh" onClick={() => void load()}>
          Refresh
        </Button>
      }
    >
      {error && <ErrorNote message={error} onDismiss={() => setError(null)} />}

      {loading && items.length === 0 ? (
        <SkeletonRows />
      ) : items.length === 0 ? (
        <EmptyNote
          icon="edit_note"
          title="No activity yet"
          hint="Actions appear here as you publish edits and manage the inbox."
        />
      ) : (
        <ul className="divide-y divide-rule">
          {items.map((row) => {
            const meta = ACTION_META[row.action] ?? {
              icon: "info",
              describe: () => row.action,
            };
            return (
              <li key={row.id} className="flex items-start gap-3 py-2.5">
                <span
                  className="material-symbols-outlined text-word-blue shrink-0 mt-0.5"
                  style={{ fontSize: 18 }}
                >
                  {meta.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-ui text-[13px] text-ink">
                    {meta.describe(row.detail)}
                  </p>
                </div>
                <span
                  className="font-ui text-[11px] text-ink-subtle tabular-nums shrink-0"
                  title={absTime(row.created_at)}
                >
                  {relTime(row.created_at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------ shared bits ------------------------------ */

function describeFailure(kind: string, message?: string): string {
  if (kind === "unauthorized") return "Your session expired. Sign out and back in.";
  if (kind === "offline") return "Couldn't reach the server. Check your connection.";
  return message ?? "Something went wrong.";
}

function ErrorNote({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="mb-3 border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 rounded-sm px-3 py-2 font-ui text-[12px] text-red-700 dark:text-red-300 flex items-start gap-1.5">
      <span className="material-symbols-outlined shrink-0" style={{ fontSize: 14, marginTop: 1 }}>
        error
      </span>
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
      </button>
    </div>
  );
}

function EmptyNote({ icon, title, hint }: { icon: string; title: string; hint: string }) {
  return (
    <div className="grid place-items-center py-10 text-center">
      <span className="material-symbols-outlined text-ink-subtle" style={{ fontSize: 32 }}>
        {icon}
      </span>
      <div className="mt-2 font-ui text-[13px] font-semibold text-ink">{title}</div>
      <p className="mt-1 font-ui text-[11px] text-ink-subtle max-w-[320px]">{hint}</p>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full bg-rule animate-pulse shrink-0" />
          <div className="h-3 bg-rule rounded-sm animate-pulse" style={{ width: `${75 - i * 10}%` }} />
        </div>
      ))}
    </div>
  );
}

function relTime(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return "just now";
  if (s < 90) return "1m ago";
  const m = Math.round(s / 60);
  if (m < 55) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 22) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.round(d / 30);
  return mo < 12 ? `${mo}mo ago` : `${Math.round(mo / 12)}y ago`;
}

function absTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
