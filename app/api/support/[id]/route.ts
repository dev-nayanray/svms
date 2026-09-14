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
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  response: z.string().trim().max(5000).optional(),
  category: z.string().optional(),
});

/**
 * GET /api/support/[id]
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const { id } = await params;

    const row = await prisma.supportRequest.findFirst({
      where: { id },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, studentId: true, email: true, phone: true, userId: true },
        },
      },
    });
    if (!row) throw notFound("Support request");
    return ok({ data: row });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * PATCH /api/support/[id]
 *
 * Update a support request — status, priority, category, response.
 * When a response is set, respondedAt + respondedById are auto-filled.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const { id } = await params;
    const body = patchSchema.parse(await req.json().catch(() => ({})));

    const existing = await prisma.supportRequest.findFirst({ where: { id } });
    if (!existing) throw notFound("Support request");

    const updateData: Record<string, unknown> = {};
    if (body.status) updateData.status = body.status;
    if (body.priority) updateData.priority = body.priority;
    if (body.category) updateData.category = body.category;
    if (body.response !== undefined) {
      updateData.response = body.response;
      updateData.respondedAt = new Date();
      updateData.respondedById = g.user.id;
    }

    const updated = await prisma.supportRequest.update({
      where: { id },
      data: updateData,
      include: {
        student: { select: { id: true, firstName: true, lastName: true, userId: true } },
      },
    });

    await auditLog.record({
      userId: g.user.id,
      action: "support_request.updated",
      entity: "SupportRequest",
      entityId: id,
      oldValue: { status: existing.status, priority: existing.priority },
      newValue: updateData,
    });

    // Notify student of response or status change
    if (body.response || (body.status && body.status !== existing.status)) {
      const msg = body.response
        ? `Your support request "${existing.subject}" has a new response.`
        : `Your support request "${existing.subject}" status is now ${body.status}.`;
      await notifications.push({
        userId: updated.student.userId,
        type: "SUPPORT_UPDATED",
        title: "Support request updated",
        message: msg,
        link: "/student/support",
      });
    }

    return ok({ data: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
