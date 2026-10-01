/**
 * AI Agent Layer
 * ===============
 *
 * Orchestrates the LLM ↔ tool loop. The agent is the "brain" that:
 *  1. Builds the system prompt + tool definitions
 *  2. Calls the LLM with streaming
 *  3. If the LLM requests a tool → dispatches via ToolRegistry
 *  4. Loops: tool result → LLM → (tool call | final answer)
 *  5. Enforces max 5 tool-call rounds (prevents infinite loops)
 *  6. Enforces token budget
 *  7. Streams text chunks back to the caller (SSE)
 *
 * SECURITY:
 *  - The agent never touches the database directly — only via tools.
 *  - studentId is passed from the API route → agent → ToolRegistry.
 *    The LLM never sees studentId.
 *  - Prompt-injection heuristic runs on the user's message before
 *    sending to the LLM.
 *
 * See SVMS_AI_ASSISTANT_ARCHITECTURE.md §4 (Agent Layer).
 */

import "server-only";
import type { AiProvider, ChatMessage, ChatChunk, ToolDefinition } from "@/lib/ai/provider";
import type { ToolContext } from "@/lib/ai/tools/types";
import { type ToolRegistry, STUDENT_TOOLS } from "@/lib/ai/tools";
import { buildSystemPrompt } from "@/lib/ai/prompts/student-assistant";
import type { StudentContext } from "@/lib/ai/context";

// ── Agent config ─────────────────────────────────────────────────

export const AGENT_CONFIG = {
  /** Max tool-call rounds per request (prevents infinite loops). */
  maxToolRounds: 5,
  /** Max input tokens (rough estimate). */
  maxInputTokens: 4000,
  /** Max output tokens per LLM call. */
  maxOutputTokens: 1000,
  /** Temperature (low = factual, not creative). */
  temperature: 0.3,
  /** Max messages to include in history. */
  maxHistoryMessages: 20,
} as const;

// ── Prompt injection detection ───────────────────────────────────

const INJECTION_PATTERNS = [
  /ignore (all )?(previous |prior )?instructions/i,
  /you are now (an? )?(admin|developer|system)/i,
  /act as (an? )?(admin|developer|system|different)/i,
  /pretend (to be|you are)/i,
  /show me all students/i,
  /show me (other |all )?users?/i,
  /show me (passwords|api keys|tokens|secrets)/i,
  /reveal (your |the )?(system |)?(instructions|prompt)/i,
  /what (are |is )(your |the )?(system |)?prompt/i,
  /repeat (your |the )?(system |)?(instructions|prompt)/i,
  /disclose (your |the )?(system |)?(instructions|prompt)/i,
];

/**
 * Check if a user message contains prompt injection patterns.
 * Returns the matched pattern (for logging) or null if safe.
 */
export function detectPromptInjection(message: string): string | null {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(message)) {
      return pattern.source;
    }
  }
  return null;
}

// ── Tool definition builder ──────────────────────────────────────

/**
 * Convert the registry's AiTool objects into the OpenAI tool-definition
 * format (JSON Schema). This is what the LLM sees.
 */
function buildToolDefinitions(): ToolDefinition[] {
  return STUDENT_TOOLS.map((tool) => {
    // Convert Zod schema to JSON Schema (simplified — the tools use
    // z.object({}).strict() so the JSON Schema is just { type: "object" })
    const jsonSchema = zodToJsonSchema(tool.parameters);
    return {
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: jsonSchema,
      },
    };
  });
}

/**
 * Minimal Zod → JSON Schema converter.
 * Handles the common cases used in our tools (z.object, z.string, etc.)
 */
function zodToJsonSchema(_schema: { _zod?: { def?: unknown } } | unknown): object {
  // Our tools use z.object({}).strict() — the JSON Schema is simple.
  // For a full implementation, use `zod-to-json-schema` package.
  // For now, return a permissive object schema — the registry does
  // the actual validation with Zod.
  return {
    type: "object",
    properties: {},
    additionalProperties: false,
  };
}

// ── Agent result ─────────────────────────────────────────────────

export interface AgentEvent {
  type: "text" | "tool_call" | "tool_result" | "done" | "error";
  text?: string;
  toolName?: string;
  toolArgs?: unknown;
  toolResult?: unknown;
  error?: { code: string; message: string };
  usage?: { inputTokens: number; outputTokens: number };
}

/**
 * Run the AI agent loop.
 *
 * Yields AgentEvents as they happen — the API route forwards these
 * to the client via SSE.
 *
 * @param params.messages  - The user's new message + conversation history
 * @param params.studentCtx - Safe student context (for system prompt)
 * @param params.toolCtx   - Authenticated tool context (studentId from session)
 * @param params.provider  - LLM provider (OpenAI/Anthropic/Mock)
 * @param params.registry  - Tool registry
 * @param params.signal    - AbortSignal for cancellation
 */
export async function* runAgent(params: {
  userMessage: string;
  history: ChatMessage[];
  studentCtx: StudentContext;
  toolCtx: ToolContext;
  provider: AiProvider;
  registry: ToolRegistry;
  signal?: AbortSignal;
}): AsyncIterable<AgentEvent> {
  const { userMessage, history, studentCtx, toolCtx, provider, registry, signal } = params;

  // ── 1. Check for prompt injection ─────────────────────────────
  const injectionPattern = detectPromptInjection(userMessage);
  if (injectionPattern) {
    yield {
      type: "error",
      error: {
        code: "PROMPT_INJECTION_DETECTED",
        message: "Your message was flagged as potentially unsafe. Please rephrase your question.",
      },
    };
    // Log to console (Phase 0 will log to SecurityEvent table)
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "ai.prompt_injection_detected",
        studentId: maskId(toolCtx.studentId),
        pattern: injectionPattern,
        messagePreview: userMessage.slice(0, 100),
        requestId: toolCtx.requestId,
        timestamp: new Date().toISOString(),
      }),
    );
    return;
  }

  // ── 2. Build messages ─────────────────────────────────────────
  const systemPrompt = buildSystemPrompt(studentCtx);
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.slice(-AGENT_CONFIG.maxHistoryMessages),
    { role: "user", content: userMessage },
  ];

  // ── 3. Check input token budget ───────────────────────────────
  const inputTokenEstimate = provider.countTokens(messages);
  if (inputTokenEstimate > AGENT_CONFIG.maxInputTokens) {
    yield {
      type: "error",
      error: {
        code: "INPUT_TOO_LONG",
        message: "This conversation is too long. Please start a new conversation.",
      },
    };
    return;
  }

  // ── 4. Build tool definitions ─────────────────────────────────
  const tools = buildToolDefinitions();

  // ── 5. Agent loop ─────────────────────────────────────────────
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let round = 0; round < AGENT_CONFIG.maxToolRounds; round++) {
    // Call the LLM
    let assistantText = "";
    const assistantToolCalls: Array<{ id: string; name: string; args: string }> = [];
    let chunkError: { code: string; message: string } | null = null;
    let finishReason = "stop";

    try {
      for await (const chunk of provider.streamChat({
        messages,
        tools,
        maxOutputTokens: AGENT_CONFIG.maxOutputTokens,
        temperature: AGENT_CONFIG.temperature,
        signal,
      })) {
        switch (chunk.type) {
          case "text":
            assistantText += chunk.text;
            yield { type: "text", text: chunk.text };
            break;
          case "tool_call":
            assistantToolCalls.push({
              id: chunk.tool_call.id,
              name: chunk.tool_call.function.name,
              args: chunk.tool_call.function.arguments,
            });
            break;
          case "done":
            totalInputTokens += chunk.usage.inputTokens;
            totalOutputTokens += chunk.usage.outputTokens;
            finishReason = chunk.finishReason;
            break;
          case "error":
            chunkError = { code: chunk.code, message: chunk.message };
            break;
        }
        if (chunkError) break;
      }
    } catch (err) {
      yield {
        type: "error",
        error: {
          code: "PROVIDER_ERROR",
          message: `AI service error: ${err instanceof Error ? err.message : "unknown"}`,
        },
      };
      return;
    }

    if (chunkError) {
      yield { type: "error", error: chunkError };
      return;
    }

    // ── 5a. No tool calls → we're done (final answer) ──────────
    if (assistantToolCalls.length === 0) {
      // Add the assistant message to history
      messages.push({ role: "assistant", content: assistantText });

      yield {
        type: "done",
        usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
      };
      return;
    }

    // ── 5b. Tool calls → dispatch each, add results to history ─
    // Add the assistant message (with tool calls) to history
    messages.push({
      role: "assistant",
      content: assistantText,
      tool_calls: assistantToolCalls.map((tc) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: tc.args },
      })),
    });

    // Yield each tool call event
    for (const tc of assistantToolCalls) {
      yield { type: "tool_call", toolName: tc.name, toolArgs: safeParseArgs(tc.args) };
    }

    // Dispatch each tool call
    for (const tc of assistantToolCalls) {
      let parsedArgs: unknown;
      try {
        parsedArgs = tc.args ? JSON.parse(tc.args) : {};
      } catch {
        parsedArgs = {};
      }

      const result = await registry.dispatch(tc.name, parsedArgs, toolCtx);

      // Yield the tool result
      yield {
        type: "tool_result",
        toolName: tc.name,
        toolResult: result.ok ? result.data : { error: result.error.message },
      };

      // Add the tool result to the message history
      messages.push({
        role: "tool",
        content: JSON.stringify(result.ok ? result.data : { error: result.error.message }),
        tool_call_id: tc.id,
        name: tc.name,
      });
    }

    // Loop continues → LLM gets called again with the tool results
  }

  // ── 6. Max rounds exceeded ────────────────────────────────────
  yield {
    type: "error",
    error: {
      code: "MAX_ROUNDS_EXCEEDED",
      message: "I need to check too many things to answer this. Could you ask a more specific question?",
    },
  };
}

// ── Helpers ──────────────────────────────────────────────────────

function safeParseArgs(argsStr: string): unknown {
  try {
    return JSON.parse(argsStr);
  } catch {
    return argsStr;
  }
}

function maskId(id: string): string {
  if (id.length <= 8) return "***";
  return `${id.slice(0, 4)}...${id.slice(-4)}`;
}
