import { NextRequest } from "next/server";
import { ok, handleApiError, notFound } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/services/audit";
import { notifications } from "@/lib/services/notification";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const respondSchema = z.object({
  response: z.string().trim().min(1, "Response is required").max(5000, "Response too long"),
});

/**
 * POST /api/support/[id]/respond
 *
 * Respond to a support request. Sets status → IN_PROGRESS, records
 * the response, and notifies the student.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const { id } = await params;
    const body = respondSchema.parse(await req.json().catch(() => ({})));

    const existing = await prisma.supportRequest.findFirst({ where: { id } });
    if (!existing) throw notFound("Support request");

    const updated = await prisma.supportRequest.update({
      where: { id },
      data: {
        response: body.response,
        respondedAt: new Date(),
        respondedById: g.user.id,
        status: "IN_PROGRESS",
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, userId: true } },
      },
    });

    await auditLog.record({
      userId: g.user.id,
      action: "support_request.responded",
      entity: "SupportRequest",
      entityId: id,
      newValue: { status: "IN_PROGRESS", hasResponse: true },
    });

    // Notify student
    await notifications.push({
      userId: updated.student.userId,
      type: "SUPPORT_UPDATED",
      title: "Support request updated",
      message: `Your support request "${existing.subject}" has a new response.`,
      link: "/student/support",
    });

    return ok({ data: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
