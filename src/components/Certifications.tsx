import { useEffect, useMemo, useState } from "react";
import { getContent, type Cert } from "../lib/content";

export function Certifications() {
  const { certs, timeline } = useMemo(() => getContent(), []);
  const awards = certs.filter((c) => !c.image);
  const courseCerts = certs.filter((c) => c.image);
  const courseIssuer = courseCerts[0]?.issuer ?? "Online courses";

  const [carouselOpen, setCarouselOpen] = useState(false);

  return (
    <section className="space-y-10">
      {/* Education + Experience */}
      <div>
        <h2 className="font-ui text-[13px] font-bold uppercase tracking-[0.12em] text-word-blue section-rule pb-1.5 mb-4">
          Education &amp; Experience
        </h2>
        <ul className="space-y-4 font-doc text-[15px]">
          {timeline.map((entry) => (
            <li
              key={entry.title}
              className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1"
            >
              <div className="flex-1">
                <h3 className="font-bold text-ink leading-snug">{entry.title}</h3>
                <p className="text-ink-muted text-[14px]">{entry.org}</p>
                <p className="text-ink-muted text-[14px] mt-1 leading-relaxed">
                  {entry.blurb}
                </p>
              </div>
              <span className="font-ui text-[12px] text-ink-subtle uppercase tracking-wider sm:text-right shrink-0 sm:ml-6 tabular-nums">
                {entry.range}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Certifications & Awards */}
      <div>
        <h2 className="font-ui text-[13px] font-bold uppercase tracking-[0.12em] text-word-blue section-rule pb-1.5 mb-4">
          Certifications &amp; Awards
        </h2>
        <ul className="font-doc text-[15px] divide-y divide-rule">
          {awards.map((c) => {
            const isLink = Boolean(c.href && c.href !== "#");
            return (
              <li
                key={c.title + c.issuer}
                className="flex items-baseline justify-between gap-4 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <a
                    href={c.href ?? "#"}
                    target={isLink ? "_blank" : undefined}
                    rel={isLink ? "noreferrer" : undefined}
                    className={
                      "font-semibold text-ink" +
                      (isLink
                        ? " hover:text-word-blue hover:underline underline-offset-2"
                        : " pointer-events-none")
                    }
                  >
                    {c.title}
                  </a>
                  <span className="text-ink-muted text-[14px]"> — {c.issuer}</span>
                </div>
                {c.date && (
                  <span className="font-ui text-[12px] text-ink-subtle uppercase tracking-wider tabular-nums shrink-0">
                    {c.date}
                  </span>
                )}
              </li>
            );
          })}

          {/* Sololearn course certs — one row that opens a carousel */}
          {courseCerts.length > 0 && (
            <li className="py-2.5">
              <button
                onClick={() => setCarouselOpen(true)}
                className="group w-full flex items-center justify-between gap-4 text-left"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-ink group-hover:text-word-blue transition-colors">
                    {courseCerts.length}× Course Certificates
                  </span>
                  <span className="text-ink-muted text-[14px]"> — {courseIssuer}</span>
                  <span className="ml-2 inline-flex items-center gap-1 font-ui text-[11px] font-semibold uppercase tracking-wider text-word-blue">
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 14 }}
                    >
                      collections
                    </span>
                  </span>
                </div>
                <span
                  className="material-symbols-outlined text-ink-subtle group-hover:text-word-blue transition-colors shrink-0"
                  style={{ fontSize: 18 }}
                >
                  chevron_right
                </span>
              </button>
            </li>
          )}
        </ul>
      </div>

      {carouselOpen && (
        <CertCarousel certs={courseCerts} onClose={() => setCarouselOpen(false)} />
      )}
    </section>
  );
}

/** Full-screen lightbox carousel for the course certificates. */
function CertCarousel({ certs, onClose }: { certs: Cert[]; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const count = certs.length;
  const go = (n: number) => setIdx((n + count) % count);
  const current = certs[idx];

  // Keyboard: Esc closes, arrows navigate. Lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIdx((i) => (i - 1 + count) % count);
      if (e.key === "ArrowRight") setIdx((i) => (i + 1) % count);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [count, onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 no-print"
      role="dialog"
      aria-modal="true"
      aria-label="Course certificates"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-paper rounded-sm border border-rule shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-rule">
          <div className="min-w-0">
            <span className="font-doc text-[15px] font-bold text-ink truncate">
              {current.title}
            </span>
            <span className="font-ui text-[12px] text-ink-subtle">
              {" "}
              — {current.issuer}
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

        {/* Image */}
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

        {/* Dots */}
        <div className="flex items-center justify-center flex-wrap gap-1.5 px-4 py-3 border-t border-rule">
          {certs.map((c, i) => (
            <button
              key={c.title + i}
              aria-label={`Go to ${c.title}`}
              aria-current={i === idx}
              onClick={() => go(i)}
              className={
                "h-1.5 rounded-full transition-all " +
                (i === idx
                  ? "w-5 bg-word-blue"
                  : "w-1.5 bg-rule-strong hover:bg-ink-subtle")
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
