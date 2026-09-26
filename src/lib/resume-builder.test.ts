import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "./content";
import {
  buildResumeContent,
  freshResumeDraft,
  parseResumeDraft,
  resumeSelectedProjects,
} from "./resume-builder";

describe("résumé drafts", () => {
  it("starts with five projects and never mutates portfolio content", () => {
    const before = JSON.stringify(DEFAULT_CONTENT);
    const draft = freshResumeDraft();
    draft.edits.all = {
      headline: "A tailored headline",
      summary: "A personal summary.",
    };
    const result = buildResumeContent(DEFAULT_CONTENT, draft);
    expect(result.projects).toHaveLength(5);
    expect(result.hero.role).toBe("A tailored headline");
    expect(result.about.paragraphs).toBe("A personal summary.");
    expect(JSON.stringify(DEFAULT_CONTENT)).toBe(before);
  });
  it("keeps explicit project order, allows no projects, and ignores deleted IDs", () => {
    const draft = freshResumeDraft();
    const [first, second] = DEFAULT_CONTENT.projects;
    draft.edits.all = { projectIds: [second.id, "deleted", first.id] };
    expect(
      buildResumeContent(DEFAULT_CONTENT, draft).projects.map(
        (project) => project.id,
      ),
    ).toEqual([second.id, first.id]);
    draft.edits.all.projectIds = [];
    expect(resumeSelectedProjects(DEFAULT_CONTENT, draft)).toEqual([]);
    expect(buildResumeContent(DEFAULT_CONTENT, draft).projects).toEqual([]);
  });
  it("preserves separate edits for each role and respects section visibility", () => {
    const draft = freshResumeDraft();
    draft.edits = {
      all: { summary: "General summary" },
      frontend: { summary: "Frontend summary" },
    };
    draft.role = "frontend";
    expect(buildResumeContent(DEFAULT_CONTENT, draft).about.paragraphs).toBe(
      "Frontend summary",
    );
    draft.role = "all";
    expect(buildResumeContent(DEFAULT_CONTENT, draft).about.paragraphs).toBe(
      "General summary",
    );
    draft.sections.summary = false;
    draft.sections.skills = false;
    draft.sections.certs = false;
    const result = buildResumeContent(DEFAULT_CONTENT, draft);
    expect(result.about.paragraphs).toBe("");
    expect(result.skills).toEqual([]);
    expect(result.certs).toEqual([]);
    expect(result.timeline).toEqual(DEFAULT_CONTENT.timeline);
  });
  it("restores valid drafts and safely recovers from malformed storage", () => {
    const draft = freshResumeDraft();
    draft.role = "support";
    draft.edits.support = { headline: "", projectIds: [] };
    expect(parseResumeDraft(JSON.stringify(draft))).toEqual(draft);
    expect(parseResumeDraft("invalid json")).toEqual(freshResumeDraft());
    expect(parseResumeDraft(JSON.stringify({ version: 99 }))).toEqual(
      freshResumeDraft(),
    );
    expect(
      parseResumeDraft(
        JSON.stringify({
          version: 1,
          role: "invalid",
          sections: { skills: "false" },
          edits: { all: { projectIds: [null] } },
        }),
      ).sections.skills,
    ).toBe(true);
  });
});
