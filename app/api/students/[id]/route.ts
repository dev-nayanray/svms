import { NextRequest } from "next/server";
import { ok, handleApiError, notFound } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { studentService } from "@/lib/services/student";
import { studentUpdateSchema } from "@/lib/validations";
import { HttpError } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("students.read");
    if (g.error) return g.error;
    const { id } = await params;

    const student = await prisma.student.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: true,
        employee: { include: { user: true } },
        academicRecords: true,
        englishProficiencies: true,
        applications: { where: { deletedAt: null }, include: { country: true } },
      },
    });
    if (!student) throw notFound("Student");

    // Students may only view themselves; employees only assigned students
    if (g.user.role === "STUDENT") {
      const me = await prisma.student.findUnique({ where: { userId: g.user.id } });
      if (!me || me.id !== student.id) throw new HttpError(403, "FORBIDDEN", "Forbidden");
    } else if (g.user.role === "EMPLOYEE") {
      const emp = await prisma.employee.findUnique({ where: { userId: g.user.id } });
      if (emp && student.assignedEmployeeId && student.assignedEmployeeId !== emp.id) {
        throw new HttpError(403, "FORBIDDEN", "Forbidden");
      }
    }
    return ok(student);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("students.update");
    if (g.error) return g.error;
    const { id } = await params;
    const body = studentUpdateSchema.parse(await req.json());
    const updated = await studentService.update(id, body as Parameters<typeof studentService.update>[1], g.user);
    return ok(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("students.delete");
    if (g.error) return g.error;
    const { id } = await params;
    await studentService.softDelete(id, g.user);
    return ok({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
