import { useMemo } from "react";
import { getContent } from "../lib/content";
import { renderParagraphs } from "../lib/inline";

export function About() {
  const { about } = useMemo(() => getContent(), []);

  return (
    <section>
      <h2 className="font-ui text-[13px] font-bold uppercase tracking-[0.12em] text-word-blue section-rule pb-1.5 mb-4">
        Executive Summary
      </h2>
      <div className="font-doc text-[16px] leading-[1.7] text-ink space-y-4">
        {renderParagraphs(about.paragraphs)}
      </div>

      {about.specs.length > 0 && (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-1.5 font-doc text-[14px] text-ink-muted">
          {about.specs.map((s) => (
            <div key={s.label} className="flex items-baseline gap-2">
              <span className="font-ui text-[11px] font-semibold uppercase tracking-wider text-ink-subtle w-20 shrink-0">
                {s.label}
              </span>
              <span className="text-ink">{s.value}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
