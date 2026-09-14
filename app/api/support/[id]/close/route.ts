import { NextRequest } from "next/server";
import { ok, handleApiError, notFound } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/services/audit";
import { notifications } from "@/lib/services/notification";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/support/[id]/close
 *
 * Close a support request (no further action needed). Notifies student.
 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard();
    if (g.error) return g.error;
    const { id } = await params;

    const existing = await prisma.supportRequest.findFirst({ where: { id } });
    if (!existing) throw notFound("Support request");

    const updated = await prisma.supportRequest.update({
      where: { id },
      data: { status: "CLOSED" },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, userId: true } },
      },
    });

    await auditLog.record({
      userId: g.user.id,
      action: "support_request.closed",
      entity: "SupportRequest",
      entityId: id,
      oldValue: { status: existing.status },
      newValue: { status: "CLOSED" },
    });

    // Notify student
    await notifications.push({
      userId: updated.student.userId,
      type: "SUPPORT_CLOSED",
      title: "Support request closed",
      message: `Your support request "${existing.subject}" has been closed.`,
      link: "/student/support",
    });

    return ok({ data: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
