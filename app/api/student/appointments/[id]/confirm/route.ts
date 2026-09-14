import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentAppointmentService } from "@/lib/services/student-appointments";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/student/appointments/[id]/confirm
 *
 * Confirm a SCHEDULED appointment → CONFIRMED. Students can only
 * confirm appointments in SCHEDULED status (not CONFIRMED, COMPLETED,
 * CANCELLED, or NO_SHOW). Ownership verified. Audit-logged.
 * Counselor notified via the Notification system.
 *
 * Returns 409 CONFLICT if the appointment is not in SCHEDULED status.
 * Returns 404 if the appointment doesn't belong to the caller (IDOR-safe).
 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const { id } = await params;
    const appointment = await studentAppointmentService.confirm(g.student.id, id, g.userId);
    return ok({ appointment });
  } catch (err) {
    return handleApiError(err);
  }
}
