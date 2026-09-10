import { NextRequest } from "next/server";
import { ok, handleApiError, notFound } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { courseSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("courses.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const body = courseSchema.partial().parse(await req.json());
    const course = await prisma.course.findFirst({ where: { id, deletedAt: null } });
    if (!course) throw notFound("Course");
    const updated = await prisma.course.update({ where: { id }, data: body });
    return ok(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("courses.manage");
    if (g.error) return g.error;
    const { id } = await params;
    await prisma.course.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: g.user.id },
    });
    return ok({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
