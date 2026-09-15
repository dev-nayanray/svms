import { NextRequest } from "next/server";
import { ok, handleApiError, fail, notFound } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { resolveSecurityEvent } from "@/lib/system/logs";
import { auditLog } from "@/lib/services/audit";
import { prisma } from "@/lib/db";
import { z } from "zod";

const resolveSchema = z.object({
  resolution: z.enum(["ACKNOWLEDGED", "RESOLVED"]),
});

/**
 * PATCH /api/admin/system/logs/[id]/resolve
 * Mark a security event as ACKNOWLEDGED or RESOLVED.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const g = await guard("security.manage");
    if (g.error) return g.error;
    const { id } = await ctx.params;

    const exists = await prisma.securityEvent.findUnique({ where: { id } });
    if (!exists) throw notFound("Security event");

    const body = await req.json();
    const parsed = resolveSchema.safeParse(body);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Invalid resolution", 422, {
        fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])),
      });
    }

    const auditCtx = auditLog.fromRequest(req);
    await resolveSecurityEvent(id, g.user.id, parsed.data.resolution);
    await auditLog.record({
      userId: g.user.id,
      action: "security_event.resolve.requested",
      entity: "SecurityEvent",
      entityId: id,
      newValue: parsed.data,
      ...auditCtx,
    });
    return ok({ resolved: true });
  } catch (err) {
    return handleApiError(err);
  }
}
