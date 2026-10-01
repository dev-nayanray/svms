import { describe, it, expect } from "vitest";
import { MockProvider, type ChatChunk, type ChatMessage } from "@/lib/ai/provider";

describe("MockProvider", () => {
  it("yields canned chunks in order", async () => {
    const chunks: ChatChunk[][] = [
      [
        { type: "text", text: "Hello" },
        { type: "text", text: " world" },
        { type: "done", usage: { inputTokens: 10, outputTokens: 2 }, finishReason: "stop" },
      ],
    ];
    const provider = new MockProvider(chunks);
    const results: ChatChunk[] = [];
    for await (const chunk of provider.streamChat({ messages: [] })) {
      results.push(chunk);
    }
    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({ type: "text", text: "Hello" });
    expect(results[1]).toEqual({ type: "text", text: " world" });
    expect(results[2].type).toBe("done");
  });

  it("returns error when canned responses are exhausted", async () => {
    const provider = new MockProvider([]);
    const results: ChatChunk[] = [];
    for await (const chunk of provider.streamChat({ messages: [] })) {
      results.push(chunk);
    }
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe("error");
    if (results[0].type !== "error") return;
    expect(results[0].code).toBe("MOCK_EXHAUSTED");
  });

  it("countTokens estimates 4 chars per token", () => {
    const provider = new MockProvider();
    const messages: ChatMessage[] = [{ role: "user", content: "Hello world!" }]; // 12 chars → 3 tokens
    expect(provider.countTokens(messages)).toBe(3);
  });
});
