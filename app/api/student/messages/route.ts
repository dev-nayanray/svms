import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentMessageService } from "@/lib/services/student-messages";

export const dynamic = "force-dynamic";

/**
 * GET /api/student/messages
 *
 * Returns the caller's conversations (inbox). Each conversation
 * includes: counselor name + initials, latest message preview,
 * timestamp, and unread count. Scoped by `studentId` from the session.
 *
 * The UI polls this endpoint every 30 seconds (TanStack Query
 * refetchInterval) for unread-count updates without WebSocket
 * infrastructure.
 */
export async function GET(_req: NextRequest) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const conversations = await studentMessageService.list(g.student.id);
    return ok({ conversations });
  } catch (err) {
    return handleApiError(err);
  }
}
