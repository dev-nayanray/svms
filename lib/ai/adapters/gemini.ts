import "server-only";
import type { AiProviderAdapter, ConnectionTestResult, GenerateOptions, GenerateResult, ChatMessage, ToolCall } from "./types";

/**
 * Google Gemini Provider Adapter
 * ==============================
 *
 * Works with the Google Generative AI API (Gemini).
 * Uses the REST API via https://generativelanguage.googleapis.com/v1beta
 *
 * Gemini has a unique request format:
 *  - Endpoint: /models/{model}:generateContent
 *  - Contents array with parts (text, inlineData, etc.)
 *  - System instruction is a separate field
 *  - Generation config uses temperature, maxOutputTokens, etc.
 *  - Tools are passed via the `tools` field with function declarations
 *
 * Free tier: Gemini offers a free tier with rate limits. The admin
 * should check current limits at https://ai.google.dev/pricing
 */

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

const DEFAULT_MODELS = [
  {
    modelId: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash (Latest)",
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    contextWindow: 1000000,
    inputPricePerMillionCents: 0, // Free tier available
    outputPricePerMillionCents: 0,
  },
  {
    modelId: "gemini-flash-latest",
    name: "Gemini Flash (Latest Auto)",
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    contextWindow: 1000000,
    inputPricePerMillionCents: 0,
    outputPricePerMillionCents: 0,
  },
  {
    modelId: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash (Legacy)",
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    contextWindow: 1000000,
    inputPricePerMillionCents: 0,
    outputPricePerMillionCents: 0,
  },
  {
    modelId: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro (Legacy)",
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsVision: true,
    contextWindow: 2000000,
    inputPricePerMillionCents: 125,
    outputPricePerMillionCents: 500,
  },
];

function classifyError(status: number, body: string): ConnectionTestResult {
  const lowerBody = body.toLowerCase();
  // Handle "User location is not supported" — Gemini is geo-restricted
  if (lowerBody.includes("location is not supported") || lowerBody.includes("user location")) {
    return {
      status: "provider_unavailable",
      message: "Gemini API is not available in your region. Google restricts access by geographic location. Consider using a VPN, a proxy server, or switching to OpenAI/Anthropic which don't have this restriction.",
    };
  }
  if (status === 400 || status === 403) {
    if (lowerBody.includes("api key") || lowerBody.includes("api_key") || lowerBody.includes("permission")) {
      return {
        status: "invalid_credentials",
        message: "Invalid API key. Check that the key is correct and has the Generative Language API enabled.",
      };
    }
    if (lowerBody.includes("model") && (lowerBody.includes("not found") || lowerBody.includes("not supported") || lowerBody.includes("no longer available"))) {
      return {
        status: "unsupported_model",
        message: "Model not found or deprecated. Google frequently updates model names. Try 'gemini-3.8-flash' or 'gemini-flash-latest'.",
      };
    }
    return {
      status: "invalid_credentials",
      message: `API rejected the request (HTTP ${status}): ${body.slice(0, 200)}`,
    };
  }
  if (status === 404) {
    return {
      status: "unsupported_model",
      message: "Model not found. Check that the model ID is correct.",
    };
  }
  if (status === 429) {
    if (lowerBody.includes("quota") || lowerBody.includes("resource")) {
      return {
        status: "quota_exceeded",
        message: "Quota exceeded. Check your Google Cloud quota and billing.",
      };
    }
    return {
      status: "rate_limited",
      message: "Rate limit hit. Gemini free tier has strict rate limits.",
    };
  }
  if (status >= 500) {
    return {
      status: "provider_unavailable",
      message: "Google AI is experiencing issues. Try again later.",
    };
  }
  return {
    status: "network_error",
    message: `Unexpected response (HTTP ${status}): ${body.slice(0, 200)}`,
  };
}

/**
 * Convert our internal ChatMessage[] to Gemini's contents format.
 * Gemini uses "user" and "model" roles (not "assistant").
 */
function toGeminiContents(messages: ChatMessage[]): {
  systemInstruction: { parts: { text: string }[] } | undefined;
  contents: { role: string; parts: { text: string }[] }[];
} {
  let systemText = "";
  const contents: { role: string; parts: { text: string }[] }[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemText += (systemText ? "\n" : "") + msg.content;
    } else {
      const role = msg.role === "assistant" ? "model" : "user";
      contents.push({ role, parts: [{ text: msg.content }] });
    }
  }

  return {
    systemInstruction: systemText ? { parts: [{ text: systemText }] } : undefined,
    contents,
  };
}

export const geminiAdapter: AiProviderAdapter = {
  type: "gemini",

  async testConnection({ apiKey, model }) {
    const start = Date.now();
    try {
      const url = `${BASE_URL}/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Hi" }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
        signal: AbortSignal.timeout(15000),
      });

      const latencyMs = Date.now() - start;

      if (!res.ok) {
        const body = await res.text();
        return { ...classifyError(res.status, body), model, latencyMs };
      }

      const data = await res.json();
      if (data.candidates?.[0]?.content?.parts?.[0]?.text !== undefined) {
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
    const { systemInstruction, contents } = toGeminiContents(options.messages);

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2048,
      },
      ...(systemInstruction ? { systemInstruction } : {}),
    };

    // Gemini supports tools via function declarations
    if (options.tools && options.tools.length > 0) {
      body.tools = [{
        functionDeclarations: options.tools.map((t) => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
        })),
      }];
    }

    const url = `${BASE_URL}/models/${options.model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: options.signal ?? AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      const errResult = classifyError(res.status, errorBody);
      throw new Error(`Gemini API error: ${errResult.status} — ${errResult.message}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];

    const content = parts
      .filter((p: { text?: string }) => p.text !== undefined)
      .map((p: { text: string }) => p.text)
      .join("");

    // Extract tool calls (functionCall parts)
    const functionCalls = parts.filter((p: { functionCall?: unknown }) => p.functionCall !== undefined) ?? [];
    const toolCalls: ToolCall[] | undefined = functionCalls.length > 0
      ? functionCalls.map((p: { functionCall: { name: string; args: unknown } }, i: number) => ({
          id: `call_${i}`,
          type: "function" as const,
          function: {
            name: p.functionCall.name,
            arguments: JSON.stringify(p.functionCall.args ?? {}),
          },
        }))
      : undefined;

    // Gemini returns usage metadata
    const usage = data.usageMetadata ?? {};

    return {
      content,
      toolCalls,
      usage: {
        inputTokens: usage.promptTokenCount ?? 0,
        outputTokens: usage.candidatesTokenCount ?? 0,
      },
      latencyMs: Date.now() - start,
      model: data.modelVersion ?? options.model,
    };
  },

  async listModels({ apiKey }) {
    const url = `${BASE_URL}/models?key=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.models as { name: string }[]).map((m) => m.name.replace("models/", ""));
  },

  getDefaultModels() {
    return DEFAULT_MODELS;
  },
};
