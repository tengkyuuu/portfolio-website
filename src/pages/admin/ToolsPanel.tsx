import { useEffect, useState } from "react";
import { fetchHealth, type ServerHealth } from "../../lib/api";
import { getAuthMode } from "../../lib/auth";
import {
  CONTENT_EVENT,
  exportContent,
  importContent,
  resetAll,
} from "../../lib/content";
import { formatBytes } from "../../lib/image";
import { Button, Card } from "./ui";

export function ToolsPanel() {
  return (
    <>
      <ServerCard />
      <StorageCard />
      <BackupCard />
      <DangerCard />
    </>
  );
}

function ServerCard() {
  const [health, setHealth] = useState<ServerHealth | null | "loading">("loading");
  const mode = getAuthMode();

  useEffect(() => {
    void fetchHealth().then(setHealth);
  }, []);

  const rows: { label: string; value: string; ok: boolean }[] =
    health === "loading"
      ? []
      : health === null
        ? [{ label: "Backend", value: "Unreachable — edits stay in this browser", ok: false }]
        : [
            { label: "Backend", value: "Connected", ok: true },
            {
              label: "Session",
              value: mode === "server" ? "Server-authenticated" : "Local only — sign out and back in",
              ok: mode === "server",
            },
            {
              label: "Published content",
              value: health.hasContent
                ? "Live — visitors see your edits"
                : "None yet — visitors see the bundled defaults",
              ok: health.hasContent,
            },
          ];

  return (
    <Card
      title="Server"
      description="Status of the content API. When connected and signed in, every change publishes automatically and visitors see it on reload."
    >
      {health === "loading" ? (
        <p className="font-ui text-[12px] text-ink-subtle">Checking…</p>
      ) : (
        <dl className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-2">
              <span
                className={
                  "material-symbols-outlined " +
                  (r.ok ? "text-word-blue icon-fill" : "text-amber-600 dark:text-amber-400")
                }
                style={{ fontSize: 16 }}
              >
                {r.ok ? "check_circle" : "warning"}
              </span>
              <dt className="font-ui text-[12px] font-semibold text-ink-muted w-36 shrink-0">
                {r.label}
              </dt>
              <dd className="font-ui text-[12px] text-ink">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}

/** Approximate localStorage budget across browsers. Used for the visual gauge. */
const STORAGE_BUDGET = 5 * 1024 * 1024;

function StorageCard() {
  const [bytes, setBytes] = useState(() => measureStored());

  useEffect(() => {
    const refresh = () => setBytes(measureStored());
    window.addEventListener(CONTENT_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CONTENT_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const pct = Math.min(100, (bytes / STORAGE_BUDGET) * 100);
  const warn = pct >= 70;

  return (
    <Card
      title="Storage"
      description="How much localStorage the local content cache is using. The server keeps the published copy; this cache makes loads instant and works offline. Most browsers cap localStorage around 5 MB per origin."
    >
      <div className="flex items-baseline justify-between mb-2">
        <span className="font-doc text-[20px] font-bold text-ink tabular-nums">
          {formatBytes(bytes)}
        </span>
        <span className="font-ui text-[12px] text-ink-subtle tabular-nums">
          {pct.toFixed(1)}% of ~5 MB
        </span>
      </div>
      <div className="w-full h-2 bg-rule rounded-sm overflow-hidden">
        <div
          className={"h-full transition-[width] " + (warn ? "bg-red-500" : "bg-word-blue")}
          style={{ width: `${pct}%` }}
        />
      </div>
      {warn && (
        <p className="mt-2 font-ui text-[12px] text-red-600 dark:text-red-400">
          You're using a lot of storage — mostly project screenshots. Consider
          moving images to <code className="bg-ribbon px-1 rounded-sm">public/projects/</code>
          {" "}and referencing by path, or downsizing/removing uploads. If
          localStorage fills up, new saves will fail.
        </p>
      )}
    </Card>
  );
}

function measureStored(): number {
  if (typeof localStorage === "undefined") return 0;
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith("jvc_")) continue;
    const v = localStorage.getItem(k);
    if (v) total += (k.length + v.length) * 2; // UTF-16 in most engines
  }
  return total;
}

function BackupCard() {
  const [importValue, setImportValue] = useState("");
  const [importMsg, setImportMsg] = useState<
    | { kind: "ok"; text: string }
    | { kind: "error"; text: string }
    | null
  >(null);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  function copy() {
    navigator.clipboard.writeText(exportContent());
    setCopyState("copied");
    setTimeout(() => setCopyState("idle"), 1500);
  }

  function download() {
    const blob = new Blob([exportContent()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.href = url;
    a.download = `portfolio-content-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function doImport() {
    if (!importValue.trim()) {
      setImportMsg({ kind: "error", text: "Paste a JSON payload first." });
      return;
    }
    const result = importContent(importValue);
    if (result.ok) {
      setImportMsg({ kind: "ok", text: "Imported successfully. Reload the live site to see changes." });
      setImportValue("");
    } else {
      setImportMsg({ kind: "error", text: result.error });
    }
  }

  return (
    <Card
      title="Backup"
      description="Copy or download your full content as JSON. Use it to back up, restore, or move between browsers."
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          icon={copyState === "copied" ? "check" : "content_copy"}
          onClick={copy}
        >
          {copyState === "copied" ? "Copied" : "Copy JSON"}
        </Button>
        <Button variant="secondary" icon="download" onClick={download}>
          Download .json
        </Button>
      </div>

      <div className="mt-6">
        <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted mb-1.5">
          Import / Restore
        </p>
        <p className="font-ui text-[12px] text-ink-subtle mb-2">
          Paste a previously exported JSON payload below. This{" "}
          <b>replaces all current content</b>.
        </p>
        <textarea
          value={importValue}
          onChange={(e) => {
            setImportValue(e.target.value);
            setImportMsg(null);
          }}
          rows={6}
          placeholder='{ "hero": …, "about": …, "skills": … }'
          className="w-full bg-paper border border-rule rounded-sm px-3 py-2 text-[12px] font-ui text-ink placeholder:text-ink-subtle outline-none focus:border-word-blue focus:ring-2 focus:ring-word-blue/20 resize-y leading-[1.5]"
        />
        <div className="mt-3 flex items-center gap-3">
          <Button variant="secondary" icon="upload" onClick={doImport}>
            Replace from JSON
          </Button>
          {importMsg && (
            <span
              className={
                "font-ui text-[12px] " +
                (importMsg.kind === "ok"
                  ? "text-word-blue"
                  : "text-red-600 dark:text-red-400")
              }
            >
              {importMsg.text}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

function DangerCard() {
  const [confirm, setConfirm] = useState(false);

  return (
    <Card
      title="Danger Zone"
      description="Wipe all admin edits — locally and on the server — and revert every section to the bundled defaults."
    >
      {!confirm ? (
        <Button variant="danger" icon="restart_alt" onClick={() => setConfirm(true)}>
          Reset all content to defaults
        </Button>
      ) : (
        <div className="border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 rounded-sm p-4">
          <p className="font-ui text-[13px] text-red-700 dark:text-red-300 mb-3">
            This deletes <b>everything you've edited</b> — all sections revert to the
            defaults from{" "}
            <code className="bg-paper px-1 rounded-sm">data.ts</code>. Cannot be undone
            unless you've exported a backup.
          </p>
          <div className="flex gap-2">
            <Button
              variant="danger"
              icon="delete_forever"
              onClick={() => {
                resetAll();
                setConfirm(false);
              }}
            >
              Yes, reset everything
            </Button>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
