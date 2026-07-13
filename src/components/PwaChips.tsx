import { useEffect, useState } from "react";
import {
  applyUpdate,
  hasInstallPrompt,
  INSTALL_EVENT,
  requestInstall,
  UPDATE_EVENT,
} from "../lib/pwa";

/**
 * Floating stack of one-time PWA affordances:
 *
 *   • Update-available chip — shows the moment a new service worker has
 *     finished installing and is waiting. Click "Refresh" to activate.
 *   • Install chip — shows once we've captured a beforeinstallprompt.
 *     Click "Install" to trigger the browser's A2HS flow.
 *
 * Both live in the same corner (bottom-left) so they never fight the
 * Word status bar. They're `no-print` and hidden in focus mode by
 * caller placement.
 */

export function PwaChips() {
  const [updateReady, setUpdateReady] = useState(false);
  const [installReady, setInstallReady] = useState(hasInstallPrompt());
  const [dismissedUpdate, setDismissedUpdate] = useState(false);
  const [dismissedInstall, setDismissedInstall] = useState(false);

  useEffect(() => {
    const onUpdate = (e: Event) => {
      setUpdateReady(Boolean((e as CustomEvent<boolean>).detail));
    };
    const onInstall = (e: Event) => {
      setInstallReady(Boolean((e as CustomEvent<boolean>).detail));
    };
    window.addEventListener(UPDATE_EVENT, onUpdate);
    window.addEventListener(INSTALL_EVENT, onInstall);
    return () => {
      window.removeEventListener(UPDATE_EVENT, onUpdate);
      window.removeEventListener(INSTALL_EVENT, onInstall);
    };
  }, []);

  return (
    <div className="no-print fixed bottom-8 left-3 z-40 flex flex-col gap-2 pointer-events-none">
      {installReady && !dismissedInstall && (
        <Chip
          icon="install_desktop"
          tone="primary"
          title="Install this document"
          body="Add Portfolio.docx to your home screen — works offline."
          actionLabel="Install"
          onAction={async () => {
            const outcome = await requestInstall();
            if (outcome !== "accepted") setDismissedInstall(true);
          }}
          onDismiss={() => setDismissedInstall(true)}
        />
      )}
      {updateReady && !dismissedUpdate && (
        <Chip
          icon="sync"
          tone="accent"
          title="Update available"
          body="A new version of Portfolio.docx is ready."
          actionLabel="Refresh"
          onAction={applyUpdate}
          onDismiss={() => setDismissedUpdate(true)}
        />
      )}
    </div>
  );
}

function Chip({
  icon,
  tone,
  title,
  body,
  actionLabel,
  onAction,
  onDismiss,
}: {
  icon: string;
  tone: "primary" | "accent";
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  onDismiss: () => void;
}) {
  const isPrimary = tone === "primary";
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        "pointer-events-auto max-w-[320px] bg-paper border rounded-sm shadow-lg overflow-hidden " +
        (isPrimary ? "border-word-blue" : "border-rule")
      }
    >
      <div
        className={
          "flex items-center gap-2 border-b border-rule px-3 py-1.5 " +
          (isPrimary ? "bg-word-blue-light" : "bg-ribbon")
        }
      >
        <span
          className={
            "material-symbols-outlined icon-fill " +
            (isPrimary ? "text-word-blue" : "text-ink-muted")
          }
          style={{ fontSize: 14 }}
        >
          {icon}
        </span>
        <span
          className={
            "font-ui text-[11px] font-semibold uppercase tracking-[0.12em] " +
            (isPrimary ? "text-word-blue" : "text-ink-muted")
          }
        >
          {title}
        </span>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="ml-auto opacity-60 hover:opacity-100 transition-opacity"
        >
          <span className="material-symbols-outlined text-ink-muted" style={{ fontSize: 14 }}>
            close
          </span>
        </button>
      </div>
      <div className="p-3 flex items-start gap-3">
        <p className="flex-1 font-ui text-[13px] text-ink">{body}</p>
        <button
          onClick={onAction}
          className={
            "shrink-0 inline-flex items-center gap-1 rounded-sm px-2.5 py-1 font-ui text-[12px] font-semibold transition-colors " +
            (isPrimary
              ? "bg-word-blue text-white hover:bg-word-blue-dark"
              : "border border-rule text-ink hover:bg-ribbon-hover")
          }
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
