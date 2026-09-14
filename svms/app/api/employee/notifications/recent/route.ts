import { NextRequest } from "next/server";
import { ok, handleApiError, HttpError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getRecentNotifications } from "@/lib/services/notification-cases";

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

export async function GET(req: NextRequest) {
  try {
    const scope = await resolveScope();
    const limit = Math.min(20, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 5)));
    const rows = await getRecentNotifications(scope, limit);
    return ok({ rows });
  } catch (err) {
    return handleApiError(err);
  }
}
