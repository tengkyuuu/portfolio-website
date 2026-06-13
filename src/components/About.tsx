import { useMemo } from "react";
import { getContent } from "../lib/content";
import { renderParagraphs } from "../lib/inline";

export function About() {
  const { about } = useMemo(() => getContent(), []);
  const highlights = about.highlights ?? [];

  return (
    <section>
      <h2 className="font-ui text-[13px] font-bold uppercase tracking-[0.12em] text-word-blue section-rule pb-1.5 mb-4">
        Executive Summary
      </h2>

      {/* Short lead — scannable, not a wall of text */}
      <div className="font-doc text-[17px] leading-[1.6] text-ink space-y-3 max-w-2xl">
        {renderParagraphs(about.paragraphs)}
      </div>

      {/* Highlights — what I do, at a glance */}
      {highlights.length > 0 && (
        <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
          {highlights.map((h) => (
            <li
              key={h}
              className="flex items-start gap-2 font-doc text-[14px] text-ink-muted"
            >
              <span
                className="material-symbols-outlined text-word-blue mt-0.5 shrink-0"
                style={{ fontSize: 16 }}
              >
                check_circle
              </span>
              <span>{h}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Quick facts — bordered spec panel */}
      {about.specs.length > 0 && (
        <div className="mt-7 border border-rule rounded-sm bg-row-alt/50 divide-y divide-rule">
          <div className="px-4 py-2 font-ui text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            Quick Facts
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2">
            {about.specs.map((s, i) => (
              <div
                key={s.label}
                className={
                  "flex items-baseline gap-3 px-4 py-2.5 " +
                  // hide the right cell's left border on small screens via gap; add a subtle divider on sm+
                  (i % 2 === 0 ? "sm:border-r sm:border-rule" : "")
                }
              >
                <dt className="font-ui text-[11px] font-semibold uppercase tracking-wider text-ink-subtle w-20 shrink-0">
                  {s.label}
                </dt>
                <dd className="font-doc text-[14px] text-ink">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}
