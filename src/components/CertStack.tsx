import { useEffect, useMemo, useRef, useState } from "react";
import type { Cert } from "../lib/content";

/**
 * Scroll-to-view certificate deck.
 *
 *   • Cards stack in a shallow 3D perspective — front one crisp, the
 *     next few peek from underneath with progressive scale/blur/opacity.
 *   • Mouse wheel over the deck advances / rewinds. We accumulate delta
 *     across events so a light trackpad flick doesn't skip five cards.
 *   • Only preventDefault when there IS a card to move to — the page
 *     scroll takes over at the ends of the deck. No trap.
 *   • Keyboard: ArrowLeft/Right, PageUp/PageDown, Home/End. Focusable
 *     via a hidden button so screen readers can drive it too.
 *   • Touch: swipe up/down changes cards (>= 40px threshold).
 *   • Reduced-motion honoured — transitions drop to instant.
 *   • Fullscreen "expand" button — pops a lightbox for close inspection.
 *
 * Falls back to a plain list of thumbnails when JS is disabled (the
 * <noscript> path).
 */

const CARD_TRANSITION = 460; // ms
const WHEEL_THRESHOLD = 90; // px of deltaY per advance
const VISIBLE_BEHIND = 3; // cards peeking behind the front one

type Props = {
  certs: Cert[];
  issuer: string;
};

export function CertStack({ certs, issuer }: Props) {
  const [idx, setIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const deckRef = useRef<HTMLDivElement>(null);
  const accumRef = useRef(0);
  const lastWheelRef = useRef(0);
  const touchStartRef = useRef<number | null>(null);
  const count = certs.length;

  const clamp = (n: number) => Math.max(0, Math.min(count - 1, n));

  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  // Wheel: convert vertical delta to card advances.
  useEffect(() => {
    const el = deckRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // Reset accumulator on direction change so a flip doesn't lag.
      const now = performance.now();
      if (now - lastWheelRef.current > 400) accumRef.current = 0;
      lastWheelRef.current = now;

      // Only capture the event if there's somewhere to go — this is
      // what keeps the page scrolling naturally at the ends.
      const goingDown = e.deltaY > 0;
      const canGo = goingDown ? idx < count - 1 : idx > 0;
      if (!canGo) return;

      e.preventDefault();
      accumRef.current += e.deltaY;
      if (accumRef.current > WHEEL_THRESHOLD) {
        accumRef.current = 0;
        setIdx((i) => clamp(i + 1));
      } else if (accumRef.current < -WHEEL_THRESHOLD) {
        accumRef.current = 0;
        setIdx((i) => clamp(i - 1));
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, count]);

  // Touch: swipe support.
  useEffect(() => {
    const el = deckRef.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => {
      touchStartRef.current = e.touches[0]?.clientY ?? null;
    };
    const onEnd = (e: TouchEvent) => {
      if (touchStartRef.current === null) return;
      const dy = (e.changedTouches[0]?.clientY ?? 0) - touchStartRef.current;
      if (dy < -40) setIdx((i) => clamp(i + 1));
      else if (dy > 40) setIdx((i) => clamp(i - 1));
      touchStartRef.current = null;
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  // Keyboard: focused-on-deck arrows navigate.
  const onDeckKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "PageDown") {
      e.preventDefault();
      setIdx((i) => clamp(i + 1));
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      setIdx((i) => clamp(i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setIdx(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setIdx(count - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setExpanded(true);
    }
  };

  return (
    <div
      className="mt-2"
      aria-labelledby="cert-stack-heading"
    >
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p
            id="cert-stack-heading"
            className="font-ui text-[11px] font-semibold uppercase tracking-[0.14em] text-word-blue"
          >
            {count} Course Certificates · {issuer}
          </p>
          <p className="font-ui text-[11px] text-ink-subtle italic">
            Scroll on the deck or use ← → to flip through. Click a card to
            enlarge.
          </p>
        </div>
        <span className="font-ui text-[11px] font-semibold text-ink-subtle tabular-nums shrink-0">
          {idx + 1} / {count}
        </span>
      </div>

      <div
        ref={deckRef}
        role="region"
        aria-roledescription="carousel"
        aria-label="Course certificates"
        tabIndex={0}
        onKeyDown={onDeckKeyDown}
        onClick={() => setExpanded(true)}
        className="cert-deck relative w-full aspect-[16/11] overflow-hidden rounded-sm bg-row-alt border border-rule cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-word-blue focus-visible:ring-offset-2"
        style={{ perspective: "1200px" }}
      >
        {certs.map((c, i) => {
          const offset = i - idx;
          // Behind: cards further back get smaller, dimmer, blurrier.
          // Ahead (already flipped away): slide down + fade out.
          const style = cardStyle(offset, reduced);
          const hidden = offset > VISIBLE_BEHIND || offset < -1;
          return (
            <div
              key={c.title + i}
              aria-hidden={i !== idx}
              className={
                "absolute inset-4 md:inset-6 bg-paper border border-rule shadow-xl overflow-hidden rounded-sm " +
                (hidden ? "invisible" : "")
              }
              style={style}
            >
              {c.image ? (
                <img
                  src={c.image}
                  alt={
                    i === idx
                      ? `${c.title} — ${c.issuer} certificate`
                      : ""
                  }
                  loading={i === idx ? "eager" : "lazy"}
                  decoding="async"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="grid place-items-center h-full font-doc text-ink-subtle italic p-6 text-center">
                  {c.title}
                </div>
              )}
              {/* Front-card corner chip */}
              {i === idx && (
                <div className="pointer-events-none absolute bottom-2 left-2 font-ui text-[10px] uppercase tracking-[0.14em] text-ink-muted bg-paper/90 border border-rule rounded-sm px-1.5 py-0.5">
                  {c.title}
                </div>
              )}
            </div>
          );
        })}

        {/* Fullscreen affordance */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(true);
          }}
          aria-label="Expand certificate"
          className="absolute top-2 right-2 grid place-items-center w-8 h-8 rounded-sm bg-paper/90 border border-rule text-ink-muted hover:text-word-blue hover:bg-paper transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            open_in_full
          </span>
        </button>

        {/* Prev / next affordances (visible on hover / focus for click users) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIdx((i) => clamp(i - 1));
          }}
          disabled={idx === 0}
          aria-label="Previous certificate"
          className="absolute left-2 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-full bg-paper/85 border border-rule text-ink shadow-sm hover:bg-paper hover:text-word-blue disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIdx((i) => clamp(i + 1));
          }}
          disabled={idx === count - 1}
          aria-label="Next certificate"
          className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-full bg-paper/85 border border-rule text-ink shadow-sm hover:bg-paper hover:text-word-blue disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>

      {/* Progress bar + dots */}
      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1 h-1 bg-rule rounded-full overflow-hidden">
          <div
            className="h-full bg-word-blue"
            style={{
              width: `${((idx + 1) / count) * 100}%`,
              transition: reduced
                ? "none"
                : `width ${CARD_TRANSITION}ms cubic-bezier(0.4,0,0.2,1)`,
            }}
          />
        </div>
        <div className="flex items-center gap-1">
          {certs.map((c, i) => (
            <button
              key={c.title + i}
              onClick={() => setIdx(i)}
              aria-label={`Go to ${c.title}`}
              aria-current={i === idx}
              className={
                "h-1.5 rounded-full transition-all " +
                (i === idx
                  ? "w-4 bg-word-blue"
                  : "w-1.5 bg-rule-strong hover:bg-ink-subtle")
              }
            />
          ))}
        </div>
      </div>

      {expanded && (
        <CertLightbox
          certs={certs}
          startIdx={idx}
          onIdxChange={setIdx}
          onClose={() => setExpanded(false)}
        />
      )}
    </div>
  );
}

function cardStyle(offset: number, reduced: boolean): React.CSSProperties {
  // Ahead of current — swipe down and fade out.
  if (offset < 0) {
    return {
      transform: "translateY(60px) scale(0.98) rotateX(2deg)",
      opacity: 0,
      filter: "blur(0px)",
      pointerEvents: "none",
      transition: reduced
        ? "none"
        : `transform ${CARD_TRANSITION}ms cubic-bezier(0.4,0,0.2,1), opacity ${CARD_TRANSITION}ms ease, filter ${CARD_TRANSITION}ms ease`,
      zIndex: 50 - offset,
    };
  }

  // Depth stack behind the front card.
  const y = offset * -12; // shift up slightly
  const s = 1 - offset * 0.04; // shrink
  const o = offset === 0 ? 1 : Math.max(0.35, 1 - offset * 0.25);
  const b = offset === 0 ? 0 : Math.min(4, offset * 1.4);
  return {
    transform: `translateY(${y}px) scale(${s})`,
    opacity: o,
    filter: `blur(${b}px)`,
    pointerEvents: offset === 0 ? "auto" : "none",
    transition: reduced
      ? "none"
      : `transform ${CARD_TRANSITION}ms cubic-bezier(0.4,0,0.2,1), opacity ${CARD_TRANSITION}ms ease, filter ${CARD_TRANSITION}ms ease`,
    zIndex: 50 - offset,
    transformOrigin: "center top",
  };
}

/* -------------------------- expanded lightbox --------------------------- */

function CertLightbox({
  certs,
  startIdx,
  onIdxChange,
  onClose,
}: {
  certs: Cert[];
  startIdx: number;
  onIdxChange: (i: number) => void;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIdx);
  const count = certs.length;
  const go = (n: number) => {
    const next = (n + count) % count;
    setIdx(next);
    onIdxChange(next);
  };
  const current = certs[idx];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(idx - 1);
      if (e.key === "ArrowRight") go(idx + 1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, count]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 no-print"
      role="dialog"
      aria-modal="true"
      aria-label="Course certificate — expanded"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-paper rounded-sm border border-rule shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-rule">
          <div className="min-w-0">
            <span className="font-doc text-[15px] font-bold text-ink truncate">
              {current.title}
            </span>
            <span className="font-ui text-[12px] text-ink-subtle">
              {" "}— {current.issuer}
            </span>
          </div>
          <span className="font-ui text-[12px] text-ink-subtle tabular-nums shrink-0">
            {idx + 1} / {count}
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-1 grid place-items-center w-8 h-8 rounded-sm text-ink-muted hover:bg-ribbon-hover hover:text-ink transition-colors shrink-0"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
              close
            </span>
          </button>
        </div>
        <div className="relative bg-row-alt">
          <img
            key={current.image}
            src={current.image}
            alt={`${current.title} certificate — ${current.issuer}`}
            className="w-full max-h-[70vh] object-contain"
          />
          <button
            aria-label="Previous certificate"
            onClick={() => go(idx - 1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-full bg-paper/90 border border-rule text-ink shadow-sm hover:bg-paper hover:text-word-blue transition-colors"
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <button
            aria-label="Next certificate"
            onClick={() => go(idx + 1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-full bg-paper/90 border border-rule text-ink shadow-sm hover:bg-paper hover:text-word-blue transition-colors"
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>
    </div>
  );
}
