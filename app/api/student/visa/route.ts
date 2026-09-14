import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentVisaService } from "@/lib/services/student-visa";

export const dynamic = "force-dynamic";

/**
 * GET /api/student/visa
 *
 * Returns ALL visa applications for the caller's own applications.
 * The student record is resolved from the authenticated session —
 * never from a query param or request body. The query joins through
 * `application.studentId` so only the caller's own visas are returned.
 *
 * Each item is a summary shape — no `notes` field (internal), no
 * `deletedAt`/`deletedBy` (internal). Students cannot modify visa
 * status; this route is GET-only. Stage changes go through the admin
 * `/api/visa` PATCH endpoint (EMPLOYEE/ADMIN only, `visa.manage`
 * permission).
 */
export async function GET(_req: NextRequest) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const visas = await studentVisaService.list(g.student.id);
    return ok({ visas });
  } catch (err) {
    return handleApiError(err);
  }
}
