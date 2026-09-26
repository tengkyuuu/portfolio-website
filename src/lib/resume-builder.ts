import type { SiteContent } from "./content";
import { applyRoleFilter, isRole, type ResumeRole } from "./resume-roles";
import { plain } from "../pages/resume/shared";

export const RESUME_PROJECT_LIMIT = 5;
export const RESUME_DRAFT_KEY = "jvc_resume_draft_v1";
export type ResumeTemplateId = "modern" | "ats";
export type ResumeSection =
  "summary" | "highlights" | "skills" | "projects" | "timeline" | "certs";
export type ResumeEdit = {
  headline?: string;
  summary?: string;
  projectIds?: string[];
};
export type ResumeDraft = {
  version: 1;
  role: ResumeRole;
  template: ResumeTemplateId;
  accent: "blue" | "graphite" | "forest";
  density: "comfortable" | "compact";
  sections: Record<ResumeSection, boolean>;
  edits: Partial<Record<ResumeRole, ResumeEdit>>;
};
export function freshResumeDraft(): ResumeDraft {
  return {
    version: 1,
    role: "all",
    template: "modern",
    accent: "blue",
    density: "comfortable",
    sections: {
      summary: true,
      highlights: true,
      skills: true,
      projects: true,
      timeline: true,
      certs: true,
    },
    edits: {},
  };
}
/** A damaged or old local draft must not prevent access to the builder. */
export function parseResumeDraft(raw: string | null): ResumeDraft {
  const base = freshResumeDraft();
  if (!raw) return base;
  try {
    const value = JSON.parse(raw);
    if (!value || value.version !== 1) return base;
    if (isRole(value.role)) base.role = value.role;
    if (value.template === "modern" || value.template === "ats")
      base.template = value.template;
    if (["blue", "graphite", "forest"].includes(value.accent))
      base.accent = value.accent;
    if (value.density === "compact") base.density = "compact";
    for (const key of Object.keys(base.sections) as ResumeSection[])
      if (typeof value.sections?.[key] === "boolean")
        base.sections[key] = value.sections[key];
    for (const role of ["all", "frontend", "fullstack", "support"] as const) {
      const edit = value.edits?.[role];
      if (!edit || typeof edit !== "object") continue;
      base.edits[role] = {
        ...(typeof edit.headline === "string"
          ? { headline: edit.headline }
          : {}),
        ...(typeof edit.summary === "string" ? { summary: edit.summary } : {}),
        ...(Array.isArray(edit.projectIds) &&
        edit.projectIds.every((id: unknown) => typeof id === "string")
          ? { projectIds: [...new Set<string>(edit.projectIds)] }
          : {}),
      };
    }
    return base;
  } catch {
    return base;
  }
}
export function initialResumeDraft(): ResumeDraft {
  let draft = freshResumeDraft();
  try {
    draft = parseResumeDraft(localStorage.getItem(RESUME_DRAFT_KEY));
  } catch {
    /* Storage can be disabled. */
  }
  const params = new URLSearchParams(window.location.search);
  if (params.has("role"))
    draft.role = isRole(params.get("role"))
      ? (params.get("role") as ResumeRole)
      : "all";
  if (params.has("style"))
    draft.template = params.get("style") === "ats" ? "ats" : "modern";
  return draft;
}
export function resumeRoleContent(content: SiteContent, draft: ResumeDraft) {
  return applyRoleFilter(content, draft.role);
}
export function resumeSelectedProjects(
  content: SiteContent,
  draft: ResumeDraft,
): string[] {
  const selected =
    draft.edits[draft.role]?.projectIds ??
    resumeRoleContent(content, draft)
      .projects.slice(0, RESUME_PROJECT_LIMIT)
      .map((project) => project.id);
  return selected.filter((id) =>
    content.projects.some((project) => project.id === id),
  );
}
export function buildResumeContent(
  content: SiteContent,
  draft: ResumeDraft,
): SiteContent {
  const base = resumeRoleContent(content, draft);
  const edit = draft.edits[draft.role];
  const selectedIds = resumeSelectedProjects(content, draft);
  const selected = selectedIds
    .map((id) => content.projects.find((project) => project.id === id))
    .filter((project): project is SiteContent["projects"][number] =>
      Boolean(project),
    );
  return {
    ...base,
    hero: { ...base.hero, role: edit?.headline ?? base.hero.role },
    about: {
      ...base.about,
      paragraphs: draft.sections.summary
        ? (edit?.summary ??
          plain(base.about.paragraphs.split(/\n\s*\n/)[0] ?? ""))
        : "",
      highlights: draft.sections.highlights ? base.about.highlights : [],
    },
    projects: draft.sections.projects ? selected : [],
    skills: draft.sections.skills ? base.skills : [],
    timeline: draft.sections.timeline ? base.timeline : [],
    certs: draft.sections.certs ? base.certs : [],
  };
}
