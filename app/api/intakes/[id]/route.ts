import { NextRequest } from "next/server";
import { ok, handleApiError, notFound } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { intakeSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("intakes.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const body = intakeSchema.partial().parse(await req.json());
    const intake = await prisma.intake.findUnique({ where: { id } });
    if (!intake) throw notFound("Intake");
    const updated = await prisma.intake.update({ where: { id }, data: body });
    return ok(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("intakes.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const intake = await prisma.intake.findUnique({ where: { id } });
    if (!intake) throw notFound("Intake");
    // Only remove intakes that are not referenced by applications
    const inUse = await prisma.application.count({ where: { intakeId: id } });
    if (inUse > 0) {
      await prisma.intake.update({ where: { id }, data: { status: "INACTIVE" } });
      return ok({ deactivated: true });
    }
    await prisma.intake.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
