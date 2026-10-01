import "server-only";
import type { AiProviderAdapter, ConnectionTestResult, GenerateOptions, GenerateResult, ChatMessage, ToolCall } from "./types";

/**
 * OpenAI Provider Adapter
 * =======================
 *
 * Works with the official OpenAI API (https://api.openai.com/v1).
 * Also serves as the base for openai-compatible providers (OpenRouter,
 * LM Studio, Ollama, vLLM, etc.) which expose the same /chat/completions
 * endpoint with a different base URL.
 *
 * Uses the native fetch API (no SDK dependency) to keep the bundle small.
 */

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

const DEFAULT_MODELS = [
  {
    modelId: "gpt-4o",
    name: "GPT-4o",
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    contextWindow: 128000,
    inputPricePerMillionCents: 250, // $2.50/1M
    outputPricePerMillionCents: 1000, // $10.00/1M
  },
  {
    modelId: "gpt-4o-mini",
    name: "GPT-4o mini",
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    contextWindow: 128000,
    inputPricePerMillionCents: 15, // $0.15/1M
    outputPricePerMillionCents: 60, // $0.60/1M
  },
  {
    modelId: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    contextWindow: 128000,
    inputPricePerMillionCents: 1000,
    outputPricePerMillionCents: 3000,
  },
];

/**
 * Classify an HTTP error response into our connection test status.
 */
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
      message: "Model not found. Check that the model ID is correct and available for your account.",
    };
  }
  if (status === 429) {
    if (lowerBody.includes("quota") || lowerBody.includes("billing")) {
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
      message: "Provider is experiencing issues. Try again later.",
    };
  }
  return {
    status: "network_error",
    message: `Unexpected response (HTTP ${status}): ${body.slice(0, 200)}`,
  };
}

export const openaiAdapter: AiProviderAdapter = {
  type: "openai",

  async testConnection({ apiKey, baseUrl, model }) {
    const start = Date.now();
    try {
      const url = `${baseUrl || DEFAULT_BASE_URL}/chat/completions`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 5,
        }),
        signal: AbortSignal.timeout(15000),
      });

      const latencyMs = Date.now() - start;

      if (!res.ok) {
        const body = await res.text();
        return { ...classifyError(res.status, body), model, latencyMs };
      }

      const data = await res.json();
      // Verify we got a valid response
      if (data.choices?.[0]?.message?.content !== undefined) {
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

  async generate({ apiKey, baseUrl, options }): Promise<GenerateResult> {
    const start = Date.now();
    const url = `${baseUrl || DEFAULT_BASE_URL}/chat/completions`;

    const body: Record<string, unknown> = {
      model: options.model,
      messages: options.messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
        ...(m.name ? { name: m.name } : {}),
      })),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: false, // Non-streaming for the generate() method
    };

    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: options.signal ?? AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      const errResult = classifyError(res.status, errorBody);
      throw new Error(`OpenAI API error: ${errResult.status} — ${errResult.message}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const message = choice?.message;

    const toolCalls: ToolCall[] | undefined = message?.tool_calls?.map((tc: { id: string; function: { name: string; arguments: string } }) => ({
      id: tc.id,
      type: "function" as const,
      function: { name: tc.function.name, arguments: tc.function.arguments },
    }));

    return {
      content: message?.content ?? "",
      toolCalls,
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
      latencyMs: Date.now() - start,
      model: data.model ?? options.model,
    };
  },

  async listModels({ apiKey, baseUrl }) {
    const url = `${baseUrl || DEFAULT_BASE_URL}/models`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data as { id: string }[]).map((m) => m.id);
  },

  getDefaultModels() {
    return DEFAULT_MODELS;
  },
};
