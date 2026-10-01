/**
 * POST /api/student/assistant/chat
 * =================================
 *
 * Streaming AI assistant chat endpoint (SSE).
 *
 * ROUTING CONVENTION:
 *   This project uses /api/student/* for all student-scoped routes
 *   (following the existing pattern: /api/student/dashboard,
 *   /api/student/documents, /api/student/notifications, etc.).
 *   The AI assistant lives under /api/student/assistant/* to match.
 *
 * ARCHITECTURE:
 *   Browser → SVMS Backend (this route) → AI Agent → SVMS Tools → Database
 *   The browser NEVER directly communicates with the AI provider.
 *   The API key stays on the server (lib/ai/provider.ts uses 'server-only').
 *
 * SECURITY:
 *  1. studentApiGuard() derives studentId from the NextAuth session
 *     — NEVER from client input.
 *  2. Kill switch: AI_ASSISTANT_ENABLED=false disables globally.
 *  3. Rate limiting: per-student (5/min burst, 20/hour, 50/day).
 *  4. Input validation: zod (message 1-2000 chars, conversationId?).
 *  5. Conversation ownership: loadConversation checks studentId match.
 *  6. Prompt-injection detection (in agent layer, 11 patterns).
 *  7. Tool dispatch: studentId injected from session, never from LLM.
 *  8. Request logging: structured JSON, no PII, no message content.
 *
 * SSE EVENT FORMAT (frontend-friendly, provider-agnostic):
 *   data: {"type":"conversation","conversationId":"conv-..."}\n\n
 *   data: {"type":"text","text":"Hello"}\n\n
 *   data: {"type":"tool_call","toolName":"getStudentProfile"}\n\n
 *   data: {"type":"tool_result","toolName":"getStudentProfile","success":true}\n\n
 *   data: {"type":"done","usage":{"inputTokens":150,"outputTokens":80}}\n\n
 *   data: {"type":"error","error":{"code":"...","message":"..."}}\n\n
 *
 * The SSE events do NOT expose provider-specific details (no model
 * names, no raw API responses, no internal IDs beyond conversationId).
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { buildStudentContext } from "@/lib/ai/context";
import { runAgent } from "@/lib/ai/agent";
import { getAiProvider } from "@/lib/ai/provider";
import { createStudentToolRegistry } from "@/lib/ai/tools";
import {
  createConversation,
  loadConversation,
  appendMessage,
} from "@/lib/ai/conversation";
import { checkApiRateLimit } from "@/lib/ai/api-rate-limit";
import { logAiRequest, previewMessage, generateRequestId } from "@/lib/ai/request-logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const chatSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(2000, "Message is too long (max 2000 characters)"),
  conversationId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  // ── 1. Authentication + student role validation ──────────────
  // studentApiGuard() derives studentId from the NextAuth session.
  // It returns 401 if unauthenticated, 403 if not a STUDENT role.
  // The studentId is NEVER trusted from the request body.
  const g = await studentApiGuard();
  if (!g.ok) return g.error;

  // ── 2. Kill switch ────────────────────────────────────────────
  if (process.env.AI_ASSISTANT_ENABLED === "false") {
    logAiRequest({
      requestId,
      event: "ai.chat.disabled",
      studentId: g.student.id,
      method: "POST",
      path: "/api/student/assistant/chat",
      timestamp: new Date().toISOString(),
      statusCode: 503,
    });
    return fail("UNAVAILABLE", "AI assistant is currently disabled.", 503);
  }

  // ── 3. Rate limiting ──────────────────────────────────────────
  const rateLimit = checkApiRateLimit(g.student.id);
  if (!rateLimit.allowed) {
    logAiRequest({
      requestId,
      event: "ai.chat.rate_limited",
      studentId: g.student.id,
      method: "POST",
      path: "/api/student/assistant/chat",
      timestamp: new Date().toISOString(),
      statusCode: 429,
      errorCode: "RATE_LIMITED",
    });
    return fail(
      "RATE_LIMITED",
      `You've sent too many messages. Please try again in ${Math.ceil(rateLimit.retryAfterMs / 1000)} seconds.`,
      429,
      { retryAfter: rateLimit.retryAfterMs },
    );
  }

  // ── 4. Input validation ───────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON body", 400);
  }

  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return fail("VALIDATION_ERROR", message, 422);
  }

  const { message: userMessage, conversationId: requestedConversationId } = parsed.data;

  // ── 5. Build student context (safe, no PII) ───────────────────
  const studentCtx = await buildStudentContext(g.student.id, g.userId);
  if (!studentCtx) {
    return fail("NOT_FOUND", "Student profile not found", 404);
  }

  // ── 6. Load or create conversation (ownership-validated) ──────
  // loadConversation returns null if the conversation doesn't exist
  // OR doesn't belong to this student. This closes IDOR — a student
  // cannot read another student's conversation by guessing the ID.
  let conversation = requestedConversationId
    ? loadConversation(requestedConversationId, g.student.id)
    : null;
  let isNewConversation = false;
  if (!conversation) {
    conversation = createConversation(g.student.id);
    isNewConversation = true;
  }

  // If the client requested a specific conversationId but it wasn't
  // found (or didn't belong to them), we create a new one. This is
  // not an error — it's a fresh start. The new conversationId is
  // sent to the client via the SSE stream.

  // Persist the user's message
  appendMessage(conversation.id, g.student.id, {
    role: "user",
    content: userMessage,
    createdAt: Date.now(),
  });

  // ── 7. Build history for the LLM ──────────────────────────────
  const history = conversation.messages.slice(-20).map((m) => ({
    role: m.role,
    content: m.content,
    ...(m.toolCalls
      ? {
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.name, arguments: tc.args },
          })),
        }
      : {}),
    ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
    ...(m.role === "tool" ? { name: "tool" } : {}),
  }));

  // ── 8. Log the request (no PII, no message content) ───────────
  logAiRequest({
    requestId,
    event: "ai.chat.request",
    studentId: g.student.id,
    method: "POST",
    path: "/api/student/assistant/chat",
    timestamp: new Date().toISOString(),
    messageLength: userMessage.length,
    messagePreview: previewMessage(userMessage),
    conversationId: conversation.id,
  });

  // ── 9. Set up SSE stream ──────────────────────────────────────
  const encoder = new TextEncoder();
  const abortController = new AbortController();

  // Abort if the client disconnects
  req.signal.addEventListener("abort", () => abortController.abort());

  const toolCalls: string[] = [];
  let inputTokens = 0;
  let outputTokens = 0;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(event: unknown) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      // Send the conversation ID first so the client can track it
      send({
        type: "conversation",
        conversationId: conversation!.id,
        isNew: isNewConversation,
      });

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
            role: "STUDENT",
            requestId: conversation!.id,
          },
          provider,
          registry,
          signal: abortController.signal,
        })) {
          // Send the event to the client, but sanitize it first
          // (don't expose provider-specific details)
          if (event.type === "text") {
            send({ type: "text", text: event.text });
            assistantText += event.text;
          } else if (event.type === "tool_call") {
            // Only send the tool name — not the args (which might
            // contain user-supplied data the LLM tried to inject)
            send({ type: "tool_call", toolName: event.toolName });
            if (event.toolName) toolCalls.push(event.toolName);
          } else if (event.type === "tool_result") {
            // Only send success/fail — not the full result (which
            // might contain student data the client shouldn't see
            // in the chat stream)
            send({
              type: "tool_result",
              toolName: event.toolName,
              success: event.toolResult !== null && typeof event.toolResult === "object" && !("error" in (event.toolResult as object)),
            });
          } else if (event.type === "done") {
            if (event.usage) {
              inputTokens = event.usage.inputTokens;
              outputTokens = event.usage.outputTokens;
            }
            send({ type: "done", usage: event.usage });
            break;
          } else if (event.type === "error") {
            send({ type: "error", error: event.error });
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

        // Log successful completion
        logAiRequest({
          requestId,
          event: "ai.chat.done",
          studentId: g.student.id,
          method: "POST",
          path: "/api/student/assistant/chat",
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          conversationId: conversation!.id,
          statusCode: 200,
          inputTokens,
          outputTokens,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        });
      } catch (err) {
        send({
          type: "error",
          error: {
            code: "INTERNAL",
            message: "An unexpected error occurred. Please try again.",
          },
        });

        logAiRequest({
          requestId,
          event: "ai.chat.error",
          studentId: g.student.id,
          method: "POST",
          path: "/api/student/assistant/chat",
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          conversationId: conversation!.id,
          statusCode: 500,
          errorCode: "INTERNAL",
          errorMessage: err instanceof Error ? err.message : "unknown",
        });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
    cancel() {
      abortController.abort();
      logAiRequest({
        requestId,
        event: "ai.chat.cancelled",
        studentId: g.student.id,
        method: "POST",
        path: "/api/student/assistant/chat",
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        conversationId: conversation!.id,
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable Nginx buffering
      "X-Request-Id": requestId,
    },
  });
}
