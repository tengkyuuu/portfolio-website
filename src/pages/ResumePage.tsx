import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Eye,
  FileText,
  Maximize2,
  Minus,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { CONTENT_EVENT, getContent, syncFromServer } from "../lib/content";
import {
  buildResumeContent,
  freshResumeDraft,
  initialResumeDraft,
  RESUME_DRAFT_KEY,
  type ResumeDraft,
} from "../lib/resume-builder";
import { ATSTemplate } from "./resume/ATSTemplate";
import { ModernTemplate } from "./resume/ModernTemplate";
import { ResumeToolbar } from "./resume/ResumeToolbar";
import { ResumeSettings } from "./resume/ResumeSettings";
import "./resume/resume-builder.css";
export { RESUME_PROJECT_LIMIT } from "../lib/resume-builder";

export function ResumePage() {
  const [content, setContent] = useState(getContent);
  const [draft, setDraft] = useState(initialResumeDraft);
  const [saveStatus, setSaveStatus] = useState("Local working copy");
  const [mobilePane, setMobilePane] = useState<"edit" | "preview">("edit");
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [fit, setFit] = useState(1);
  const [wordCount, setWordCount] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(
    () => buildResumeContent(content, draft),
    [content, draft],
  );
  const scale = zoom === "fit" ? fit : zoom / 100;

  useEffect(() => {
    const update = () => setContent(getContent());
    window.addEventListener(CONTENT_EVENT, update);
    void syncFromServer();
    return () => window.removeEventListener(CONTENT_EVENT, update);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (draft.role === "all") params.delete("role");
    else params.set("role", draft.role);
    if (draft.template === "modern") params.delete("style");
    else params.set("style", draft.template);
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (query ? `?${query}` : ""),
    );
    document.title = `${content.hero.name} — Résumé`;
  }, [draft.role, draft.template, content.hero.name]);

  useEffect(() => {
    const onPop = () => setDraft(initialResumeDraft());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const resize = () => {
      if (canvas.clientWidth > 0)
        setFit(Math.min(1, Math.max(0.2, (canvas.clientWidth - 40) / 794)));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const text =
      previewRef.current?.innerText ?? previewRef.current?.textContent ?? "";
    setWordCount(text.trim().split(/\s+/).filter(Boolean).length);
  }, [filtered, draft.template]);

  function updateDraft(next: ResumeDraft) {
    setDraft(next);
    setSaveStatus("Unsaved changes");
  }
  function saveDraft() {
    try {
      localStorage.setItem(RESUME_DRAFT_KEY, JSON.stringify(draft));
      setSaveStatus("Draft saved on this device");
    } catch {
      setSaveStatus("Draft could not be saved. You can still export PDF.");
    }
  }
  function resetDraft() {
    setDraft({
      ...freshResumeDraft(),
      role: draft.role,
      template: draft.template,
      accent: draft.accent,
      density: draft.density,
    });
    try {
      localStorage.removeItem(RESUME_DRAFT_KEY);
    } catch {
      /* The working copy still resets. */
    }
    setSaveStatus("Reset · not yet saved");
  }
  function stepZoom(amount: number) {
    setZoom(
      Math.max(
        30,
        Math.min(
          125,
          Math.round((zoom === "fit" ? fit * 100 : zoom) / 5) * 5 + amount,
        ),
      ),
    );
  }

  return (
    <div className="resume-page resume-builder" data-mobile-pane={mobilePane}>
      <style>{FRAME_CSS}</style>
      <ResumeToolbar
        role={draft.role}
        template={draft.template}
        onDownload={() => window.print()}
        onSave={saveDraft}
        saveStatus={saveStatus}
      />
      <div className="resume-mobile-switch no-print">
        <button
          aria-pressed={mobilePane === "edit"}
          onClick={() => setMobilePane("edit")}
        >
          <SlidersHorizontal size={14} />
          Customize
        </button>
        <button
          aria-pressed={mobilePane === "preview"}
          onClick={() => setMobilePane("preview")}
        >
          <Eye size={14} />
          Preview
        </button>
      </div>
      <div className="resume-builder-layout">
        <ResumeSettings
          content={content}
          draft={draft}
          onChange={updateDraft}
          onReset={resetDraft}
        />
        <main className="resume-preview-panel" aria-label="Résumé preview">
          <div className="resume-preview-toolbar no-print">
            <div>
              <span className="resume-live-dot" />
              <strong>Live preview</strong>
              <span>
                {draft.template === "modern" ? "Editorial" : "ATS-friendly"}
              </span>
            </div>
            <div className="resume-zoom-controls">
              <button
                onClick={() => stepZoom(-10)}
                aria-label="Zoom résumé out"
              >
                <Minus size={14} />
              </button>
              <span>{Math.round(scale * 100)}%</span>
              <button onClick={() => stepZoom(10)} aria-label="Zoom résumé in">
                <Plus size={14} />
              </button>
              <button
                onClick={() => setZoom("fit")}
                aria-label="Fit résumé to width"
                aria-pressed={zoom === "fit"}
              >
                <Maximize2 size={13} />
                <span>Fit</span>
              </button>
            </div>
          </div>
          <div className="resume-preview-meta no-print">
            <span>
              <FileText size={12} /> A4 <span>·</span> 210 × 297 mm
            </span>
            <span>{wordCount} words</span>
          </div>
          <div className="resume-canvas" ref={canvasRef}>
            <div
              className="resume-preview-document"
              ref={previewRef}
              style={{ zoom: scale }}
              data-accent={draft.accent}
              data-density={draft.density}
            >
              <table className="resume-print-frame" role="presentation">
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
                      {draft.template === "ats" ? (
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
          </div>
          <div className="resume-export-note no-print">
            <Check size={14} />
            <p>
              Ready when you are.{" "}
              <span>
                Export PDF opens print preview. Choose A4 and “Save as PDF” to
                confirm pagination.
              </span>
            </p>
          </div>
        </main>
      </div>
      <footer className="resume-builder-status no-print">
        <span>
          Résumé workspace <span>·</span> Changes apply to this résumé only
        </span>
        <span>
          {draft.template === "ats"
            ? "Single-column layout"
            : "Editorial layout"}{" "}
          <span>·</span> A4 document
        </span>
      </footer>
    </div>
  );
}

/** Repeated table spacers preserve margins on every PDF page, including
 * when the print dialog's own margin setting is None. One content column
 * keeps source and PDF reading order aligned in both templates. */
const FRAME_CSS = `
  .resume-print-frame, .resume-print-frame > thead, .resume-print-frame > tbody,
  .resume-print-frame > tfoot, .resume-print-frame tr, .resume-print-frame td {
    display: block; width: 100%; border: 0; padding: 0; margin: 0;
  }
  .resume-page-spacer { height: 0; }
  @media print {
    @page { size: A4; margin: 0; }
    .resume-print-frame { display: table !important; table-layout: fixed; }
    .resume-print-frame > thead { display: table-header-group !important; }
    .resume-print-frame > tbody { display: table-row-group !important; }
    .resume-print-frame > tfoot { display: table-footer-group !important; }
    .resume-print-frame tr { display: table-row !important; }
    .resume-print-frame td { display: table-cell !important; }
    .resume-page-spacer { height: 16mm; }
    .resume-sheet, .resume-ats { padding: 0 16mm !important; box-shadow: none !important; border: 0 !important; }
    .resume-sheet h2 { break-after: avoid; page-break-after: avoid; }
    .resume-sheet li, .resume-ats section > div { break-inside: avoid; page-break-inside: avoid; }
    .resume-sheet p { orphans: 2; widows: 2; }
  }
`;
