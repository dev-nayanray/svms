import { NextRequest } from "next/server";
import { ok, handleApiError, HttpError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";
import { requestReupload } from "@/lib/services/document-cases";

const reuploadSchema = z.object({
  reason: z.string().min(1, "A reason is required").max(2000, "Reason too long"),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
    const role = (session.user as { role?: string }).role;
    if (role !== "EMPLOYEE" && role !== "ADMIN") throw new HttpError(403, "FORBIDDEN", "Employees only");
    if (!hasPermission(role, "documents.review")) throw new HttpError(403, "FORBIDDEN", "Missing documents.review permission");

    const { id } = await ctx.params;
    const body = reuploadSchema.parse(await req.json());

    let employeeId: string | null = null;
    if (role === "EMPLOYEE") {
      const employee = await prisma.employee.findFirst({ where: { userId: session.user.id }, select: { id: true } });
      if (!employee) throw new HttpError(403, "FORBIDDEN", "No employee record");
      employeeId = employee.id;
    }

    const scope = { isAdmin: role === "ADMIN", userId: session.user.id, employeeId };
    const result = await requestReupload(scope, id, body.reason, {
      id: session.user.id,
      ipAddress: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    return ok(result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
