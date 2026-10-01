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

const { default: handler, hashPassword, verifyPassword, validateNewAdminInvite } =
  await import("./login");

const OWNER_PASSWORD = "correct horse battery";
const SECRET = "test-secret";
const SITE_URL = "https://portfolio.example";

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

/** Owner sends the invite. Doesn't sign anyone in — no password exists yet. */
async function invite(owner: string, username = "maria", email = "maria@example.com") {
  const res = await call({
    method: "POST",
    query: { op: "team" },
    token: owner,
    body: { username, name: "Maria Santos", email },
  });
  expect(res.statusCode).toBe(201);
  return res.body as { id: string; inviteLink: string; emailSent: boolean };
}

function tokenFromLink(link: string): string {
  const found = new URL(link).searchParams.get("invite");
  if (!found) throw new Error(`no ?invite= on ${link}`);
  return found;
}

async function checkInvite(token: string) {
  return call({ method: "GET", query: { op: "invite", token } });
}

async function acceptInvite(token: string, password: string) {
  return call({ method: "POST", query: { op: "invite" }, body: { token, password } });
}

/** The common case: invite an admin and immediately redeem it, so a test
 *  that just needs a working session doesn't have to think about email. */
async function addAdminAndSignIn(owner: string, username = "maria", password = "a-long-password-1") {
  const created = await invite(owner, username);
  const accepted = await acceptInvite(tokenFromLink(created.inviteLink), password);
  expect(accepted.statusCode).toBe(200);
  return { id: created.id, token: accepted.body.token as string };
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
  vi.stubEnv("SITE_URL", SITE_URL);
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

describe("validateNewAdminInvite", () => {
  it("reserves the owner's name", () => {
    const r = validateNewAdminInvite({ username: "Owner", name: "X", email: "x@example.com" });
    expect(r.ok).toBe(false);
  });

  it("rejects a malformed username, an empty name, and a bad email", () => {
    expect(validateNewAdminInvite({ username: "no spaces", name: "X", email: "x@example.com" }).ok).toBe(false);
    expect(validateNewAdminInvite({ username: "ab", name: "X", email: "x@example.com" }).ok).toBe(false);
    expect(validateNewAdminInvite({ username: "ok_name", name: "", email: "x@example.com" }).ok).toBe(false);
    expect(validateNewAdminInvite({ username: "ok_name", name: "X", email: "not-an-email" }).ok).toBe(false);
    expect(validateNewAdminInvite({ username: "ok_name", name: "X", email: "" }).ok).toBe(false);
  });

  it("normalises the username and email", () => {
    const r = validateNewAdminInvite({ username: "  Maria.S ", name: " Maria ", email: " Maria@Example.COM " });
    expect(r).toEqual({ ok: true, value: { username: "maria.s", name: "Maria", email: "maria@example.com" } });
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

describe("inviting a team admin", () => {
  it("creates an invite that isn't a working sign-in until it's redeemed", async () => {
    const owner = await ownerToken();
    const created = await invite(owner);
    expect(created.inviteLink).toContain(`${SITE_URL}/admin?invite=`);
    expect(created.emailSent).toBe(false); // no RESEND_* configured in the test env

    const tooEarly = await call({ method: "POST", body: { username: "maria", password: "anything-long-enough" } });
    expect(tooEarly.statusCode).toBe(401);
  });

  it("refuses without SITE_URL — there'd be no working link to send", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("ADMIN_PASSWORD_HASH", crypto.createHash("sha256").update(OWNER_PASSWORD).digest("hex"));
    vi.stubEnv("ADMIN_TOKEN_SECRET", SECRET);
    vi.stubEnv("SUPABASE_URL", "http://supabase.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    const owner = await ownerToken();
    const res = await call({
      method: "POST",
      query: { op: "team" },
      token: owner,
      body: { username: "maria", name: "Maria Santos", email: "maria@example.com" },
    });
    expect(res.statusCode).toBe(503);
  });

  it("refuses a duplicate username", async () => {
    const owner = await ownerToken();
    await invite(owner);
    const again = await call({
      method: "POST",
      query: { op: "team" },
      token: owner,
      body: { username: "maria", name: "Other", email: "other@example.com" },
    });
    expect(again.statusCode).toBe(409);
  });

  it("keeps team management owner-only", async () => {
    const owner = await ownerToken();
    const { token: admin } = await addAdminAndSignIn(owner);
    const list = await call({ method: "GET", query: { op: "team" }, token: admin });
    expect(list.statusCode).toBe(403);
    const add = await call({
      method: "POST",
      query: { op: "team" },
      token: admin,
      body: { username: "sneaky", name: "S", email: "sneaky@example.com" },
    });
    expect(add.statusCode).toBe(403);
  });

  it("never puts a password hash in the team list", async () => {
    const owner = await ownerToken();
    await addAdminAndSignIn(owner);
    const list = await call({ method: "GET", query: { op: "team" }, token: owner });
    expect(JSON.stringify(list.body)).not.toContain("scrypt$");
  });
});

describe("accepting an invite", () => {
  it("greets the invitee by name before they type a password", async () => {
    const owner = await ownerToken();
    const created = await invite(owner);
    const res = await checkInvite(tokenFromLink(created.inviteLink));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ name: "Maria Santos", username: "maria" });
  });

  it("rejects a garbage or unknown token the same way it rejects an expired one", async () => {
    expect((await checkInvite("not-a-real-token")).statusCode).toBe(400);
    expect((await checkInvite("A".repeat(40))).statusCode).toBe(410);
  });

  it("expires after 7 days", async () => {
    const owner = await ownerToken();
    const created = await invite(owner);
    const token = tokenFromLink(created.inviteLink);
    vi.setSystemTime(new Date("2026-10-06T08:00:00.001Z")); // 7 days + 1ms
    expect((await checkInvite(token)).statusCode).toBe(410);
    expect((await acceptInvite(token, "a-long-enough-password")).statusCode).toBe(410);
  });

  it("enforces the same password rules as everywhere else", async () => {
    const owner = await ownerToken();
    const created = await invite(owner);
    const res = await acceptInvite(tokenFromLink(created.inviteLink), "short");
    expect(res.statusCode).toBe(400);
  });

  it("redeems exactly once — the same link can't be used twice", async () => {
    const owner = await ownerToken();
    const created = await invite(owner);
    const token = tokenFromLink(created.inviteLink);
    const first = await acceptInvite(token, "a-long-password-1");
    expect(first.statusCode).toBe(200);
    expect(first.body.user).toMatchObject({ role: "admin", username: "maria" });

    const second = await acceptInvite(token, "a-different-password");
    expect(second.statusCode).toBe(410);
  });

  it("signs the new admin in with a token that works right away", async () => {
    const owner = await ownerToken();
    const { token } = await addAdminAndSignIn(owner);
    const me = await call({ method: "GET", query: { op: "me" }, token });
    expect(me.statusCode).toBe(200);
    expect(me.body.user).toMatchObject({ role: "admin", username: "maria" });
  });

  it("rate-limits repeated bad tokens from the same client", async () => {
    // checkInvite()/call() give every request its own synthetic IP unless
    // told otherwise, so this drives the handler directly with one fixed ip
    // — otherwise five "different" clients would never trip the same key.
    const ip = "203.0.113.9";
    for (let i = 0; i < 5; i++) {
      const res = await call({ method: "GET", query: { op: "invite", token: "B".repeat(40) }, ip });
      expect(res.statusCode).toBe(410);
    }
    const locked = await call({ method: "GET", query: { op: "invite", token: "B".repeat(40) }, ip });
    expect(locked.statusCode).toBe(429);
  });
});

describe("resending an invite", () => {
  it("invalidates the old link and issues a new one", async () => {
    const owner = await ownerToken();
    const created = await invite(owner);
    const oldToken = tokenFromLink(created.inviteLink);

    const resend = await call({
      method: "PATCH",
      query: { op: "team" },
      token: owner,
      body: { id: created.id, resendInvite: true },
    });
    expect(resend.statusCode).toBe(200);
    const newToken = tokenFromLink(resend.body.inviteLink as string);
    expect(newToken).not.toBe(oldToken);

    expect((await checkInvite(oldToken)).statusCode).toBe(410);
    expect((await checkInvite(newToken)).statusCode).toBe(200);
  });

  it("is owner-only, like every other team change", async () => {
    const owner = await ownerToken();
    const { token: admin } = await addAdminAndSignIn(owner, "jose", "another-long-password");
    const res = await call({
      method: "PATCH",
      query: { op: "team" },
      token: admin,
      body: { id: "anything", resendInvite: true },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("team lifecycle", () => {
  it("revokes a disabled admin's live token at once", async () => {
    const owner = await ownerToken();
    const { id, token: admin } = await addAdminAndSignIn(owner);
    expect((await call({ method: "GET", query: { op: "me" }, token: admin })).statusCode).toBe(200);

    await call({ method: "PATCH", query: { op: "team" }, token: owner, body: { id, disabled: true } });
    expect((await call({ method: "GET", query: { op: "me" }, token: admin })).statusCode).toBe(401);

    const signIn = await call({ method: "POST", body: { username: "maria", password: "a-long-password-1" } });
    expect(signIn.statusCode).toBe(403);
  });

  it("revokes a removed admin's live token at once", async () => {
    const owner = await ownerToken();
    const { id, token: admin } = await addAdminAndSignIn(owner);
    const del = await call({ method: "DELETE", query: { op: "team", id }, token: owner });
    expect(del.statusCode).toBe(200);
    expect((await call({ method: "GET", query: { op: "me" }, token: admin })).statusCode).toBe(401);
  });

  it("signs an admin out of older sessions when the owner resets their password", async () => {
    const owner = await ownerToken();
    const { id } = await addAdminAndSignIn(owner);
    const stale = (await call({ method: "POST", body: { username: "maria", password: "a-long-password-1" } })).body
      .token as string;

    vi.setSystemTime(new Date("2026-09-29T08:05:00Z"));
    await call({
      method: "PATCH",
      query: { op: "team" },
      token: owner,
      body: { id, password: "a-brand-new-password" },
    });
    expect((await call({ method: "GET", query: { op: "me" }, token: stale })).statusCode).toBe(401);
    const fresh = await call({ method: "POST", body: { username: "maria", password: "a-brand-new-password" } });
    expect((await call({ method: "GET", query: { op: "me" }, token: fresh.body.token as string })).statusCode).toBe(
      200
    );
  });
});

describe("changing your own password", () => {
  it("needs the current password, then hands back a working token", async () => {
    const owner = await ownerToken();
    const { token: before } = await addAdminAndSignIn(owner);

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
  it("records who invited whom", async () => {
    const owner = await ownerToken();
    await invite(owner);
    expect(db.activity_log).toContainEqual(
      expect.objectContaining({
        action: "team.invite",
        detail: { username: "maria", email: "maria@example.com", by: "Owner" },
      })
    );
  });

  it("records who accepted an invite, without naming the owner", async () => {
    const owner = await ownerToken();
    await addAdminAndSignIn(owner);
    expect(db.activity_log).toContainEqual(
      expect.objectContaining({ action: "team.invite_accepted", detail: { username: "maria" } })
    );
  });
});


describe("invite security", () => {
  it("allows exactly one simultaneous redemption", async () => {
    const owner = await ownerToken();
    const invitation = await invite(owner);
    const token = tokenFromLink(invitation.inviteLink);
    const responses = await Promise.all([
      acceptInvite(token, "first-password-long"),
      acceptInvite(token, "second-password-long"),
    ]);
    expect(responses.map(r => r.statusCode).sort(), JSON.stringify(responses.map(r => r.body))).toEqual([200, 410]);
    expect(responses.filter(r => r.body.token)).toHaveLength(1);
  });
  it("refuses an invite for a disabled admin", async () => {
    const invitation = await invite(await ownerToken());
    db.admin_users[0].disabled = true;
    const res = await acceptInvite(tokenFromLink(invitation.inviteLink), "long-password-here");
    expect(res.statusCode).toBe(410);
    expect(res.body.token).toBeUndefined();
  });
});
