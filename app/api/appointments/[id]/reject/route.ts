import { NextRequest } from "next/server";
import { ok, handleApiError, fail, notFound } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/services/audit";
import { notifications } from "@/lib/services/notification";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const rejectSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

/**
 * POST /api/appointments/[id]/reject
 *
 * Reject a REQUESTED appointment → CANCELLED. Student is notified
 * with the reason (if provided).
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const { id } = await params;
    const body = rejectSchema.parse(await req.json().catch(() => ({})));

    const appt = await prisma.appointment.findFirst({ where: { id } });
    if (!appt) throw notFound("Appointment");
    if (appt.status !== "REQUESTED") {
      return fail("CONFLICT", `Cannot reject an appointment in ${appt.status} status`, 409);
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledBy: g.user.id,
        cancelReason: body.reason ?? "Request rejected by counselor",
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, userId: true } },
        employee: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    await auditLog.record({
      userId: g.user.id,
      action: "appointment.rejected",
      entity: "Appointment",
      entityId: id,
      oldValue: { status: "REQUESTED" },
      newValue: { status: "CANCELLED", reason: body.reason },
    });

    // Notify student
    await notifications.push({
      userId: updated.student.userId,
      type: "APPOINTMENT_CANCELLED",
      title: "Appointment request declined",
      message: `Your appointment request "${appt.purpose}" was declined.${body.reason ? ` Reason: ${body.reason}` : ""}`,
      link: "/student/appointments",
    });

    return ok({ data: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
