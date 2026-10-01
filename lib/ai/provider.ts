/**
 * AI Provider Layer
 * =================
 *
 * Abstracts the LLM provider so the agent layer is provider-agnostic.
 * The default implementation is OpenAI-compatible (works with OpenAI,
 * Azure OpenAI, OpenRouter, LM Studio, Ollama, vLLM, etc.).
 *
 * SECURITY:
 *  - The API key is read from env (AI_PROVIDER_API_KEY) and NEVER
 *    sent to the browser. This file runs only on the server.
 *  - The provider receives only sanitized context + tool definitions.
 *    It never sees database credentials or the student's ObjectId.
 *
 * HERMES COMPATIBILITY:
 * If "Hermes API" is an OpenAI-compatible endpoint (many agent
 * frameworks expose an OpenAI-compatible /v1/chat/completions route),
 * set AI_PROVIDER_BASE_URL to the Hermes endpoint and it works
 * without code changes. The provider abstraction was designed for
 * exactly this kind of swap.
 *
 * See SVMS_AI_ASSISTANT_ARCHITECTURE.md §3 (AI Service Layer).
 */

import "server-only";

// ── Types ────────────────────────────────────────────────────────

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** For assistant messages with tool calls */
  tool_calls?: ToolCall[];
  /** For tool result messages */
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: object; // JSON Schema
  };
}

export interface StreamChatParams {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  maxInputTokens?: number;
  maxOutputTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export type ChatChunk =
  | { type: "text"; text: string }
  | { type: "tool_call"; tool_call: ToolCall }
  | { type: "done"; usage: { inputTokens: number; outputTokens: number }; finishReason: string }
  | { type: "error"; code: string; message: string };

export interface AiProvider {
  streamChat(params: StreamChatParams): AsyncIterable<ChatChunk>;
  countTokens(messages: ChatMessage[]): number;
}

// ── OpenAI-compatible provider ───────────────────────────────────

interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

function getProviderConfig(): ProviderConfig {
  const apiKey = process.env.AI_PROVIDER_API_KEY;
  if (!apiKey) {
    throw new AiProviderError(
      "MISSING_API_KEY",
      "AI_PROVIDER_API_KEY environment variable is not set. The AI assistant cannot start without it.",
    );
  }
  return {
    apiKey,
    baseUrl: process.env.AI_PROVIDER_BASE_URL || "https://api.openai.com/v1",
    model: process.env.AI_PROVIDER_MODEL || "gpt-4o-mini",
  };
}

export class AiProviderError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

/**
 * OpenAI-compatible streaming chat provider.
 *
 * Uses the standard /v1/chat/completions endpoint with:
 *  - stream: true (SSE response)
 *  - tools: [...] (function calling)
 *  - max_tokens, temperature
 *
 * Works with: OpenAI, Azure OpenAI (via base URL override), OpenRouter,
 * LM Studio, Ollama (with OpenAI compat plugin), vLLM, and any
 * Hermes API that exposes an OpenAI-compatible endpoint.
 */
export class OpenAiCompatibleProvider implements AiProvider {
  private config: ProviderConfig;

  constructor(config?: Partial<ProviderConfig>) {
    this.config = { ...getProviderConfig(), ...config };
  }

  async *streamChat(params: StreamChatParams): AsyncIterable<ChatChunk> {
    const { messages, tools, maxOutputTokens, temperature, signal } = params;

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
    };
    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = "auto";
    }
    if (maxOutputTokens) body.max_tokens = maxOutputTokens;
    if (temperature !== undefined) body.temperature = temperature;

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        yield { type: "error", code: "ABORTED", message: "Request was aborted" };
        return;
      }
      // SECURITY: Log the raw error server-side, but return a generic
      // message to the caller. The raw error can contain hostnames,
      // connection strings, or internal infrastructure details.
      console.error("[ai:provider] network error:", err instanceof Error ? err.message : "unknown");
      yield {
        type: "error",
        code: "NETWORK_ERROR",
        message: "AI service is temporarily unavailable. Please try again.",
      };
      return;
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      // SECURITY: Log the raw upstream error server-side only.
      // Return a generic message — upstream error bodies can contain
      // model names, organization IDs, rate-limit details, and
      // internal infrastructure info.
      console.error(`[ai:provider] upstream ${response.status}:`, errText.slice(0, 500));
      const code = response.status === 401 ? "UNAUTHORIZED" : response.status === 429 ? "RATE_LIMITED" : "PROVIDER_ERROR";
      const message = response.status === 429
        ? "AI service is busy. Please try again in a moment."
        : response.status === 401
          ? "AI service configuration error. Please contact support."
          : "AI service is temporarily unavailable. Please try again.";
      yield { type: "error", code, message };
      return;
    }

    if (!response.body) {
      yield { type: "error", code: "NO_BODY", message: "AI provider returned no response body" };
      return;
    }

    // Parse the SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let inputTokens = 0;
    let outputTokens = 0;
    let finishReason = "stop";

    // Track tool calls being built up across chunks
    const toolCallAccumulator = new Map<number, { id: string; name: string; args: string }>();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // Keep the last incomplete line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;

          try {
            const chunk = JSON.parse(data);
            const choice = chunk.choices?.[0];
            const delta = choice?.delta;

            // Text content
            if (delta?.content) {
              yield { type: "text", text: delta.content };
            }

            // Tool calls (accumulated across chunks)
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!toolCallAccumulator.has(idx)) {
                  toolCallAccumulator.set(idx, { id: tc.id ?? "", name: "", args: "" });
                }
                const acc = toolCallAccumulator.get(idx)!;
                if (tc.id) acc.id = tc.id;
                if (tc.function?.name) acc.name += tc.function.name;
                if (tc.function?.arguments) acc.args += tc.function.arguments;
              }
            }

            if (choice?.finish_reason) {
              finishReason = choice.finish_reason;
            }

            // Usage (usually in the last chunk)
            if (chunk.usage) {
              inputTokens = chunk.usage.prompt_tokens ?? 0;
              outputTokens = chunk.usage.completion_tokens ?? 0;
            }
          } catch {
            // Skip malformed JSON chunks
            continue;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Emit completed tool calls
    for (const [, acc] of toolCallAccumulator) {
      if (acc.name) {
        yield {
          type: "tool_call",
          tool_call: {
            id: acc.id,
            type: "function",
            function: { name: acc.name, arguments: acc.args },
          },
        };
      }
    }

    yield {
      type: "done",
      usage: { inputTokens, outputTokens },
      finishReason,
    };
  }

  /**
   * Rough token count (4 chars ≈ 1 token). Used for budget enforcement.
   * The provider's actual count comes back in the `done` chunk.
   */
  countTokens(messages: ChatMessage[]): number {
    let chars = 0;
    for (const msg of messages) {
      chars += msg.content?.length ?? 0;
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          chars += tc.function.arguments.length;
        }
      }
    }
    return Math.ceil(chars / 4);
  }
}

// ── Mock provider (for tests + dev without an API key) ───────────

export class MockProvider implements AiProvider {
  private responses: ChatChunk[][];

  constructor(responses: ChatChunk[][] = []) {
    this.responses = responses;
  }

  async *streamChat(_params: StreamChatParams): AsyncIterable<ChatChunk> {
    const next = this.responses.shift();
    if (!next) {
      yield {
        type: "error",
        code: "MOCK_EXHAUSTED",
        message: "Mock provider has no more canned responses",
      };
      return;
    }
    for (const chunk of next) {
      yield chunk;
    }
  }

  countTokens(messages: ChatMessage[]): number {
    return messages.reduce((sum, m) => sum + Math.ceil((m.content?.length ?? 0) / 4), 0);
  }
}

// ── Gemini Provider ──────────────────────────────────────────────

/**
 * Gemini Provider — implements the AiProvider interface but uses
 * Google's Gemini API format instead of OpenAI's.
 *
 * Gemini differences:
 *  - Endpoint: /models/{model}:generateContent?key=API_KEY
 *  - Uses "contents" array with "parts" (not "messages")
 *  - System instruction is a separate field
 *  - Streaming uses SSE with different chunk format
 *  - Auth via URL param, not Bearer header
 */
class GeminiProvider implements AiProvider {
  private config: ProviderConfig;

  constructor(config?: Partial<ProviderConfig>) {
    this.config = { ...getProviderConfig(), ...config };
  }

  async *streamChat(params: StreamChatParams): AsyncIterable<ChatChunk> {
    const { messages, tools, maxOutputTokens, temperature, signal } = params;

    // Convert OpenAI-style messages to Gemini format
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

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: temperature ?? 0.7,
        maxOutputTokens: maxOutputTokens ?? 2048,
      },
      ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
    };

    // Gemini function calling
    if (tools && tools.length > 0) {
      body.tools = [{
        functionDeclarations: tools.map((t) => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
        })),
      }];
    }

    const model = this.config.model;
    const url = `${this.config.baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${this.config.apiKey}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        yield { type: "error", code: "ABORTED", message: "Request was aborted" };
        return;
      }
      yield { type: "error", code: "NETWORK_ERROR", message: err instanceof Error ? err.message : "Network error" };
      return;
    }

    if (!response.ok) {
      const errorText = await response.text();
      let code = "PROVIDER_ERROR";
      if (response.status === 400 && errorText.toLowerCase().includes("location is not supported")) {
        code = "REGION_NOT_SUPPORTED";
      } else if (response.status === 400 || response.status === 403) {
        code = "INVALID_API_KEY";
      } else if (response.status === 429) {
        code = "RATE_LIMITED";
      }
      yield { type: "error", code, message: `Gemini API error (${response.status}): ${errorText.slice(0, 200)}` };
      return;
    }

    // Parse SSE stream
    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: "error", code: "NO_RESPONSE_BODY", message: "Empty response body" };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;

          try {
            const chunk = JSON.parse(jsonStr);
            const parts = chunk.candidates?.[0]?.content?.parts ?? [];

            for (const part of parts) {
              if (part.text) {
                yield { type: "text", text: part.text };
              }
              if (part.functionCall) {
                yield {
                  type: "tool_call",
                  tool_call: {
                    id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                    type: "function",
                    function: {
                      name: part.functionCall.name,
                      arguments: JSON.stringify(part.functionCall.args ?? {}),
                    },
                  },
                };
              }
            }

            // Usage metadata — store for the done event
            if (chunk.usageMetadata) {
              // Gemini sends usage in the last chunk; we'll include it in the done event
              // For now, just yield text chunks — usage is handled at the end
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
      yield { type: "done", usage: { inputTokens: 0, outputTokens: 0 }, finishReason: "STOP" };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        yield { type: "error", code: "ABORTED", message: "Request was aborted" };
      } else {
        yield { type: "error", code: "STREAM_ERROR", message: err instanceof Error ? err.message : "Stream error" };
      }
    }
  }

  countTokens(messages: ChatMessage[]): number {
    return messages.reduce((sum, m) => sum + Math.ceil((m.content?.length ?? 0) / 4), 0);
  }
}

// ── Factory ──────────────────────────────────────────────────────

let _provider: AiProvider | null = null;

/**
 * Get the singleton AI provider instance (sync — reads from env vars only).
 *
 * Reads from env:
 *  - AI_PROVIDER_API_KEY (required)
 *  - AI_PROVIDER_BASE_URL (optional, default: https://api.openai.com/v1)
 *  - AI_PROVIDER_MODEL (optional, default: gpt-4o-mini)
 *
 * If the base URL contains "generativelanguage.googleapis.com",
 * the Gemini provider is used instead (different API format).
 *
 * In test environment, returns a MockProvider if no API key is set.
 */
export function getAiProvider(): AiProvider {
  if (_provider) return _provider;

  if (process.env.NODE_ENV === "test" && !process.env.AI_PROVIDER_API_KEY) {
    _provider = new MockProvider();
    return _provider;
  }

  const baseUrl = process.env.AI_PROVIDER_BASE_URL || "https://api.openai.com/v1";

  // Detect Gemini by the base URL
  if (baseUrl.includes("generativelanguage.googleapis.com")) {
    _provider = new GeminiProvider();
    return _provider;
  }

  _provider = new OpenAiCompatibleProvider();
  return _provider;
}

/**
 * Get the AI provider instance from the DB-configured provider (if available).
 *
 * This is the ASYNC version that checks the AiProvider table first.
 * If a DB provider is enabled + has an API key, it takes precedence
 * over the env vars. Falls back to getAiProvider() (env-based) if:
 *  - No DB provider is configured
 *  - DB is unreachable
 *  - DB provider has no API key
 *
 * This is used by the student assistant + Telegram bot so they use
 * the admin-configured provider from the AI Control Center.
 */
export async function getAiProviderAsync(): Promise<AiProvider> {
  // Check DB for a configured provider
  try {
    const { prisma } = await import("@/lib/db");
    const dbProvider = await prisma.aiProvider.findFirst({
      where: { enabled: true, apiKeyEncrypted: { not: null } },
      orderBy: [{ priority: "asc" }],
    });

    if (dbProvider && dbProvider.apiKeyEncrypted && dbProvider.defaultModel) {
      // Set env vars so the sync factory picks them up
      process.env.AI_PROVIDER_API_KEY = dbProvider.apiKeyEncrypted;
      process.env.AI_PROVIDER_BASE_URL = dbProvider.baseUrl ?? "https://api.openai.com/v1";
      process.env.AI_PROVIDER_MODEL = dbProvider.defaultModel;
      // Reset the cached provider so it re-initializes with new env vars
      _provider = null;
    }
  } catch {
    // DB unavailable — fall through to env vars
  }

  return getAiProvider();
}

/** Reset the singleton (for tests). */
export function _resetAiProviderForTests(): void {
  _provider = null;
}

/** Set a custom provider (for tests). */
export function _setAiProviderForTests(provider: AiProvider): void {
  _provider = provider;
}
