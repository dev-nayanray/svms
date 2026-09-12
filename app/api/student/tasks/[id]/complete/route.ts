import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentTaskService } from "@/lib/services/student-tasks";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/student/tasks/[id]/complete
 *
 * Shortcut endpoint for the checklist UX — the student taps a
 * checkbox and the task is marked as COMPLETED. Equivalent to
 * PATCH /api/student/tasks/[id] with body { status: "COMPLETED" }.
 *
 * Ownership is verified server-side (the task's `assignedToId` must
 * match the caller's `userId`). Foreign/missing tasks return 404
 * (NOT_FOUND, never 403).
 *
 * Sets `completedAt` automatically, audit-logs the change, and
 * notifies the task creator if they're different from the student.
 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const { id } = await params;
    const task = await studentTaskService.complete(g.userId, id);
    return ok({ task });
  } catch (err) {
    return handleApiError(err);
  }
}
