/**
 * GET /api/student/assistant/conversations/[id]
 * DELETE /api/student/assistant/conversations/[id]
 * =================================================
 *
 * Get or delete a specific AI conversation.
 *
 * ROUTING CONVENTION:
 *   Follows the existing /api/student/* pattern with [id] dynamic
 *   segment (same as /api/student/documents/[id], /api/student/tasks/[id],
 *   etc.).
 *
 * SECURITY:
 *  1. studentApiGuard() derives studentId from the NextAuth session.
 *  2. loadConversation() + deleteConversation() both verify the
 *     conversation belongs to this studentId before proceeding.
 *     Returns 404 if not found OR not owned — so a student cannot
 *     tell whether a given ID exists for someone else (IDOR-safe).
 *  3. The studentId is NEVER taken from the URL or body — always
 *     from the session.
 *
 * GET RESPONSE (frontend-friendly):
 *   {
 *     "success": true,
 *     "data": {
 *       "conversation": {
 *         "id": "conv-...",
 *         "title": "What is my GPA?",
 *         "createdAt": "2026-10-01T...",
 *         "updatedAt": "2026-10-01T...",
 *         "messages": [
 *           { "role": "user", "content": "...", "createdAt": "..." },
 *           { "role": "assistant", "content": "...", "createdAt": "..." }
 *         ]
 *       }
 *     }
 *   }
 *
 * DELETE RESPONSE:
 *   { "success": true, "data": { "deleted": true } }
 */

import { NextRequest } from "next/server";
import { ok, fail, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { loadConversation, deleteConversation } from "@/lib/ai/conversation";
import { logAiRequest, generateRequestId } from "@/lib/ai/request-logger";

export const dynamic = "force-dynamic";

// ── GET: Load a conversation with messages ───────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    // ── 1. Authentication + student role validation ────────────
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const { id: conversationId } = await params;

    // ── 2. Parse pagination params (for message pagination) ─────
    const sp = req.nextUrl.searchParams;
    const messageLimit = sp.get("limit") ? Math.max(1, parseInt(sp.get("limit")!, 10)) : undefined;
    const messageOffset = sp.get("offset") ? Math.max(0, parseInt(sp.get("offset")!, 10)) : undefined;

    // ── 3. Load the conversation (ownership-validated) ──────────
    // loadConversation returns null if the conversation doesn't exist
    // OR doesn't belong to this student. Either way → 404.
    const conversation = loadConversation(conversationId, g.student.id, {
      limit: messageLimit,
      offset: messageOffset,
    });

    if (!conversation) {
      logAiRequest({
        requestId,
        event: "ai.conversation.get.not_found",
        studentId: g.student.id,
        method: "GET",
        path: `/api/student/assistant/conversations/${conversationId}`,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        statusCode: 404,
      });
      return fail("NOT_FOUND", "Conversation not found", 404);
    }

    // ── 3. Log the request ──────────────────────────────────────
    logAiRequest({
      requestId,
      event: "ai.conversation.get",
      studentId: g.student.id,
      method: "GET",
      path: `/api/student/assistant/conversations/${conversationId}`,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      statusCode: 200,
      conversationId,
    });

    // ── 4. Return frontend-friendly response ────────────────────
    return ok({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        createdAt: new Date(conversation.createdAt).toISOString(),
        updatedAt: new Date(conversation.updatedAt).toISOString(),
        messages: conversation.messages.map((m) => ({
          role: m.role,
          content: m.content,
          createdAt: new Date(m.createdAt).toISOString(),
        })),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// ── DELETE: Delete a conversation ────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    // ── 1. Authentication + student role validation ────────────
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const { id: conversationId } = await params;

    // ── 2. Delete the conversation (ownership-validated) ────────
    // deleteConversation returns false if the conversation doesn't
    // exist OR doesn't belong to this student. Either way → 404.
    const deleted = deleteConversation(conversationId, g.student.id);

    if (!deleted) {
      logAiRequest({
        requestId,
        event: "ai.conversation.delete.not_found",
        studentId: g.student.id,
        method: "DELETE",
        path: `/api/student/assistant/conversations/${conversationId}`,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        statusCode: 404,
      });
      return fail("NOT_FOUND", "Conversation not found", 404);
    }

    // ── 3. Log the request ──────────────────────────────────────
    logAiRequest({
      requestId,
      event: "ai.conversation.delete",
      studentId: g.student.id,
      method: "DELETE",
      path: `/api/student/assistant/conversations/${conversationId}`,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      statusCode: 200,
      conversationId,
    });

    // ── 4. Return frontend-friendly response ────────────────────
    return ok({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
