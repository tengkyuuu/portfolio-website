import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCheck,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import type { SiteContent } from "../../lib/content";
import { RESUME_ROLES } from "../../lib/resume-roles";
import {
  resumeRoleContent,
  resumeSelectedProjects,
  type ResumeDraft,
  type ResumeEdit,
  type ResumeSection,
} from "../../lib/resume-builder";
import { plain } from "./shared";
import { TEMPLATES } from "./ResumeToolbar";

const SECTIONS: { id: ResumeSection; label: string }[] = [
  { id: "summary", label: "Professional summary" },
  { id: "highlights", label: "Summary highlights" },
  { id: "skills", label: "Skills & technologies" },
  { id: "projects", label: "Selected projects" },
  { id: "timeline", label: "Education & experience" },
  { id: "certs", label: "Certifications & awards" },
];
export function ResumeSettings({
  content,
  draft,
  onChange,
  onReset,
}: {
  content: SiteContent;
  draft: ResumeDraft;
  onChange: (draft: ResumeDraft) => void;
  onReset: () => void;
}) {
  const roleContent = resumeRoleContent(content, draft);
  const edit = draft.edits[draft.role] ?? {};
  const selected = resumeSelectedProjects(content, draft);
  function updateEdit(next: ResumeEdit) {
    onChange({
      ...draft,
      edits: { ...draft.edits, [draft.role]: { ...edit, ...next } },
    });
  }
  function moveProject(index: number, direction: number) {
    const reordered = [...selected];
    [reordered[index], reordered[index + direction]] = [
      reordered[index + direction],
      reordered[index],
    ];
    updateEdit({ projectIds: reordered });
  }
  return (
    <aside className="resume-settings no-print" aria-label="Résumé settings">
      <div className="resume-settings-heading">
        <SlidersHorizontal size={17} />
        <div>
          <h1>Make it your own.</h1>
          <p>Fine-tune the story you send.</p>
        </div>
      </div>
      <section className="resume-setting-section">
        <h2>
          <span>01</span> Choose your canvas
        </h2>
        <div className="resume-template-options">
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              aria-label={`${template.label} template`}
              aria-pressed={draft.template === template.id}
              onClick={() => onChange({ ...draft, template: template.id })}
              className={draft.template === template.id ? "is-selected" : ""}
            >
              <span
                className={`resume-template-mini mini-${template.id}`}
                aria-hidden="true"
              >
                <b>James Vincent</b>
                <span>COMPUTER ENGINEER</span>
                <i />
                <i />
                <i />
                <strong />
                <i />
                <i />
                <strong />
                <i />
                <i />
              </span>
              <span className="resume-template-label">
                {template.label}
                {draft.template === template.id && <Check size={12} />}
              </span>
              <small>{template.hint}</small>
            </button>
          ))}
        </div>
        {draft.template === "modern" && (
          <div className="resume-appearance">
            <span>Accent</span>
            <div>
              {(["blue", "graphite", "forest"] as const).map((accent) => (
                <button
                  key={accent}
                  className={`resume-accent-swatch accent-${accent}`}
                  aria-label={`${accent} accent`}
                  aria-pressed={draft.accent === accent}
                  onClick={() => onChange({ ...draft, accent })}
                >
                  {draft.accent === accent && <Check size={12} />}
                </button>
              ))}
            </div>
            <label>
              Spacing
              <select
                value={draft.density}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    density: event.target.value as ResumeDraft["density"],
                  })
                }
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </label>
          </div>
        )}
      </section>
      <section className="resume-setting-section">
        <h2>
          <span>02</span> Tell your story
        </h2>
        <label className="resume-field-label" htmlFor="resume-role">
          Tailor for a role
        </label>
        <select
          id="resume-role"
          className="resume-field"
          value={draft.role}
          onChange={(event) =>
            onChange({
              ...draft,
              role: event.target.value as ResumeDraft["role"],
            })
          }
        >
          {RESUME_ROLES.map((role) => (
            <option key={role.id} value={role.id}>
              {role.label}
            </option>
          ))}
        </select>
        <p className="resume-field-hint">
          Suggests relevant skills and projects. Your edits are kept separately
          for each role.
        </p>
        <label className="resume-field-label" htmlFor="resume-headline">
          Professional headline
        </label>
        <input
          id="resume-headline"
          className="resume-field"
          value={edit.headline ?? roleContent.hero.role}
          onChange={(event) => updateEdit({ headline: event.target.value })}
          maxLength={180}
        />
        <label className="resume-field-label" htmlFor="resume-summary">
          Summary<span>Editable</span>
        </label>
        <textarea
          id="resume-summary"
          className="resume-field"
          rows={5}
          value={
            edit.summary ??
            plain(roleContent.about.paragraphs.split(/\n\s*\n/)[0] ?? "")
          }
          onChange={(event) => updateEdit({ summary: event.target.value })}
          maxLength={3000}
        />
      </section>
      <section className="resume-setting-section">
        <h2>
          <span>03</span> Curate the details
        </h2>
        <div className="resume-section-toggles">
          {SECTIONS.map((section) => (
            <label key={section.id}>
              <input
                type="checkbox"
                checked={draft.sections[section.id]}
                disabled={
                  section.id === "highlights" && !draft.sections.summary
                }
                onChange={(event) =>
                  onChange({
                    ...draft,
                    sections: {
                      ...draft.sections,
                      [section.id]: event.target.checked,
                    },
                  })
                }
              />
              <span>{section.label}</span>
              <span className="resume-toggle-track" aria-hidden="true" />
            </label>
          ))}
        </div>
        {draft.sections.projects && (
          <div className="resume-project-picker">
            <div>
              <h3>Projects to include</h3>
              <span>{selected.length} selected</span>
            </div>
            <p className="resume-field-hint">
              Start with the suggested five, then choose and reorder what fits.
            </p>
            <ul className="resume-selected-projects">
              {selected.map((id, index) => {
                const project = content.projects.find((item) => item.id === id);
                if (!project) return null;
                return (
                  <li key={id}>
                    <span>{index + 1}</span>
                    <strong>{project.title}</strong>
                    <button
                      disabled={index === 0}
                      onClick={() => moveProject(index, -1)}
                      aria-label={`Move ${project.title} up`}
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      disabled={index === selected.length - 1}
                      onClick={() => moveProject(index, 1)}
                      aria-label={`Move ${project.title} down`}
                    >
                      <ArrowDown size={12} />
                    </button>
                  </li>
                );
              })}
            </ul>
            <details>
              <summary>
                Select projects <CheckCheck size={13} />
              </summary>
              <div>
                {content.projects.map((project) => (
                  <label key={project.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(project.id)}
                      onChange={(event) =>
                        updateEdit({
                          projectIds: event.target.checked
                            ? [...selected, project.id]
                            : selected.filter((id) => id !== project.id),
                        })
                      }
                    />
                    <span>{project.title}</span>
                  </label>
                ))}
              </div>
            </details>
          </div>
        )}
      </section>
      <div className="resume-settings-footer">
        <p>Your résumé edits stay here. They won’t change your portfolio.</p>
        <button onClick={onReset}>
          <RotateCcw size={13} /> Reset to portfolio content
        </button>
      </div>
    </aside>
  );
}
