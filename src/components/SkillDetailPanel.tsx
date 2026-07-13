import { useEffect, useRef } from "react";
import type { Project } from "../lib/content";
import {
  getSkillMeta,
  LEVEL_HINT,
  LEVEL_LABEL,
  skillLogoUrl,
} from "../lib/skill-catalog";

/**
 * Word-style "Format" side pane for a single skill.
 *
 *   Slide-in from the right, occupies up to 420px on desktop, becomes a
 *   full-width sheet on mobile. Backdrop closes it; Esc closes it (the
 *   parent installs the keydown listener so this remains stateless).
 *
 *   Content: a Word "info balloon" header (logo + name + level chip),
 *   then three optional sub-sections — Why I chose it / Code snippet /
 *   Related projects — each omitted if the underlying data is missing.
 *
 *   Focus is moved to the close button on mount so a keyboard user can
 *   Esc-close immediately without hunting for focus.
 */

type Props = {
  name: string;
  related: Project[];
  onClose: () => void;
};

export function SkillDetailPanel({ name, related, onClose }: Props) {
  const meta = getSkillMeta(name);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    // Lock body scroll while the pane is open — mobile users otherwise
    // scroll the page underneath the sheet.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const level = meta?.level;
  const logo = meta?.logo;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="skill-panel-title"
      className="fixed inset-0 z-50 flex justify-end no-print"
    >
      {/* Backdrop */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/30 dark:bg-black/60"
      />

      {/* Sheet */}
      <div
        className="relative w-full sm:w-[420px] max-w-full h-full bg-paper border-l border-rule shadow-2xl flex flex-col animate-[skill-slide_240ms_ease-out]"
        style={{ animationFillMode: "both" }}
      >
        {/* Ribbon-style header */}
        <header className="border-b border-rule bg-ribbon px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined icon-fill text-word-blue"
              style={{ fontSize: 16 }}
            >
              format_paint
            </span>
            <span
              className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-word-blue"
              id="skill-panel-eyebrow"
            >
              Skill
            </span>
            <button
              ref={closeRef}
              onClick={onClose}
              aria-label="Close skill detail"
              className="ml-auto grid w-7 h-7 place-items-center rounded-sm text-ink-muted hover:bg-ribbon-hover hover:text-ink transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                close
              </span>
            </button>
          </div>

          <div className="mt-2 flex items-center gap-3">
            {logo ? (
              <img
                src={skillLogoUrl(logo)}
                alt=""
                aria-hidden="true"
                width={40}
                height={40}
                className="w-10 h-10 object-contain shrink-0"
              />
            ) : (
              <span
                className="material-symbols-outlined text-word-blue shrink-0"
                style={{ fontSize: 32 }}
              >
                chip_extraction
              </span>
            )}
            <div className="flex-1 min-w-0">
              <h2
                id="skill-panel-title"
                className="font-doc text-[20px] font-bold text-ink leading-tight truncate"
              >
                {name}
              </h2>
              {level && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-word-blue-light text-word-blue font-ui text-[10px] font-semibold uppercase tracking-wider">
                    {LEVEL_LABEL[level]}
                  </span>
                  <span className="font-ui text-[11px] text-ink-subtle italic">
                    {LEVEL_HINT[level]}
                  </span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {!meta && (
            <div className="border border-dashed border-rule rounded-sm p-4 text-center">
              <span
                className="material-symbols-outlined text-ink-subtle"
                style={{ fontSize: 24 }}
              >
                info
              </span>
              <p className="mt-1 font-ui text-[12px] text-ink-subtle">
                No detail card yet for <b>{name}</b>. Add one in{" "}
                <code className="bg-ribbon px-1 rounded-sm">
                  src/lib/skill-catalog.ts
                </code>
                .
              </p>
            </div>
          )}

          {meta?.why && (
            <section>
              <SectionTitle>Why I reach for it</SectionTitle>
              <p className="font-doc text-[14.5px] leading-[1.7] text-ink">
                {meta.why}
              </p>
            </section>
          )}

          {meta?.snippet && (
            <section>
              <SectionTitle>
                Snippet · <span className="normal-case text-ink-subtle">{meta.snippet.lang}</span>
              </SectionTitle>
              <pre className="mt-1 bg-ribbon border border-rule rounded-sm p-3 overflow-x-auto max-h-[300px]">
                <code
                  className="font-ui text-[12px] leading-[1.55] text-ink"
                  aria-label={`${meta.snippet.lang} code sample`}
                >
                  {meta.snippet.code}
                </code>
              </pre>
            </section>
          )}

          <section>
            <SectionTitle>
              Related projects
              <span className="ml-1 text-ink-subtle normal-case tracking-normal font-normal">
                · {related.length}
              </span>
            </SectionTitle>
            {related.length === 0 ? (
              <p className="font-ui text-[12px] italic text-ink-subtle">
                No projects tagged with <b>{name}</b> yet. Add it to a project's
                Tags or Tech Stack in the admin to link them here.
              </p>
            ) : (
              <ul className="space-y-2">
                {related.map((p) => (
                  <li key={p.id}>
                    <a
                      href={`#work-${p.id}`}
                      className="block border border-rule rounded-sm px-3 py-2 hover:bg-ribbon-hover hover:border-word-blue transition-colors"
                    >
                      <div className="font-doc text-[14px] font-semibold text-ink">
                        {p.title}
                      </div>
                      {p.blurb && (
                        <div className="font-ui text-[11px] text-ink-muted line-clamp-2">
                          {p.blurb}
                        </div>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <footer className="border-t border-rule bg-ribbon px-4 py-2 flex items-center justify-between font-ui text-[10px] uppercase tracking-[0.14em] text-ink-subtle">
          <span className="inline-flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: 11 }}>
              keyboard
            </span>
            Esc closes
          </span>
          <span>Skills · Detail Pane</span>
        </footer>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-ui text-[11px] font-bold uppercase tracking-[0.12em] text-word-blue border-b border-rule pb-1 mb-2">
      {children}
    </h3>
  );
}
