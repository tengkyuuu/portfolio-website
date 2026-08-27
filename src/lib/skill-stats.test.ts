import { describe, expect, it } from "vitest";
import type { Project, SkillGroup } from "./content";
import {
  buildSkillModel,
  CADENCE_MAX,
  matchesQuery,
  sortRows,
  type SkillRow,
} from "./skill-stats";

const groups: SkillGroup[] = [
  { label: "Frontend", items: ["React", "TypeScript", "Three.js"] },
  { label: "Design", items: ["Figma", "Not A Real Skill"] },
];

const project = (id: string, tags: string[], stack: string[] = []): Project => ({
  id,
  index: "01",
  title: id,
  blurb: "",
  tags,
  kind: "web",
  links: [],
  stack,
});

const projects: Project[] = [
  project("a", ["React"], ["TypeScript"]),
  project("b", ["react"], []), // case-insensitive match
  project("c", [], ["Figma", "TypeScript"]),
];

describe("buildSkillModel", () => {
  const model = buildSkillModel(groups, projects);
  const row = (name: string) => model.rows.find((r) => r.name === name) as SkillRow;

  it("keeps every skill, in group order", () => {
    expect(model.rows.map((r) => r.name)).toEqual([
      "React",
      "TypeScript",
      "Three.js",
      "Figma",
      "Not A Real Skill",
    ]);
  });

  it("renders a catalog level as a 0-3 cadence", () => {
    expect(row("React").cadence).toBe(3); // daily
    expect(row("Three.js").cadence).toBe(1); // explored
    expect(row("React").cadence).toBeLessThanOrEqual(CADENCE_MAX);
  });

  it("gives an uncatalogued skill zero cadence rather than a guess", () => {
    expect(row("Not A Real Skill").cadence).toBe(0);
    expect(row("Not A Real Skill").documented).toBe(false);
  });

  it("counts projects from both tags and stack, case-insensitively", () => {
    expect(row("React").projects.map((p) => p.id).sort()).toEqual(["a", "b"]);
    expect(row("TypeScript").projects.map((p) => p.id).sort()).toEqual(["a", "c"]);
    expect(row("Three.js").projects).toHaveLength(0);
  });

  it("counts a project once even when it names a skill twice", () => {
    const model2 = buildSkillModel(
      [{ label: "X", items: ["React"] }],
      [project("dup", ["React"], ["React"])]
    );
    expect(model2.rows[0].projects).toHaveLength(1);
  });

  it("summarises the deck without double-counting", () => {
    expect(model.stats.disciplines).toBe(2);
    expect(model.stats.skills).toBe(5);
    expect(model.stats.documented).toBe(4);
    expect(model.stats.byLevel.daily).toBe(3); // React, TypeScript, Figma
    expect(model.stats.byLevel.explored).toBe(1); // Three.js
    expect(model.stats.shippedIn).toBe(3); // a, b, c
  });

  it("scores group density as mean cadence over the maximum", () => {
    const frontend = model.groups.find((g) => g.label === "Frontend")!;
    // React 3 + TypeScript 3 + Three.js 1 = 7 of a possible 9
    expect(frontend.density).toBeCloseTo(7 / 9, 5);
  });

  it("handles an empty deck without dividing by zero", () => {
    const empty = buildSkillModel([{ label: "Empty", items: [] }], []);
    expect(empty.groups[0].density).toBe(0);
    expect(empty.stats.skills).toBe(0);
  });
});

describe("matchesQuery", () => {
  const model = buildSkillModel(groups, projects);
  const react = model.rows.find((r) => r.name === "React")!;

  it("matches everything on an empty query", () => {
    expect(matchesQuery(react, "")).toBe(true);
    expect(matchesQuery(react, "   ")).toBe(true);
  });

  it("matches on skill name, case-insensitively and partially", () => {
    expect(matchesQuery(react, "rea")).toBe(true);
    expect(matchesQuery(react, "REACT")).toBe(true);
  });

  it("matches on the discipline too", () => {
    expect(matchesQuery(react, "frontend")).toBe(true);
  });

  it("rejects a non-match", () => {
    expect(matchesQuery(react, "verilog")).toBe(false);
  });
});

describe("sortRows", () => {
  const model = buildSkillModel(groups, projects);

  it("leaves discipline order untouched", () => {
    expect(sortRows(model.rows, "discipline").map((r) => r.name)).toEqual(
      model.rows.map((r) => r.name)
    );
  });

  it("sorts by cadence, breaking ties by name", () => {
    const names = sortRows(model.rows, "cadence").map((r) => r.name);
    expect(names.slice(0, 3)).toEqual(["Figma", "React", "TypeScript"]);
    expect(names.at(-1)).toBe("Not A Real Skill");
  });

  it("sorts by project count", () => {
    const names = sortRows(model.rows, "projects").map((r) => r.name);
    expect(names.slice(0, 2).sort()).toEqual(["React", "TypeScript"]);
  });

  it("sorts alphabetically", () => {
    expect(sortRows(model.rows, "name").map((r) => r.name)).toEqual([
      "Figma",
      "Not A Real Skill",
      "React",
      "Three.js",
      "TypeScript",
    ]);
  });

  it("does not mutate the input array", () => {
    const before = model.rows.map((r) => r.name);
    sortRows(model.rows, "name");
    expect(model.rows.map((r) => r.name)).toEqual(before);
  });
});
