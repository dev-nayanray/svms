import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentTaskService } from "@/lib/services/student-tasks";
import type { TaskView } from "@/lib/constants/tasks";

export const dynamic = "force-dynamic";

/**
 * GET /api/student/tasks
 *
 * Returns tasks assigned to the caller (scoped by `assignedToId =
 * session.user.id`). Supports the 5 views via `?view=`:
 *  - all (default): all tasks
 *  - today: dueDate within today
 *  - upcoming: dueDate strictly after today
 *  - overdue: dueDate in the past AND status is open
 *  - completed: status = COMPLETED
 *
 * Optional `?status=` filter narrows by status (TODO, IN_PROGRESS,
 * COMPLETED, CANCELLED).
 *
 * Each task is enriched with an `overdue` boolean flag so the UI can
 * highlight without recomputing. Internal fields (`deletedAt`,
 * `deletedBy`, `assignedToId`) are stripped.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const sp = req.nextUrl.searchParams;
    const view = (sp.get("view") ?? "all") as TaskView;
    const status = sp.get("status") ?? undefined;

    const tasks = await studentTaskService.list(g.userId, {
      view: view as TaskView,
      status: status ?? undefined,
    });
    return ok({ tasks });
  } catch (err) {
    return handleApiError(err);
  }
}
