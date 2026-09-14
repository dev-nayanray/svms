import { NextRequest } from "next/server";
import { ok, handleApiError, notFound } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/services/audit";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  universityId: z.string().optional(),
  courseId: z.string().optional(),
  intakeId: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  status: z.enum(["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]).optional(),
  archived: z.boolean().optional(),
});

/** General edit: university/course/intake/priority/status + archive. Audited. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("applications.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const body = updateSchema.parse(await req.json());
    const { archived, ...changes } = body;

    const application = await prisma.application.findFirst({ where: { id, deletedAt: null } });
    if (!application) throw notFound("Application");

    if (archived !== undefined) {
      await prisma.application.update({
        where: { id },
        data: { deletedAt: archived ? new Date() : null, deletedBy: archived ? g.user.id : null },
      });
      await auditLog.record({
        userId: g.user.id,
        action: archived ? "application.archived" : "application.unarchived",
        entity: "Application",
        entityId: id,
      });
      return ok({ archived });
    }

    const updated = await prisma.application.update({
      where: { id },
      data: changes,
    });
    const tracked = ["universityId", "courseId", "intakeId", "priority", "status"] as const;
    await auditLog.record({
      userId: g.user.id,
      action: "application.updated",
      entity: "Application",
      entityId: id,
      oldValue: Object.fromEntries(tracked.map((k) => [k, (application as Record<string, unknown>)[k]])),
      newValue: Object.fromEntries(tracked.map((k) => [k, (changes as Record<string, unknown>)[k]])),
    });
    return ok(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

/** Soft-delete (archive). */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("applications.delete");
    if (g.error) return g.error;
    const { id } = await params;
    const application = await prisma.application.findFirst({ where: { id, deletedAt: null } });
    if (!application) throw notFound("Application");
    await prisma.application.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: g.user.id },
    });
    await auditLog.record({
      userId: g.user.id,
      action: "application.archived",
      entity: "Application",
      entityId: id,
    });
    return ok({ archived: true });
  } catch (err) {
    return handleApiError(err);
  }
}
