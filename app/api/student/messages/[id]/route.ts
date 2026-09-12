import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentMessageService } from "@/lib/services/student-messages";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/student/messages/[id]
 *
 * Returns a conversation with all messages. Ownership is verified:
 * the query is scoped by `studentId` from the session. A foreign
 * `conversationId` returns null → 404 (NOT_FOUND, never 403 — the
 * existence of another student's conversation is never confirmed).
 *
 * On access, messages from the counselor are automatically marked
 * as read (the student has seen them by opening the chat).
 *
 * The UI polls this endpoint every 5 seconds when the chat is active
 * for near-real-time message delivery without WebSocket.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const { id } = await params;
    const conversation = await studentMessageService.getById(g.student.id, id);
    if (!conversation) {
      return fail("NOT_FOUND", "Conversation not found", 404);
    }
    return ok({ conversation });
  } catch (err) {
    return handleApiError(err);
  }
}
