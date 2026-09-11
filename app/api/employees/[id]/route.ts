import { NextRequest } from "next/server";
import { ok, handleApiError, notFound, fail } from "@/lib/api";
import { auditLog } from "@/lib/services/audit";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { employeeService } from "@/lib/services/employee";
import { employeeUpdateSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("employees.read");
    if (g.error) return g.error;
    const { id } = await params;
    const employee = await prisma.employee.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: true,
        branch: true,
        students: { where: { deletedAt: null }, take: 10, orderBy: { createdAt: "desc" } },
        leads: { where: { deletedAt: null }, take: 10, orderBy: { createdAt: "desc" } },
      },
    });
    if (!employee) throw notFound("Employee");
    return ok(employee);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("employees.update");
    if (g.error) return g.error;
    const { id } = await params;
    const body = employeeUpdateSchema.parse(await req.json());

    if (body.roleName) {
      const employee = await prisma.employee.findFirst({
        where: { id, deletedAt: null },
        include: { user: true },
      });
      if (!employee) throw notFound("Employee");
      const { roleAssignmentError } = await import("@/lib/utils/employee-insights");
      const reason = roleAssignmentError(
        { userId: employee.userId, roleName: employee.user.roleName },
        g.user,
        body.roleName
      );
      if (reason) return fail("BAD_REQUEST", reason, 400);
      await prisma.user.update({ where: { id: employee.userId }, data: { roleName: body.roleName } });
      await auditLog.record({
        userId: g.user.id,
        action: "employee.role_assigned",
        entity: "Employee",
        entityId: id,
        oldValue: { role: employee.user.roleName },
        newValue: { role: body.roleName },
      });
      delete body.roleName;
    }

    const employee = await employeeService.update(id, body, g.user);
    return ok(employee);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("employees.delete");
    if (g.error) return g.error;
    const { id } = await params;
    await employeeService.softDelete(id, g.user);
    return ok({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
