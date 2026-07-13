import type { SiteContent } from "../../lib/content";
import { partitionCerts, plain, resumeChannels } from "./shared";

/**
 * ATS-friendly template. Rules:
 *   • Single column, no side-by-side blocks (some ATS parsers ignore
 *     content in narrow right-hand columns).
 *   • System serif stack — no web fonts, no colours, no gradients, no
 *     background fills. Everything renders identically inside a PDF
 *     text-extraction pipeline.
 *   • Section headings are ALL CAPS on their own line.
 *   • Dates on the same line as the role — parsers key off common formats.
 *   • No em-dashes in place of hyphens where a screener might see them
 *     — we still use them in prose, but section separators stay simple.
 *
 * QA cheat-sheet:
 *   • Try `Ctrl-A / Ctrl-C` the printed PDF then paste into a plain-text
 *     editor. It should read top-to-bottom in reasonable order.
 *   • Contact line is one line: `Name · Email · Location · GitHub · …`.
 *   • No custom fonts, colours, or borders needed for the doc to make sense.
 */
export function ATSTemplate({ content }: { content: SiteContent }) {
  const { hero, about, skills, projects, timeline, certs, contact } = content;

  const summary = plain(about.paragraphs.split(/\n\s*\n/)[0] ?? "");
  const highlights = about.highlights ?? [];
  const channels = resumeChannels(hero, contact.channels);
  const { award, course, courseIssuer } = partitionCerts(content);

  return (
    <article
      className="resume-sheet resume-ats bg-paper paper-shadow w-full max-w-[794px] min-h-[1123px] mx-auto text-black"
      style={{
        // Force a black-on-white, system-serif rendering. `data-theme` on
        // <html> can't touch this because we opt-out with explicit values.
        fontFamily:
          '"Times New Roman", Times, Georgia, "Liberation Serif", serif',
        color: "#000",
        background: "#fff",
        padding: "36pt 42pt",
        lineHeight: 1.35,
      }}
    >
      {/* Header — single line, no styling ATS parsers can trip on */}
      <header>
        <h1
          style={{
            fontSize: "22pt",
            fontWeight: 700,
            margin: 0,
            lineHeight: 1.15,
          }}
        >
          {hero.name}
        </h1>
        <p style={{ fontSize: "11pt", margin: "2pt 0 0 0" }}>{hero.role}</p>
        <p style={{ fontSize: "10pt", margin: "6pt 0 0 0" }}>
          {joinInline([
            hero.email,
            hero.location,
            ...channels.map((c) => c.value),
          ])}
        </p>
        <hr
          style={{
            border: 0,
            borderTop: "1pt solid #000",
            margin: "10pt 0 12pt 0",
          }}
        />
      </header>

      {summary && (
        <AtsSection title="SUMMARY">
          <p style={sectionParaStyle}>{summary}</p>
          {highlights.length > 0 && (
            <ul style={{ paddingLeft: "18pt", margin: "6pt 0 0 0" }}>
              {highlights.map((h) => (
                <li key={h} style={{ fontSize: "10.5pt", marginBottom: "2pt" }}>
                  {h}
                </li>
              ))}
            </ul>
          )}
        </AtsSection>
      )}

      {skills.length > 0 && (
        <AtsSection title="SKILLS">
          <dl style={{ margin: 0 }}>
            {skills.map((g) => (
              <div
                key={g.label}
                style={{ display: "flex", gap: "8pt", marginBottom: "3pt" }}
              >
                <dt style={{ fontWeight: 700, fontSize: "10.5pt", minWidth: "80pt" }}>
                  {g.label}:
                </dt>
                <dd style={{ margin: 0, fontSize: "10.5pt" }}>
                  {g.items.join(", ")}
                </dd>
              </div>
            ))}
          </dl>
        </AtsSection>
      )}

      {projects.length > 0 && (
        <AtsSection title="SELECTED PROJECTS">
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {projects.map((p) => (
              <li key={p.id} style={{ marginBottom: "8pt" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12pt",
                    alignItems: "baseline",
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: "11pt" }}>
                    {p.title}
                  </span>
                  {p.stack && p.stack.length > 0 && (
                    <span style={{ fontSize: "9.5pt", textAlign: "right" }}>
                      {p.stack.join(", ")}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: "10.5pt", margin: "2pt 0 0 0" }}>
                  {plain(p.blurb)}
                </p>
              </li>
            ))}
          </ul>
        </AtsSection>
      )}

      {timeline.length > 0 && (
        <AtsSection title="EDUCATION & EXPERIENCE">
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {timeline.map((t) => (
              <li key={t.title} style={{ marginBottom: "6pt" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12pt",
                    alignItems: "baseline",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "11pt" }}>
                      {t.title}
                    </div>
                    <div style={{ fontSize: "10pt" }}>{t.org}</div>
                  </div>
                  <span style={{ fontSize: "10pt", whiteSpace: "nowrap" }}>
                    {t.range}
                  </span>
                </div>
                {t.blurb && (
                  <p style={{ fontSize: "10pt", margin: "1pt 0 0 0" }}>
                    {plain(t.blurb)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </AtsSection>
      )}

      {certs.length > 0 && (
        <AtsSection title="CERTIFICATIONS">
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {award.map((c) => (
              <li
                key={c.title + c.issuer}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "12pt",
                  fontSize: "10.5pt",
                  marginBottom: "2pt",
                }}
              >
                <span>
                  <strong>{c.title}</strong> — {c.issuer}
                </span>
                {c.date && <span>{c.date}</span>}
              </li>
            ))}
            {course.length > 0 && (
              <li style={{ fontSize: "10.5pt", marginTop: "3pt" }}>
                <strong>{course.length}x Course Certificates</strong> —{" "}
                {courseIssuer} ({course.map((c) => c.title).join(", ")})
              </li>
            )}
          </ul>
        </AtsSection>
      )}
    </article>
  );
}

function AtsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: "12pt", pageBreakInside: "avoid" }}>
      <h2
        style={{
          fontSize: "10.5pt",
          fontWeight: 700,
          letterSpacing: "0.05em",
          borderBottom: "0.75pt solid #000",
          paddingBottom: "2pt",
          margin: "0 0 4pt 0",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

const sectionParaStyle: React.CSSProperties = {
  fontSize: "10.5pt",
  margin: 0,
};

function joinInline(parts: (string | undefined | null)[]): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(" · ");
}
