import { useEffect, useRef, useState } from "react";
import { LANGUAGES, useI18n, type LanguageId } from "../lib/i18n";

type FooterProps = {
  currentPage: number;
  totalPages: number;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onEnterFocus: () => void;
};

const ZOOM_MIN = 50;
const ZOOM_MAX = 200;

export function Footer({
  currentPage,
  totalPages,
  zoom,
  onZoomChange,
  onEnterFocus,
}: FooterProps) {
  const { t } = useI18n();
  const [wordCount, setWordCount] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  // Read the current paper aloud with the browser's speech synthesis
  const toggleReadAloud = () => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (synth.speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const text = document.getElementById("paper-doc")?.innerText ?? "";
    if (!text.trim()) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    synth.speak(utterance);
    setSpeaking(true);
  };

  // Stop reading when the user flips to another page or leaves
  useEffect(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    return () => window.speechSynthesis?.cancel();
  }, [currentPage]);

  // Click or drag anywhere on the slider track, snapping to 10% steps
  const zoomFromPointer = (clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    onZoomChange(
      Math.round((ZOOM_MIN + ratio * (ZOOM_MAX - ZOOM_MIN)) / 10) * 10
    );
  };

  useEffect(() => {
    // Recount whenever the active paper swaps in
    const recount = () => {
      const paper = document.getElementById("paper-doc");
      if (!paper) return;
      const text = paper.innerText || "";
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      setWordCount(words);
    };
    recount();
    // Wait a frame in case the new paper just mounted
    const raf = requestAnimationFrame(recount);
    return () => cancelAnimationFrame(raf);
  }, [currentPage]);

  return (
    <footer className="no-print fixed bottom-0 left-0 right-0 h-6 z-50 bg-status-bar text-status-bar-fg text-[11px] flex items-center justify-between px-3 font-ui">
      <div className="flex items-center gap-3">
        <span className="tabular-nums">
          {t("status.page")} {currentPage} {t("status.of")} {totalPages}
        </span>
        <span className="border-l border-white/30 pl-3 tabular-nums">
          {wordCount.toLocaleString()} {t("status.words")}
        </span>
        <LanguagePicker />
        <span className="hidden md:inline border-l border-white/30 pl-3">
          <span
            className="material-symbols-outlined align-middle"
            style={{ fontSize: 14 }}
          >
            check_circle
          </span>{" "}
          {t("status.accessibility")}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          aria-label={speaking ? "Stop reading" : "Read aloud"}
          aria-pressed={speaking}
          onClick={toggleReadAloud}
          className={
            "hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded transition-colors " +
            (speaking ? "bg-white/25" : "hover:bg-white/15")
          }
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
            {speaking ? "stop_circle" : "volume_up"}
          </span>
          <span className="hidden md:inline">
            {speaking ? "Stop" : t("status.readAloud")}
          </span>
        </button>
        <button
          aria-label="Focus mode"
          title="Hide everything but the document (Esc to exit)"
          onClick={onEnterFocus}
          className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded hover:bg-white/15 transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
            crop_free
          </span>
          <span className="hidden md:inline">{t("status.focus")}</span>
        </button>
        <button
          aria-label="Print layout"
          aria-pressed="true"
          title="Current view"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/15 hover:bg-white/25 transition-colors cursor-default"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
            article
          </span>
          <span className="hidden md:inline">{t("status.printLayout")}</span>
        </button>

        <div className="hidden sm:flex items-center gap-1.5 ml-2">
          <button
            onClick={() => onZoomChange(Math.max(ZOOM_MIN, zoom - 10))}
            className="hover:bg-white/15 rounded p-0.5"
            aria-label="Zoom out"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              remove
            </span>
          </button>
          <div
            ref={trackRef}
            role="slider"
            aria-label="Zoom"
            aria-valuemin={ZOOM_MIN}
            aria-valuemax={ZOOM_MAX}
            aria-valuenow={zoom}
            className="w-20 py-1.5 -my-1.5 cursor-pointer touch-none"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              zoomFromPointer(e.clientX);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 1) zoomFromPointer(e.clientX);
            }}
          >
            <div className="h-1 bg-white/30 rounded-full relative">
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2 h-3 bg-white rounded-sm -ml-1"
                style={{
                  left: `${((zoom - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN)) * 100}%`,
                }}
              />
            </div>
          </div>
          <button
            onClick={() => onZoomChange(Math.min(ZOOM_MAX, zoom + 10))}
            className="hover:bg-white/15 rounded p-0.5"
            aria-label="Zoom in"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              add
            </span>
          </button>
          <button
            onClick={() => onZoomChange(100)}
            title="Reset to 100%"
            className="ml-1 w-9 text-right tabular-nums hover:bg-white/15 rounded px-0.5"
          >
            {zoom}%
          </button>
        </div>
      </div>
    </footer>
  );
}

/**
 * Word-style "Language" chip in the status bar. Clicking opens a small popover
 * upward with the four supported languages. Selecting one calls setLanguage,
 * which flips the app-wide translation set + <html lang="…">.
 */
function LanguagePicker() {
  const { language, setLanguage, t } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find((l) => l.id === language) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative hidden sm:inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t("status.language")}
        aria-expanded={open}
        className={
          "border-l border-white/30 pl-3 pr-1 h-6 -my-0.5 inline-flex items-center gap-1 hover:bg-white/10 transition-colors " +
          (open ? "bg-white/15" : "")
        }
      >
        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
          language
        </span>
        {current.statusLabel}
        <span className="material-symbols-outlined opacity-70" style={{ fontSize: 12 }}>
          arrow_drop_up
        </span>
      </button>
      {open && (
        <div className="word-popover absolute bottom-full left-0 mb-1 w-64 py-2 z-50 text-ink normal-case tracking-normal font-normal text-[13px]">
          <div className="px-3 pb-1.5 border-b border-rule">
            <div className="font-ui text-[13px] font-semibold text-ink">
              {t("status.language")}
            </div>
            <div className="font-ui text-[11px] text-ink-subtle">
              Set the document language
            </div>
          </div>
          <div className="py-1">
            {LANGUAGES.map((lang) => {
              const isActive = lang.id === language;
              return (
                <button
                  key={lang.id}
                  onClick={() => {
                    setOpen(false);
                    setLanguage(lang.id as LanguageId);
                  }}
                  className={
                    "w-full flex items-center gap-3 px-3 py-1.5 text-left transition-colors " +
                    (isActive ? "bg-word-blue-light" : "hover:bg-ribbon-hover")
                  }
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-ui text-[13px] font-medium text-ink truncate">
                      {lang.label}
                    </div>
                    {lang.label !== lang.english && (
                      <div className="font-ui text-[11px] text-ink-subtle truncate">
                        {lang.english}
                      </div>
                    )}
                  </div>
                  {isActive && (
                    <span
                      className="material-symbols-outlined text-word-blue icon-fill"
                      style={{ fontSize: 16 }}
                    >
                      check_circle
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
