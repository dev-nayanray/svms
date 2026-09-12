import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentSupportService } from "@/lib/services/student-support";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/student/support/[id]
 *
 * Returns one support request detail. Ownership verified: scoped by
 * `studentId` from the session. Foreign `id` → 404 (IDOR-safe).
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const { id } = await params;
    const request = await studentSupportService.getById(g.student.id, id);
    if (!request) {
      return fail("NOT_FOUND", "Support request not found", 404);
    }
    return ok({ request });
  } catch (err) {
    return handleApiError(err);
  }
}
