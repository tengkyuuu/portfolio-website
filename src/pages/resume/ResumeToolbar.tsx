import { useEffect, useRef, useState } from "react";
import { RESUME_ROLES, type ResumeRole } from "../../lib/resume-roles";

export type ResumeTemplateId = "modern" | "ats";

export const TEMPLATES: {
  id: ResumeTemplateId;
  label: string;
  hint: string;
  icon: string;
}[] = [
  {
    id: "modern",
    label: "Modern",
    hint: "Word-document look — serif + accent",
    icon: "description",
  },
  {
    id: "ats",
    label: "ATS-friendly",
    hint: "System serif, single column, no colour",
    icon: "checklist",
  },
];

type Props = {
  role: ResumeRole;
  template: ResumeTemplateId;
  onRoleChange: (r: ResumeRole) => void;
  onTemplateChange: (t: ResumeTemplateId) => void;
  onDownload: () => void;
};

/**
 * Word "Style Gallery" toolbar for the Résumé Builder. Two popovers:
 * Style (template picker) and Focus (role picker). Everything hidden in
 * print. Copy-link chip renders the current shareable URL for the visible
 * variant.
 */
export function ResumeToolbar({
  role,
  template,
  onRoleChange,
  onTemplateChange,
  onDownload,
}: Props) {
  const [copied, setCopied] = useState(false);
  const currentTemplate = TEMPLATES.find((t) => t.id === template) ?? TEMPLATES[0];
  const currentRole = RESUME_ROLES.find((r) => r.id === role) ?? RESUME_ROLES[0];

  async function copyLink() {
    const url = new URL(window.location.href);
    url.searchParams.set("style", template);
    url.searchParams.set("role", role);
    await navigator.clipboard.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="no-print max-w-[794px] mx-auto mb-4 space-y-3">
      {/* Top row — back / download */}
      <div className="flex items-center justify-between gap-3">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 font-ui text-[13px] text-ink-muted hover:text-ink"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            arrow_back
          </span>
          Back to portfolio
        </a>
        <button
          onClick={onDownload}
          className="inline-flex items-center gap-1.5 bg-word-blue text-white font-ui text-[13px] font-medium px-3.5 py-2 rounded-sm hover:bg-word-blue-dark transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            download
          </span>
          Download PDF
        </button>
      </div>

      {/* Style + Focus row — Word "Style Gallery" ribbon */}
      <div className="border border-rule rounded-sm bg-paper p-3 md:p-4">
        <div className="flex items-center gap-2 mb-3">
          <span
            className="material-symbols-outlined icon-fill text-word-blue"
            style={{ fontSize: 16 }}
          >
            style
          </span>
          <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.14em] text-word-blue">
            Résumé Builder
          </span>
          <span className="hidden sm:inline font-ui text-[11px] text-ink-subtle italic ml-1">
            · pick a style and a focus, then Download PDF
          </span>
          <button
            onClick={copyLink}
            title="Copy link to this variant"
            className="ml-auto inline-flex items-center gap-1 font-ui text-[11px] font-medium text-ink-muted hover:text-word-blue transition-colors"
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 14 }}
            >
              {copied ? "check" : "link"}
            </span>
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <PickerButton
            eyebrow="Style"
            currentLabel={currentTemplate.label}
            currentHint={currentTemplate.hint}
            currentIcon={currentTemplate.icon}
            options={TEMPLATES.map((t) => ({
              id: t.id,
              label: t.label,
              hint: t.hint,
              icon: t.icon,
            }))}
            selected={template}
            onChange={(id) => onTemplateChange(id as ResumeTemplateId)}
          />
          <PickerButton
            eyebrow="Focus"
            currentLabel={currentRole.english}
            currentHint={currentRole.label}
            currentIcon="target"
            options={RESUME_ROLES.map((r) => ({
              id: r.id,
              label: r.english,
              hint: r.headline,
              icon: r.id === "all" ? "workspaces" : "target",
            }))}
            selected={role}
            onChange={(id) => onRoleChange(id as ResumeRole)}
          />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- picker -------------------------------- */

function PickerButton({
  eyebrow,
  currentLabel,
  currentHint,
  currentIcon,
  options,
  selected,
  onChange,
}: {
  eyebrow: string;
  currentLabel: string;
  currentHint: string;
  currentIcon: string;
  options: { id: string; label: string; hint: string; icon: string }[];
  selected: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={
          "w-full flex items-center gap-3 border rounded-sm px-3 py-2 text-left transition-colors " +
          (open
            ? "border-word-blue bg-word-blue-light"
            : "border-rule bg-paper hover:bg-ribbon-hover")
        }
      >
        <span
          className="material-symbols-outlined icon-fill text-word-blue shrink-0"
          style={{ fontSize: 22 }}
        >
          {currentIcon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
            {eyebrow}
          </div>
          <div className="font-ui text-[13px] font-semibold text-ink truncate">
            {currentLabel}
          </div>
          <div className="font-ui text-[11px] text-ink-subtle truncate">
            {currentHint}
          </div>
        </div>
        <span
          className="material-symbols-outlined text-ink-muted"
          style={{ fontSize: 18 }}
        >
          {open ? "arrow_drop_up" : "arrow_drop_down"}
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          className="word-popover absolute top-full left-0 right-0 mt-1 py-1 z-40 max-h-[320px] overflow-y-auto"
        >
          {options.map((o) => {
            const isActive = o.id === selected;
            return (
              <button
                key={o.id}
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  setOpen(false);
                  onChange(o.id);
                }}
                className={
                  "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors " +
                  (isActive ? "bg-word-blue-light" : "hover:bg-ribbon-hover")
                }
              >
                <span
                  className="material-symbols-outlined text-ink-muted shrink-0"
                  style={{ fontSize: 18 }}
                >
                  {o.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-ui text-[13px] font-medium text-ink truncate">
                    {o.label}
                  </div>
                  <div className="font-ui text-[11px] text-ink-subtle truncate">
                    {o.hint}
                  </div>
                </div>
                {isActive && (
                  <span
                    className="material-symbols-outlined text-word-blue icon-fill"
                    style={{ fontSize: 16 }}
                  >
                    check_circle
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
