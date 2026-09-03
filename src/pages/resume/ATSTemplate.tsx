import type { SiteContent } from "../../lib/content";
import { partitionCerts, plain, resumeChannels } from "./shared";

/**
 * ATS-friendly template. Rules:
 *   • Single column, genuinely. No flex rows, no `justify-content:
 *     space-between`, no table anywhere in the tree — see ResumePage, which
 *     deliberately renders this template OUTSIDE the print-frame table the
 *     Modern one uses. A table wrapper is the classic ATS killer: parsers
 *     either skip its contents or read them column-wise, and PDF text
 *     extraction reorders side-by-side runs unpredictably.
 *   • Every field label and value is on the same text line, in reading
 *     order, so extraction top-to-bottom equals the visual order.
 *   • System serif stack — no web fonts, no colours, no gradients, no
 *     background fills. Everything renders identically inside a PDF
 *     text-extraction pipeline.
 *   • Section headings are ALL CAPS on their own line.
 *   • Dates on the same line as the organisation — parsers key off that
 *     shape, and a date stranded in a right-hand column is a date lost.
 *   • Structural punctuation stays ASCII: " | " between fields, " - "
 *     between a title and its issuer. Em dashes and middle dots survive
 *     most extractors but not all, and they carry no meaning here. Content
 *     keeps whatever characters it has — project names are not ours to
 *     transliterate.
 *   • page-break-inside is avoided per ENTRY, never per section. A section
 *     taller than the page (eight projects, say) cannot honour it, and
 *     browsers resolve that by clipping or by dumping a page of whitespace.
 *
 * QA cheat-sheet:
 *   • Try `Ctrl-A / Ctrl-C` the printed PDF then paste into a plain-text
 *     editor. It should read top-to-bottom in reasonable order.
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
      {/* Header — one field per line, nothing side by side */}
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
          <p style={bodyStyle}>{summary}</p>
          {highlights.length > 0 && (
            <ul style={bulletListStyle}>
              {highlights.map((h) => (
                <li key={h} style={bulletItemStyle}>
                  {h}
                </li>
              ))}
            </ul>
          )}
        </AtsSection>
      )}

      {skills.length > 0 && (
        <AtsSection title="SKILLS">
          {/* One line per group: "Label: a, b, c". A <dl> with flex rows
              reads as two columns to an extractor; this reads as prose. */}
          {skills.map((g) => (
            <p key={g.label} style={{ ...bodyStyle, marginBottom: "3pt" }}>
              <strong>{g.label}:</strong> {g.items.join(", ")}
            </p>
          ))}
        </AtsSection>
      )}

      {projects.length > 0 && (
        <AtsSection title="SELECTED PROJECTS">
          {projects.map((p) => (
            <div key={p.id} style={entryStyle}>
              <h3 style={entryTitleStyle}>{p.title}</h3>
              {p.stack && p.stack.length > 0 && (
                <p style={entryMetaStyle}>Technologies: {p.stack.join(", ")}</p>
              )}
              <p style={{ ...bodyStyle, margin: "2pt 0 0 0" }}>
                {plain(p.blurb)}
              </p>
            </div>
          ))}
        </AtsSection>
      )}

      {timeline.length > 0 && (
        <AtsSection title="EDUCATION & EXPERIENCE">
          {timeline.map((t) => (
            <div key={t.title} style={entryStyle}>
              <h3 style={entryTitleStyle}>{t.title}</h3>
              {/* Organisation and dates on one line, in that order — the
                  shape parsers expect for an employment entry. */}
              <p style={entryMetaStyle}>{joinInline([t.org, t.range])}</p>
              {t.blurb && (
                <p style={{ ...bodyStyle, margin: "2pt 0 0 0" }}>
                  {plain(t.blurb)}
                </p>
              )}
            </div>
          ))}
        </AtsSection>
      )}

      {certs.length > 0 && (
        <AtsSection title="CERTIFICATIONS">
          <ul style={bulletListStyle}>
            {award.map((c) => (
              <li key={c.title + c.issuer} style={bulletItemStyle}>
                <strong>{c.title}</strong>
                {c.issuer ? ` - ${c.issuer}` : ""}
                {c.date ? ` (${c.date})` : ""}
              </li>
            ))}
            {course.length > 0 && (
              <li style={bulletItemStyle}>
                <strong>{course.length}x Course Certificates</strong> -{" "}
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
    <section style={{ marginBottom: "12pt" }}>
      <h2
        style={{
          fontSize: "10.5pt",
          fontWeight: 700,
          letterSpacing: "0.05em",
          borderBottom: "0.75pt solid #000",
          paddingBottom: "2pt",
          margin: "0 0 4pt 0",
          // Never leave a heading alone at the foot of a page.
          breakAfter: "avoid",
          pageBreakAfter: "avoid",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

const bodyStyle: React.CSSProperties = {
  fontSize: "10.5pt",
  margin: 0,
  orphans: 2,
  widows: 2,
};

/** One project / role / school. Small enough to keep whole on a page. */
const entryStyle: React.CSSProperties = {
  marginBottom: "8pt",
  breakInside: "avoid",
  pageBreakInside: "avoid",
};

const entryTitleStyle: React.CSSProperties = {
  fontSize: "11pt",
  fontWeight: 700,
  margin: 0,
  lineHeight: 1.3,
};

const entryMetaStyle: React.CSSProperties = {
  fontSize: "10pt",
  margin: "1pt 0 0 0",
};

const bulletListStyle: React.CSSProperties = {
  listStyleType: "disc",
  paddingLeft: "18pt",
  margin: "6pt 0 0 0",
};

const bulletItemStyle: React.CSSProperties = {
  fontSize: "10.5pt",
  marginBottom: "2pt",
  breakInside: "avoid",
  pageBreakInside: "avoid",
};

/** ASCII pipe rather than a middle dot — see the separator rule above. */
function joinInline(parts: (string | undefined | null)[]): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(" | ");
}
