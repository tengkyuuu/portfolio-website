import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Download,
  Link,
  LockKeyhole,
  Save,
} from "lucide-react";
import type { ResumeRole } from "../../lib/resume-roles";
import type { ResumeTemplateId } from "../../lib/resume-builder";
export type { ResumeTemplateId } from "../../lib/resume-builder";

export const TEMPLATES = [
  {
    id: "modern" as const,
    label: "Editorial",
    hint: "A little personality. A clear hierarchy.",
  },
  {
    id: "ats" as const,
    label: "ATS-friendly",
    hint: "Simple, single-column, black on white.",
  },
];

export function ResumeToolbar({
  role,
  template,
  onDownload,
  onSave,
  saveStatus,
}: {
  role: ResumeRole;
  template: ResumeTemplateId;
  onDownload: () => void;
  onSave: () => void;
  saveStatus: string;
}) {
  const [copyStatus, setCopyStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copyLink() {
    const url = new URL(window.location.href);
    url.search = new URLSearchParams({ style: template, role }).toString();
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopyStatus("Style and role link copied");
    } catch {
      setCopyStatus("Couldn’t copy. Use the address bar.");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopyStatus(""), 3500);
  }
  return (
    <header className="resume-builder-header no-print">
      <div className="resume-builder-titlebar">
        <a href="/" aria-label="Back to portfolio">
          <ArrowLeft size={16} />
          <span>Portfolio</span>
        </a>
        <span className="resume-header-divider" />
        <span className="resume-file-name">Résumé.docx</span>
        <span className="resume-private">
          <LockKeyhole size={11} /> Private workspace
        </span>
        <div className="resume-header-actions">
          <button onClick={onSave}>
            <Save size={14} />
            <span>Save draft</span>
          </button>
          <button className="resume-export" onClick={onDownload}>
            <Download size={14} />
            <span>Export PDF</span>
          </button>
        </div>
      </div>
      <div className="resume-builder-subbar">
        <span>
          <strong>Résumé builder</strong>
          <span className="resume-subbar-note">
            Your next chapter starts here.
          </span>
        </span>
        <div>
          <span className="resume-save-status" role="status">
            {saveStatus}
          </span>
          <button
            onClick={() => void copyLink()}
            title="Copies the template and role settings. Draft edits stay on this device."
          >
            {copyStatus.startsWith("Style") ? (
              <Check size={13} />
            ) : (
              <Link size={13} />
            )}
            <span>Copy preset link</span>
          </button>
          <a href="/admin" title="Edit the source content">
            <span>Portfolio content</span>
            <ArrowUpRight size={13} />
          </a>
        </div>
      </div>
      {copyStatus && (
        <div className="resume-builder-toast" role="status">
          {copyStatus}
        </div>
      )}
    </header>
  );
}
