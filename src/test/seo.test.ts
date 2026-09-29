import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultContact, defaultHero } from "../lib/data";

/**
 * Metadata is the one part of this site nobody looks at. It renders
 * nowhere, so it rots silently: a name edited in data.ts and not in the
 * head, an og:image swapped for one of a different size, a JSON-LD block
 * with a trailing comma that every crawler discards without telling
 * anyone. Each of those is invisible in the browser and expensive in
 * search results, which is exactly the kind of failure worth a test.
 *
 * These assert against the source index.html. The absolute-URL stamping
 * (canonical, og:url, @id) happens at build time in scripts/apply-seo.mjs
 * and is not visible here — what is asserted is that the tags it rewrites
 * exist and are root-relative for it to find.
 */

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const html = readFileSync(path.join(ROOT, "index.html"), "utf8");

function meta(attr: "name" | "property", key: string): string | null {
  const re = new RegExp(
    `<meta\\s+${attr}="${key.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}"\\s+content="([^"]*)"`,
    "i"
  );
  const compact = html.replace(/\s*\n\s*/g, " ");
  return re.exec(compact)?.[1] ?? null;
}

/** A public/ PNG's real dimensions, read out of its IHDR header. */
function png(src: string): { width: number; height: number } {
  const file = path.join(ROOT, "public", src);
  expect(existsSync(file), `${src} is referenced but not in public/`).toBe(true);
  const bytes = readFileSync(file);
  expect(bytes.subarray(1, 4).toString(), `${src} is not a PNG`).toBe("PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** The JSON-LD graph, parsed. */
function graph(): Record<string, unknown>[] {
  const raw = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1];
  expect(raw, "index.html has no JSON-LD block").toBeTruthy();
  const parsed = JSON.parse(raw as string);
  return parsed["@graph"];
}

function node(type: string): any {
  const found = graph().find((n) => n["@type"] === type);
  expect(found, `no ${type} in the JSON-LD graph`).toBeTruthy();
  return found;
}

describe("document head", () => {
  it("leads the title with the name, inside what Google will show", () => {
    const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "";
    expect(title).toContain(defaultHero.name);
    // Google truncates around 60 characters. Past that the tail is lost,
    // and the tail is where the role sits.
    expect(title.length).toBeLessThanOrEqual(62);
  });

  it("carries a description short enough to survive a results page", () => {
    const description = meta("name", "description");
    expect(description).toBeTruthy();
    expect(description).toContain(defaultHero.name);
    expect((description as string).length).toBeLessThanOrEqual(160);
  });

  it("lets itself be indexed, with a full-size image preview", () => {
    const robots = meta("name", "robots") ?? "";
    expect(robots).toMatch(/\bindex\b/);
    expect(robots).not.toMatch(/\bnoindex\b/);
    expect(robots).toContain("max-image-preview:large");
  });
});

describe("social cards", () => {
  it("fills in both the Open Graph and the Twitter card", () => {
    for (const key of ["og:type", "og:site_name", "og:title", "og:description", "og:image"]) {
      expect(meta("property", key), `${key} missing`).toBeTruthy();
    }
    for (const key of ["twitter:card", "twitter:title", "twitter:description", "twitter:image"]) {
      expect(meta("name", key), `${key} missing`).toBeTruthy();
    }
  });

  it("declares an og:locale in the language_TERRITORY form the scrapers parse", () => {
    // A bare "en" is dropped silently by Facebook and LinkedIn — the card
    // still renders, so nothing looks wrong, and the locale is simply gone.
    expect(meta("property", "og:locale")).toMatch(/^[a-z]{2}_[A-Z]{2}$/);
  });

  it("keeps the image root-relative so the build can absolutise it", () => {
    // LinkedIn and Facebook refuse a relative image; apply-seo.mjs rewrites
    // these at build time and only matches root-relative hrefs.
    expect(meta("property", "og:image")).toMatch(/^\//);
    expect(meta("name", "twitter:image")).toMatch(/^\//);
  });

  it("states image dimensions that match the file on disk", () => {
    // A card whose declared size disagrees with the file is cropped or
    // rejected outright, and there is no way to see that from the page.
    const src = meta("property", "og:image") as string;
    const { width, height } = png(src);
    expect(meta("property", "og:image:width")).toBe(String(width));
    expect(meta("property", "og:image:height")).toBe(String(height));
  });

  it("gives every social image alt text", () => {
    expect(meta("property", "og:image:alt")).toBeTruthy();
    expect(meta("name", "twitter:image:alt")).toBeTruthy();
  });
});

describe("structured data", () => {
  it("parses, which a crawler will not tell you if it does not", () => {
    expect(graph().length).toBeGreaterThan(0);
  });

  it("names the person exactly as the page does", () => {
    expect(node("Person").name).toBe(defaultHero.name);
  });

  it("splits the name so a middle name cannot be mistaken for a surname", () => {
    const person = node("Person");
    const parts = defaultHero.name.split(" ");
    expect(person.givenName).toBe(parts[0]);
    expect(person.familyName).toBe(parts[parts.length - 1]);
    if (parts.length > 2) {
      expect(person.additionalName).toBe(parts.slice(1, -1).join(" "));
    }
  });

  it("claims the shortened forms of the name people actually search", () => {
    // "James Vincent Calunsag" is what is on the page. "James Calunsag"
    // and "Vincent Calunsag" are what land in someone's search bar, and
    // to a crawler they are unrelated strings until alternateName says
    // otherwise.
    const { alternateName } = node("Person");
    const parts = defaultHero.name.split(" ");
    const first = parts[0];
    const last = parts[parts.length - 1];
    expect(alternateName).toContain(`${first} ${last}`);
    for (const middle of parts.slice(1, -1)) {
      expect(alternateName, `"${middle} ${last}" is not claimed`).toContain(
        `${middle} ${last}`
      );
    }
  });

  it("points sameAs at the same profiles the contact page links to", () => {
    // Two lists of the same URLs drift. When they do, the page is right
    // and the entity graph quietly points at a dead account.
    const { sameAs } = node("Person");
    const linked = defaultContact.channels
      .map((c) => c.href)
      .filter((href) => /^https?:/.test(href));
    for (const href of linked) {
      expect(sameAs, `${href} is linked on the page but not in sameAs`).toContain(href);
    }
  });

  it("wires the graph together by id rather than repeating itself", () => {
    const ids = new Set(graph().map((n) => n["@id"]));
    const person = node("Person");
    const page = node("ProfilePage");
    expect(ids.has(page.about["@id"])).toBe(true);
    expect(ids.has(page.isPartOf["@id"])).toBe(true);
    expect(ids.has(person.mainEntityOfPage["@id"])).toBe(true);
    expect(ids.has(node("WebSite").publisher["@id"])).toBe(true);
  });

  it("keeps every id and url root-relative for the build to stamp", () => {
    // apply-seo.mjs only rewrites hrefs beginning with "/". An absolute
    // one hardcodes a domain; a bare fragment is not an identifier.
    for (const n of graph()) {
      expect(String(n["@id"]), "@id must be root-relative").toMatch(/^\//);
    }
  });
});

describe("icons", () => {
  /** Every <link rel="icon"> and apple-touch-icon, as [href, sizes]. */
  const links = [...html.matchAll(/<link\s+rel="(icon|apple-touch-icon)"[^>]*>/g)].map(
    ([tag]) => ({
      href: /href="([^"]*)"/.exec(tag)?.[1] ?? "",
      sizes: /sizes="([^"]*)"/.exec(tag)?.[1] ?? "",
    })
  );

  it("declares an icon at the size a browser tab actually paints", () => {
    expect(links.length).toBeGreaterThan(0);
    expect(links.map((l) => l.sizes)).toContain("16x16");
  });

  it("points every icon link at a file that is really there", () => {
    // A 404 here is invisible: the browser falls back to a blank page
    // icon, and a previously cached favicon keeps rendering for weeks.
    for (const { href } of links) png(href);
  });

  it("declares sizes that match the pixels in the file", () => {
    for (const { href, sizes } of links) {
      if (!/^\d+x\d+$/.test(sizes)) continue;
      const { width, height } = png(href);
      expect(`${width}x${height}`, `${href} is not ${sizes}`).toBe(sizes);
    }
  });

  it("offers no SVG icon, which would outrank every PNG", () => {
    // Browsers prefer an SVG icon whenever one is listed, regardless of
    // the sizes on the others — listing one silently retires the photo.
    for (const { href } of links) expect(href).not.toMatch(/\.svg$/);
  });
});

describe("web app manifest", () => {
  const manifest = JSON.parse(
    readFileSync(path.join(ROOT, "public", "manifest.webmanifest"), "utf8")
  );

  it("ships icons that exist and are the size they claim", () => {
    expect(manifest.icons.length).toBeGreaterThan(0);
    for (const icon of manifest.icons) {
      const { width, height } = png(icon.src);
      expect(`${width}x${height}`, `${icon.src} is not ${icon.sizes}`).toBe(icon.sizes);
    }
  });

  it("declares a maskable icon, so Android does not letterbox it", () => {
    const purposes = manifest.icons.flatMap((i: { purpose?: string }) =>
      (i.purpose ?? "any").split(/\s+/)
    );
    expect(purposes).toContain("maskable");
  });

  it("names the person, not just the document", () => {
    expect(manifest.name).toContain(defaultHero.name);
  });
});

describe("service worker shell", () => {
  const sw = readFileSync(path.join(ROOT, "public", "sw.js"), "utf8");

  it("precaches only files that exist", () => {
    // cache.addAll is all-or-nothing: one 404 rejects the whole install,
    // the service worker never activates, and offline support disappears
    // with nothing in the UI to say so.
    const list = /const SHELL_URLS = \[([^\]]*)\]/.exec(sw)?.[1] ?? "";
    const urls = [...list.matchAll(/"([^"]+)"/g)].map(([, u]) => u);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      if (url === "/" || url === "/index.html") continue;
      expect(
        existsSync(path.join(ROOT, "public", url)),
        `${url} is precached but not in public/`
      ).toBe(true);
    }
  });
});
