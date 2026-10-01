/**
 * GET /api/student/assistant/conversations
 * ==========================================
 *
 * Lists the authenticated student's AI conversations.
 *
 * ROUTING CONVENTION:
 *   Follows the existing /api/student/* pattern. The conversation
 *   list is student-scoped — the studentId is derived from the
 *   NextAuth session, never from query parameters.
 *
 * SECURITY:
 *  1. studentApiGuard() derives studentId from the session.
 *  2. listConversations() only returns conversations where
 *     studentId matches — cross-student access is impossible.
 *  3. The list view does NOT include message content (only titles +
 *     timestamps) to keep the response small + avoid exposing
 *     chat history in a list endpoint.
 *
 * RESPONSE (frontend-friendly):
 *   {
 *     "success": true,
 *     "data": {
 *       "conversations": [
 *         {
 *           "id": "conv-...",
 *           "title": "What is my GPA?",
 *           "createdAt": "2026-10-01T...",
 *           "updatedAt": "2026-10-01T...",
 *           "messageCount": 4
 *         }
 *       ]
 *     }
 *   }
 */

import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { listConversations } from "@/lib/ai/conversation";
import { logAiRequest, generateRequestId } from "@/lib/ai/request-logger";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  try {
    // ── 1. Authentication + student role validation ────────────
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    // ── 2. List the student's own conversations ─────────────────
    // listConversations is scoped by studentId — a student can only
    // see their own conversations.
    const conversations = listConversations(g.student.id);

    // ── 3. Log the request ──────────────────────────────────────
    logAiRequest({
      requestId,
      event: "ai.conversations.list",
      studentId: g.student.id,
      method: "GET",
      path: "/api/student/assistant/conversations",
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      statusCode: 200,
    });

    // ── 4. Return frontend-friendly response ────────────────────
    // Map to a clean shape — no internal fields, ISO timestamps.
    return ok({
      conversations: conversations.map((c) => ({
        id: c.id,
        title: c.title,
        createdAt: new Date(c.createdAt).toISOString(),
        updatedAt: new Date(c.updatedAt).toISOString(),
        messageCount: 0, // listConversations returns messages: []
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
