import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import {
  getActiveMaintenance,
  enableMaintenance,
  disableMaintenance,
  updateMaintenanceSettings,
} from "@/lib/system/maintenance";
import { auditLog } from "@/lib/services/audit";
import { z } from "zod";

const enableSchema = z.object({
  message: z.string().min(1).max(500),
  title: z.string().max(200).optional(),
  expectedEndAt: z.string().datetime().optional(),
  allowAdminAccess: z.boolean().default(true),
  showContactButton: z.boolean().default(true),
  contactButtonText: z.string().max(100).default("Contact Support"),
  contactButtonUrl: z.string().max(500).default("/contact"),
  showSocialLinks: z.boolean().default(true),
  scheduledStartAt: z.string().datetime().optional(),
  scheduledEndAt: z.string().datetime().optional(),
});

const updateSchema = enableSchema.partial();

/**
 * GET /api/admin/system/maintenance
 * Returns the active maintenance window status (admin-only).
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
 * Enable maintenance mode with full settings. Audited + revalidated.
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
      ...parsed.data,
      expectedEndAt: parsed.data.expectedEndAt ? new Date(parsed.data.expectedEndAt) : undefined,
      scheduledStartAt: parsed.data.scheduledStartAt ? new Date(parsed.data.scheduledStartAt) : undefined,
      scheduledEndAt: parsed.data.scheduledEndAt ? new Date(parsed.data.scheduledEndAt) : undefined,
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
 * PATCH /api/admin/system/maintenance
 * Update settings on the active maintenance window (title, message, etc.)
 */
export async function PATCH(req: NextRequest) {
  try {
    const g = await guard("maintenance.manage");
    if (g.error) return g.error;
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid maintenance settings", 422, {
        fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])),
      });
    }
    const ctx = auditLog.fromRequest(req);
    const status = await updateMaintenanceSettings(
      {
        ...parsed.data,
        expectedEndAt: parsed.data.expectedEndAt ? new Date(parsed.data.expectedEndAt) : undefined,
        scheduledStartAt: parsed.data.scheduledStartAt ? new Date(parsed.data.scheduledStartAt) : undefined,
        scheduledEndAt: parsed.data.scheduledEndAt ? new Date(parsed.data.scheduledEndAt) : undefined,
      },
      g.user.id,
    );
    return ok(status);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * DELETE /api/admin/system/maintenance
 * Disable maintenance mode (end the active window). Audited + revalidated.
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
