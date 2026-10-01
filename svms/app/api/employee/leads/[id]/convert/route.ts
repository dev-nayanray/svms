import { NextRequest } from "next/server";
import { ok, handleApiError, HttpError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { convertLeadToStudent } from "@/lib/services/lead-cases";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
    const role = (session.user as { role?: string }).role;
    if (role !== "EMPLOYEE" && role !== "ADMIN") throw new HttpError(403, "FORBIDDEN", "Employees only");
    if (!hasPermission(role, "leads.manage")) throw new HttpError(403, "FORBIDDEN", "Missing leads.manage permission");

    let employeeId: string | null = null;
    if (role === "EMPLOYEE") {
      const employee = await prisma.employee.findFirst({ where: { userId: session.user.id }, select: { id: true } });
      if (!employee) throw new HttpError(403, "FORBIDDEN", "No employee record");
      employeeId = employee.id;
    }
    const scope = { isAdmin: role === "ADMIN", userId: session.user.id, employeeId };
    const { id } = await ctx.params;
    // The result includes `tempPassword` — a one-time random credential
    // generated for the new student account. The converting employee
    // is responsible for sharing it out-of-band with the student.
    const result = await convertLeadToStudent(scope, id, {
      id: session.user.id,
      ipAddress: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    return ok(result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
