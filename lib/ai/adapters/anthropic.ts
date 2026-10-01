import "server-only";
import type { AiProviderAdapter, ConnectionTestResult, GenerateOptions, GenerateResult, ChatMessage, ToolCall } from "./types";

/**
 * Anthropic Claude Provider Adapter
 * ==================================
 *
 * Works with the official Anthropic Messages API
 * (https://api.anthropic.com/v1/messages).
 *
 * Anthropic uses a different request/response format than OpenAI:
 *  - System message goes in a top-level `system` field (not in messages)
 *  - Messages array only contains user/assistant turns
 *  - Response uses `content` array (text blocks + tool_use blocks)
 *  - Usage uses `input_tokens` / `output_tokens` (not prompt/completion)
 */

const BASE_URL = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION = "2023-06-01";

const DEFAULT_MODELS = [
  {
    modelId: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet",
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    contextWindow: 200000,
    inputPricePerMillionCents: 300, // $3.00/1M
    outputPricePerMillionCents: 1500, // $15.00/1M
  },
  {
    modelId: "claude-3-5-haiku-20241022",
    name: "Claude 3.5 Haiku",
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    contextWindow: 200000,
    inputPricePerMillionCents: 80, // $0.80/1M
    outputPricePerMillionCents: 400, // $4.00/1M
  },
  {
    modelId: "claude-3-opus-20240229",
    name: "Claude 3 Opus",
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    contextWindow: 200000,
    inputPricePerMillionCents: 1500, // $15.00/1M
    outputPricePerMillionCents: 7500, // $75.00/1M
  },
];

function classifyError(status: number, body: string): ConnectionTestResult {
  const lowerBody = body.toLowerCase();
  if (status === 401 || status === 403) {
    return {
      status: "invalid_credentials",
      message: "Invalid API key. Check that the key is correct and has the required permissions.",
    };
  }
  if (status === 404) {
    return {
      status: "unsupported_model",
      message: "Model not found. Check that the model ID is correct.",
    };
  }
  if (status === 429) {
    if (lowerBody.includes("quota") || lowerBody.includes("billing") || lowerBody.includes("credit")) {
      return {
        status: "quota_exceeded",
        message: "Quota exceeded. Check your billing plan and usage limits.",
      };
    }
    return {
      status: "rate_limited",
      message: "Rate limit hit. Too many requests in a short period.",
    };
  }
  if (status >= 500) {
    return {
      status: "provider_unavailable",
      message: "Anthropic is experiencing issues. Try again later.",
    };
  }
  return {
    status: "network_error",
    message: `Unexpected response (HTTP ${status}): ${body.slice(0, 200)}`,
  };
}

/**
 * Convert our internal ChatMessage[] to Anthropic's format.
 * Anthropic requires the system message to be separate from the messages array.
 */
function toAnthropicMessages(messages: ChatMessage[]): { system: string | undefined; messages: { role: string; content: string }[] } {
  let system: string | undefined;
  const converted: { role: string; content: string }[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      system = (system ? system + "\n" : "") + msg.content;
    } else {
      converted.push({ role: msg.role, content: msg.content });
    }
  }

  return { system, messages: converted };
}

export const anthropicAdapter: AiProviderAdapter = {
  type: "anthropic",

  async testConnection({ apiKey, model }) {
    const start = Date.now();
    try {
      const { system, messages } = toAnthropicMessages([
        { role: "user", content: "Hi" },
      ]);

      const res = await fetch(`${BASE_URL}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model,
          max_tokens: 5,
          messages,
          ...(system ? { system } : {}),
        }),
        signal: AbortSignal.timeout(15000),
      });

      const latencyMs = Date.now() - start;

      if (!res.ok) {
        const body = await res.text();
        return { ...classifyError(res.status, body), model, latencyMs };
      }

      const data = await res.json();
      if (data.content?.[0]?.text !== undefined) {
        return {
          status: "connected",
          message: `Successfully connected. Model "${model}" is available.`,
          model,
          latencyMs,
        };
      }

      return {
        status: "provider_unavailable",
        message: "Provider returned an unexpected response format.",
        model,
        latencyMs,
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      if (err instanceof Error && err.name === "TimeoutError") {
        return { status: "network_error", message: "Request timed out after 15 seconds.", model, latencyMs };
      }
      return {
        status: "network_error",
        message: `Network error: ${err instanceof Error ? err.message : String(err)}`,
        model,
        latencyMs,
      };
    }
  },

  async generate({ apiKey, options }): Promise<GenerateResult> {
    const start = Date.now();
    const { system, messages } = toAnthropicMessages(options.messages);

    const body: Record<string, unknown> = {
      model: options.model,
      max_tokens: options.maxTokens ?? 2048,
      messages,
      ...(system ? { system } : {}),
    };

    // Anthropic supports tools via the `tools` field (different format than OpenAI)
    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }

    const res = await fetch(`${BASE_URL}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
      signal: options.signal ?? AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      const errResult = classifyError(res.status, errorBody);
      throw new Error(`Anthropic API error: ${errResult.status} — ${errResult.message}`);
    }

    const data = await res.json();

    // Anthropic returns content as an array of blocks
    const textBlocks = data.content?.filter((b: { type: string }) => b.type === "text") ?? [];
    const content = textBlocks.map((b: { text: string }) => b.text).join("");

    // Extract tool calls
    const toolUseBlocks = data.content?.filter((b: { type: string }) => b.type === "tool_use") ?? [];
    const toolCalls: ToolCall[] | undefined = toolUseBlocks.length > 0
      ? toolUseBlocks.map((b: { id: string; name: string; input: unknown }) => ({
          id: b.id,
          type: "function" as const,
          function: {
            name: b.name,
            arguments: JSON.stringify(b.input),
          },
        }))
      : undefined;

    return {
      content,
      toolCalls,
      usage: {
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
      },
      latencyMs: Date.now() - start,
      model: data.model ?? options.model,
    };
  },

  getDefaultModels() {
    return DEFAULT_MODELS;
  },
};
