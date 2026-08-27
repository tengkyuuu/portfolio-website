import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  certs,
  nowGroups,
  nowUpdated,
  processStages,
  projects,
  skillGroups,
  timeline,
} from "./data";
import { getSkillMeta, skillLogoUrl } from "./skill-catalog";

/**
 * Integrity checks over the hand-edited content in data.ts.
 *
 * These exist because this file is edited three ways — by hand, by the
 * project-intake prompt, and by reconciling an admin-published snapshot
 * back into the repo — and the failure modes are all silent. A duplicated
 * index, a figure caption still numbered for its old slot, or an image
 * path with no file behind it all render without throwing.
 */

const publicPath = (src: string) => resolve(process.cwd(), "public", src.replace(/^\//, ""));
const isLocal = (src: string) => src.startsWith("/");

describe("projects", () => {
  it("has at least one entry", () => {
    expect(projects.length).toBeGreaterThan(0);
  });

  it("has unique ids", () => {
    const ids = projects.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("numbers entries sequentially from 01, matching array order", () => {
    projects.forEach((p, i) => {
      expect(p.index, `${p.id} index`).toBe(String(i + 1).padStart(2, "0"));
    });
  });

  it("keeps ref in step with index and year", () => {
    for (const p of projects) {
      if (!p.ref) continue;
      expect(p.ref, `${p.id} ref`).toBe(`REF: JVC-${p.year}-${p.index}`);
    }
  });

  it("numbers figure captions to match their project index", () => {
    for (const p of projects) {
      if (!p.figCaption) continue;
      const m = /^FIG (\d+)\.\d+:/.exec(p.figCaption);
      expect(m, `${p.id} figCaption should start with "FIG N.1:"`).not.toBeNull();
      expect(Number(m![1]), `${p.id} figCaption number`).toBe(Number(p.index));
    }
  });

  it("assigns each project the page after the cover sheet", () => {
    // Projects.tsx computes the real page as index + 2; the stored `page`
    // is only metadata, but a stale value is confusing in the admin.
    projects.forEach((p, i) => {
      if (!p.page) return;
      expect(p.page, `${p.id} page`).toBe(String(i + 2).padStart(2, "0"));
    });
  });

  it("points every local image at a file that exists", () => {
    for (const p of projects) {
      for (const img of p.gallery ?? []) {
        if (!isLocal(img.src)) continue;
        expect(existsSync(publicPath(img.src)), `missing ${img.src} (${p.id})`).toBe(true);
      }
      if (p.image && isLocal(p.image)) {
        expect(existsSync(publicPath(p.image)), `missing ${p.image} (${p.id})`).toBe(true);
      }
    }
  });

  it("gives every gallery image real alt text", () => {
    for (const p of projects) {
      for (const img of p.gallery ?? []) {
        expect(img.alt?.trim(), `${p.id} gallery alt`).toBeTruthy();
        expect((img.alt ?? "").length, `${p.id} alt too short`).toBeGreaterThan(20);
      }
    }
  });

  it("has no empty or malformed links", () => {
    for (const p of projects) {
      for (const l of p.links) {
        expect(l.label.trim(), `${p.id} link label`).toBeTruthy();
        expect(l.href.trim(), `${p.id} link href (${l.label})`).toBeTruthy();
        if (l.href !== "#") {
          expect(() => new URL(l.href), `${p.id} link ${l.href}`).not.toThrow();
        }
      }
    }
  });

  it("uses absolute https for demo and video URLs", () => {
    for (const p of projects) {
      for (const [field, url] of [
        ["demoUrl", p.demoUrl],
        ["videoUrl", p.videoUrl],
      ] as const) {
        if (!url) continue;
        expect(url.startsWith("https://"), `${p.id} ${field}: ${url}`).toBe(true);
      }
    }
  });

  it("keeps tag pills short enough not to wrap", () => {
    for (const p of projects) {
      expect(p.tags.length, `${p.id} tags`).toBeGreaterThan(0);
      for (const tag of p.tags) {
        expect(tag.length, `${p.id} tag "${tag}"`).toBeLessThanOrEqual(16);
      }
    }
  });

  it("writes a four-digit year", () => {
    for (const p of projects) {
      if (!p.year) continue;
      expect(p.year, `${p.id} year`).toMatch(/^\d{4}$/);
    }
  });
});

describe("skillGroups", () => {
  it("has unique group labels", () => {
    const labels = skillGroups.map((g) => g.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("never lists the same skill twice, even across groups", () => {
    const all = skillGroups.flatMap((g) => g.items).map((s) => s.toLowerCase());
    const dupes = all.filter((s, i) => all.indexOf(s) !== i);
    expect(dupes, `duplicated skills: ${dupes.join(", ")}`).toHaveLength(0);
  });

  it("has no blank entries", () => {
    for (const g of skillGroups) {
      expect(g.items.length, `${g.label} is empty`).toBeGreaterThan(0);
      for (const item of g.items) expect(item.trim()).toBeTruthy();
    }
  });

  it("resolves catalog logos to a devicon path or an absolute URL", () => {
    for (const g of skillGroups) {
      for (const item of g.items) {
        const logo = getSkillMeta(item)?.logo;
        if (!logo) continue;
        const url = skillLogoUrl(logo);
        expect(() => new URL(url), `${item} logo`).not.toThrow();
      }
    }
  });
});

describe("credentials", () => {
  it("points every local cert asset at a file that exists", () => {
    for (const c of certs) {
      for (const src of [c.image, c.href]) {
        if (!src || !isLocal(src)) continue;
        expect(existsSync(publicPath(src)), `missing ${src} (${c.title})`).toBe(true);
      }
    }
  });

  it("names an issuer for every entry", () => {
    for (const c of certs) {
      expect(c.title.trim()).toBeTruthy();
      expect(c.issuer.trim(), `${c.title} issuer`).toBeTruthy();
    }
  });
});

describe("timeline", () => {
  it("fills every field", () => {
    for (const t of timeline) {
      expect(t.range.trim()).toBeTruthy();
      expect(t.title.trim()).toBeTruthy();
      expect(t.org.trim(), `${t.title} org`).toBeTruthy();
      expect(t.blurb.trim(), `${t.title} blurb`).toBeTruthy();
    }
  });
});

describe("source hygiene", () => {
  it("keeps data.ts free of base64 payloads", () => {
    // Admin uploads inline images as data URLs. They belong in public/ as
    // files — 100 KB of base64 here lands in every visitor's JS bundle.
    const src = readFileSync(resolve(process.cwd(), "src/lib/data.ts"), "utf8");
    expect(src.includes("data:image/"), "inline data URL in data.ts").toBe(false);
  });
});

describe("processStages", () => {
  it("numbers stages sequentially from 01", () => {
    processStages.forEach((s, i) => {
      expect(s.n, `${s.title}`).toBe(String(i + 1).padStart(2, "0"));
    });
  });

  it("has unique titles", () => {
    const titles = processStages.map((s) => s.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("fills summary and detail for every stage", () => {
    for (const s of processStages) {
      expect(s.summary.trim(), `${s.n} summary`).toBeTruthy();
      expect(s.detail.length, `${s.n} detail is too thin`).toBeGreaterThan(80);
    }
  });

  it("points every artifact at a file that really exists", () => {
    // The Process tab links these. A stage describing a workflow the repo
    // no longer follows is worse than no stage at all.
    for (const s of processStages) {
      if (!s.artifact) continue;
      const full = resolve(process.cwd(), s.artifact.path);
      expect(existsSync(full), `missing ${s.artifact.path} (stage ${s.n})`).toBe(true);
    }
  });

  it("labels each artifact with its own path", () => {
    for (const s of processStages) {
      if (!s.artifact) continue;
      expect(s.artifact.label, `stage ${s.n} label`).toBe(s.artifact.path);
    }
  });
});

describe("nowGroups", () => {
  it("has at least one group, each with items", () => {
    expect(nowGroups.length).toBeGreaterThan(0);
    for (const g of nowGroups) {
      expect(g.label.trim()).toBeTruthy();
      expect(g.icon.trim(), `${g.label} icon`).toBeTruthy();
      expect(g.items.length, `${g.label} is empty`).toBeGreaterThan(0);
    }
  });

  it("gives every item a name and a note", () => {
    for (const g of nowGroups) {
      for (const item of g.items) {
        expect(item.name.trim()).toBeTruthy();
        expect(item.note.trim(), `${item.name} note`).toBeTruthy();
      }
    }
  });

  it("records when the page was last reviewed", () => {
    // A Now page with no date is just an About page that lies.
    expect(nowUpdated).toMatch(/^[A-Z][a-z]+ \d{4}$/);
  });
});
