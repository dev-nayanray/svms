import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentNotificationService, type NotificationCategory } from "@/lib/services/student-notifications";

export const dynamic = "force-dynamic";

/**
 * GET /api/student/notifications?category=<category>
 *
 * Returns the caller's notifications with optional category filter.
 * Categories: all, unread, application, documents, visa, payments,
 * messages, tasks. Scoped by `userId` from the session.
 *
 * Each notification includes: type, typeLabel, icon name, title,
 * message, link (for navigation), readAt, isRead flag, category,
 * and createdAt.
 *
 * Also returns unreadCount (total across all categories — for the
 * badge) and totalCount.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const sp = req.nextUrl.searchParams;
    const category = (sp.get("category") ?? "all") as NotificationCategory;
    const result = await studentNotificationService.list(g.userId, category);
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
