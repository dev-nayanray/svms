import { NextRequest } from "next/server";
import { ok, handleApiError, fail, sortFrom } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { documentRequirementSchema } from "@/lib/validations";
import { auditLog } from "@/lib/services/audit";

/**
 * Document requirements catalog. A requirement can be:
 *  - global (no countryId) — applies to all applications
 *  - country-scoped (countryId set) — applies only to applications for that country
 *
 * Read access: any role with `documents.read` (admin + employee). Mutations
 * require `documents.review` (also admin + employee) — see permissions map.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard("documents.read");
    if (g.error) return g.error;
    const sp = req.nextUrl.searchParams;
    const countryId = sp.get("countryId") ?? undefined;
    const appliesTo = sp.get("appliesTo") ?? undefined;
    const status = sp.get("status") ?? undefined;

    const where = {
      ...(countryId ? { OR: [{ countryId }, { countryId: null }] } : {}),
      ...(appliesTo ? { appliesTo } : {}),
      ...(status ? { status } : {}),
    };
    const data = await prisma.documentRequirement.findMany({
      where,
      include: { country: true },
      orderBy: sortFrom(sp, ["name", "code", "appliesTo", "status"], {
        appliesTo: "asc",
        name: "asc",
      }),
    });
    return ok({ data });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const g = await guard("documents.review");
    if (g.error) return g.error;
    const body = documentRequirementSchema.parse(await req.json());

    if (body.countryId) {
      const country = await prisma.country.findFirst({
        where: { id: body.countryId, deletedAt: null },
      });
      if (!country) return fail("NOT_FOUND", "Country not found", 404);
    }

    const dup = await prisma.documentRequirement.findUnique({
      where: { code: body.code },
    });
    if (dup) return fail("CONFLICT", "Another requirement uses this code", 409);

    const item = await prisma.documentRequirement.create({ data: body });
    await auditLog.record({
      userId: g.user.id,
      action: "document_requirement.created",
      entity: "DocumentRequirement",
      entityId: item.id,
      newValue: {
        name: item.name,
        code: item.code,
        countryId: item.countryId,
        appliesTo: item.appliesTo,
        required: item.required,
      },
    });
    return ok(item, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
