import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { branchSchema } from "@/lib/validations";
import { auditLog } from "@/lib/services/audit";

export async function GET() {
  try {
    const g = await guard("employees.read");
    if (g.error) return g.error;
    const data = await prisma.branch.findMany({
      include: { _count: { select: { users: true, students: true, employees: true } } },
      orderBy: { name: "asc" },
    });
    return ok({ data, pagination: undefined });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const g = await guard("branches.manage");
    if (g.error) return g.error;
    const body = branchSchema.parse(await req.json());
    const existing = await prisma.branch.findUnique({ where: { code: body.code } });
    if (existing) {
      return fail("CONFLICT", "A branch with this code already exists", 409);
    }
    const branch = await prisma.branch.create({
      data: { ...body, email: body.email || undefined },
    });
    await auditLog.record({
      userId: g.user.id,
      action: "branch.created",
      entity: "Branch",
      entityId: branch.id,
      newValue: { name: body.name, code: body.code },
    });
    return ok(branch, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
