import { describe, expect, it } from "vitest";
import { resumePlainText } from "./shared";
import { DEFAULT_CONTENT } from "../../lib/content";

/**
 * resumePlainText exists for one job: pasting cleanly into an application
 * portal's plain-text résumé box (Workday, Greenhouse, Lever all have one).
 * Every failure mode is invisible until someone actually pastes it in — a
 * stray asterisk, a date that didn't make the cut, a section that silently
 * dropped — so these assert content and shape, not that it merely renders.
 */

const content = DEFAULT_CONTENT;

describe("resumePlainText", () => {
  it("leads with name, role, and contact on their own lines", () => {
    const text = resumePlainText(content);
    const lines = text.split("\n");
    expect(lines[0]).toBe(content.hero.name);
    expect(lines[1]).toBe(content.hero.role);
    expect(lines[2]).toContain(content.hero.email);
  });

  it("carries every section heading that has content, in reading order", () => {
    const text = resumePlainText(content);
    const headings = ["SUMMARY", "SKILLS", "SELECTED PROJECTS", "EDUCATION & EXPERIENCE", "CERTIFICATIONS"];
    const positions = headings.map((h) => text.indexOf(h));
    for (const [i, pos] of positions.entries()) {
      expect(pos, `${headings[i]} missing`).toBeGreaterThan(-1);
    }
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i], `${headings[i]} out of order`).toBeGreaterThan(positions[i - 1]);
    }
  });

  it("includes every project's title and full tech stack", () => {
    const text = resumePlainText(content);
    for (const p of content.projects) {
      expect(text, `${p.id} title`).toContain(p.title);
      if (p.stack && p.stack.length > 0) {
        expect(text, `${p.id} stack`).toContain(p.stack.join(", "));
      }
    }
  });

  it("keeps each organisation and its dates on one line, same shape as the ATS template", () => {
    const text = resumePlainText(content);
    for (const t of content.timeline) {
      expect(text).toContain(`${t.org} | ${t.range}`);
    }
  });

  it("writes each skill group as one label-and-values line", () => {
    const text = resumePlainText(content);
    for (const g of content.skills) {
      expect(text).toContain(`${g.label}: ${g.items.join(", ")}`);
    }
  });

  it("strips markdown and HTML markers a paste target can't render", () => {
    // Real content can legitimately contain "_" or "*" on their own (a
    // stack entry like "BLE (flutter_blue_plus)", say) — this only
    // asserts the specific markers around this injected sentence are
    // gone, not that those characters never appear anywhere in the output.
    const text = resumePlainText({
      ...content,
      about: {
        ...content.about,
        paragraphs: "I ship **bold** claims, *italic* ones, and <em>tags</em> too.",
      },
    });
    expect(text).toContain("I ship bold claims, italic ones, and tags too.");
    expect(text).not.toContain("**bold**");
    expect(text).not.toContain("<em>");
  });

  it("preserves a multi-paragraph summary rather than collapsing it", () => {
    const text = resumePlainText({
      ...content,
      about: { ...content.about, paragraphs: "First paragraph.\n\nSecond paragraph." },
    });
    expect(text).toContain("First paragraph.\n\nSecond paragraph.");
  });

  it("ends with exactly one trailing newline, clean to paste", () => {
    const text = resumePlainText(content);
    expect(text.endsWith("\n")).toBe(true);
    expect(text.endsWith("\n\n")).toBe(false);
  });

  it("omits a section entirely when the filtered content has nothing for it", () => {
    const text = resumePlainText({ ...content, certs: [] });
    expect(text).not.toContain("CERTIFICATIONS");
  });

  it("lists named awards and groups course certificates into one line", () => {
    const text = resumePlainText(content);
    const named = content.certs.filter((c) => !c.image);
    const courses = content.certs.filter((c) => c.image);
    for (const c of named) {
      expect(text, `${c.title} missing`).toContain(c.title);
    }
    if (courses.length > 0) {
      expect(text).toContain(`${courses.length}x Course Certificates`);
    }
  });
});
