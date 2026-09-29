import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "./content";
import { localizeContent, translateSkillGroupLabel } from "./localized-content";
import { projects, timeline, skillGroups, processStages, nowGroups } from "./data";
import { ceb } from "./translations/ceb";
import { tl } from "./translations/tl";
import { cbk } from "./translations/cbk";
import type { ContentTranslation } from "./translations/schema";

const SAMPLE: ContentTranslation = {
  hero: { eyebrow: "TRANSLATED_EYEBROW", tagline: "TRANSLATED_TAGLINE" },
  about: {
    paragraphs: "TRANSLATED_PARAGRAPHS",
    specLabels: { Role: "TRANSLATED_ROLE_LABEL" },
  },
  contact: {
    intro: "TRANSLATED_INTRO",
    channelLabels: { Email: "TRANSLATED_EMAIL_LABEL" },
  },
  skillGroupLabels: { Embedded: "TRANSLATED_EMBEDDED" },
  projects: { shm: { blurb: "TRANSLATED_BLURB" } },
  timeline: [{ title: "TRANSLATED_TIMELINE_TITLE" }],
};

describe("localizeContent", () => {
  it("substitutes translated strings and leaves everything else untouched", () => {
    const out = localizeContent(DEFAULT_CONTENT, "ceb", { ceb: SAMPLE });
    expect(out.hero.eyebrow).toBe("TRANSLATED_EYEBROW");
    expect(out.hero.tagline).toBe("TRANSLATED_TAGLINE");
    // Untranslated hero fields fall back to English.
    expect(out.hero.role).toBe(DEFAULT_CONTENT.hero.role);
    expect(out.hero.name).toBe(DEFAULT_CONTENT.hero.name);

    expect(out.about.paragraphs).toBe("TRANSLATED_PARAGRAPHS");
    expect(out.about.specs.find((s) => s.label === "TRANSLATED_ROLE_LABEL")).toBeTruthy();
    // Only the label translates — the value is untouched.
    expect(out.about.specs.find((s) => s.label === "TRANSLATED_ROLE_LABEL")?.value).toBe(
      DEFAULT_CONTENT.about.specs.find((s) => s.label === "Role")?.value
    );

    expect(out.contact.intro).toBe("TRANSLATED_INTRO");
    expect(out.contact.channels.find((c) => c.label === "TRANSLATED_EMAIL_LABEL")).toBeTruthy();
    // GitHub/LinkedIn are brand names — never translated.
    expect(out.contact.channels.some((c) => c.label === "GitHub")).toBe(true);

    const shm = out.projects.find((p) => p.id === "shm");
    expect(shm?.blurb).toBe("TRANSLATED_BLURB");
    // Untranslated project fields fall back to English.
    expect(shm?.challenge).toBe(projects.find((p) => p.id === "shm")?.challenge);
    const other = out.projects.find((p) => p.id !== "shm");
    expect(other?.blurb).toBe(projects.find((p) => p.id === other?.id)?.blurb);

    expect(out.timeline[0].title).toBe("TRANSLATED_TIMELINE_TITLE");
    expect(out.timeline[1].title).toBe(timeline[1].title);
  });

  it("never touches skills — Skills.tsx looks its icon up by the English label", () => {
    const out = localizeContent(DEFAULT_CONTENT, "ceb", { ceb: SAMPLE });
    // If this ever changes, Skills.tsx's groupIcon[group.label] lookup
    // breaks silently for every non-English language.
    expect(out.skills).toEqual(DEFAULT_CONTENT.skills);
  });

  it("returns the English content as-is for the English language", () => {
    const out = localizeContent(DEFAULT_CONTENT, "en", { ceb: SAMPLE });
    expect(out).toBe(DEFAULT_CONTENT);
  });

  it("falls back to English content entirely when a language has no dictionary", () => {
    const out = localizeContent(DEFAULT_CONTENT, "tl", {});
    expect(out).toBe(DEFAULT_CONTENT);
  });
});

describe("translateSkillGroupLabel", () => {
  it("translates when a mapping exists, falls back to the English label otherwise", () => {
    expect(translateSkillGroupLabel("Embedded", "ceb", { ceb: SAMPLE })).toBe("TRANSLATED_EMBEDDED");
    expect(translateSkillGroupLabel("Frontend", "ceb", { ceb: SAMPLE })).toBe("Frontend");
    expect(translateSkillGroupLabel("Embedded", "en", { ceb: SAMPLE })).toBe("Embedded");
  });
});

/**
 * Every committed translation file — even the empty placeholders — must
 * only reference ids/indices that actually exist in data.ts. Catches the
 * failure this whole system is meant to guard against: an admin renames
 * or removes a project, and every language's stale translation for the
 * old id silently stops applying instead of erroring.
 */
describe("translation files stay in sync with data.ts", () => {
  const projectIds = new Set(projects.map((p) => p.id));
  const stageIds = new Set(processStages.map((s) => s.n));
  const nowGroupLabels = new Set(nowGroups.map((g) => g.label));
  const skillGroupLabels = new Set(skillGroups.map((g) => g.label));

  it.each([
    ["ceb", ceb],
    ["tl", tl],
    ["cbk", cbk],
  ])("%s", (_name, dict: ContentTranslation) => {
    for (const id of Object.keys(dict.projects ?? {})) {
      expect(projectIds.has(id), `translation references unknown project id "${id}"`).toBe(true);
    }
    expect(
      (dict.timeline ?? []).length,
      "translation has more timeline entries than data.ts"
    ).toBeLessThanOrEqual(timeline.length);
    for (const n of Object.keys(dict.processStages ?? {})) {
      expect(stageIds.has(n), `translation references unknown process stage "${n}"`).toBe(true);
    }
    for (const label of Object.keys(dict.nowGroups ?? {})) {
      expect(nowGroupLabels.has(label), `translation references unknown now-group "${label}"`).toBe(true);
    }
    for (const label of Object.keys(dict.skillGroupLabels ?? {})) {
      expect(skillGroupLabels.has(label), `translation references unknown skill group "${label}"`).toBe(true);
    }
  });
});
