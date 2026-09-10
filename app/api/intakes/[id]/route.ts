import { NextRequest } from "next/server";
import { ok, handleApiError, notFound, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { intakeUpdateSchema } from "@/lib/validations";
import { auditLog } from "@/lib/services/audit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Admin intake detail endpoint. Returns the intake with its course +
 * university + country, plus an application count so the admin can see
 * how many applications reference this intake.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("courses.read");
    if (g.error) return g.error;
    const { id } = await params;

    const intake = await prisma.intake.findFirst({
      where: { id },
      include: {
        course: {
          select: {
            id: true,
            name: true,
            degreeLevel: true,
            tuitionFee: true,
            currency: true,
            university: {
              select: {
                id: true,
                name: true,
                country: { select: { id: true, name: true, flag: true } },
              },
            },
          },
        },
        _count: { select: { applications: { where: { deletedAt: null } } } },
      },
    });
    if (!intake) throw notFound("Intake");

    // Activity timeline = audit trail for this intake.
    const activities = await prisma.auditLog.findMany({
      where: { entity: "Intake", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    return ok({ ...intake, activities });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("intakes.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const body = intakeUpdateSchema.parse(await req.json());
    const { archived, ...changes } = body;

    const intake = await prisma.intake.findUnique({ where: { id } });
    if (!intake) throw notFound("Intake");

    // Archive / unarchive path — separate from field updates so the audit
    // trail records the lifecycle event distinctly. Archiving an intake
    // with applications is blocked (deactivate instead).
    if (archived !== undefined) {
      if (archived && !intake.deletedAt) {
        const inUse = await prisma.application.count({
          where: { intakeId: id, deletedAt: null },
        });
        if (inUse > 0) {
          return fail(
            "CONFLICT",
            `Cannot archive: ${inUse} application(s) reference this intake. Deactivate it instead.`,
            409,
          );
        }
      }
      const updated = await prisma.intake.update({
        where: { id },
        data: {
          deletedAt: archived ? new Date() : null,
          deletedBy: archived ? g.user.id : null,
        },
      });
      await auditLog.record({
        userId: g.user.id,
        action: archived ? "intake.archived" : "intake.unarchived",
        entity: "Intake",
        entityId: id,
        oldValue: { name: intake.name, deletedAt: intake.deletedAt },
        newValue: { deletedAt: updated.deletedAt },
      });
      return ok({ archived });
    }

    // If courseId is being changed, validate the new course exists.
    if (changes.courseId && changes.courseId !== intake.courseId) {
      const course = await prisma.course.findFirst({
        where: { id: changes.courseId, deletedAt: null },
      });
      if (!course) return fail("NOT_FOUND", "Course not found", 404);
    }

    const updated = await prisma.intake.update({
      where: { id },
      data: changes,
    });
    await auditLog.record({
      userId: g.user.id,
      action: "intake.updated",
      entity: "Intake",
      entityId: id,
      oldValue: {
        name: intake.name,
        courseId: intake.courseId,
        month: intake.month,
        year: intake.year,
        deadline: intake.deadline,
        status: intake.status,
      },
      newValue: {
        name: changes.name,
        courseId: changes.courseId,
        month: changes.month,
        year: changes.year,
        deadline: changes.deadline,
        status: changes.status,
      },
    });
    // Status changes emit a dedicated audit entry.
    if (changes.status && changes.status !== intake.status) {
      await auditLog.record({
        userId: g.user.id,
        action: "intake.status_changed",
        entity: "Intake",
        entityId: id,
        oldValue: { status: intake.status },
        newValue: { status: changes.status },
      });
    }
    return ok(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Archive (soft delete). Hard delete is intentionally not exposed —
 * intake data participates in historical applications and audit logs.
 *
 * Archive is blocked when applications reference the intake — the admin
 * must deactivate it first (status: INACTIVE).
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("intakes.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const intake = await prisma.intake.findFirst({ where: { id, deletedAt: null } });
    if (!intake) throw notFound("Intake");

    const inUse = await prisma.application.count({
      where: { intakeId: id, deletedAt: null },
    });
    if (inUse > 0) {
      return fail(
        "CONFLICT",
        `Cannot archive: ${inUse} application(s) reference this intake. Deactivate it instead.`,
        409,
      );
    }

    await prisma.intake.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: g.user.id },
    });
    await auditLog.record({
      userId: g.user.id,
      action: "intake.archived",
      entity: "Intake",
      entityId: id,
      oldValue: { name: intake.name, courseId: intake.courseId },
    });
    return ok({ archived: true });
  } catch (err) {
    return handleApiError(err);
  }
}
