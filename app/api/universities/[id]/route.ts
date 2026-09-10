import { NextRequest } from "next/server";
import { ok, handleApiError, notFound, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { universityUpdateSchema } from "@/lib/validations";
import { auditLog } from "@/lib/services/audit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Admin university detail endpoint. Returns the full payload needed for
 * the detail page's tabbed sections:
 *  - university core fields (incl. country)
 *  - courses (active, with course + intake counts)
 *  - active applications (latest 25, with student + course joins)
 *  - audit activity timeline (latest 30 events for this university)
 *
 * Internal `_count` is included for the stat strip but the API consumer
 * (the admin UI) is the only audience — no student-facing route exposes
 * these counts.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("universities.read");
    if (g.error) return g.error;
    const { id } = await params;

    const university = await prisma.university.findFirst({
      where: { id },
      include: {
        country: { select: { id: true, name: true, code: true, flag: true, currency: true } },
        courses: {
          where: { deletedAt: null },
          orderBy: [{ degreeLevel: "asc" }, { name: "asc" }],
          include: {
            _count: {
              select: {
                intakes: { where: { status: "ACTIVE" } },
                applications: { where: { deletedAt: null } },
              },
            },
          },
        },
        applications: {
          where: { deletedAt: null, status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
          take: 25,
          include: {
            student: {
              select: { id: true, firstName: true, lastName: true, studentId: true },
            },
            course: { select: { id: true, name: true } },
          },
        },
        _count: {
          select: {
            courses: { where: { deletedAt: null } },
            applications: { where: { deletedAt: null, status: "ACTIVE" } },
          },
        },
      },
    });
    if (!university) throw notFound("University");

    // Activity timeline = audit trail for this university.
    const activities = await prisma.auditLog.findMany({
      where: { entity: "University", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    return ok({ ...university, activities });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("universities.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const body = universityUpdateSchema.parse(await req.json());
    const { archived, ...changes } = body;

    const uni = await prisma.university.findUnique({ where: { id } });
    if (!uni) throw notFound("University");

    // Archive / unarchive path — separate from field updates so the audit
    // trail records the lifecycle event distinctly. Archiving a university
    // with active applications is blocked (deactivate instead).
    if (archived !== undefined) {
      if (archived && !uni.deletedAt) {
        const inUse = await prisma.application.count({
          where: { universityId: id, deletedAt: null, status: "ACTIVE" },
        });
        if (inUse > 0) {
          return fail(
            "CONFLICT",
            `Cannot archive: ${inUse} active application(s) reference this university. Deactivate it instead.`,
            409,
          );
        }
      }
      const updated = await prisma.university.update({
        where: { id },
        data: {
          deletedAt: archived ? new Date() : null,
          deletedBy: archived ? g.user.id : null,
        },
      });
      await auditLog.record({
        userId: g.user.id,
        action: archived ? "university.archived" : "university.unarchived",
        entity: "University",
        entityId: id,
        oldValue: { name: uni.name, deletedAt: uni.deletedAt },
        newValue: { deletedAt: updated.deletedAt },
      });
      return ok({ archived });
    }

    // Dedupe-check name within the same country when name is being changed.
    if (changes.name && changes.name.toLowerCase() !== uni.name.toLowerCase()) {
      const nameTaken = await prisma.university.findFirst({
        where: {
          name: { equals: changes.name, mode: "insensitive" },
          countryId: uni.countryId,
          deletedAt: null,
          NOT: { id },
        },
      });
      if (nameTaken) {
        return fail("CONFLICT", "Another university with this name exists in this country", 409);
      }
    }

    // Validate the country exists if it's being changed.
    if (changes.countryId && changes.countryId !== uni.countryId) {
      const country = await prisma.country.findFirst({
        where: { id: changes.countryId, deletedAt: null },
      });
      if (!country) return fail("NOT_FOUND", "Country not found", 404);
    }

    const updated = await prisma.university.update({
      where: { id },
      data: {
        ...changes,
        website: changes.website || undefined,
        logo: changes.logo || undefined,
        city: changes.city || undefined,
      },
    });
    await auditLog.record({
      userId: g.user.id,
      action: "university.updated",
      entity: "University",
      entityId: id,
      oldValue: {
        name: uni.name,
        countryId: uni.countryId,
        website: uni.website,
        city: uni.city,
        logo: uni.logo,
        description: uni.description,
        ranking: uni.ranking,
        applicationFee: uni.applicationFee,
        status: uni.status,
      },
      newValue: {
        name: changes.name,
        countryId: changes.countryId,
        website: changes.website,
        city: changes.city,
        logo: changes.logo,
        description: changes.description,
        ranking: changes.ranking,
        applicationFee: changes.applicationFee,
        status: changes.status,
      },
    });
    // Status changes emit a dedicated audit entry so the timeline can
    // surface activate/deactivate events distinctly from generic edits.
    if (changes.status && changes.status !== uni.status) {
      await auditLog.record({
        userId: g.user.id,
        action: "university.status_changed",
        entity: "University",
        entityId: id,
        oldValue: { status: uni.status },
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
 * university data participates in historical applications and audit
 * logs, so the tombstone is the only removal path.
 *
 * Archive is blocked when active applications reference the university
 * — the admin must deactivate it first (status: INACTIVE) so in-flight
 * applications retain their data without the university appearing in
 * new-application selectors.
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("universities.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const uni = await prisma.university.findFirst({ where: { id } });
    if (!uni) throw notFound("University");

    const inUse = await prisma.application.count({
      where: { universityId: id, deletedAt: null, status: "ACTIVE" },
    });
    if (inUse > 0) {
      return fail(
        "CONFLICT",
        `Cannot archive: ${inUse} active application(s) reference this university. Deactivate it instead.`,
        409,
      );
    }

    await prisma.university.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: g.user.id },
    });
    await auditLog.record({
      userId: g.user.id,
      action: "university.archived",
      entity: "University",
      entityId: id,
      oldValue: { name: uni.name, slug: uni.slug },
    });
    return ok({ archived: true });
  } catch (err) {
    return handleApiError(err);
  }
}
