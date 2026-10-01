import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createFakeSupabase, fakeReq, fakeRes, type FakeDb } from "../src/test/fake-supabase";
const db: FakeDb = {};
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ ...createFakeSupabase(db), rpc }) }));
import chat from "./chat";
import login from "./login";
import inquiries from "./inquiries";
import health from "./health";
const call = async (handler: typeof chat, init: Parameters<typeof fakeReq>[0]) => {
  const res = fakeRes();
  await handler(fakeReq(init) as unknown as VercelRequest, res as unknown as VercelResponse);
  return res;
};
beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  vi.stubEnv("SUPABASE_URL", "https://database.example");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");
  vi.stubEnv("ADMIN_TOKEN_SECRET", "test-secret");
  vi.stubEnv("ADMIN_PASSWORD_HASH", crypto.createHash("sha256").update("correct-password").digest("hex"));
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  rpc.mockReset().mockResolvedValue({ data: true, error: null });
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it.each([false, null])("blocks chat before writing a transcript or spending money when allowance is %s", async allowance => {
  rpc.mockResolvedValue({ data: allowance, error: allowance === null ? { message: "database down" } : null });
  const res = await call(chat, { method: "POST", body: { sessionId: "00000000-0000-4000-8000-000000000001", messages: [{ role: "user", content: "Hello" }] } });
  expect(res.statusCode).toBe(allowance === false ? 429 : 503);
  expect(db.chat_sessions).toBeUndefined();
  expect(db.chat_messages).toBeUndefined();
  expect(fetch).not.toHaveBeenCalled();
  expect(res.headers["cache-control"]).toBe("no-store");
});
it("refuses login even with a correct password if protection is unavailable", async () => {
  rpc.mockRejectedValue(new Error("down"));
  const res = await call(login, { method: "POST", body: { password: "correct-password" } });
  expect(res.statusCode).toBe(503);
  expect(res.body).not.toHaveProperty("token");
});
it("uses a shared database limit across fresh login module instances", async () => {
  rpc.mockResolvedValue({ data: false, error: null });
  const res = await call(login, { method: "POST", body: { password: "correct-password" } });
  expect(res.statusCode).toBe(429);
  expect(rpc).toHaveBeenCalledWith("consume_security_limit", expect.objectContaining({ p_limit: 10, p_window_seconds: 900 }));
});
it("does not store an inquiry when the quota is exhausted", async () => {
  rpc.mockResolvedValue({ data: false, error: null });
  const res = await call(inquiries, { method: "POST", body: { name: "Visitor", email: "visitor@example.com", subject: "Hello", message: "This is a valid contact message." } });
  expect(res.statusCode).toBe(429);
  expect(db.inquiries).toBeUndefined();
});
it("keeps database diagnostics private", async () => {
  const res = await call(health, { method: "GET" });
  expect(res.body).toEqual({ ok: true, authConfigured: true, storeConfigured: true });
  expect(Object.keys(db)).toEqual([]);
});
it("keeps the distributed limiter identical in each self-contained handler", () => {
  const blocks = ["login", "chat", "inquiries"].map(file => readFileSync(`api/${file}.ts`, "utf8").match(/\/\* ---- shared security limiter[\s\S]*?\/\* ---- end shared security limiter ---- \*\//)?.[0]);
  expect(blocks[0]).toBeTruthy();
  expect(blocks[1]).toBe(blocks[0]); expect(blocks[2]).toBe(blocks[0]);
});
