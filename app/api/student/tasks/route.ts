import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentTaskService } from "@/lib/services/student-tasks";
import type { TaskView } from "@/lib/constants/tasks";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title too long"),
  description: z
    .string()
    .trim()
    .max(2000, "Description too long")
    .optional(),
  priority: z
    .enum(["LOW", "MEDIUM", "HIGH", "URGENT"])
    .optional(),
  /** ISO datetime string — must be in the future. */
  dueDate: z
    .string()
    .datetime({ message: "Due date must be a valid ISO datetime" })
    .optional(),
});

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

    const tasks = await studentTaskService.list(g.student.id, {
      view: view as TaskView,
      status: status ?? undefined,
    });
    return ok({ tasks });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * POST /api/student/tasks
 *
 * Create a personal (self-assigned) task. Students can track their
 * own to-dos alongside counselor-assigned tasks — useful for
 * "remember to gather bank statements" or "research housing in Munich".
 *
 * Body:
 *  {
 *    title:       "Gather bank statements" (required, 3-200 chars),
 *    description: "Last 6 months, from primary account" (optional, max 2000),
 *    priority:    "HIGH" | "MEDIUM" | "LOW" | "URGENT" (optional, default MEDIUM),
 *    dueDate:     "2026-09-20T14:30:00.000Z" (optional ISO datetime, must be future)
 *  }
 *
 * The new task is:
 *  - assignedToId = caller's userId (self-assigned — the student owns it)
 *  - studentId    = caller's studentId (for the dashboard aggregate)
 *  - createdById  = caller's userId
 *  - status       = "TODO" (always starts in TODO state)
 *  - applicationId = null (student-created tasks aren't tied to applications)
 *
 * Returns 422 VALIDATION_ERROR if:
 *  - Title is < 3 chars or > 200 chars
 *  - dueDate is in the past (with 2min clock-drift tolerance)
 *  - priority is not in the allowed enum
 *
 * Returns 409 CONFLICT if:
 *  - The student already has 50 active personal tasks (flood guard)
 *
 * No notification is sent (the student created the task themselves —
 * they don't need a notification about their own action).
 */
export async function POST(req: NextRequest) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const body = createSchema.parse(await req.json().catch(() => ({})));

    const task = await studentTaskService.create(
      g.student.id,
      {
        title: body.title,
        description: body.description ?? null,
        priority: body.priority,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      },
      g.userId,
    );
    return ok({ task }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
