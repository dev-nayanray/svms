import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentApplicationService } from "@/lib/services/student-application";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/student/application/[id]
 *
 * Returns the full student-safe detail view of one application.
 * Ownership is verified server-side: the query is scoped by the
 * session-resolved studentId, so a foreign application id returns
 * 404 (NOT_FOUND) — never 403, so the existence of another student's
 * application is never confirmed.
 *
 * The returned shape excludes:
 *  - internal/employee notes (only `visibility: STUDENT` notes are
 *    loaded from the DB, so they never reach this code path)
 *  - internal document review notes (only surfaced when status is
 *    REJECTED so the student knows why)
 *  - internal payment transactionReference details
 *  - internal visa notes field
 *  - audit-log details, internal employee commission/cost data
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const { id } = await params;
    const view = await studentApplicationService.getById(g.student.id, id, g.userId);
    if (!view) {
      return fail("NOT_FOUND", "Application not found", 404);
    }
    return ok({ application: view });
  } catch (err) {
    return handleApiError(err);
  }
}
