/**
 * Derived numbers for the Core Competencies tab.
 *
 * Everything here is computed from data that already exists — the skill
 * groups in `content`, the `level` field in `skill-catalog`, and the
 * tags / stack arrays on each project. Nothing is estimated: a "cadence"
 * of 3/3 is just a rendering of `level: "daily"`, and a project count is
 * a real count of projects that name the skill.
 */

import type { Project, SkillGroup } from "./content";
import { getSkillMeta, type SkillLevel } from "./skill-catalog";

/** Most-used first — drives filter order and sort order. */
export const LEVEL_ORDER: SkillLevel[] = ["daily", "weekly", "explored"];

/** Cadence is the level rendered as a 0–3 signal, nothing more. */
export const CADENCE_MAX = 3;
export const LEVEL_CADENCE: Record<SkillLevel, number> = {
  daily: 3,
  weekly: 2,
  explored: 1,
};

export type SkillRow = {
  name: string;
  group: string;
  level?: SkillLevel;
  /** 0 when the skill has no catalog entry, else 1–3. */
  cadence: number;
  logo?: string;
  /** True when `skill-catalog.ts` has an entry (so the panel has content). */
  documented: boolean;
  projects: Project[];
};

export type GroupStats = {
  label: string;
  rows: SkillRow[];
  /** Mean cadence across the group, 0–1. Drives the discipline meter. */
  density: number;
  daily: number;
};

export type DeckStats = {
  disciplines: number;
  skills: number;
  byLevel: Record<SkillLevel, number>;
  documented: number;
  /** Distinct projects named by at least one skill in the deck. */
  shippedIn: number;
};

export type SkillModel = {
  groups: GroupStats[];
  rows: SkillRow[];
  stats: DeckStats;
};

const norm = (s: string) => s.trim().toLowerCase();

/** skill name (normalized) → projects whose tags or stack name it. */
export function indexProjectsBySkill(projects: Project[]): Map<string, Project[]> {
  const map = new Map<string, Project[]>();
  for (const p of projects) {
    const bag = new Set<string>();
    (p.tags ?? []).forEach((t) => bag.add(norm(t)));
    (p.stack ?? []).forEach((s) => bag.add(norm(s)));
    for (const skill of bag) {
      const list = map.get(skill) ?? [];
      list.push(p);
      map.set(skill, list);
    }
  }
  return map;
}

export function buildSkillModel(
  skills: SkillGroup[],
  projects: Project[]
): SkillModel {
  const bySkill = indexProjectsBySkill(projects);

  const groups: GroupStats[] = skills.map((group) => {
    const rows: SkillRow[] = group.items.map((name) => {
      const meta = getSkillMeta(name);
      return {
        name,
        group: group.label,
        level: meta?.level,
        cadence: meta?.level ? LEVEL_CADENCE[meta.level] : 0,
        logo: meta?.logo,
        documented: Boolean(meta),
        projects: bySkill.get(norm(name)) ?? [],
      };
    });

    const sum = rows.reduce((n, r) => n + r.cadence, 0);
    return {
      label: group.label,
      rows,
      density: rows.length ? sum / (rows.length * CADENCE_MAX) : 0,
      daily: rows.filter((r) => r.level === "daily").length,
    };
  });

  const rows = groups.flatMap((g) => g.rows);

  const byLevel: Record<SkillLevel, number> = {
    daily: 0,
    weekly: 0,
    explored: 0,
  };
  for (const r of rows) if (r.level) byLevel[r.level] += 1;

  const shipped = new Set<string>();
  for (const r of rows) for (const p of r.projects) shipped.add(p.id);

  return {
    groups,
    rows,
    stats: {
      disciplines: groups.length,
      skills: rows.length,
      byLevel,
      documented: rows.filter((r) => r.documented).length,
      shippedIn: shipped.size,
    },
  };
}

/** True when the query matches the skill name or its discipline. */
export function matchesQuery(row: SkillRow, query: string): boolean {
  const q = norm(query);
  if (!q) return true;
  return norm(row.name).includes(q) || norm(row.group).includes(q);
}

export type SortKey = "discipline" | "cadence" | "projects" | "name";

export function sortRows(rows: SkillRow[], key: SortKey): SkillRow[] {
  const out = [...rows];
  switch (key) {
    case "cadence":
      return out.sort(
        (a, b) => b.cadence - a.cadence || a.name.localeCompare(b.name)
      );
    case "projects":
      return out.sort(
        (a, b) =>
          b.projects.length - a.projects.length ||
          b.cadence - a.cadence ||
          a.name.localeCompare(b.name)
      );
    case "name":
      return out.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return out; // already in discipline order
  }
}
