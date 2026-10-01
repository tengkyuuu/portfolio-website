import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fakeReq, fakeRes, createFakeSupabase, type FakeDb } from "../src/test/fake-supabase";
import handler, { invitationEmail, validateInvitation } from "./inquiries";

const db: FakeDb = {};
vi.mock("@supabase/supabase-js", () => ({ createClient: () => createFakeSupabase(db) }));
const secret = "invitation-test-secret";
const draft = { recipients: ["one@example.com", "two@example.com"], subject: "An invitation", message: "Hello! Come take a look.", requestId: "00000000-0000-4000-8000-000000000001" };
function token(sub = "owner") {
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ sub, name: "James", iat: now, exp: now + 3600 })).toString("base64url");
  return `${body}.${crypto.createHmac("sha256", secret).update(body).digest("base64url")}`;
}
async function call(body?: object, auth: string | undefined = token()) {
  const res = fakeRes();
  await handler(fakeReq({ method: body ? "POST" : "GET", query: { op: "invitations" }, body, token: auth }) as unknown as VercelRequest, res as unknown as VercelResponse);
  return res;
}
beforeEach(() => {
  vi.stubEnv("ADMIN_TOKEN_SECRET", secret);
  vi.stubEnv("SUPABASE_URL", "https://supabase.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test");
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("RESEND_FROM", "James <hello@example.com>");
  vi.stubEnv("RESEND_REPLY_TO", "reply@example.com");
  vi.stubEnv("SITE_URL", "https://portfolio.example.com");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [{ id: "email-1" }, { id: "email-2" }] }))));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("invitations", () => {
  it("requires authentication before both preview and send", async () => {
    expect((await call({ ...draft, preview: true }, "bad-token")).statusCode).toBe(401);
    expect((await call(draft, "bad-token")).statusCode).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("refuses removed or disabled team admins", async () => {
    vi.stubEnv("SUPABASE_URL", "https://supabase.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test");
    db.admin_users = [{ id: "removed", disabled: true, display_name: "Removed", password_changed_at: null }];
    expect((await call(draft, token("removed"))).statusCode).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("previews the actual escaped email without sending", async () => {
    const res = await call({ ...draft, preview: true, message: '<img src=x onerror="alert(1)"> & Hello' });
    expect(res.statusCode).toBe(200);
    expect((res.body as { html: string }).html).toContain("&lt;img");
    expect((res.body as { html: string }).html).not.toContain("<img");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps recipients private and uses the same idempotency key for retries", async () => {
    const first = await call(draft);
    await call(draft);
    expect(first.statusCode).toBe(200);
    const calls = vi.mocked(fetch).mock.calls;
    const firstOptions = calls[0][1]!;
    const emails = JSON.parse(firstOptions.body as string);
    expect(emails.map((email: { to: string[] }) => email.to)).toEqual([["one@example.com"], ["two@example.com"]]);
    expect(emails[0].reply_to).toBe("reply@example.com");
    expect(emails[0].text).toContain("https://portfolio.example.com");
    expect(new Headers(firstOptions.headers).get("Idempotency-Key")).toBe(new Headers(calls[1][1]!.headers).get("Idempotency-Key"));
  });
  it("rejects malformed input before any provider call", async () => {
    for (const patch of [{ recipients: ["bad-address"] }, { recipients: Array(11).fill("one@example.com") }, { subject: "Hello\nBcc: someone" }, { requestId: "bad-key" }]) {
      expect((await call({ ...draft, ...patch })).statusCode).toBe(400);
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it("deduplicates recipients and requires an HTTPS destination", async () => {
    expect(validateInvitation({ ...draft, recipients: ["One@example.com", "one@example.com"] })?.recipients).toEqual(["one@example.com"]);
    vi.stubEnv("SITE_URL", "javascript:alert(1)");
    expect((await call(draft)).statusCode).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("allows Gmail previews before a Resend key is configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect((await call({ ...draft, preview: true })).statusCode).toBe(200);
    expect((await call(draft)).statusCode).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not claim success for provider failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 403 })));
    expect((await call(draft)).statusCode).toBe(502);
  });
  it("builds a readable text alternative", () => {
    expect(invitationEmail(draft, "https://example.com").text).toContain(draft.message);
  });
});
