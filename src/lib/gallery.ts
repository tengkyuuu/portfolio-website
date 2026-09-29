import type { Design } from "./content";

/**
 * Pure helpers for the design gallery — filtering, pagination onto
 * paper-length sheets, and deep links. Kept out of the component so the
 * rules are testable on their own.
 */

/**
 * What visitors see. A design is hidden until it's complete — a bulk
 * upload lands as a row of untitled images, and autosave would otherwise
 * publish them the moment they arrive — or while the admin parks it.
 */
export function publicDesigns(designs: Design[]): Design[] {
  return designs.filter((d) => !d.hidden && designProblem(d) === null);
}

/** Categories in first-seen order, so the admin's ordering drives the chips. */
export function galleryCategories(designs: Design[]): string[] {
  const seen: string[] = [];
  for (const d of designs) {
    const c = d.category?.trim();
    if (c && !seen.some((s) => s.toLowerCase() === c.toLowerCase())) seen.push(c);
  }
  return seen;
}

export function filterDesigns(designs: Design[], category: string | null): Design[] {
  if (!category) return designs;
  const want = category.toLowerCase();
  return designs.filter((d) => d.category?.trim().toLowerCase() === want);
}

/**
 * Split into sheets: fewer on the first, which carries the chapter
 * heading, so every sheet stays the same paper length.
 */
export function paginate<T>(items: T[], first: number, rest: number): T[][] {
  if (items.length === 0) return [[]];
  const pages: T[][] = [items.slice(0, first)];
  for (let i = first; i < items.length; i += rest) pages.push(items.slice(i, i + rest));
  return pages;
}

/** "#gallery/abc" → "abc"; anything else → null. */
export function designIdFromHash(hash: string): string | null {
  const m = /^#?gallery\/([^/?#]+)/.exec(hash);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}

/** A title from a file name: "summer-fest_poster v2.png" → "Summer fest poster v2". */
export function titleFromFilename(name: string): string {
  const base = name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return base ? base[0].toUpperCase() + base.slice(1) : "Untitled";
}

export function newDesign(image: string, title = "Untitled"): Design {
  return { id: crypto.randomUUID(), title, image, alt: "" };
}

/** Why a design isn't ready to show, or null. Alt text is not optional. */
export function designProblem(d: Design): string | null {
  if (!d.image) return "Add the image.";
  if (!d.title.trim()) return "Give it a title.";
  if (d.alt.trim().length < 10) return "Describe what's visibly in it (alt text).";
  return null;
}
