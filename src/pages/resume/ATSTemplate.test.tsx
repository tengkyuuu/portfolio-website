import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ATSTemplate } from "./ATSTemplate";
import { RESUME_PROJECT_LIMIT, ResumePage } from "../ResumePage";
import { DEFAULT_CONTENT } from "../../lib/content";
import { projects } from "../../lib/data";

/**
 * The ATS template's whole job is to survive machine parsing, and every way
 * it can fail is invisible on screen: the page looks fine and the extracted
 * text is garbage. So these assert structure, not appearance.
 *
 * The regressions they exist to catch, both of which shipped:
 *   1. The entire résumé was wrapped in a <table> (a print-margin hack for
 *      the Modern template) — the single most reliable way to defeat an ATS.
 *   2. Rows used `display:flex; justify-content:space-between` to put dates
 *      and tech stacks on the right, so extraction reordered them or read
 *      them as a second column. The file's own doc comment forbade this.
 */

const content = DEFAULT_CONTENT;

describe("ATSTemplate", () => {
  it("contains no table anywhere in the tree", () => {
    const { container } = render(<ATSTemplate content={content} />);
    expect(container.querySelector("table")).toBeNull();
    expect(container.querySelector("thead")).toBeNull();
    expect(container.querySelector("td")).toBeNull();
  });

  it("lays nothing out side by side", () => {
    const { container } = render(<ATSTemplate content={content} />);
    for (const el of container.querySelectorAll<HTMLElement>("*")) {
      expect(el.style.display).not.toBe("flex");
      expect(el.style.display).not.toBe("grid");
      expect(el.style.justifyContent).toBe("");
    }
  });

  it("never sets column layout that would split the reading order", () => {
    const { container } = render(<ATSTemplate content={content} />);
    for (const el of container.querySelectorAll<HTMLElement>("*")) {
      expect(el.style.columnCount).toBe("");
      expect(el.style.float).toBe("");
      expect(el.style.position).not.toBe("absolute");
    }
  });

  it("keeps each organisation and its dates in one text node", () => {
    render(<ATSTemplate content={content} />);
    // A date stranded in a right-hand column is a date the parser loses.
    for (const t of content.timeline) {
      expect(
        screen.getByText(`${t.org} | ${t.range}`, { exact: false })
      ).toBeInTheDocument();
    }
  });

  it("writes each skill group as one label-and-values line", () => {
    const { container } = render(<ATSTemplate content={content} />);
    // A <dl> of flex rows reads as two columns; prose reads as prose.
    expect(container.querySelector("dl")).toBeNull();
    for (const g of content.skills) {
      expect(
        screen.getByText(g.items.join(", "), { exact: false })
      ).toBeInTheDocument();
    }
  });

  it("uses real headings for sections and entries", () => {
    render(<ATSTemplate content={content} />);
    expect(
      screen.getByRole("heading", { level: 1, name: content.hero.name })
    ).toBeInTheDocument();
    for (const title of ["SKILLS", "SELECTED PROJECTS", "EDUCATION & EXPERIENCE"]) {
      expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    }
    // Every project is an entry heading, so hierarchy survives extraction.
    for (const p of content.projects) {
      expect(
        screen.getByRole("heading", { level: 3, name: p.title })
      ).toBeInTheDocument();
    }
  });

  it("avoids page breaks per entry, never per whole section", () => {
    const { container } = render(<ATSTemplate content={content} />);
    // A section taller than the page can't honour break-inside:avoid, and
    // browsers resolve that by clipping or by emitting a blank page.
    for (const section of container.querySelectorAll<HTMLElement>("section")) {
      expect(section.style.pageBreakInside).not.toBe("avoid");
      expect(section.style.breakInside).not.toBe("avoid");
    }
    // ...but the individual entries do ask to stay whole.
    const entries = container.querySelectorAll<HTMLElement>(
      '[style*="page-break-inside: avoid"]'
    );
    expect(entries.length).toBeGreaterThan(0);
  });

  it("keeps structural separators ASCII", () => {
    const { container } = render(<ATSTemplate content={content} />);
    // Content may hold any character (project names are not ours to
    // transliterate) — this covers the separators the template itself emits.
    const contactLine = container.querySelector("header p:last-of-type");
    expect(contactLine?.textContent).toContain(" | ");
    expect(contactLine?.textContent).not.toContain("·");
  });
});

describe("ResumePage", () => {
  it("wraps both templates in the print frame", () => {
    // The frame's repeating thead/tfoot spacers are the only vertical
    // margin that survives the print dialog's "Margins: None", which zeroes
    // @page. Without it page two of the ATS résumé printed against the edge.
    for (const [query, present, absent] of [
      ["/resume?style=ats", ".resume-ats", null],
      ["/resume", null, ".resume-ats"],
    ] as const) {
      window.history.replaceState(null, "", query);
      const { container, unmount } = render(<ResumePage />);
      expect(container.querySelector(".resume-print-frame")).not.toBeNull();
      if (present) expect(container.querySelector(present)).not.toBeNull();
      if (absent) expect(container.querySelector(absent)).toBeNull();
      unmount();
    }
  });

  it("keeps the ATS document in a single frame column, in source order", () => {
    // A table only misleads a parser when it puts content side by side.
    // One column reads top-to-bottom exactly as the markup does.
    window.history.replaceState(null, "", "/resume?style=ats");
    const { container } = render(<ResumePage />);

    const rows = container.querySelectorAll(".resume-print-frame tr");
    for (const row of rows) {
      expect(row.querySelectorAll("td")).toHaveLength(1);
    }
    // The résumé itself sits in the body row, not in a spacer.
    const body = container.querySelector(".resume-print-frame > tbody");
    expect(body?.querySelector(".resume-ats")).not.toBeNull();
  });

  it("carries only the first five projects", () => {
    /* The site shows the whole catalogue; the résumé is a highlight reel.
       data.ts keeps the older entries at the tail of the array specifically
       so they fall outside this slice — if someone reorders it, the two
       assertions below disagree and this fails. */
    window.history.replaceState(null, "", "/resume?style=ats");
    render(<ResumePage />);

    for (const p of projects.slice(0, RESUME_PROJECT_LIMIT)) {
      expect(
        screen.getByRole("heading", { level: 3, name: p.title }),
        `${p.title} should be on the résumé`
      ).toBeInTheDocument();
    }
    for (const p of projects.slice(RESUME_PROJECT_LIMIT)) {
      expect(
        screen.queryByRole("heading", { level: 3, name: p.title }),
        `${p.title} should NOT be on the résumé`
      ).toBeNull();
    }
  });
});
