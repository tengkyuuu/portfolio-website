import { useMemo } from "react";
import { getContent } from "../lib/content";

/** Strip the inline markdown/HTML we allow in content so it reads as plain
 *  résumé prose (bold/italic markers, links → their text, <em> tags). */
function plain(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // [text](url) → text
    .replace(/<\/?[^>]+>/g, "") // strip HTML tags
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .trim();
}

/**
 * Standalone, print-optimised one-page résumé assembled from the same content
 * that drives the site. Served at /resume; "Download PDF" calls the browser's
 * print dialog (Save as PDF). The print stylesheet (.resume-print in index.css)
 * trims it to a clean A4 sheet.
 */
export function ResumePage() {
  const content = useMemo(() => getContent(), []);
  const { hero, about, skills, projects, timeline, certs, contact } = content;

  const summary = plain(about.paragraphs.split(/\n\s*\n/)[0] ?? "");

  // Contact line — pull the meaningful channels, skip "Location" (shown already)
  const channels = contact.channels.filter(
    (c) => c.icon !== "location_on" && c.value
  );

  return (
    <div className="min-h-svh bg-workspace text-ink py-6 md:py-10 px-3">
      {/* Toolbar — not printed */}
      <div className="no-print max-w-[794px] mx-auto mb-4 flex items-center justify-between gap-3">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 font-ui text-[13px] text-ink-muted hover:text-ink"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            arrow_back
          </span>
          Back to portfolio
        </a>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 bg-word-blue text-white font-ui text-[13px] font-medium px-3.5 py-2 rounded-sm hover:bg-word-blue-dark transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            download
          </span>
          Download PDF
        </button>
      </div>

      {/* Résumé sheet (A4) */}
      <article className="resume-sheet bg-paper paper-shadow w-full max-w-[794px] min-h-[1123px] mx-auto px-10 md:px-14 py-12 text-ink">
        {/* Header */}
        <header className="border-b-2 border-word-blue pb-4 mb-5">
          <h1 className="font-doc text-[34px] font-bold tracking-tight leading-none text-ink">
            {hero.name}
          </h1>
          <p className="font-ui text-[13px] font-medium text-word-blue mt-1.5 uppercase tracking-[0.08em]">
            {hero.role}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-ui text-[12px] text-ink-muted">
            {hero.email && (
              <a href={`mailto:${hero.email}`} className="hover:text-word-blue">
                {hero.email}
              </a>
            )}
            {hero.location && <span>{hero.location}</span>}
            {channels.map((c) => (
              <a
                key={c.label}
                href={c.href}
                className="hover:text-word-blue"
                target={c.href.startsWith("http") ? "_blank" : undefined}
                rel="noreferrer"
              >
                {c.value}
              </a>
            ))}
          </div>
        </header>

        {/* Summary */}
        {summary && (
          <ResumeSection title="Summary">
            <p className="font-doc text-[13.5px] leading-[1.6] text-ink-muted">
              {summary}
            </p>
          </ResumeSection>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <ResumeSection title="Skills">
            <dl className="space-y-1.5">
              {skills.map((g) => (
                <div key={g.label} className="flex gap-3 font-ui text-[12.5px]">
                  <dt className="font-bold text-ink w-28 shrink-0">{g.label}</dt>
                  <dd className="text-ink-muted">{g.items.join(" · ")}</dd>
                </div>
              ))}
            </dl>
          </ResumeSection>
        )}

        {/* Projects */}
        {projects.length > 0 && (
          <ResumeSection title="Selected Projects">
            <ul className="space-y-3">
              {projects.map((p) => (
                <li key={p.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-doc text-[14px] font-bold text-ink">
                      {p.title}
                    </h3>
                    {p.stack && p.stack.length > 0 && (
                      <span className="font-ui text-[11px] text-ink-subtle text-right shrink-0">
                        {p.stack.join(" · ")}
                      </span>
                    )}
                  </div>
                  <p className="font-doc text-[13px] leading-[1.55] text-ink-muted mt-0.5">
                    {plain(p.blurb)}
                  </p>
                </li>
              ))}
            </ul>
          </ResumeSection>
        )}

        {/* Education & Experience */}
        {timeline.length > 0 && (
          <ResumeSection title="Education & Experience">
            <ul className="space-y-2.5">
              {timeline.map((t) => (
                <li
                  key={t.title}
                  className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5"
                >
                  <div className="flex-1">
                    <h3 className="font-doc text-[13.5px] font-bold text-ink">
                      {t.title}
                    </h3>
                    <p className="font-ui text-[12px] text-ink-muted">{t.org}</p>
                  </div>
                  <span className="font-ui text-[11px] text-ink-subtle uppercase tracking-wider tabular-nums sm:text-right shrink-0 sm:ml-6">
                    {t.range}
                  </span>
                </li>
              ))}
            </ul>
          </ResumeSection>
        )}

        {/* Certifications */}
        {certs.length > 0 && (
          <ResumeSection title="Certifications & Awards">
            <ul className="space-y-1">
              {certs.map((c) => (
                <li
                  key={c.title + c.issuer}
                  className="flex items-baseline justify-between gap-3 font-ui text-[12.5px]"
                >
                  <span className="text-ink">
                    <span className="font-semibold">{c.title}</span>
                    <span className="text-ink-muted"> — {c.issuer}</span>
                  </span>
                  <span className="text-ink-subtle tabular-nums shrink-0">
                    {c.date}
                  </span>
                </li>
              ))}
            </ul>
          </ResumeSection>
        )}
      </article>
    </div>
  );
}

function ResumeSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5 break-inside-avoid">
      <h2 className="font-ui text-[11px] font-bold uppercase tracking-[0.16em] text-word-blue border-b border-rule pb-1 mb-2.5">
        {title}
      </h2>
      {children}
    </section>
  );
}
