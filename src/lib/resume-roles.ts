import type { Project, SiteContent } from "./content";

/**
 * Role-scoped views of the résumé.
 *
 * Each role declares:
 *   • the skill *groups* it wants surfaced (matched by label)
 *   • the extra tags/stack items considered relevant (widens project match)
 *   • the summary spin — a role-specific opener that overrides the About lead
 *
 * A résumé template asks `applyRoleFilter(content, role)` and gets back
 * a filtered SiteContent it can render as-is. Projects are re-ordered so
 * the best matches come first; nothing is deleted unless the role
 * explicitly excludes it.
 */

export type ResumeRole = "all" | "frontend" | "fullstack" | "support";

export type RoleMeta = {
  id: ResumeRole;
  label: string;
  english: string;
  headline: string;
  /** Which SkillGroup.label values are the role's core discipline. */
  skillGroups: string[];
  /** Case-insensitive stack tokens that mark a project as role-relevant. */
  relevantStack: string[];
  /** Prose spin used when the summary paragraph should be role-specific. */
  summaryOverride?: string;
  /** Role-specific highlight bullets, prepended to the summary highlights
   *  so they lead the list when this role is selected. */
  extraHighlights?: string[];
};

const norm = (s: string) => s.trim().toLowerCase();

export const RESUME_ROLES: RoleMeta[] = [
  {
    id: "all",
    label: "All disciplines",
    english: "All",
    headline: "Computer Engineer · Embedded · Frontend · Design",
    skillGroups: [],
    relevantStack: [],
  },
  {
    id: "frontend",
    label: "Frontend Engineer",
    english: "Frontend",
    headline: "Frontend Engineer · React · TypeScript · Design",
    skillGroups: ["Frontend", "Design"],
    relevantStack: [
      "react",
      "typescript",
      "tailwind css",
      "flutter",
      "html / css / js",
      "responsive design",
      "web apis",
      "three.js",
      "figma",
      "ui / ux",
    ],
    summaryOverride:
      "Frontend engineer who ships product from Figma to prod — React + TypeScript, Tailwind, and a designer's eye for typography and motion. Comfortable owning both the component library and the marketing surface.",
  },
  {
    id: "fullstack",
    label: "Full-Stack Engineer",
    english: "Full Stack",
    headline: "Full-Stack Engineer · React · Node · Supabase",
    skillGroups: ["Frontend", "Tools & Backend"],
    relevantStack: [
      "react",
      "typescript",
      "tailwind css",
      "node.js",
      "sql",
      "firebase",
      "python",
      "web apis",
      "git",
      "linux",
    ],
    summaryOverride:
      "Full-stack engineer who works across the whole request lifecycle — React + TypeScript on the surface, Node + SQL (Postgres/Supabase) + serverless functions on the server. Comfortable designing schemas, wiring auth, and hardening a deploy pipeline.",
    extraHighlights: [
      "Handled the full deployment lifecycle — domain configuration, SSL setup, and hosting — for client launches (Rallys Equities, MYKTECH), ensuring secure and reliable production delivery",
      "Customized WordPress themes and layouts for client projects, adapting builds to non-technical client requirements",
    ],
  },
  {
    id: "support",
    label: "IT Support",
    english: "IT Support",
    headline: "IT Support · Systems · Documentation",
    skillGroups: ["Tools & Backend"],
    relevantStack: [
      "python",
      "git",
      "linux",
      "sql",
      "node.js",
      "vs code",
      "c / c++",
    ],
    summaryOverride:
      "IT support with a computer-engineering background — troubleshoot from silicon to browser, write clear runbooks, and ship small automations (Python, Bash, PowerShell) so recurring incidents stop being one-offs.",
  },
];

export function getRoleMeta(id: ResumeRole): RoleMeta {
  return RESUME_ROLES.find((r) => r.id === id) ?? RESUME_ROLES[0];
}

export function isRole(v: unknown): v is ResumeRole {
  return typeof v === "string" && RESUME_ROLES.some((r) => r.id === v);
}

/**
 * Score a project against a role. Higher = more relevant.
 *   +4 per relevantStack token appearing in project.stack
 *   +2 per relevantStack token appearing in project.tags
 *   +1 if any explicit "kind" match (Frontend → web/mobile; Support → desktop/web)
 */
function scoreProject(p: Project, role: RoleMeta): number {
  if (role.id === "all") return 0; // preserve original order
  const stack = new Set((p.stack ?? []).map(norm));
  const tags = new Set((p.tags ?? []).map(norm));
  let score = 0;
  for (const tok of role.relevantStack) {
    if (stack.has(tok)) score += 4;
    if (tags.has(tok)) score += 2;
  }
  if (role.id === "frontend" && (p.kind === "web" || p.kind === "mobile")) score += 1;
  if (role.id === "fullstack" && (p.kind === "web" || p.kind === "mobile" || p.kind === "desktop")) score += 1;
  if (role.id === "support" && (p.kind === "desktop" || p.kind === "web")) score += 1;
  return score;
}

/**
 * Apply the role filter to a SiteContent. Returns a new (shallow) content
 * object with:
 *   • skills → only the groups the role cares about (unless role=all)
 *   • projects → re-ranked so most relevant come first; unrelated projects
 *     drop off unless the role hits nothing (in which case we keep the
 *     original list rather than show an empty résumé)
 *   • hero.role → role.headline (when overriding)
 *   • about.paragraphs → role.summaryOverride prepended
 */
export function applyRoleFilter(content: SiteContent, role: ResumeRole): SiteContent {
  const meta = getRoleMeta(role);

  if (role === "all") {
    return content;
  }

  const scoredProjects = content.projects
    .map((p) => ({ p, s: scoreProject(p, meta) }))
    .sort((a, b) => b.s - a.s);
  const anyMatch = scoredProjects.some((x) => x.s > 0);
  const projects = anyMatch
    ? scoredProjects.filter((x) => x.s > 0).map((x) => x.p)
    : content.projects;

  const groupSet = new Set(meta.skillGroups.map(norm));
  const skills =
    meta.skillGroups.length === 0
      ? content.skills
      : content.skills.filter((g) => groupSet.has(norm(g.label)));
  const filteredSkills = skills.length === 0 ? content.skills : skills;

  const paragraphs = meta.summaryOverride
    ? meta.summaryOverride + "\n\n" + content.about.paragraphs
    : content.about.paragraphs;

  // Role-specific bullets lead the highlights list so they read first.
  const highlights = meta.extraHighlights
    ? [...meta.extraHighlights, ...(content.about.highlights ?? [])]
    : content.about.highlights;

  return {
    ...content,
    hero: { ...content.hero, role: meta.headline },
    about: { ...content.about, paragraphs, highlights },
    skills: filteredSkills,
    projects,
  };
}
