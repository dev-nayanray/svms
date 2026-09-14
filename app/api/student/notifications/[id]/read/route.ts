import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentNotificationService } from "@/lib/services/student-notifications";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/student/notifications/[id]/read
 *
 * Mark one notification as read. Ownership is verified: the query is
 * scoped by `userId` from the session. A foreign `notificationId` → 404
 * (NOT_FOUND, never 403 — the existence of another user's notification
 * is never confirmed).
 *
 * If the notification is already read, the operation is a no-op.
 */
export async function PATCH(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const { id } = await params;
    try {
      await studentNotificationService.markRead(g.userId, id);
      return ok({ updated: true });
    } catch (err) {
      if (err instanceof Error && err.message.includes("not found")) {
        return fail("NOT_FOUND", "Notification not found", 404);
      }
      throw err;
    }
  } catch (err) {
    return handleApiError(err);
  }
}
