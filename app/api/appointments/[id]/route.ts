import { NextRequest } from "next/server";
import { ok, handleApiError, notFound } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/services/audit";
import { notifications } from "@/lib/services/notification";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  status: z.enum(["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
  scheduledAt: z.string().datetime().optional(),
  durationMins: z.number().int().min(5).max(480).optional(),
  purpose: z.string().trim().min(3).max(200).optional(),
  location: z.string().trim().max(200).optional(),
  meetingMethod: z.enum(["IN_PERSON", "VIDEO_CALL", "PHONE_CALL"]).optional(),
  meetingLink: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
  cancelReason: z.string().trim().max(500).optional(),
});

/**
 * GET /api/appointments/[id]
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const { id } = await params;

    const row = await prisma.appointment.findFirst({
      where: { id },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, studentId: true, email: true, phone: true } },
        employee: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });
    if (!row) throw notFound("Appointment");
    return ok({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * PATCH /api/appointments/[id]
 *
 * Update an appointment — status, scheduled time, meeting details, etc.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const { id } = await params;
    const body = patchSchema.parse(await req.json().catch(() => ({})));

    const existing = await prisma.appointment.findFirst({ where: { id } });
    if (!existing) throw notFound("Appointment");

    const updateData: Record<string, unknown> = {};
    if (body.status) updateData.status = body.status;
    if (body.scheduledAt) updateData.scheduledAt = new Date(body.scheduledAt);
    if (body.durationMins) updateData.durationMins = body.durationMins;
    if (body.purpose) updateData.purpose = body.purpose;
    if (body.location !== undefined) updateData.location = body.location;
    if (body.meetingMethod !== undefined) updateData.meetingMethod = body.meetingMethod;
    if (body.meetingLink !== undefined) updateData.meetingLink = body.meetingLink;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.status === "CANCELLED") {
      updateData.cancelledAt = new Date();
      updateData.cancelledBy = g.user.id;
      if (body.cancelReason) updateData.cancelReason = body.cancelReason;
    }
    if (body.status === "COMPLETED") updateData.completedAt = new Date();

    const updated = await prisma.appointment.update({
      where: { id },
      data: updateData,
      include: {
        student: { select: { id: true, firstName: true, lastName: true, studentId: true, email: true, userId: true } },
        employee: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    await auditLog.record({
      userId: g.user.id,
      action: "appointment.updated",
      entity: "Appointment",
      entityId: id,
      oldValue: { status: existing.status },
      newValue: updateData,
    });

    // Notify student of status changes
    if (body.status && body.status !== existing.status) {
      const studentMsg = body.status === "CANCELLED"
        ? `Your appointment "${existing.purpose}" has been cancelled.`
        : body.status === "COMPLETED"
          ? `Your appointment "${existing.purpose}" is marked as completed.`
          : `Your appointment "${existing.purpose}" status is now ${body.status}.`;
      await notifications.push({
        userId: updated.student.userId,
        type: "APPOINTMENT_UPDATED",
        title: "Appointment updated",
        message: studentMsg,
        link: "/student/appointments",
      });
    }

    return ok({ data: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * DELETE /api/appointments/[id] — soft-delete
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const { id } = await params;

    const existing = await prisma.appointment.findFirst({ where: { id } });
    if (!existing) throw notFound("Appointment");

    await prisma.appointment.delete({ where: { id } });

    await auditLog.record({
      userId: g.user.id,
      action: "appointment.deleted",
      entity: "Appointment",
      entityId: id,
    });

    return ok({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
