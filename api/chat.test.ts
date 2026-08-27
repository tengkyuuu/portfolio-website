import { describe, expect, it } from "vitest";
import { extractReply, validSessionId, type GeminiResponse } from "./chat";

/**
 * Gemini's response shape is nothing like Anthropic's, and getting it wrong
 * is silent: the handler returns 200 with a fallback line instead of the
 * model's actual answer. These pin the shape.
 */

describe("extractReply", () => {
  it("reads the text out of a normal answer", () => {
    const res: GeminiResponse = {
      candidates: [
        { content: { parts: [{ text: "James builds ESP32 firmware." }] }, finishReason: "STOP" },
      ],
    };
    expect(extractReply(res)).toBe("James builds ESP32 firmware.");
  });

  it("joins a multi-part answer in order", () => {
    const res: GeminiResponse = {
      candidates: [{ content: { parts: [{ text: "Hello " }, { text: "there." }] } }],
    };
    expect(extractReply(res)).toBe("Hello there.");
  });

  it("trims surrounding whitespace", () => {
    const res: GeminiResponse = {
      candidates: [{ content: { parts: [{ text: "\n  padded  \n" }] } }],
    };
    expect(extractReply(res)).toBe("padded");
  });

  it("keeps a truncated answer rather than discarding it", () => {
    const res: GeminiResponse = {
      candidates: [
        { content: { parts: [{ text: "He works on" }] }, finishReason: "MAX_TOKENS" },
      ],
    };
    expect(extractReply(res)).toBe("He works on");
  });

  it("returns empty when a safety filter blocked the prompt", () => {
    expect(extractReply({ promptFeedback: { blockReason: "SAFETY" } })).toBe("");
  });

  it("returns empty for an empty candidate list", () => {
    expect(extractReply({ candidates: [] })).toBe("");
  });

  it("returns empty when the candidate carries no parts", () => {
    expect(extractReply({ candidates: [{ content: {} }] })).toBe("");
    expect(extractReply({ candidates: [{}] })).toBe("");
  });

  it("returns empty for a response with nothing in it at all", () => {
    expect(extractReply({})).toBe("");
  });

  it("skips parts that carry something other than text", () => {
    const res = {
      candidates: [
        { content: { parts: [{ text: "ok" }, { inlineData: { data: "x" } }] } },
      ],
    } as unknown as GeminiResponse;
    expect(extractReply(res)).toBe("ok");
  });
});

/**
 * The session id is the only thing standing between a crafted ?session= and
 * a database query — the transcript route is public by design, because the
 * uuid IS the credential. Anything not uuid-shaped must be rejected before
 * it gets near Postgres.
 */
describe("validSessionId", () => {
  it("accepts a lowercase uuid", () => {
    const id = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    expect(validSessionId(id)).toBe(id);
  });

  it("accepts uppercase hex", () => {
    const id = "3F2504E0-4F89-41D3-9A0C-0305E82C3301";
    expect(validSessionId(id)).toBe(id);
  });

  it("rejects a SQL-ish payload", () => {
    expect(validSessionId("' or 1=1 --")).toBeNull();
  });

  it("rejects a uuid with trailing content", () => {
    expect(validSessionId("3f2504e0-4f89-41d3-9a0c-0305e82c3301'--")).toBeNull();
  });

  it("rejects the wrong shape", () => {
    expect(validSessionId("3f2504e04f8941d39a0c0305e82c3301")).toBeNull();
    expect(validSessionId("not-a-uuid")).toBeNull();
    expect(validSessionId("")).toBeNull();
  });

  it("rejects non-strings", () => {
    expect(validSessionId(null)).toBeNull();
    expect(validSessionId(undefined)).toBeNull();
    expect(validSessionId(42)).toBeNull();
    expect(validSessionId({})).toBeNull();
  });
});
