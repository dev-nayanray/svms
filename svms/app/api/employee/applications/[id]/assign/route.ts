import { NextRequest } from "next/server";
import { ok, handleApiError, HttpError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";
import { assignApplication } from "@/lib/services/application-cases";

const assignSchema = z.object({
  employeeId: z.string().nullable(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
    const role = (session.user as { role?: string }).role;
    if (role !== "EMPLOYEE" && role !== "ADMIN") throw new HttpError(403, "FORBIDDEN", "Employees only");
    if (!hasPermission(role, "applications.update")) throw new HttpError(403, "FORBIDDEN", "Missing applications.update permission");

    const { id } = await ctx.params;
    const body = assignSchema.parse(await req.json());

    let employeeId: string | null = null;
    if (role === "EMPLOYEE") {
      const employee = await prisma.employee.findFirst({ where: { userId: session.user.id }, select: { id: true } });
      if (!employee) throw new HttpError(403, "FORBIDDEN", "No employee record");
      employeeId = employee.id;
    }

    const scope = { isAdmin: role === "ADMIN", userId: session.user.id, employeeId };
    await assignApplication(scope, id, body.employeeId, { id: session.user.id });
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
