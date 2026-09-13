import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/users/[id]/status — activate, deactivate, or suspend a user.
 *
 * Body: { status: "ACTIVE" | "INACTIVE" | "SUSPENDED" }
 *
 * - ACTIVE: user can log in normally
 * - INACTIVE: user cannot log in (soft disable)
 * - SUSPENDED: user cannot log in (hard disable, shown in UI)
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard("employees.update");
    if (g.error) return g.error;

    const { id } = await params;
    const { status } = await req.json();

    if (!["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status)) {
      return fail("VALIDATION_ERROR", "Invalid status. Use ACTIVE, INACTIVE, or SUSPENDED.", 422);
    }

    // Prevent self-suspension
    if (id === g.user.id && status !== "ACTIVE") {
      return fail("BAD_REQUEST", "You cannot suspend or deactivate your own account", 400);
    }

    const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return fail("NOT_FOUND", "User not found", 404);

    const updated = await prisma.user.update({
      where: { id },
      data: { status },
    });

    const { ipAddress, userAgent } = auditLog.fromRequest(req);
    await auditLog.record({
      userId: g.user.id,
      action: `user.status_${status.toLowerCase()}`,
      entity: "User",
      entityId: id,
      oldValue: { status: existing.status },
      newValue: { status },
      ipAddress,
      userAgent,
    });

    return ok({ id: updated.id, status: updated.status });
  } catch (err) {
    return handleApiError(err);
  }
}
