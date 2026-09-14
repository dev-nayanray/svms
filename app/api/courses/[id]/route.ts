import { NextRequest } from "next/server";
import { ok, handleApiError, notFound, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { courseUpdateSchema } from "@/lib/validations";
import { auditLog } from "@/lib/services/audit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Admin course detail endpoint. Returns the full payload needed for the
 * detail page's tabbed sections:
 *  - course core fields (incl. university + country)
 *  - active intakes (with application counts)
 *  - active applications (latest 25, with student joins)
 *  - audit activity timeline (latest 30 events for this course)
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("courses.read");
    if (g.error) return g.error;
    const { id } = await params;

    const course = await prisma.course.findFirst({
      where: { id },
      include: {
        university: {
          select: {
            id: true,
            name: true,
            logo: true,
            country: { select: { id: true, name: true, flag: true, currency: true } },
          },
        },
        intakes: {
          where: { deletedAt: null },
          orderBy: [{ year: "asc" }, { month: "asc" }],
          include: {
            _count: { select: { applications: { where: { deletedAt: null } } } },
          },
        },
        _count: {
          select: {
            intakes: { where: { deletedAt: null, status: "ACTIVE" } },
            applications: { where: { deletedAt: null, status: "ACTIVE" } },
          },
        },
      },
    });
    if (!course) throw notFound("Course");

    // Active applications targeting this course (latest 25).
    const applications = await prisma.application.findMany({
      where: { courseId: id, deletedAt: null, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, studentId: true },
        },
      },
    });

    // Activity timeline = audit trail for this course.
    const activities = await prisma.auditLog.findMany({
      where: { entity: "Course", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    return ok({ ...course, applications, activities });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("courses.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const body = courseUpdateSchema.parse(await req.json());
    const { archived, ...changes } = body;

    const course = await prisma.course.findFirst({ where: { id, deletedAt: null } });
    if (!course) throw notFound("Course");

    // Archive / unarchive path — separate from field updates so the audit
    // trail records the lifecycle event distinctly. Archiving a course
    // with active applications is blocked (deactivate instead).
    if (archived !== undefined) {
      if (archived && !course.deletedAt) {
        const inUse = await prisma.application.count({
          where: { courseId: id, deletedAt: null, status: "ACTIVE" },
        });
        if (inUse > 0) {
          return fail(
            "CONFLICT",
            `Cannot archive: ${inUse} active application(s) reference this course. Deactivate it instead.`,
            409,
          );
        }
      }
      const updated = await prisma.course.update({
        where: { id },
        data: {
          deletedAt: archived ? new Date() : null,
          deletedBy: archived ? g.user.id : null,
        },
      });
      await auditLog.record({
        userId: g.user.id,
        action: archived ? "course.archived" : "course.unarchived",
        entity: "Course",
        entityId: id,
        oldValue: { name: course.name, deletedAt: course.deletedAt },
        newValue: { deletedAt: updated.deletedAt },
      });
      return ok({ archived });
    }

    // If universityId is being changed, validate the new university exists.
    if (changes.universityId && changes.universityId !== course.universityId) {
      const uni = await prisma.university.findFirst({
        where: { id: changes.universityId, deletedAt: null },
      });
      if (!uni) return fail("NOT_FOUND", "University not found", 404);
    }

    const updated = await prisma.course.update({
      where: { id },
      data: changes,
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
        duration: course.duration,
        tuitionFee: course.tuitionFee,
        currency: course.currency,
        applicationFee: course.applicationFee,
        ieltsRequirement: course.ieltsRequirement,
        toeflRequirement: course.toeflRequirement,
        pteRequirement: course.pteRequirement,
        academicRequirements: course.academicRequirements,
        applicationDeadline: course.applicationDeadline,
        status: course.status,
      },
      newValue: {
        name: changes.name,
        degreeLevel: changes.degreeLevel,
        universityId: changes.universityId,
        duration: changes.duration,
        tuitionFee: changes.tuitionFee,
        currency: changes.currency,
        applicationFee: changes.applicationFee,
        ieltsRequirement: changes.ieltsRequirement,
        toeflRequirement: changes.toeflRequirement,
        pteRequirement: changes.pteRequirement,
        academicRequirements: changes.academicRequirements,
        applicationDeadline: changes.applicationDeadline,
        status: changes.status,
      },
    });
    // Status changes emit a dedicated audit entry so the timeline can
    // surface activate/deactivate events distinctly from generic edits.
    if (changes.status && changes.status !== course.status) {
      await auditLog.record({
        userId: g.user.id,
        action: "course.status_changed",
        entity: "Course",
        entityId: id,
        oldValue: { status: course.status },
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
 * course data participates in historical applications and audit logs.
 *
 * Archive is blocked when active applications reference the course —
 * the admin must deactivate it first (status: INACTIVE).
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
        `Cannot archive: ${inUse} active application(s) reference this course. Deactivate it instead.`,
        409,
      );
    }

    await prisma.course.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: g.user.id },
    });
    await auditLog.record({
      userId: g.user.id,
      action: "course.archived",
      entity: "Course",
      entityId: id,
      oldValue: { name: course.name, universityId: course.universityId },
    });
    return ok({ archived: true });
  } catch (err) {
    return handleApiError(err);
  }
}
