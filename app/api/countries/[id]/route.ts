import { NextRequest } from "next/server";
import { ok, handleApiError, notFound, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { countryUpdateSchema } from "@/lib/validations";
import { auditLog } from "@/lib/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("countries.read");
    if (g.error) return g.error;
    const { id } = await params;
    const country = await prisma.country.findFirst({ where: { id } });
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

    if (archived !== undefined) {
      if (archived) {
        const inUse = await prisma.application.count({
          where: { countryId: id, deletedAt: null, status: "ACTIVE" },
        });
        if (inUse > 0) {
          return fail(
            "CONFLICT",
            `Cannot archive: ${inUse} active application(s) reference this country. Deactivate it instead.`,
            409
          );
        }
      }
      await prisma.country.update({
        where: { id },
        data: { deletedAt: archived ? new Date() : null, deletedBy: archived ? g.user.id : null },
      });
      await auditLog.record({
        userId: g.user.id,
        action: archived ? "country.archived" : "country.unarchived",
        entity: "Country",
        entityId: id,
      });
      return ok({ archived });
    }

    if (changes.code && changes.code !== country.code) {
      const codeTaken = await prisma.country.findFirst({
        where: { code: changes.code, NOT: { id } },
      });
      if (codeTaken) return fail("CONFLICT", "Another country uses this code", 409);
    }

    const updated = await prisma.country.update({ where: { id }, data: changes });
    await auditLog.record({
      userId: g.user.id,
      action: "country.updated",
      entity: "Country",
      entityId: id,
      oldValue: { name: country.name, status: country.status, currency: country.currency },
      newValue: { name: changes.name, status: changes.status, currency: changes.currency },
    });
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

/** Archive (soft delete). */
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
        409
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
    });
    return ok({ archived: true });
  } catch (err) {
    return handleApiError(err);
  }
}
