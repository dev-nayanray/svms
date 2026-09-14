import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentNotificationService } from "@/lib/services/student-notifications";

export const dynamic = "force-dynamic";

/**
 * POST /api/student/notifications/read-all
 *
 * Mark ALL unread notifications as read for the caller. Scoped by
 * `userId` from the session. Returns the count of notifications
 * that were marked.
 */
export async function POST(_req: NextRequest) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const count = await studentNotificationService.markAllRead(g.userId);
    return ok({ updated: true, count });
  } catch (err) {
    return handleApiError(err);
  }
}
