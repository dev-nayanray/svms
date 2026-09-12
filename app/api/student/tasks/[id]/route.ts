import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentTaskService } from "@/lib/services/student-tasks";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/student/tasks/[id]
 *
 * Students can ONLY change the status of their own tasks, and only to
 * IN_PROGRESS or COMPLETED. They cannot:
 *  - Set status to TODO (revert) or CANCELLED (cancel)
 *  - Change title, description, priority, dueDate
 *  - Change assignedToId, studentId, applicationId
 *  - Create or delete tasks
 *
 * Body: { status: "IN_PROGRESS" | "COMPLETED" }
 *
 * Ownership is verified server-side: the task's `assignedToId` must
 * match the caller's `userId` from the session. Foreign/missing tasks
 * return 404 (NOT_FOUND, never 403 — the existence of another user's
 * task is never confirmed).
 *
 * Setting COMPLETED automatically sets `completedAt`; reverting to
 * IN_PROGRESS clears it. The task creator is notified when the student
 * completes the task. The status change is audit-logged.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const { id } = await params;
    const body = await req.json();

    // Only `status` is accepted — any other field is rejected.
    if (!body || typeof body.status !== "string") {
      return fail("VALIDATION_ERROR", "Field 'status' is required", 422, {
        fields: { status: "Required — must be IN_PROGRESS or COMPLETED" },
      });
    }

    // Reject any field other than `status` — defense in depth.
    const allowedKeys = ["status"];
    const extraKeys = Object.keys(body).filter((k) => !allowedKeys.includes(k));
    if (extraKeys.length > 0) {
      return fail(
        "VALIDATION_ERROR",
        `Students can only update 'status'. Unknown fields: ${extraKeys.join(", ")}`,
        422,
        { fields: Object.fromEntries(extraKeys.map((k) => [k, "Not editable by students"])) },
      );
    }

    const task = await studentTaskService.updateStatus(g.userId, id, body.status);
    return ok({ task });
  } catch (err) {
    return handleApiError(err);
  }
}
