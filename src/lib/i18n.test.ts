import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LANGUAGES, t } from "./i18n";

/**
 * t() falls back to returning the key itself when it isn't in the
 * dictionary, which fails silently and beautifully: the build passes, the
 * types pass, every test passes, and the ribbon ships reading "nav.file"
 * to every visitor. That is exactly what happened — the File button and
 * the print menu item went to production as raw keys.
 *
 * So the dictionary is checked against the call sites rather than against
 * itself. Add a t("…") anywhere in src/ without adding the key, in any of
 * the four languages, and this fails.
 */

const SRC = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** Every t("literal") in src/, excluding the tests themselves. */
function usedKeys(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name) || /\.test\./.test(entry.name)) continue;
      const src = readFileSync(full, "utf8");
      for (const m of src.matchAll(/\bt\(\s*"([^"]+)"/g)) {
        const rel = path.relative(SRC, full).replace(/\\/g, "/");
        found.set(m[1], [...(found.get(m[1]) ?? []), rel]);
      }
    }
  };
  walk(SRC);
  return found;
}

describe("i18n", () => {
  const used = usedKeys();

  it("finds the call sites at all, so a silent regex change can't pass this file", () => {
    expect(used.size).toBeGreaterThan(10);
  });

  it("resolves every key used in src/ to real copy, in every language", () => {
    const broken: string[] = [];
    for (const [key, files] of used) {
      for (const lang of LANGUAGES) {
        // A key that resolves to itself was never translated.
        if (t(key, lang.id) === key) {
          broken.push(`${lang.id}: "${key}" (${[...new Set(files)].join(", ")})`);
        }
      }
    }
    expect(broken, `untranslated keys render as raw text on screen:\n${broken.join("\n")}`)
      .toEqual([]);
  });

  it("keeps the tab strip's own keys translated", () => {
    // The ribbon is the one surface where a raw key is unmissable.
    for (const lang of LANGUAGES) {
      for (const key of ["nav.file", "nav.home", "nav.projects", "nav.credentials"]) {
        expect(t(key, lang.id), `${lang.id} ${key}`).not.toBe(key);
      }
    }
  });
});
