import { ok, handleApiError, notFound } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { auditLog } from "@/lib/services/audit";
import { generateTempPassword } from "@/lib/utils/employee-insights";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Reset access: replaces the password with a generated temporary one.
 * The temporary password is returned exactly once and never stored/logged in
 * plaintext. Audited as employee.access_reset.
 */
export async function POST(_req: Request, { params }: Ctx) {
  try {
    const g = await guard("employees.update");
    if (g.error) return g.error;
    const { id } = await params;

    const employee = await prisma.employee.findFirst({
      where: { id, deletedAt: null },
      include: { user: true },
    });
    if (!employee) throw notFound("Employee");

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await prisma.user.update({
      where: { id: employee.userId },
      data: { passwordHash, status: "ACTIVE" },
    });

    await auditLog.record({
      userId: g.user.id,
      action: "employee.access_reset",
      entity: "Employee",
      entityId: id,
      newValue: { method: "temporary_password" },
    });

    return ok({
      email: employee.user.email,
      temporaryPassword: tempPassword,
      note: "Shown once — share securely with the employee.",
    });
  } catch (err) {
    return handleApiError(err);
  }
}
