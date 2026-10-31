import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "./content";
import { migratePortfolioContent } from "./content-migration";
import legacy from "./legacy-branding.json";
import { locateQuote, selectionMarks } from "./highlights";
import { pagePlacement } from "./pagination";
import { publicResumeContent } from "./public-resume";

describe("content upgrade", () => {
  it("upgrades obsolete copy while preserving unrelated admin edits", () => {
    const before = structuredClone(DEFAULT_CONTENT);
    before.hero.role = legacy.hero.role;
    before.hero.email = "custom@example.com";
    before.about.paragraphs = legacy.about.paragraphs;
    before.about.highlights = ["My custom highlight"];
    before.projects.find((p) => p.id === "stormfresh-erp")!.contribution = "One of five engineers. Custom contribution.";
    before.projects.find((p) => p.id === "flux")!.metrics = [{ label: "Old count", pre: "0", post: "10", delta: "10" }];
    const next = migratePortfolioContent(before);
    expect(next.hero.role).toBe("AI-Driven Computer Engineer · Full-Stack Development & Design");
    expect(next.hero.email).toBe("custom@example.com");
    expect(next.about.highlights).toEqual(["My custom highlight"]);
    expect(next.projects.find((p) => p.id === "stormfresh-erp")!.contribution).toBe("One of four engineers. Custom contribution.");
    expect(next.projects.find((p) => p.id === "flux")!.metrics).toBeUndefined();
    expect(migratePortfolioContent(next)).toEqual(next);
    expect(before.hero.role).toBe(legacy.hero.role);
  });
  it("has an explicit public software preset independent of private résumé drafts", () => {
    expect(publicResumeContent.hero.role).toBe("AI-Driven Computer Engineer · Full-Stack Development & Design");
    expect(publicResumeContent.projects.map((p) => p.id)).toEqual(["stormfresh-erp", "flux", "rallys-transfers"]);
    expect(publicResumeContent.projects[0].blurb).toContain("four engineers");
  });
});

describe("page boundaries", () => {
  it("keeps a fitting block where it is and moves a crossing block to the next content inset", () => {
    expect(pagePlacement(100, 200, 1123, 28, 37, 64)).toBe(0);
    expect(pagePlacement(1000, 100, 1123, 28, 37, 64)).toBe(188);
    expect(pagePlacement(1151, 100, 1123, 28, 37, 64)).toBe(37);
  });
  it("leaves oversized blocks for semantic fragmentation instead of endlessly shifting them", () => {
    expect(pagePlacement(100, 2000, 1123, 28, 37, 64)).toBe(0);
  });
});

describe("visitor text marks", () => {
  it("reanchors a quote after nearby text is inserted", () => {
    const mark = { quote: "software", prefix: "Build ", suffix: " carefully", start: 6 };
    expect(locateQuote("Note: Build software carefully", mark)).toBe(12);
    expect(locateQuote("Build hardware carefully", mark)).toBeNull();
  });
  it("refuses ambiguous repeated text", () => {
    expect(locateQuote("same same", { quote: "same", prefix: "", suffix: "", start: 0 })).toBeNull();
  });
  it("splits a selection across paragraphs while excluding controls", () => {
    const root = document.createElement("div");
    root.innerHTML = '<p id="a">First passage</p><button>Ignore me</button><p id="b">Second passage</p>';
    document.body.append(root);
    const paragraphs = root.querySelectorAll("p");
    const range = document.createRange();
    range.setStart(paragraphs[0].firstChild!, 6);
    range.setEnd(paragraphs[1].firstChild!, 6);
    const marks = selectionMarks(root, range, "work:en");
    expect(marks.map((mark) => mark.quote)).toEqual(["passage", "Second"]);
    expect(marks.every((mark) => mark.scope === "work:en")).toBe(true);
    root.remove();
  });
});
