import { NextRequest } from "next/server";
import { ok, handleApiError, notFound, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { courseSchema } from "@/lib/validations";
import { auditLog } from "@/lib/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("courses.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const body = courseSchema.partial().parse(await req.json());
    const course = await prisma.course.findFirst({ where: { id, deletedAt: null } });
    if (!course) throw notFound("Course");

    // If universityId is being changed, validate the new university exists.
    if (body.universityId && body.universityId !== course.universityId) {
      const uni = await prisma.university.findFirst({
        where: { id: body.universityId, deletedAt: null },
      });
      if (!uni) return fail("NOT_FOUND", "University not found", 404);
    }

    const updated = await prisma.course.update({
      where: { id },
      data: body,
    });
    await auditLog.record({
      userId: g.user.id,
      action: "course.updated",
      entity: "Course",
      entityId: id,
      oldValue: {
        name: course.name,
        degreeLevel: course.degreeLevel,
        universityId: course.universityId,
        tuitionFee: course.tuitionFee,
        status: course.status,
      },
      newValue: {
        name: body.name,
        degreeLevel: body.degreeLevel,
        universityId: body.universityId,
        tuitionFee: body.tuitionFee,
        status: body.status,
      },
    });
    // Status changes emit a dedicated audit entry so the timeline can
    // surface activate/deactivate events distinctly from generic edits.
    if (body.status && body.status !== course.status) {
      await auditLog.record({
        userId: g.user.id,
        action: "course.status_changed",
        entity: "Course",
        entityId: id,
        oldValue: { status: course.status },
        newValue: { status: body.status },
      });
    }
    return ok(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Soft-delete a course. Blocked when active applications reference it —
 * the admin must deactivate the course instead so in-flight applications
 * retain their data.
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("courses.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const course = await prisma.course.findFirst({ where: { id, deletedAt: null } });
    if (!course) throw notFound("Course");

    const inUse = await prisma.application.count({
      where: { courseId: id, deletedAt: null, status: "ACTIVE" },
    });
    if (inUse > 0) {
      return fail(
        "CONFLICT",
        `Cannot delete: ${inUse} active application(s) reference this course. Deactivate it instead.`,
        409,
      );
    }

    await prisma.course.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: g.user.id },
    });
    await auditLog.record({
      userId: g.user.id,
      action: "course.deleted",
      entity: "Course",
      entityId: id,
      oldValue: { name: course.name, universityId: course.universityId },
    });
    return ok({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
