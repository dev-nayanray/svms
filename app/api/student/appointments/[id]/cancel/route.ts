import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentAppointmentService } from "@/lib/services/student-appointments";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const cancelSchema = z.object({
  cancelReason: z.string().max(500, "Reason too long").optional(),
});

/**
 * POST /api/student/appointments/[id]/cancel
 *
 * Cancel a SCHEDULED or CONFIRMED appointment → CANCELLED. Students
 * can only cancel non-terminal appointments (not COMPLETED, CANCELLED,
 * or NO_SHOW). Ownership verified. Audit-logged. Counselor notified.
 *
 * Body: { cancelReason?: string }
 *
 * Returns 409 CONFLICT if the appointment is in a terminal status.
 * Returns 404 if the appointment doesn't belong to the caller (IDOR-safe).
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const { id } = await params;
    const body = cancelSchema.parse(await req.json().catch(() => ({})));
    const appointment = await studentAppointmentService.cancel(
      g.student.id,
      id,
      body.cancelReason,
      g.userId,
    );
    return ok({ appointment });
  } catch (err) {
    return handleApiError(err);
  }
}
