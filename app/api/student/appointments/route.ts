import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentAppointmentService } from "@/lib/services/student-appointments";

export const dynamic = "force-dynamic";

/**
 * GET /api/student/appointments?filter=<filter>
 *
 * Returns the caller's appointments. Filters:
 *  - all (default): all appointments
 *  - upcoming: SCHEDULED/CONFIRMED with future scheduledAt
 *  - past: COMPLETED/NO_SHOW, or past SCHEDULED/CONFIRMED
 *  - cancelled: CANCELLED
 *
 * Scoped by `studentId` from the session. Internal fields
 * (`employeeId`) stripped. Counselor name + initials included.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const sp = req.nextUrl.searchParams;
    const filter = (sp.get("filter") ?? "all") as "upcoming" | "past" | "cancelled" | "all";

    const appointments = await studentAppointmentService.list(g.student.id, filter);
    return ok({ appointments });
  } catch (err) {
    return handleApiError(err);
  }
}
