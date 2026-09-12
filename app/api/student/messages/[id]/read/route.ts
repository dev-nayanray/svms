import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentMessageService } from "@/lib/services/student-messages";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/student/messages/[id]/read
 *
 * Mark all messages from the counselor as read in a conversation.
 * The conversation must belong to the caller (ownership verified).
 *
 * Foreign `conversationId` → 404 (NOT_FOUND, never 403).
 *
 * Returns: { updated: true, count: <number of messages marked> }
 */
export async function PATCH(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const { id } = await params;
    const count = await studentMessageService.markRead(g.student.id, id);
    return ok({ updated: true, count });
  } catch (err) {
    return handleApiError(err);
  }
}
