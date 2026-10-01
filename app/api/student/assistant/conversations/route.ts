/**
 * GET /api/student/assistant/conversations
 * ==========================================
 *
 * Lists the authenticated student's AI conversations.
 *
 * SECURITY:
 *  - studentApiGuard() derives studentId from the session.
 *  - The conversation manager only returns conversations belonging
 *    to that studentId.
 */

import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { listConversations } from "@/lib/ai/conversation";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const conversations = listConversations(g.student.id);
    return ok({ conversations });
  } catch (err) {
    return handleApiError(err);
  }
}
