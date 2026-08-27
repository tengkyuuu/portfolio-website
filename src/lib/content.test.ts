import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The content cache is where a shipped change goes to die.
 *
 * A published Supabase snapshot replaces the defaults wholesale, and the
 * browser copy of it outlives any deploy. That combination is exactly how
 * projects that were live in the bundle stayed invisible on the site, so
 * the invalidation rules get their own regression tests.
 *
 * Every case re-imports the module: content.ts keeps an in-memory copy
 * that would otherwise leak between tests and mask a stale-cache bug.
 */

const STORAGE_KEY = "jvc_content_v1";
const META_KEY = "jvc_content_meta_v1";

async function freshModule() {
  vi.resetModules();
  return import("./content");
}

/** Write a payload the way a healthy save would, then corrupt the sidecar. */
async function seedCache(
  mutate: (c: import("./content").SiteContent) => void,
  meta?: unknown
) {
  const mod = await freshModule();
  const next = structuredClone(mod.DEFAULT_CONTENT);
  mutate(next);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  if (meta !== undefined) localStorage.setItem(META_KEY, JSON.stringify(meta));
  return next;
}

beforeEach(() => {
  localStorage.clear();
});

describe("getContent", () => {
  it("returns the shipped defaults when nothing is cached", async () => {
    const { getContent, DEFAULT_CONTENT } = await freshModule();
    expect(getContent()).toEqual(DEFAULT_CONTENT);
  });

  it("serves a cached payload while its fingerprint matches", async () => {
    const mod = await freshModule();
    const next = structuredClone(mod.DEFAULT_CONTENT);
    next.hero.name = "Cached Name";
    mod.saveContent(next);

    const reread = await freshModule();
    expect(reread.getContent().hero.name).toBe("Cached Name");
  });

  it("ignores a payload written against different defaults", async () => {
    // The deploy shipped new content; this browser is holding a snapshot
    // taken before it. The deploy must win.
    await seedCache((c) => {
      c.hero.name = "Stale Name";
      c.projects = [];
    }, { fp: "not-the-current-fingerprint", src: "local" });

    const { getContent, DEFAULT_CONTENT } = await freshModule();
    expect(getContent().hero.name).toBe(DEFAULT_CONTENT.hero.name);
    expect(getContent().projects.length).toBe(DEFAULT_CONTENT.projects.length);
  });

  it("ignores a payload with no fingerprint record at all", async () => {
    // Written before the rule existed — treat as stale.
    await seedCache((c) => {
      c.projects = [];
    });

    const { getContent, DEFAULT_CONTENT } = await freshModule();
    expect(getContent().projects.length).toBe(DEFAULT_CONTENT.projects.length);
  });

  it("discards server-sourced payloads too once the defaults move on", async () => {
    // Server content is authoritative only while it's current; when the
    // API is unreachable we must fall back to what shipped.
    await seedCache((c) => {
      c.projects = [];
    }, { fp: "stale", src: "server" });

    const { getContent, DEFAULT_CONTENT } = await freshModule();
    expect(getContent().projects.length).toBe(DEFAULT_CONTENT.projects.length);
  });

  it("falls back to defaults when the cached JSON is corrupt", async () => {
    localStorage.setItem(STORAGE_KEY, "{ not json");
    const { getContent, DEFAULT_CONTENT } = await freshModule();
    expect(getContent()).toEqual(DEFAULT_CONTENT);
  });
});

describe("normalizeContent (via a partial cached payload)", () => {
  it("fills sections missing from the payload with defaults", async () => {
    const mod = await freshModule();
    // Save a complete payload first so the fingerprint is valid, then
    // strip a section the way an older schema would have.
    mod.saveContent(structuredClone(mod.DEFAULT_CONTENT));
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
    delete stored.certs;
    delete stored.timeline;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const reread = await freshModule();
    const c = reread.getContent();
    expect(c.certs).toEqual(reread.DEFAULT_CONTENT.certs);
    expect(c.timeline).toEqual(reread.DEFAULT_CONTENT.timeline);
  });
});

describe("saveSection / resetSection", () => {
  it("replaces one section and leaves the rest alone", async () => {
    const mod = await freshModule();
    const before = mod.getContent();
    mod.saveSection("skills", [{ label: "Only", items: ["One"] }]);

    const after = mod.getContent();
    expect(after.skills).toEqual([{ label: "Only", items: ["One"] }]);
    expect(after.projects).toEqual(before.projects);
  });

  it("puts a section back to the shipped default", async () => {
    const mod = await freshModule();
    mod.saveSection("skills", [{ label: "Only", items: ["One"] }]);
    mod.resetSection("skills");
    expect(mod.getContent().skills).toEqual(mod.DEFAULT_CONTENT.skills);
  });
});

describe("syncFromServer", () => {
  it("applies published content and keeps it readable afterwards", async () => {
    const mod = await freshModule();
    const remote = structuredClone(mod.DEFAULT_CONTENT);
    remote.hero.name = "From Server";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(remote), { status: 200 }))
    );

    await expect(mod.syncFromServer()).resolves.toBe(true);
    expect(mod.getContent().hero.name).toBe("From Server");

    // And it survives a reload, because the write stamped a fresh record.
    const reread = await freshModule();
    expect(reread.getContent().hero.name).toBe("From Server");
  });

  it("leaves the defaults alone when the endpoint is failing", async () => {
    const mod = await freshModule();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));

    await expect(mod.syncFromServer()).resolves.toBe(false);
    expect(mod.getContent()).toEqual(mod.DEFAULT_CONTENT);
  });

  it("reports no change when the server matches what we already have", async () => {
    const mod = await freshModule();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(mod.DEFAULT_CONTENT), { status: 200 }))
    );
    await expect(mod.syncFromServer()).resolves.toBe(false);
  });
});
