import { useEffect, useState } from "react";
import {
  hasInstallPrompt,
  INSTALL_EVENT,
  requestInstall,
} from "../lib/pwa";

/** Optional installation prompt. Site updates are applied automatically. */
export function PwaChips() {
  const [installReady, setInstallReady] = useState(hasInstallPrompt());
  const [dismissedInstall, setDismissedInstall] = useState(false);

  useEffect(() => {
    const onInstall = (e: Event) => {
      setInstallReady(Boolean((e as CustomEvent<boolean>).detail));
    };
    window.addEventListener(INSTALL_EVENT, onInstall);
    return () => {
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
              ? "bg-word-blue text-paper hover:bg-word-blue-dark"
              : "border border-rule text-ink hover:bg-ribbon-hover")
          }
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
