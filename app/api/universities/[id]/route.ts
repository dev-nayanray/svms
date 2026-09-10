import { NextRequest } from "next/server";
import { ok, handleApiError, notFound } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { universitySchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("universities.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const body = universitySchema.partial().parse(await req.json());
    const uni = await prisma.university.findFirst({ where: { id, deletedAt: null } });
    if (!uni) throw notFound("University");
    const updated = await prisma.university.update({
      where: { id },
      data: { ...body, website: body.website || undefined },
    });
    return ok(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("universities.manage");
    if (g.error) return g.error;
    const { id } = await params;
    await prisma.university.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: g.user.id },
    });
    return ok({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
