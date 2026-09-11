import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { visaRequirementCreateSchema } from "@/lib/validations";
import { auditLog } from "@/lib/services/audit";

export async function GET(req: NextRequest) {
  try {
    const g = await guard("visa.read");
    if (g.error) return g.error;
    const sp = req.nextUrl.searchParams;
    const countryId = sp.get("countryId") ?? undefined;
    const status = sp.get("status") ?? "ACTIVE";
    const data = await prisma.visaRequirement.findMany({
      where: {
        status,
        ...(countryId ? { countryId } : {}),
      },
      include: { country: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return ok({ data });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const g = await guard("visa.manage");
    if (g.error) return g.error;
    const body = visaRequirementCreateSchema.parse(await req.json());

    const country = await prisma.country.findFirst({
      where: { id: body.countryId, deletedAt: null },
    });
    if (!country) return fail("NOT_FOUND", "Country not found", 404);

    const item = await prisma.visaRequirement.create({ data: body });
    await auditLog.record({
      userId: g.user.id,
      action: "visa_requirement.created",
      entity: "VisaRequirement",
      entityId: item.id,
      newValue: {
        name: item.name,
        countryId: item.countryId,
        required: item.required,
        sortOrder: item.sortOrder,
      },
    });
    return ok(item, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
