import { NextRequest } from "next/server";
import { ok, handleApiError, notFound } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const reassignSchema = z.object({ employeeId: z.string().min(1, "Employee is required") });

/** Assign/reassign an application's responsible counselor. Audited. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("applications.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const body = reassignSchema.parse(await req.json());

    const application = await prisma.application.findFirst({ where: { id, deletedAt: null } });
    if (!application) throw notFound("Application");
    const employee = await prisma.employee.findFirst({
      where: { id: body.employeeId, deletedAt: null },
      include: { user: true },
    });
    if (!employee) throw notFound("Employee");

    const updated = await prisma.application.update({
      where: { id },
      data: { employeeId: body.employeeId },
    });

    const { auditLog } = await import("@/lib/services/audit");
    await auditLog.record({
      userId: g.user.id,
      action: "application.employee_assigned",
      entity: "Application",
      entityId: id,
      oldValue: { employeeId: application.employeeId },
      newValue: { employeeId: body.employeeId, employeeName: employee.user.name },
    });

    return ok(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
