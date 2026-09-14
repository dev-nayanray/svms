import { NextRequest } from "next/server";
import { ok, handleApiError, notFound } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { visaRequirementUpdateSchema } from "@/lib/validations";
import { auditLog } from "@/lib/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("visa.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const body = visaRequirementUpdateSchema.parse(await req.json());
    const item = await prisma.visaRequirement.findUnique({ where: { id } });
    if (!item) throw notFound("Visa requirement");
    const updated = await prisma.visaRequirement.update({ where: { id }, data: body });
    await auditLog.record({
      userId: g.user.id,
      action: "visa_requirement.updated",
      entity: "VisaRequirement",
      entityId: id,
      oldValue: {
        name: item.name,
        description: item.description,
        required: item.required,
        sortOrder: item.sortOrder,
        status: item.status,
      },
      newValue: {
        name: body.name,
        description: body.description,
        required: body.required,
        sortOrder: body.sortOrder,
        status: body.status,
      },
    });
    return ok(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("visa.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const item = await prisma.visaRequirement.findUnique({ where: { id } });
    if (!item) throw notFound("Visa requirement");
    await prisma.visaRequirement.delete({ where: { id } });
    await auditLog.record({
      userId: g.user.id,
      action: "visa_requirement.deleted",
      entity: "VisaRequirement",
      entityId: id,
      oldValue: { name: item.name, countryId: item.countryId },
    });
    return ok({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
