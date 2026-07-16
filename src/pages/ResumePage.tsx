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

  const filtered = useMemo(
    () => applyRoleFilter(content, role),
    [content, role]
  );

  function download() {
    // Delegate to the browser's print dialog. Users pick "Save as PDF"
    // as the destination — no server-side PDF generation needed.
    window.print();
  }

  return (
    <div className="resume-page min-h-svh bg-workspace text-ink py-6 md:py-10 px-3">
      {/* Route-scoped print overrides. Only /resume loads this component,
          so site-wide printing is unaffected.

          @page margin 0 removes the browser's own header/footer (date +
          title live in that margin area). But that also means the sheet's
          padding only cushions PAGE ONE — later pages would start at the
          paper's physical edge. So vertical breathing room comes from a
          repeating table frame instead: Chromium re-renders a table's
          <thead>/<tfoot> at the top/bottom of EVERY printed page, and the
          empty spacer rows inside them are 12mm tall in print. Horizontal
          padding stays on the sheet (it applies to every line anyway). */}
      <style>{`
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
        .resume-page-spacer { height: 0; }

        @media print {
          @page { margin: 0; }
          .resume-sheet { padding: 0 16mm !important; }
          .resume-print-frame { display: table !important; table-layout: fixed; }
          .resume-print-frame > thead { display: table-header-group !important; }
          .resume-print-frame > tbody { display: table-row-group !important; }
          .resume-print-frame > tfoot { display: table-footer-group !important; }
          .resume-print-frame tr { display: table-row !important; }
          .resume-print-frame td { display: table-cell !important; }
          .resume-page-spacer { height: 12mm; }
        }
      `}</style>
      <ResumeToolbar
        role={role}
        template={template}
        onRoleChange={(r) => setState((s) => ({ ...s, role: r }))}
        onTemplateChange={(t) => setState((s) => ({ ...s, template: t }))}
        onDownload={download}
      />

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
