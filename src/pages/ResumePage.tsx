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
      {/* Route-scoped print override: zero @page margin removes the
          browser's own header/footer (date + title live in that margin),
          and the sheet takes over the breathing room itself. Only /resume
          loads this component, so site-wide printing is unaffected. */}
      <style>{`
        @media print {
          @page { margin: 0; }
          .resume-sheet { padding: 14mm 16mm !important; }
        }
      `}</style>
      <ResumeToolbar
        role={role}
        template={template}
        onRoleChange={(r) => setState((s) => ({ ...s, role: r }))}
        onTemplateChange={(t) => setState((s) => ({ ...s, template: t }))}
        onDownload={download}
      />

      {template === "ats" ? (
        <ATSTemplate content={filtered} />
      ) : (
        <ModernTemplate content={filtered} />
      )}
    </div>
  );
}
