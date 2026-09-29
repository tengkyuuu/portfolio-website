import { describe, expect, it } from "vitest";
import type { Design } from "./content";
import {
  designIdFromHash,
  filterDesigns,
  galleryCategories,
  paginate,
  publicDesigns,
  titleFromFilename,
} from "./gallery";

const d = (p: Partial<Design>): Design => ({
  id: p.id ?? "x",
  title: "A piece",
  image: "/x.webp",
  alt: "A poster with a big orange sun",
  ...p,
});

describe("publicDesigns", () => {
  it("shows only finished, unhidden pieces", () => {
    const list = publicDesigns([
      d({ id: "ok" }),
      d({ id: "no-alt", alt: "" }),
      d({ id: "thin-alt", alt: "poster" }),
      d({ id: "untitled", title: " " }),
      d({ id: "no-image", image: "" }),
      d({ id: "parked", hidden: true }),
    ]);
    expect(list.map((x) => x.id)).toEqual(["ok"]);
  });
});

describe("categories", () => {
  it("lists categories in first-seen order, ignoring case and blanks", () => {
    expect(
      galleryCategories([
        d({ category: "Poster" }),
        d({ category: "Logo" }),
        d({ category: "poster" }),
        d({ category: " " }),
        d({}),
      ])
    ).toEqual(["Poster", "Logo"]);
  });

  it("filters case-insensitively and passes everything through with no filter", () => {
    const all = [d({ id: "a", category: "Poster" }), d({ id: "b", category: "logo" })];
    expect(filterDesigns(all, "LOGO").map((x) => x.id)).toEqual(["b"]);
    expect(filterDesigns(all, null)).toBe(all);
  });
});

describe("paginate", () => {
  it("puts fewer on the first sheet, which carries the heading", () => {
    const pages = paginate(Array.from({ length: 20 }, (_, i) => i), 6, 9);
    expect(pages.map((p) => p.length)).toEqual([6, 9, 5]);
  });

  it("always yields at least one sheet", () => {
    expect(paginate([], 6, 9)).toEqual([[]]);
  });
});

describe("helpers", () => {
  it("reads a design id from a deep link", () => {
    expect(designIdFromHash("#gallery/abc-123")).toBe("abc-123");
    expect(designIdFromHash("#gallery")).toBeNull();
  });

  it("titles an upload from its file name", () => {
    expect(titleFromFilename("summer-fest_poster  v2.PNG")).toBe("Summer fest poster v2");
    expect(titleFromFilename(".png")).toBe("Untitled");
  });
});
