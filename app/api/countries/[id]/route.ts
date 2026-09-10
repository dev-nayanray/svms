import { NextRequest } from "next/server";
import { ok, handleApiError, notFound, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { countryUpdateSchema } from "@/lib/validations";
import { auditLog } from "@/lib/services/audit";
import { normalizeCountryCode } from "@/lib/constants/countries";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("countries.read");
    if (g.error) return g.error;
    const { id } = await params;

    const country = await prisma.country.findFirst({
      where: { id },
      include: {
        universities: {
          where: { deletedAt: null },
          orderBy: { name: "asc" },
          include: {
            _count: {
              select: {
                courses: { where: { deletedAt: null } },
                applications: { where: { deletedAt: null } },
              },
            },
          },
        },
        visaRequirements: {
          where: { status: "ACTIVE" },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
        documentRequirements: {
          where: { status: "ACTIVE" },
          orderBy: [{ appliesTo: "asc" }, { name: "asc" }],
        },
        applications: {
          where: { deletedAt: null, status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
          take: 25,
          include: {
            student: { select: { id: true, firstName: true, lastName: true, studentId: true } },
            university: { select: { id: true, name: true } },
            course: { select: { id: true, name: true } },
          },
        },
        _count: {
          select: {
            universities: { where: { deletedAt: null } },
            applications: { where: { deletedAt: null, status: "ACTIVE" } },
            visaRequirements: { where: { status: "ACTIVE" } },
            documentRequirements: { where: { status: "ACTIVE" } },
          },
        },
      },
    });
    if (!country) throw notFound("Country");

    return ok(country);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("countries.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const body = countryUpdateSchema.parse(await req.json());
    const { archived, ...changes } = body;

    const country = await prisma.country.findUnique({ where: { id } });
    if (!country) throw notFound("Country");

    // Archive / unarchive path — separate from field updates so the audit trail
    // records the lifecycle event distinctly.
    if (archived !== undefined) {
      if (archived && !country.deletedAt) {
        const inUse = await prisma.application.count({
          where: { countryId: id, deletedAt: null, status: "ACTIVE" },
        });
        if (inUse > 0) {
          return fail(
            "CONFLICT",
            `Cannot archive: ${inUse} active application(s) reference this country. Deactivate it instead.`,
            409,
          );
        }
      }
      const updated = await prisma.country.update({
        where: { id },
        data: {
          deletedAt: archived ? new Date() : null,
          deletedBy: archived ? g.user.id : null,
        },
      });
      await auditLog.record({
        userId: g.user.id,
        action: archived ? "country.archived" : "country.unarchived",
        entity: "Country",
        entityId: id,
        oldValue: { name: country.name, deletedAt: country.deletedAt },
        newValue: { deletedAt: updated.deletedAt },
      });
      return ok({ archived });
    }

    // Normalize code + dedupe-check on update.
    if (changes.code) {
      changes.code = normalizeCountryCode(changes.code);
      if (changes.code !== country.code) {
        const codeTaken = await prisma.country.findFirst({
          where: { code: changes.code, NOT: { id } },
        });
        if (codeTaken) return fail("CONFLICT", "Another country uses this code", 409);
      }
    }
    if (changes.name && changes.name !== country.name) {
      const nameTaken = await prisma.country.findFirst({
        where: { name: changes.name, deletedAt: null, NOT: { id } },
      });
      if (nameTaken) return fail("CONFLICT", "Another country uses this name", 409);
    }

    const updated = await prisma.country.update({ where: { id }, data: changes });
    await auditLog.record({
      userId: g.user.id,
      action: "country.updated",
      entity: "Country",
      entityId: id,
      oldValue: {
        name: country.name,
        code: country.code,
        flag: country.flag,
        currency: country.currency,
        description: country.description,
        status: country.status,
      },
      newValue: {
        name: changes.name,
        code: changes.code,
        flag: changes.flag,
        currency: changes.currency,
        description: changes.description,
        status: changes.status,
      },
    });
    // Status changes emit a dedicated audit entry so the timeline can surface
    // activate/deactivate events distinctly from generic edits.
    if (changes.status && changes.status !== country.status) {
      await auditLog.record({
        userId: g.user.id,
        action: "country.status_changed",
        entity: "Country",
        entityId: id,
        oldValue: { status: country.status },
        newValue: { status: changes.status },
      });
    }
    return ok(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

/** Archive (soft delete). Hard delete is intentionally not exposed — country
 * data participates in historical applications and audit logs. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("countries.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const country = await prisma.country.findFirst({ where: { id } });
    if (!country) throw notFound("Country");
    const inUse = await prisma.application.count({
      where: { countryId: id, deletedAt: null, status: "ACTIVE" },
    });
    if (inUse > 0) {
      return fail(
        "CONFLICT",
        `Cannot archive: ${inUse} active application(s) reference this country.`,
        409,
      );
    }
    await prisma.country.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: g.user.id },
    });
    await auditLog.record({
      userId: g.user.id,
      action: "country.archived",
      entity: "Country",
      entityId: id,
      oldValue: { name: country.name, code: country.code },
    });
    return ok({ archived: true });
  } catch (err) {
    return handleApiError(err);
  }
}
