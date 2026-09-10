import { NextRequest } from "next/server";
import { ok, handleApiError, notFound } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { branchSchema } from "@/lib/validations";
import { auditLog } from "@/lib/services/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("branches.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const body = branchSchema.partial().parse(await req.json());
    const branch = await prisma.branch.findUnique({ where: { id } });
    if (!branch) throw notFound("Branch");
    const updated = await prisma.branch.update({
      where: { id },
      data: { ...body, email: body.email || undefined },
    });
    await auditLog.record({
      userId: g.user.id,
      action: "branch.updated",
      entity: "Branch",
      entityId: id,
      oldValue: { name: branch.name, status: branch.status },
      newValue: { name: body.name, status: body.status },
    });
    return ok(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
