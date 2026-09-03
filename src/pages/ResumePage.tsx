import { useEffect, useMemo, useState } from "react";
import { getContent } from "../lib/content";
import { applyRoleFilter, isRole, type ResumeRole } from "../lib/resume-roles";
import { ATSTemplate } from "./resume/ATSTemplate";
import { ModernTemplate } from "./resume/ModernTemplate";
import { ResumeToolbar, type ResumeTemplateId } from "./resume/ResumeToolbar";

/**
 * The Résumé Builder shell.
 *
 * Composes a template component with a role-filtered SiteContent and
 * mirrors the current variant into the URL query string so the link is
 * shareable and reloads reproduce the exact view.
 *
 * QA guardrails:
 *   • Unknown query values fall back to defaults instead of crashing.
 *   • Reading + writing the URL uses history.replaceState so the back
 *     button still leaves the résumé rather than cycling picker states.
 *   • window.print() is called through a small helper so we can extend
 *     with per-template stylesheets later without touching callers.
 */

/** How many projects a résumé carries, regardless of template. */
export const RESUME_PROJECT_LIMIT = 5;

function isTemplate(v: unknown): v is ResumeTemplateId {
  return v === "modern" || v === "ats";
}

function initialState(): { role: ResumeRole; template: ResumeTemplateId } {
  if (typeof window === "undefined") return { role: "all", template: "modern" };
  const params = new URLSearchParams(window.location.search);
  const rawRole = params.get("role");
  const rawStyle = params.get("style");
  return {
    role: isRole(rawRole) ? rawRole : "all",
    template: isTemplate(rawStyle) ? rawStyle : "modern",
  };
}

export function ResumePage() {
  const content = useMemo(() => getContent(), []);
  const [{ role, template }, setState] = useState(initialState);

  // Sync state → URL (replace, not push, so back button leaves the page)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (role === "all") params.delete("role");
    else params.set("role", role);
    if (template === "modern") params.delete("style");
    else params.set("style", template);
    const qs = params.toString();
    const next = window.location.pathname + (qs ? `?${qs}` : "");
    if (window.location.pathname + window.location.search !== next) {
      window.history.replaceState(null, "", next);
    }
    // Formal, constant title — this is also what the browser prints in its
    // page header and uses as the default PDF filename, so no role/style
    // suffixes and no informal casing here.
    document.title = "James Vincent Calunsag — Résumé";
  }, [role, template]);

  // Respond to external nav (e.g. back-forward) that changes ?style/?role
  useEffect(() => {
    const onPop = () => setState(initialState());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const filtered = useMemo(() => {
    const byRole = applyRoleFilter(content, role);
    // A résumé is a highlight reel, not the full catalogue. The site shows
    // every project; this shows the strongest few, which is also what keeps
    // the document near two pages instead of four.
    //
    // Applied after the role filter on purpose: for a specific role the
    // top five are the five most relevant, and for "all" the order in
    // data.ts decides — the older entries live at the tail of that array
    // precisely so they fall outside this slice.
    return { ...byRole, projects: byRole.projects.slice(0, RESUME_PROJECT_LIMIT) };
  }, [content, role]);

  function download() {
    // Delegate to the browser's print dialog. Users pick "Save as PDF"
    // as the destination — no server-side PDF generation needed.
    window.print();
  }

  return (
    <div className="resume-page min-h-svh bg-workspace text-ink py-6 md:py-10 px-3">
      {/* Route-scoped print overrides. Only /resume loads this component, so
          site-wide printing is unaffected — and the two templates get
          different treatment on purpose (see MODERN_PRINT_CSS). */}
      <style>{FRAME_CSS + (template === "ats" ? ATS_PRINT_CSS : MODERN_PRINT_CSS)}</style>
      <ResumeToolbar
        role={role}
        template={template}
        onRoleChange={(r) => setState((s) => ({ ...s, role: r }))}
        onTemplateChange={(t) => setState((s) => ({ ...s, template: t }))}
        onDownload={download}
      />

      {/* Both templates print inside the frame. Chromium re-renders a
          table's <thead>/<tfoot> at the top and bottom of EVERY printed
          page, so the empty spacer rows inside them are the only way to put
          a margin on page two that survives the print dialog's
          "Margins: None" — that setting zeroes @page outright, and @page is
          otherwise the only thing that applies to every page.

          The frame is a single column wrapping the whole document, so it
          does not reorder anything: an ATS receives the PDF, where text is
          extracted by position, not this markup. Verify with Ctrl-A /
          Ctrl-C on the printed file. */}
      <table className="resume-print-frame">
        <thead>
          <tr>
            <td>
              <div className="resume-page-spacer" aria-hidden="true" />
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              {template === "ats" ? (
                <ATSTemplate content={filtered} />
              ) : (
                <ModernTemplate content={filtered} />
              )}
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td>
              <div className="resume-page-spacer" aria-hidden="true" />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/**
 * The repeating print frame, shared by both templates.
 *
 * A page margin can only come from two places: @page, which the print
 * dialog's "Margins" control can zero, or something the browser repeats on
 * every page. Padding is neither — it cushions the first and last page a
 * box lands on and nothing in between, which is why a two-page résumé used
 * to start page two hard against the paper edge.
 *
 * Chromium re-renders a table's <thead> and <tfoot> at the top and bottom
 * of every printed page. Empty spacer rows there give a real, repeating
 * vertical margin that no dialog setting can take away.
 */
const FRAME_CSS = `
  .resume-print-frame,
  .resume-print-frame > thead,
  .resume-print-frame > tbody,
  .resume-print-frame > tfoot,
  .resume-print-frame tr,
  .resume-print-frame td {
    display: block;
    width: 100%;
    border: 0;
    padding: 0;
    margin: 0;
  }
  /* On screen the frame is inert — no spacers, no table behaviour. */
  .resume-page-spacer { height: 0; }

  @media print {
    /* Zero, deliberately: the frame owns the vertical margin, so the result
       is identical whether the dialog says Default or None. */
    @page { size: A4; margin: 0; }

    .resume-print-frame { display: table !important; table-layout: fixed; }
    .resume-print-frame > thead { display: table-header-group !important; }
    .resume-print-frame > tbody { display: table-row-group !important; }
    .resume-print-frame > tfoot { display: table-footer-group !important; }
    .resume-print-frame tr { display: table-row !important; }
    .resume-print-frame td { display: table-cell !important; }

    .resume-page-spacer { height: 16mm; }
  }
`;

/** Modern template: horizontal margin only — the frame handles the rest. */
const MODERN_PRINT_CSS = `
  @media print {
    .resume-sheet { padding: 0 16mm !important; }
  }
`;

/**
 * ATS template print rules.
 *
 * Horizontal margin comes from the sheet, vertical from the shared frame,
 * so every page gets 16mm on all four sides regardless of what the print
 * dialog's Margins control is set to.
 */
const ATS_PRINT_CSS = `
  @media print {
    .resume-ats {
      padding: 0 16mm !important;
      box-shadow: none !important;
      border: 0 !important;
    }

    /* Don't strand a section heading at the foot of a page, don't split a
       project or job entry across the break, and don't let a single line of
       a paragraph carry over on its own. */
    .resume-ats h2 { break-after: avoid; page-break-after: avoid; }
    .resume-ats section > div,
    .resume-ats li {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .resume-ats p { orphans: 2; widows: 2; }
  }
`;

