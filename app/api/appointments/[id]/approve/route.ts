import { NextRequest } from "next/server";
import { ok, handleApiError, fail, notFound } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/services/audit";
import { notifications } from "@/lib/services/notification";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const approveSchema = z.object({
  scheduledAt: z.string().datetime().optional(),
  durationMins: z.number().int().min(5).max(480).optional(),
  location: z.string().trim().max(200).optional(),
  meetingMethod: z.enum(["IN_PERSON", "VIDEO_CALL", "PHONE_CALL"]).optional(),
  meetingLink: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
});

/**
 * POST /api/appointments/[id]/approve
 *
 * Approve a REQUESTED appointment → SCHEDULED. Admin/counselor can
 * optionally adjust the scheduled time, meeting method, location, etc.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const { id } = await params;
    const body = approveSchema.parse(await req.json().catch(() => ({})));

    const appt = await prisma.appointment.findFirst({ where: { id } });
    if (!appt) throw notFound("Appointment");
    if (appt.status !== "REQUESTED") {
      return fail("CONFLICT", `Cannot approve an appointment in ${appt.status} status`, 409);
    }

    const updateData: Record<string, unknown> = { status: "SCHEDULED" };
    if (body.scheduledAt) updateData.scheduledAt = new Date(body.scheduledAt);
    if (body.durationMins) updateData.durationMins = body.durationMins;
    if (body.location !== undefined) updateData.location = body.location;
    if (body.meetingMethod !== undefined) updateData.meetingMethod = body.meetingMethod;
    if (body.meetingLink !== undefined) updateData.meetingLink = body.meetingLink;
    if (body.notes !== undefined) updateData.notes = body.notes;

    const updated = await prisma.appointment.update({
      where: { id },
      data: updateData,
      include: {
        student: { select: { id: true, firstName: true, lastName: true, userId: true } },
        employee: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    await auditLog.record({
      userId: g.user.id,
      action: "appointment.approved",
      entity: "Appointment",
      entityId: id,
      oldValue: { status: "REQUESTED" },
      newValue: { status: "SCHEDULED", ...updateData },
    });

    // Notify student
    await notifications.push({
      userId: updated.student.userId,
      type: "APPOINTMENT_CONFIRMED",
      title: "Appointment approved",
      message: `Your appointment request "${appt.purpose}" has been approved and scheduled. Check the Appointments page for details.`,
      link: "/student/appointments",
    });

    return ok({ data: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
