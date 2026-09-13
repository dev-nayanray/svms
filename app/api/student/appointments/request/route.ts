import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentAppointmentService } from "@/lib/services/student-appointments";
import { auditLog, fromRequest } from "@/lib/services/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const MEETING_METHODS = ["IN_PERSON", "VIDEO_CALL", "PHONE_CALL"] as const;

const requestSchema = z.object({
  /** ISO datetime string — the student's preferred date+time. */
  preferredAt: z.string().datetime({ message: "Preferred date must be a valid ISO datetime" }),
  /** Free-text purpose — short title for the appointment. */
  purpose: z.string().trim().min(3, "Purpose must be at least 3 characters").max(200, "Purpose too long"),
  /** Optional meeting-method preference (counselor may override). */
  meetingMethod: z.enum(MEETING_METHODS).optional(),
  /** Optional free-text notes. */
  notes: z.string().trim().max(2000, "Notes too long").optional(),
});

/**
 * POST /api/student/appointments/request
 *
 * Student-initiated appointment request. Creates an Appointment with
 * status="REQUESTED" and notifies the student's assigned counselor.
 * The counselor reviews and either approves (→ SCHEDULED, with
 * possibly adjusted time / location) or rejects (→ CANCELLED).
 *
 * Body:
 *  {
 *    preferredAt:  "2026-09-20T14:30:00.000Z" (ISO),
 *    purpose:      "Visa interview prep",
 *    meetingMethod: "VIDEO_CALL" | "PHONE_CALL" | "IN_PERSON" (optional),
 *    notes:        "Bring my IELTS certificate" (optional)
 *  }
 *
 * Returns 409 CONFLICT if:
 *  - The student has no assigned counselor
 *  - The student already has 3 outstanding REQUESTED appointments
 *
 * Returns 422 if preferredAt is in the past or purpose is too short.
 *
 * Returns the new appointment view on success.
 */
export async function POST(req: NextRequest) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const body = requestSchema.parse(await req.json().catch(() => ({})));

    const appointment = await studentAppointmentService.request(
      g.student.id,
      {
        preferredAt: new Date(body.preferredAt),
        purpose: body.purpose,
        meetingMethod: body.meetingMethod ?? null,
        notes: body.notes ?? null,
      },
      g.userId,
    );

    // Audit with request metadata — the service also records its own
    // audit entry, but this one includes IP + user-agent for security
    // tracing. Both records are kept intentionally: the service one
    // captures the data state change, this one captures the request
    // origin. The audit log dedupes by (userId, action, entityId, ts)
    // only on the read side, so two entries are fine.
    const { ipAddress, userAgent } = fromRequest(req);
    if (ipAddress || userAgent) {
      await auditLog.record({
        userId: g.userId,
        action: "appointment.requested.api",
        entity: "Appointment",
        entityId: appointment.id,
        ipAddress,
        userAgent,
      });
    }

    return ok({ appointment });
  } catch (err) {
    return handleApiError(err);
  }
}
