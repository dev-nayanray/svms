import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentVisaService } from "@/lib/services/student-visa";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/student/visa/[id]
 *
 * Returns the full student-safe detail view of one visa application:
 * the visa record (stage, visaType, dates), the linked application
 * (country, university, course), the visa pipeline markers, and the
 * timeline (ApplicationStatusHistory entries for the linked
 * application, newest-first).
 *
 * Ownership is verified server-side: the query joins through
 * `application.studentId` from the session. A foreign `id` returns
 * null → 404 (NOT_FOUND, never 403 — the existence of another
 * student's visa is never confirmed).
 *
 * The `notes` field on VisaApplication is NEVER exposed — it's
 * internal admin/counselor commentary. Students cannot modify visa
 * status; this route is GET-only.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const { id } = await params;
    const visa = await studentVisaService.getById(g.student.id, id);
    if (!visa) {
      return fail("NOT_FOUND", "Visa application not found", 404);
    }
    return ok({ visa });
  } catch (err) {
    return handleApiError(err);
  }
}
