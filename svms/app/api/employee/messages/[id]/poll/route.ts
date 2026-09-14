import { NextRequest } from "next/server";
import { ok, handleApiError, HttpError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pollNewMessages } from "@/lib/services/message-cases";

async function resolveScope() {
  const session = await auth();
  if (!session?.user?.id) throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") throw new HttpError(403, "FORBIDDEN", "Employees only");

  let employeeId: string | null = null;
  if (role === "EMPLOYEE") {
    const employee = await prisma.employee.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!employee) throw new HttpError(403, "FORBIDDEN", "No employee record");
    employeeId = employee.id;
  }
  return { isAdmin: role === "ADMIN", userId: session.user.id, employeeId };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const scope = await resolveScope();
    const { id } = await ctx.params;
    const sinceParam = req.nextUrl.searchParams.get("since");
    if (!sinceParam) {
      throw new HttpError(400, "BAD_REQUEST", "Missing 'since' query parameter (ISO timestamp)");
    }
    const since = new Date(sinceParam);
    if (isNaN(since.getTime())) {
      throw new HttpError(400, "BAD_REQUEST", "'since' must be a valid ISO timestamp");
    }
    const result = await pollNewMessages(scope, id, since);
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
