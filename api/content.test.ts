import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  createFakeSupabase,
  fakeReq,
  fakeRes,
  type FakeDb,
} from "../src/test/fake-supabase";

const db: FakeDb = {};
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => createFakeSupabase(db),
}));

const { default: handler } = await import("./content");

const SECRET = "test-secret";
const MARIA = "00000000-0000-4000-8000-00000000aaaa";
const JOSE = "00000000-0000-4000-8000-00000000bbbb";

function token(sub: string, name: string): string {
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ sub, name, iat: now, exp: now + 3600 })).toString("base64url");
  return `${body}.${crypto.createHmac("sha256", SECRET).update(body).digest("base64url")}`;
}

function content(tagline: string) {
  return { hero: { tagline }, about: {}, skills: [], projects: [] };
}

async function call(init: Parameters<typeof fakeReq>[0]) {
  const res = fakeRes();
  await handler(fakeReq(init) as unknown as VercelRequest, res as unknown as VercelResponse);
  return res;
}

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  db.admin_users = [
    { id: MARIA, username: "maria", display_name: "Maria", disabled: false, password_changed_at: null },
    { id: JOSE, username: "jose", display_name: "Jose", disabled: false, password_changed_at: null },
  ];
  db.site_content = [{ id: "default", content: content("first") }];
  vi.stubEnv("ADMIN_TOKEN_SECRET", SECRET);
  vi.stubEnv("SUPABASE_URL", "http://supabase.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
});

afterEach(() => vi.unstubAllEnvs());

describe("PUT /api/content", () => {
  it("refuses a disabled admin even with a validly signed token", async () => {
    const t = token(MARIA, "Maria");
    db.admin_users[0].disabled = true;
    const res = await call({ method: "PUT", token: t, body: content("hijacked") });
    expect(res.statusCode).toBe(401);
    expect((db.site_content[0].content as { hero: { tagline: string } }).hero.tagline).toBe("first");
  });

  it("credits each editor's publish to that editor", async () => {
    await call({ method: "PUT", token: token(MARIA, "Maria"), body: content("maria 1") });
    await call({ method: "PUT", token: token(MARIA, "Maria"), body: content("maria 2") });
    await call({ method: "PUT", token: token(JOSE, "Jose"), body: content("jose 1") });

    const publishes = db.activity_log.filter((r) => r.action === "content.publish");
    // Maria's two saves are one editing session; Jose's lands inside it
    // but is his own line rather than being folded into hers.
    expect(publishes.map((r) => (r.detail as { by: string }).by)).toEqual(["Maria", "Jose"]);
  });

  it("uses the admin's current display name, not the one in the token", async () => {
    const t = token(MARIA, "Maria");
    db.admin_users[0].display_name = "Maria S.";
    await call({ method: "PUT", token: t, body: content("renamed") });
    const row = db.activity_log.find((r) => r.action === "content.publish");
    expect((row?.detail as { by: string }).by).toBe("Maria S.");
  });
});

describe("POST /api/content?op=upload", () => {
  it("needs a session", async () => {
    db.__buckets = ["media"] as unknown as FakeDb[string];
    const res = await call({ method: "POST", query: { op: "upload" }, body: { contentType: "image/webp" } });
    expect(res.statusCode).toBe(401);
  });

  it("issues a server-chosen path inside the folder it was asked for", async () => {
    db.__buckets = ["media"] as unknown as FakeDb[string];
    const res = await call({
      method: "POST",
      query: { op: "upload" },
      token: token(MARIA, "Maria"),
      body: { contentType: "image/webp", folder: "designs", path: "../../site_content" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.body as { path: string; publicUrl: string; signedUrl: string };
    expect(body.path).toMatch(/^designs\/\d{4}\/[0-9a-f-]{36}\.webp$/);
    expect(body.publicUrl).toContain(`/media/${body.path}`);
  });

  it("files an unknown folder under misc", async () => {
    db.__buckets = ["media"] as unknown as FakeDb[string];
    const res = await call({
      method: "POST",
      query: { op: "upload" },
      token: token(MARIA, "Maria"),
      body: { contentType: "image/png", folder: "../secrets" },
    });
    expect((res.body as { path: string }).path).toMatch(/^misc\//);
  });

  it("refuses anything that isn't a raster image", async () => {
    db.__buckets = ["media"] as unknown as FakeDb[string];
    for (const contentType of ["image/svg+xml", "text/html", undefined]) {
      const res = await call({
        method: "POST",
        query: { op: "upload" },
        token: token(MARIA, "Maria"),
        body: { contentType },
      });
      expect(res.statusCode).toBe(400);
    }
  });

  it("answers 503 when the bucket hasn't been created, so the client can inline instead", async () => {
    const res = await call({
      method: "POST",
      query: { op: "upload" },
      token: token(MARIA, "Maria"),
      body: { contentType: "image/jpeg" },
    });
    expect(res.statusCode).toBe(503);
    expect((res.body as { error: string }).error).toContain("007_media_bucket.sql");
  });
});

describe("PUT /api/content?sections=", () => {
  it("merges only the named sections, so concurrent admins don't erase each other", async () => {
    db.site_content = [
      {
        id: "default",
        content: { hero: { tagline: "server" }, about: {}, skills: [], projects: [{ id: "jose-added" }], posts: [] },
      },
    ];
    // Maria's copy was loaded before Jose added a project; she edits posts.
    const stale = {
      hero: { tagline: "server" },
      about: {},
      skills: [],
      projects: [],
      posts: [{ id: "new-post" }],
    };
    const res = await call({ method: "PUT", query: { sections: "posts" }, token: token(MARIA, "Maria"), body: stale });
    expect(res.statusCode).toBe(200);
    const saved = db.site_content[0].content as { projects: { id: string }[]; posts: { id: string }[] };
    expect(saved.projects).toEqual([{ id: "jose-added" }]);
    expect(saved.posts).toEqual([{ id: "new-post" }]);
  });

  it("ignores section names it doesn't know", async () => {
    const res = await call({
      method: "PUT",
      query: { sections: "posts,__proto__,evil" },
      token: token(MARIA, "Maria"),
      body: { ...content("x"), posts: [{ id: "p" }], evil: true },
    });
    expect(res.statusCode).toBe(200);
    const saved = db.site_content[0].content as Record<string, unknown>;
    expect(saved.evil).toBeUndefined();
    expect(saved.posts).toEqual([{ id: "p" }]);
  });

  it("writes the whole body when nothing is published yet", async () => {
    db.site_content = [];
    const res = await call({ method: "PUT", query: { sections: "posts" }, token: token(MARIA, "Maria"), body: content("first ever") });
    expect(res.statusCode).toBe(200);
    expect((db.site_content[0].content as { hero: { tagline: string } }).hero.tagline).toBe("first ever");
  });
});
