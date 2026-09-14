import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentApplicationService } from "@/lib/services/student-application";

export const dynamic = "force-dynamic";

/**
 * GET /api/student/applications
 *
 * Returns ALL applications owned by the caller. The student record is
 * resolved from the authenticated session — never from a query param
 * or request body. Used by the multi-application selector on
 * /student/application.
 *
 * Each item is a summary shape (no documents/tasks/payments detail) —
 * the per-application detail is fetched separately via
 * /api/student/application/[id].
 */
export async function GET(_req: NextRequest) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const applications = await studentApplicationService.list(g.student.id);
    return ok({ applications });
  } catch (err) {
    return handleApiError(err);
  }
}
