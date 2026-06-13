import { useEffect, useState } from "react";

type Phase = "hidden" | "showing" | "fading";

type TabLoaderProps = {
  /** When true the loader mounts and is fully visible. When it flips to false the loader fades out. */
  visible: boolean;
  /** Tab name shown in the loader footnote (e.g. "Projects"). */
  label?: string;
};

/**
 * "Document opening…" overlay used while a tab is loading.
 * Mounts only when `visible` becomes true, fades out cleanly when it goes false.
 * Drop inside a `position: relative` ancestor — covers it via `inset-0`.
 */
export function TabLoader({ visible, label = "Document" }: TabLoaderProps) {
  const [phase, setPhase] = useState<Phase>(visible ? "showing" : "hidden");

  useEffect(() => {
    if (visible) {
      setPhase("showing");
      return;
    }
    if (phase === "showing") {
      setPhase("fading");
      const t = setTimeout(() => setPhase("hidden"), 360);
      return () => clearTimeout(t);
    }
  }, [visible, phase]);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden="true"
      role="status"
      className={
        "absolute inset-0 z-20 bg-paper flex flex-col items-center justify-center overflow-hidden " +
        (phase === "fading" ? "loader-fade-out pointer-events-none" : "")
      }
    >
      {/* Top blue progress strip (Word's "saving / opening" bar) */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-rule">
        <div className="loading-bar h-full bg-word-blue" />
      </div>

      <div className="flex flex-col items-center gap-4 loader-pulse">
        <span
          className="material-symbols-outlined icon-fill text-word-blue"
          style={{ fontSize: 64 }}
        >
          description
        </span>
        <div className="font-doc italic text-[16px] text-ink-muted">
          {label} loading<span className="word-caret">…</span>
        </div>
      </div>

      {/* Footnote */}
      <div className="absolute bottom-6 font-ui text-[11px] uppercase tracking-[0.18em] text-ink-subtle">
        Portfolio.docx · {label}
      </div>
    </div>
  );
}
