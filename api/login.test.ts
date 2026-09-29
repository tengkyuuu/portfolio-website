import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  createFakeSupabase,
  fakeReq,
  fakeRes,
  type FakeDb,
} from "../src/test/fake-supabase";

/**
 * Team accounts are the kind of feature that fails open silently: a
 * removed admin whose token keeps working looks exactly like a working
 * feature until it matters. So these drive the real handler end to end
 * and assert the revocations, not just the happy path.
 */

const db: FakeDb = {};
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => createFakeSupabase(db),
}));

const { default: handler, hashPassword, verifyPassword, validateNewAdmin } =
  await import("./login");

const OWNER_PASSWORD = "correct horse battery";
const SECRET = "test-secret";

let ipSeq = 0;
async function call(init: Parameters<typeof fakeReq>[0]) {
  const res = fakeRes();
  await handler(
    fakeReq({ ip: `198.51.100.${++ipSeq % 250}`, ...init }) as unknown as VercelRequest,
    res as unknown as VercelResponse
  );
  return res as typeof res & { body: Record<string, unknown> };
}

async function ownerToken(): Promise<string> {
  const res = await call({ method: "POST", body: { password: OWNER_PASSWORD } });
  expect(res.statusCode).toBe(200);
  return res.body.token as string;
}

async function addAdmin(owner: string, username = "maria", password = "a-long-password-1") {
  const res = await call({
    method: "POST",
    query: { op: "team" },
    token: owner,
    body: { username, name: "Maria Santos", password },
  });
  expect(res.statusCode).toBe(201);
  return res.body as { id: string };
}

async function adminToken(username = "maria", password = "a-long-password-1") {
  const res = await call({ method: "POST", body: { username, password } });
  expect(res.statusCode).toBe(200);
  return res.body.token as string;
}

function signWith(secret: string, payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  vi.stubEnv("ADMIN_PASSWORD_HASH", crypto.createHash("sha256").update(OWNER_PASSWORD).digest("hex"));
  vi.stubEnv("ADMIN_TOKEN_SECRET", SECRET);
  vi.stubEnv("SUPABASE_URL", "http://supabase.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-29T08:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("password hashing", () => {
  it("round-trips and rejects the wrong password", async () => {
    const stored = await hashPassword("a-long-password-1");
    expect(stored).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(await verifyPassword("a-long-password-1", stored)).toBe(true);
    expect(await verifyPassword("a-long-password-2", stored)).toBe(false);
  });

  it("rejects a malformed hash instead of throwing", async () => {
    expect(await verifyPassword("x", "sha256$abc")).toBe(false);
    expect(await verifyPassword("x", "scrypt$1$1$1$$")).toBe(false);
  });
});

describe("validateNewAdmin", () => {
  it("reserves the owner's name", () => {
    const r = validateNewAdmin({ username: "Owner", name: "X", password: "a-long-password" });
    expect(r.ok).toBe(false);
  });

  it("rejects short passwords and malformed usernames", () => {
    expect(validateNewAdmin({ username: "ok_name", name: "X", password: "short" }).ok).toBe(false);
    expect(validateNewAdmin({ username: "no spaces", name: "X", password: "a-long-password" }).ok).toBe(false);
    expect(validateNewAdmin({ username: "ab", name: "X", password: "a-long-password" }).ok).toBe(false);
  });

  it("normalises the username", () => {
    const r = validateNewAdmin({ username: "  Maria.S ", name: " Maria ", password: "a-long-password" });
    expect(r).toEqual({ ok: true, value: { username: "maria.s", name: "Maria", password: "a-long-password" } });
  });
});

describe("owner sign-in", () => {
  it("signs in without a username and reports the owner role", async () => {
    const res = await call({ method: "POST", body: { password: OWNER_PASSWORD } });
    expect(res.statusCode).toBe(200);
    expect(res.body.user).toMatchObject({ role: "owner", username: "owner" });
  });

  it("also accepts the reserved username", async () => {
    const res = await call({ method: "POST", body: { username: "OWNER", password: OWNER_PASSWORD } });
    expect(res.statusCode).toBe(200);
  });

  it("rejects the wrong password and rate-limits by client", async () => {
    const ip = "192.0.2.77";
    for (let i = 0; i < 5; i++) {
      const res = await call({ method: "POST", ip, body: { password: "nope" } });
      expect(res.statusCode).toBe(401);
    }
    const locked = await call({ method: "POST", ip, body: { password: OWNER_PASSWORD } });
    expect(locked.statusCode).toBe(429);
  });

  it("treats a pre-team token with no subject as the owner", async () => {
    const legacy = signWith(SECRET, { exp: Math.floor(Date.now() / 1000) + 60 });
    const res = await call({ method: "GET", query: { op: "me" }, token: legacy });
    expect(res.statusCode).toBe(200);
    expect(res.body.user).toMatchObject({ role: "owner" });
  });

  it("refuses a token signed with any other secret", async () => {
    const forged = signWith("not-the-secret", { sub: "owner", exp: Math.floor(Date.now() / 1000) + 60 });
    const res = await call({ method: "GET", query: { op: "me" }, token: forged });
    expect(res.statusCode).toBe(401);
  });
});

describe("team", () => {
  it("lets the owner add an admin who can then sign in", async () => {
    const owner = await ownerToken();
    await addAdmin(owner);
    const signIn = await call({ method: "POST", body: { username: "maria", password: "a-long-password-1" } });
    expect(signIn.statusCode).toBe(200);
    expect(signIn.body.user).toMatchObject({ role: "admin", username: "maria", name: "Maria Santos" });

    const list = await call({ method: "GET", query: { op: "team" }, token: owner });
    expect(list.body.items).toHaveLength(1);
    // The hash never leaves the server.
    expect(JSON.stringify(list.body)).not.toContain("scrypt$");
  });

  it("gives the same answer for an unknown user and a wrong password", async () => {
    const owner = await ownerToken();
    await addAdmin(owner);
    const unknown = await call({ method: "POST", body: { username: "nobody", password: "a-long-password-1" } });
    const wrong = await call({ method: "POST", body: { username: "maria", password: "a-long-password-X" } });
    expect(unknown.statusCode).toBe(401);
    expect(wrong.statusCode).toBe(401);
    expect(unknown.body.error).toBe(wrong.body.error);
  });

  it("refuses a duplicate username", async () => {
    const owner = await ownerToken();
    await addAdmin(owner);
    const again = await call({
      method: "POST",
      query: { op: "team" },
      token: owner,
      body: { username: "maria", name: "Other", password: "a-long-password-1" },
    });
    expect(again.statusCode).toBe(409);
  });

  it("keeps team management owner-only", async () => {
    const owner = await ownerToken();
    await addAdmin(owner);
    const admin = await adminToken();
    const list = await call({ method: "GET", query: { op: "team" }, token: admin });
    expect(list.statusCode).toBe(403);
    const add = await call({
      method: "POST",
      query: { op: "team" },
      token: admin,
      body: { username: "sneaky", name: "S", password: "a-long-password-1" },
    });
    expect(add.statusCode).toBe(403);
  });

  it("revokes a disabled admin's live token at once", async () => {
    const owner = await ownerToken();
    const { id } = await addAdmin(owner);
    const admin = await adminToken();
    expect((await call({ method: "GET", query: { op: "me" }, token: admin })).statusCode).toBe(200);

    await call({ method: "PATCH", query: { op: "team" }, token: owner, body: { id, disabled: true } });
    expect((await call({ method: "GET", query: { op: "me" }, token: admin })).statusCode).toBe(401);

    const signIn = await call({ method: "POST", body: { username: "maria", password: "a-long-password-1" } });
    expect(signIn.statusCode).toBe(403);
  });

  it("revokes a removed admin's live token at once", async () => {
    const owner = await ownerToken();
    const { id } = await addAdmin(owner);
    const admin = await adminToken();
    const del = await call({ method: "DELETE", query: { op: "team", id }, token: owner });
    expect(del.statusCode).toBe(200);
    expect((await call({ method: "GET", query: { op: "me" }, token: admin })).statusCode).toBe(401);
  });

  it("signs an admin out of older sessions when the owner resets their password", async () => {
    const owner = await ownerToken();
    const { id } = await addAdmin(owner);
    const stale = await adminToken();

    vi.setSystemTime(new Date("2026-09-29T08:05:00Z"));
    await call({
      method: "PATCH",
      query: { op: "team" },
      token: owner,
      body: { id, password: "a-brand-new-password" },
    });
    expect((await call({ method: "GET", query: { op: "me" }, token: stale })).statusCode).toBe(401);
    const fresh = await adminToken("maria", "a-brand-new-password");
    expect((await call({ method: "GET", query: { op: "me" }, token: fresh })).statusCode).toBe(200);
  });
});

describe("changing your own password", () => {
  it("needs the current password, then hands back a working token", async () => {
    const owner = await ownerToken();
    await addAdmin(owner);
    const before = await adminToken();

    const wrong = await call({
      method: "POST",
      query: { op: "password" },
      token: before,
      body: { current: "not-it-at-all", next: "another-long-password" },
    });
    expect(wrong.statusCode).toBe(401);

    vi.setSystemTime(new Date("2026-09-29T08:10:00Z"));
    const ok = await call({
      method: "POST",
      query: { op: "password" },
      token: before,
      body: { current: "a-long-password-1", next: "another-long-password" },
    });
    expect(ok.statusCode).toBe(200);
    const after = ok.body.token as string;

    expect((await call({ method: "GET", query: { op: "me" }, token: after })).statusCode).toBe(200);
    expect((await call({ method: "GET", query: { op: "me" }, token: before })).statusCode).toBe(401);
  });

  it("is not how the owner password changes", async () => {
    const owner = await ownerToken();
    const res = await call({
      method: "POST",
      query: { op: "password" },
      token: owner,
      body: { current: OWNER_PASSWORD, next: "another-long-password" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("activity", () => {
  it("records who changed the team", async () => {
    const owner = await ownerToken();
    await addAdmin(owner);
    expect(db.activity_log).toContainEqual(
      expect.objectContaining({ action: "team.add", detail: { username: "maria", by: "Owner" } })
    );
  });
});
