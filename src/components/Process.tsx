import { useState } from "react";
import { processStages } from "../lib/data";

/**
 * How I Work — the workflow behind everything else in this document.
 *
 * Rendered as a Word numbered-heading outline: each stage collapses to its
 * summary and expands to the reasoning, with a link to the file in this
 * repository that demonstrates it. Every artifact path is asserted to
 * exist by data.test.ts, so this page cannot drift into describing a
 * process the repo no longer follows.
 *
 * The first stage is open by default — a page of collapsed headings looks
 * like it has nothing in it.
 */

const REPO = "https://github.com/tengkyuuu/portfolio-website/blob/main/";

export function Process() {
  const [open, setOpen] = useState<string | null>(processStages[0]?.n ?? null);

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 section-rule pb-1.5 mb-4">
        <h2 className="font-ui text-[13px] font-bold uppercase tracking-[0.12em] text-word-blue">
          How I Work
        </h2>
        <span className="font-ui text-[11px] text-ink-subtle uppercase tracking-wider tabular-nums">
          {processStages.length} stages
        </span>
      </div>

      <p className="font-doc text-[15px] leading-[1.7] text-ink-muted mb-3">
        I build with an AI agent in the loop, which changes the job rather
        than removing it. Generating code stops being the constraint;
        deciding what should exist, and proving it works, becomes the whole
        job. What follows is how I actually run that — every stage points at
        a file in this repository.
      </p>

      <p className="font-doc italic text-[13px] text-ink-subtle mb-5">
        Click a stage to open it.
      </p>

      <ol className="border border-rule rounded-sm overflow-hidden">
        {processStages.map((stage) => {
          const isOpen = open === stage.n;
          return (
            <li
              key={stage.n}
              className="border-b border-rule last:border-0 even:bg-row-alt/40"
            >
              <h3>
                <button
                  onClick={() => setOpen(isOpen ? null : stage.n)}
                  aria-expanded={isOpen}
                  aria-controls={`stage-${stage.n}`}
                  className="w-full flex items-baseline gap-3 text-left px-3 py-2.5 hover:bg-word-blue-light focus:outline-none focus-visible:bg-word-blue-light transition-colors"
                >
                  <span className="font-ui text-[11px] font-bold text-word-blue tabular-nums shrink-0 pt-0.5">
                    {stage.n}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-doc text-[16px] font-bold text-ink leading-snug">
                      {stage.title}
                    </span>
                    {!isOpen && (
                      <span className="block font-doc text-[13px] text-ink-muted leading-snug mt-0.5">
                        {stage.summary}
                      </span>
                    )}
                  </span>
                  <span
                    aria-hidden="true"
                    className={
                      "material-symbols-outlined text-ink-subtle shrink-0 transition-transform " +
                      (isOpen ? "rotate-180" : "")
                    }
                    style={{ fontSize: 18 }}
                  >
                    expand_more
                  </span>
                </button>
              </h3>

              {isOpen && (
                <div id={`stage-${stage.n}`} className="px-3 pb-3 pl-[38px]">
                  <p className="font-doc text-[14.5px] leading-[1.7] text-ink">
                    {stage.detail}
                  </p>
                  {stage.artifact && (
                    <a
                      href={REPO + stage.artifact.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2.5 font-ui text-[11px] font-medium text-word-blue border border-rule rounded-sm px-2 py-1 hover:bg-word-blue-light transition-colors"
                    >
                      <span
                        aria-hidden="true"
                        className="material-symbols-outlined"
                        style={{ fontSize: 13 }}
                      >
                        description
                      </span>
                      {stage.artifact.label}
                    </a>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-6 border-l-[3px] border-word-blue bg-row-alt/60 px-4 py-3">
        <p className="font-doc text-[14px] leading-[1.7] text-ink-muted">
          The through-line: an agent will happily produce something
          plausible and wrong, and it will do it fast. Every stage above
          exists to make that expensive — a spec it has to fill in rather
          than improvise, conventions it reads before starting, tests that
          encode what already broke once, and a pipeline that has to go
          green before I look at it.
        </p>
      </div>
    </section>
  );
}
