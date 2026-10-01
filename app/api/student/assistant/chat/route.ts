/**
 * POST /api/student/assistant/chat
 * =================================
 *
 * Streaming AI assistant chat endpoint (SSE).
 *
 * ARCHITECTURE:
 *   Browser → SVMS Backend (this route) → AI Agent/API → SVMS Tools → Database
 *
 * The browser NEVER directly communicates with the AI provider.
 * The API key stays on the server.
 *
 * SECURITY:
 *  1. studentApiGuard() derives studentId from the NextAuth session
 *     — NEVER from client input.
 *  2. Role check: STUDENT only.
 *  3. Global kill switch: SystemSetting.ai_assistant_enabled (when
 *     the model exists; for now, env var AI_ASSISTANT_ENABLED).
 *  4. Rate limiting: per-student (5/min, 20/hour, 50/day).
 *  5. Input validation: zod schema (message 1-2000 chars).
 *  6. Prompt-injection detection (in agent layer).
 *  7. Tool dispatch: studentId injected from session, never from LLM.
 *
 * SSE EVENT FORMAT:
 *   data: {"type":"text","text":"Hello"}\n\n
 *   data: {"type":"tool_call","toolName":"getStudentProfile","toolArgs":{}}\n\n
 *   data: {"type":"tool_result","toolName":"getStudentProfile","toolResult":{...}}\n\n
 *   data: {"type":"done","usage":{"inputTokens":150,"outputTokens":80}}\n\n
 *   data: {"type":"error","error":{"code":"...","message":"..."}}\n\n
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { studentApiGuard } from "@/lib/student/guard";
import { buildStudentContext } from "@/lib/ai/context";
import { runAgent } from "@/lib/ai/agent";
import { getAiProvider } from "@/lib/ai/provider";
import { createStudentToolRegistry } from "@/lib/ai/tools";
import {
  createConversation,
  loadConversation,
  appendMessage,
  type ConversationMessage,
} from "@/lib/ai/conversation";
import { checkApiRateLimit } from "@/lib/ai/api-rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const chatSchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(2000, "Message is too long (max 2000 characters)"),
  conversationId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  // ── 1. Authentication ─────────────────────────────────────────
  const g = await studentApiGuard();
  if (!g.ok) return g.error;

  // ── 2. Kill switch ────────────────────────────────────────────
  // Phase 0 will check SystemSetting.ai_assistant_enabled.
  // For now, check env var.
  if (process.env.AI_ASSISTANT_ENABLED === "false") {
    return Response.json(
      { success: false, error: { code: "UNAVAILABLE", message: "AI assistant is currently disabled." } },
      { status: 503 },
    );
  }

  // ── 3. Rate limiting ──────────────────────────────────────────
  const rateLimit = checkApiRateLimit(g.student.id);
  if (!rateLimit.allowed) {
    return Response.json(
      {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: `You've sent too many messages. Please try again in ${Math.ceil(rateLimit.retryAfterMs / 1000)} seconds.`,
          retryAfter: rateLimit.retryAfterMs,
        },
      },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)) } },
    );
  }

  // ── 4. Input validation ───────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { success: false, error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return Response.json(
      { success: false, error: { code: "VALIDATION_ERROR", message } },
      { status: 400 },
    );
  }

  const { message: userMessage, conversationId } = parsed.data;

  // ── 5. Build student context ──────────────────────────────────
  const studentCtx = await buildStudentContext(g.student.id, g.userId);
  if (!studentCtx) {
    return Response.json(
      { success: false, error: { code: "NOT_FOUND", message: "Student profile not found" } },
      { status: 404 },
    );
  }

  // ── 6. Load or create conversation ────────────────────────────
  let conversation = conversationId
    ? loadConversation(conversationId, g.student.id)
    : null;
  if (!conversation) {
    conversation = createConversation(g.student.id);
  }

  // Persist the user's message
  appendMessage(conversation.id, g.student.id, {
    role: "user",
    content: userMessage,
    createdAt: Date.now(),
  });

  // ── 7. Build history for the LLM ──────────────────────────────
  const history = conversation.messages
    .slice(-20) // Last 20 messages
    .map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.toolCalls ? { tool_calls: m.toolCalls.map((tc) => ({ id: tc.id, type: "function" as const, function: { name: tc.name, arguments: tc.args } })) } : {}),
      ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
      ...(m.role === "tool" ? { name: "tool" } : {}),
    }));

  // ── 8. Set up SSE stream ──────────────────────────────────────
  const encoder = new TextEncoder();
  const abortController = new AbortController();

  // Abort if the client disconnects
  req.signal.addEventListener("abort", () => abortController.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(event: unknown) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      // Heartbeat every 15s to keep the connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15_000);

      try {
        const provider = getAiProvider();
        const registry = createStudentToolRegistry();

        let assistantText = "";

        for await (const event of runAgent({
          userMessage,
          history,
          studentCtx,
          toolCtx: {
            studentId: g.student.id,
            userId: g.userId,
            role: "STUDENT", // studentApiGuard guarantees this
            requestId: conversation.id,
          },
          provider,
          registry,
          signal: abortController.signal,
        })) {
          send(event);

          if (event.type === "text" && event.text) {
            assistantText += event.text;
          }

          if (event.type === "done" || event.type === "error") {
            break;
          }
        }

        // Persist the assistant's response
        if (assistantText) {
          appendMessage(conversation!.id, g.student.id, {
            role: "assistant",
            content: assistantText,
            createdAt: Date.now(),
          });
        }
      } catch (err) {
        send({
          type: "error",
          error: {
            code: "INTERNAL",
            message: `An unexpected error occurred: ${err instanceof Error ? err.message : "unknown"}`,
          },
        });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable Nginx buffering
    },
  });
}
