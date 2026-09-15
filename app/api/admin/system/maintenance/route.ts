import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { getActiveMaintenance, enableMaintenance, disableMaintenance } from "@/lib/system/maintenance";
import { auditLog } from "@/lib/services/audit";
import { z } from "zod";

const enableSchema = z.object({
  message: z.string().min(1).max(500),
  expectedEndAt: z.string().datetime().optional(),
  allowAdminAccess: z.boolean().default(true),
});

/**
 * GET /api/admin/system/maintenance
 * Returns the active maintenance window status.
 */
export async function GET(_req: NextRequest) {
  try {
    const g = await guard("maintenance.read");
    if (g.error) return g.error;
    const status = await getActiveMaintenance();
    return ok(status);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * POST /api/admin/system/maintenance
 * Enable maintenance mode. Audited. Allowed fields:
 *   message, expectedEndAt (ISO), allowAdminAccess (default true)
 */
export async function POST(req: NextRequest) {
  try {
    const g = await guard("maintenance.manage");
    if (g.error) return g.error;
    const body = await req.json();
    const parsed = enableSchema.safeParse(body);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid maintenance config", 422, {
        fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])),
      });
    }
    const ctx = auditLog.fromRequest(req);
    const status = await enableMaintenance({
      message: parsed.data.message,
      expectedEndAt: parsed.data.expectedEndAt ? new Date(parsed.data.expectedEndAt) : undefined,
      allowAdminAccess: parsed.data.allowAdminAccess,
      actorId: g.user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
    return ok(status, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * DELETE /api/admin/system/maintenance
 * Disable maintenance mode (end the active window). Audited.
 */
export async function DELETE(req: NextRequest) {
  try {
    const g = await guard("maintenance.manage");
    if (g.error) return g.error;
    const ctx = auditLog.fromRequest(req);
    await disableMaintenance(g.user.id);
    await auditLog.record({
      userId: g.user.id,
      action: "maintenance.disable.requested",
      entity: "MaintenanceWindow",
      entityId: "active",
      ...ctx,
    });
    return ok({ disabled: true });
  } catch (err) {
    return handleApiError(err);
  }
}
