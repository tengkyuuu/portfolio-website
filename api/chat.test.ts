import { describe, expect, it } from "vitest";
import { extractReply, type GeminiResponse } from "./chat";

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
