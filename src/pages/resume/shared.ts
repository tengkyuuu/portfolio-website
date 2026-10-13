import type { ContactChannel, HeroContent, SiteContent } from "../../lib/content";

/** Strip the inline markdown/HTML we allow in content so it reads as plain
 *  résumé prose (bold/italic markers, links → their text, <em> tags, etc). */
export function plain(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .trim();
}

/** Filter out the contact channels a résumé shouldn't repeat verbatim:
 *   • Location — already in the header line
 *   • Anything that duplicates hero.email
 */
export function resumeChannels(hero: HeroContent, channels: ContactChannel[]): ContactChannel[] {
  const heroEmailLower = hero.email.trim().toLowerCase();
  return channels.filter((c) => {
    if (!c.value) return false;
    if (c.icon === "location_on") return false;
    const v = c.value.trim().toLowerCase();
    if (v === heroEmailLower) return false;
    const href = (c.href ?? "").trim().toLowerCase();
    if (href === `mailto:${heroEmailLower}`) return false;
    return true;
  });
}

/** Split certs into "named awards" vs "course certificates" (image-backed)
 *  for the compact tail line. */
export function partitionCerts(content: SiteContent) {
  const award = content.certs.filter((c) => !c.image);
  const course = content.certs.filter((c) => c.image);
  return {
    award,
    course,
    courseIssuer: course[0]?.issuer ?? "online courses",
  };
}

/** ASCII pipe rather than a middle dot — matches ATSTemplate's rule: it
 *  survives being pasted into a plain textarea, which a middle dot or em
 *  dash is not guaranteed to. */
function joinInline(parts: (string | undefined | null)[]): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(" | ");
}

/**
 * The résumé as plain text — same content and field order as ATSTemplate,
 * serialized as a string instead of laid out as a document.
 *
 * Exists because a PDF isn't actually what most application-tracking
 * portals want: Workday, Greenhouse, and Lever all have a step that asks
 * you to paste your résumé into a textarea, and a styled export pasted
 * there arrives as a wall of run-together text. This is the thing meant
 * to go in that box.
 *
 * Deliberately shares no React with ATSTemplate — this has to work from
 * a plain button click with no DOM to read back from, and keeping the two
 * in sync is a matter of eyeballing the same field list, not an import.
 */
export function resumePlainText(content: SiteContent): string {
  const { hero, about, skills, projects, timeline, certs, contact } = content;
  const channels = resumeChannels(hero, contact.channels);
  const { award, course, courseIssuer } = partitionCerts(content);
  const lines: string[] = [];

  const heading = (title: string) => {
    lines.push("", title.toUpperCase(), "-".repeat(title.length));
  };

  lines.push(hero.name, hero.role);
  lines.push(joinInline([hero.email, hero.location, ...channels.map((c) => c.value)]));

  const summary = plain(about.paragraphs);
  if (summary) {
    heading("Summary");
    lines.push(summary);
    for (const h of about.highlights ?? []) lines.push(`- ${h}`);
  }

  if (skills.length > 0) {
    heading("Skills");
    for (const g of skills) lines.push(`${g.label}: ${g.items.join(", ")}`);
  }

  if (projects.length > 0) {
    heading("Selected Projects");
    projects.forEach((p, i) => {
      if (i > 0) lines.push("");
      lines.push(p.title);
      if (p.stack && p.stack.length > 0) {
        lines.push(`Technologies: ${p.stack.join(", ")}`);
      }
      lines.push(plain(p.blurb));
    });
  }

  if (timeline.length > 0) {
    heading("Education & Experience");
    timeline.forEach((t, i) => {
      if (i > 0) lines.push("");
      lines.push(t.title);
      lines.push(joinInline([t.org, t.range]));
      if (t.blurb) lines.push(plain(t.blurb));
    });
  }

  if (certs.length > 0) {
    heading("Certifications");
    for (const c of award) {
      lines.push(`- ${joinInline([c.title, c.issuer])}${c.date ? ` (${c.date})` : ""}`);
    }
    if (course.length > 0) {
      lines.push(
        `- ${course.length}x Course Certificates - ${courseIssuer} (${course
          .map((c) => c.title)
          .join(", ")})`
      );
    }
  }

  return lines.join("\n").trim() + "\n";
}
