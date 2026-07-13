import type { SiteContent } from "../../lib/content";
import { partitionCerts, plain, resumeChannels } from "./shared";

/**
 * The Modern template — the Word-document look that ships as the default.
 * Serif body, Word-blue accent, centred letterhead, print-optimised A4.
 */
export function ModernTemplate({ content }: { content: SiteContent }) {
  const { hero, about, skills, projects, timeline, certs, contact } = content;

  const summary = plain(about.paragraphs.split(/\n\s*\n/)[0] ?? "");
  const highlights = about.highlights ?? [];
  const channels = resumeChannels(hero, contact.channels);
  const { award, course, courseIssuer } = partitionCerts(content);

  return (
    <article className="resume-sheet bg-paper paper-shadow w-full max-w-[794px] min-h-[1123px] mx-auto px-10 md:px-14 py-12 text-ink">
      <header className="text-center border-b-2 border-word-blue pb-4 mb-5">
        <h1 className="font-doc text-[34px] font-bold tracking-tight leading-none text-ink">
          {hero.name}
        </h1>
        <p className="font-ui text-[13px] font-medium text-word-blue mt-1.5 uppercase tracking-[0.08em]">
          {hero.role}
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 font-ui text-[12px] text-ink-muted">
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

      {summary && (
        <Section title="Summary">
          <p className="font-doc text-[13.5px] leading-[1.6] text-ink-muted">
            {summary}
          </p>
          {highlights.length > 0 && (
            <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1">
              {highlights.map((h) => (
                <li
                  key={h}
                  className="font-ui text-[12px] text-ink-muted flex items-start gap-1.5"
                >
                  <span className="text-word-blue font-bold leading-none">›</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {skills.length > 0 && (
        <Section title="Skills">
          <dl className="space-y-1.5">
            {skills.map((g) => (
              <div key={g.label} className="flex gap-3 font-ui text-[12.5px]">
                <dt className="font-bold text-ink w-28 shrink-0">{g.label}</dt>
                <dd className="text-ink-muted">{g.items.join(" · ")}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {projects.length > 0 && (
        <Section title="Selected Projects">
          <ul className="space-y-3">
            {projects.map((p) => (
              <li key={p.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-doc text-[14px] font-bold text-ink">{p.title}</h3>
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
        </Section>
      )}

      {timeline.length > 0 && (
        <Section title="Education & Experience">
          <ul className="space-y-2.5">
            {timeline.map((t) => (
              <li
                key={t.title}
                className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-0.5"
              >
                <div className="flex-1">
                  <h3 className="font-doc text-[13.5px] font-bold text-ink">{t.title}</h3>
                  <p className="font-ui text-[12px] text-ink-muted">{t.org}</p>
                </div>
                <span className="font-ui text-[11px] text-ink-subtle uppercase tracking-wider tabular-nums sm:text-right shrink-0 sm:ml-6">
                  {t.range}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {certs.length > 0 && (
        <Section title="Certifications & Awards">
          <ul className="space-y-1">
            {award.map((c) => (
              <li
                key={c.title + c.issuer}
                className="flex items-baseline justify-between gap-3 font-ui text-[12.5px]"
              >
                <span className="text-ink">
                  <span className="font-semibold">{c.title}</span>
                  <span className="text-ink-muted"> — {c.issuer}</span>
                </span>
                {c.date && (
                  <span className="text-ink-subtle tabular-nums shrink-0">{c.date}</span>
                )}
              </li>
            ))}
            {course.length > 0 && (
              <li className="font-ui text-[12.5px]">
                <span className="font-semibold text-ink">
                  {course.length}× Course Certificates
                </span>
                <span className="text-ink-muted"> — {courseIssuer}</span>
                <span className="text-ink-subtle">
                  {" "}
                  ({course.map((c) => c.title).join(", ")})
                </span>
              </li>
            )}
          </ul>
        </Section>
      )}
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 break-inside-avoid">
      <h2 className="font-ui text-[11px] font-bold uppercase tracking-[0.16em] text-word-blue border-b border-rule pb-1 mb-2.5">
        {title}
      </h2>
      {children}
    </section>
  );
}
