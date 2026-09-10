import { NextRequest } from "next/server";
import { ok, handleApiError, notFound } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("tasks.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const body = (await req.json()) as { status?: string };
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) throw notFound("Task");
    const updated = await prisma.task.update({
      where: { id },
      data: {
        ...(body.status ? { status: body.status } : {}),
        completedAt: body.status === "COMPLETED" ? new Date() : task.completedAt,
      },
    });
    return ok(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
