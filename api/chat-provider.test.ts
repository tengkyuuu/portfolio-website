import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createFakeSupabase, fakeReq, fakeRes, type FakeDb } from "../src/test/fake-supabase";

const db: FakeDb = {};
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ ...createFakeSupabase(db), rpc }) }));
import handler, { callBlueModel, chatConfig, extractGroqReply } from "./chat";

const answer = { reply: "James builds embedded projects.", reaction: "working" };
const groqResponse = () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(answer), reasoning: "private reasoning" } }] }));
const messages = [{ role: "user" as const, content: "What does James build?" }];
const sessionId = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

async function call(method: string, body?: unknown) {
  const res = fakeRes();
  await handler(fakeReq({ method, body }) as unknown as VercelRequest, res as unknown as VercelResponse);
  return res;
}

beforeEach(() => {
  for (const key of Object.keys(db)) delete db[key];
  db.site_content = [{ id: "default", content: { hero: { name: "James" }, projects: [{ title: "Grounded project", blurb: "ESP32 firmware" }] } }];
  rpc.mockReset().mockResolvedValue({ data: true, error: null });
  vi.stubEnv("CHAT_PROVIDER", "groq");
  vi.stubEnv("GROQ_API_KEY", "groq-test-key");
  vi.stubEnv("GROQ_MODEL", "");
  vi.stubEnv("GEMINI_API_KEY", "gemini-test-key");
  vi.stubEnv("GEMINI_MODEL", "");
  vi.stubEnv("SUPABASE_URL", "https://database.example");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-test-key");
  vi.stubEnv("ADMIN_TOKEN_SECRET", "test-secret");
  vi.stubGlobal("fetch", vi.fn(async () => groqResponse()));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("chat provider selection", () => {
  it("keeps Gemini as the default for existing deployments", () => {
    vi.stubEnv("CHAT_PROVIDER", "");
    expect(chatConfig()).toMatchObject({ provider: "gemini", apiKey: "gemini-test-key" });
  });
  it("accepts a model override for the selected provider", () => {
    vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-120b");
    expect(chatConfig()?.model).toBe("openai/gpt-oss-120b");
  });
  it("does not substitute Gemini when the selected Groq key is absent", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    expect((await call("GET")).body).toEqual({ configured: false });
    expect((await call("POST", { messages })).statusCode).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects an unknown provider", () => {
    vi.stubEnv("CHAT_PROVIDER", "unknown");
    expect(chatConfig()).toBeNull();
  });
});

describe("Groq chat integration", () => {
  it("grounds the request, keeps conversation roles, and saves the reply and reaction", async () => {
    const history = [{ role: "user", content: "Hi" }, { role: "assistant", content: "Hello" }, ...messages];
    const res = await call("POST", { messages: history, sessionId });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ...answer, mode: "ai" });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer groq-test-key" });
    const request = JSON.parse(String(init?.body));
    expect(request.model).toBe("openai/gpt-oss-20b");
    expect(request.messages[0]).toMatchObject({ role: "system", content: expect.stringContaining("Grounded project") });
    expect(request.messages.slice(1)).toEqual(history);
    expect(request.response_format.json_schema).toMatchObject({ strict: true, schema: { required: ["reply", "reaction"], additionalProperties: false } });
    expect(request).toMatchObject({ reasoning_effort: "low", include_reasoning: false, max_completion_tokens: 2048 });
    expect(db.chat_messages).toContainEqual(expect.objectContaining({ role: "ai", body: answer.reply, reaction: answer.reaction }));
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it("never calls the model after a human takes over", async () => {
    db.chat_sessions = [{ id: sessionId, mode: "human" }];
    const res = await call("POST", { messages, sessionId });
    expect(res.body).toEqual({ mode: "human", reply: null });
    expect(fetch).not.toHaveBeenCalled();
    expect(db.chat_messages).toContainEqual(expect.objectContaining({ role: "visitor" }));
  });
  it("returns a safe error without retries or provider fallback on quota failure", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("provider details", { status: 429 }));
    const res = await call("POST", { messages });
    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ error: "The assistant is temporarily unavailable (Groq returned 429). Please try again later." });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("retries Groq 400s using broad JSON mode for model compatibility", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("schema rejected", { status: 400 }))
      .mockResolvedValueOnce(groqResponse());
    const res = await call("POST", { messages });
    expect(res.statusCode).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(2);
    const retry = JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body));
    expect(retry.response_format).toEqual({ type: "json_object" });
  });
  it("displays a readable fallback for missing text or truncated JSON", async () => {
    expect(extractGroqReply({ choices: [{ message: { content: null } }] })).toBe("");
    expect(extractGroqReply({})).toBe("");
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{"reply":"Hello' } }] })));
    const res = await call("POST", { messages });
    expect(res.body).toMatchObject({ reaction: "searching", reply: expect.not.stringContaining('{"reply"') });
  });
});

it("preserves Gemini role mapping and the retry without unsupported thinking config", async () => {
  vi.stubEnv("CHAT_PROVIDER", "gemini");
  vi.mocked(fetch)
    .mockResolvedValueOnce(new Response("invalid argument", { status: 400 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] })));
  const config = chatConfig()!;
  const upstream = await callBlueModel(config, "Grounding", [{ role: "assistant", content: "Hello" }, ...messages]);
  expect(upstream.ok).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(2);
  const first = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
  const retry = JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body));
  expect(first.contents[0].role).toBe("model");
  expect(first.systemInstruction.parts[0].text).toBe("Grounding");
  expect(first.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
  expect(retry.generationConfig).not.toHaveProperty("thinkingConfig");
});
