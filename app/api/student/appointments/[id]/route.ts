import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentAppointmentService } from "@/lib/services/student-appointments";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/student/appointments/[id]
 *
 * Returns the full detail of one appointment. Ownership verified:
 * scoped by `studentId` from the session. Foreign `id` → 404
 * (NOT_FOUND, never 403).
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const { id } = await params;
    const appointment = await studentAppointmentService.getById(g.student.id, id);
    if (!appointment) {
      return fail("NOT_FOUND", "Appointment not found", 404);
    }
    return ok({ appointment });
  } catch (err) {
    return handleApiError(err);
  }
}
