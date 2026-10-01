import { NextRequest } from "next/server";
import { ok, handleApiError, HttpError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { resolveDashboardRange } from "@/lib/utils/dashboard-range";
import {
  getPerformanceKpis,
  getPerformanceTrend,
  type PerformancePermissions,
} from "@/lib/services/performance-cases";

export const dynamic = "force-dynamic";

async function resolveScopeAndPerms() {
  const session = await auth();
  if (!session?.user?.id) throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") throw new HttpError(403, "FORBIDDEN", "Employees only");
  if (!hasPermission(role, "reports.read")) throw new HttpError(403, "FORBIDDEN", "Missing reports.read permission");

  let employeeId: string | null = null;
  if (role === "EMPLOYEE") {
    const employee = await prisma.employee.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!employee) throw new HttpError(403, "FORBIDDEN", "No employee record");
    employeeId = employee.id;
  }
  const scope = { isAdmin: role === "ADMIN", userId: session.user.id, employeeId };
  const perms: PerformancePermissions = {
    students: hasPermission(role, "students.read"),
    applications: hasPermission(role, "applications.read"),
    documents: hasPermission(role, "documents.read"),
    visa: hasPermission(role, "visa.read"),
    tasks: hasPermission(role, "tasks.read"),
    appointments: hasPermission(role, "tasks.read"),
    leads: hasPermission(role, "leads.read"),
    payments: hasPermission(role, "payments.read"),
  };
  return { scope, perms };
}

export async function GET(req: NextRequest) {
  try {
    const { scope, perms } = await resolveScopeAndPerms();
    const sp = req.nextUrl.searchParams;
    const range = resolveDashboardRange({
      preset: sp.get("preset"),
      from: sp.get("from"),
      to: sp.get("to"),
      tz: sp.get("tz"),
    });
    const [kpis, trend] = await Promise.all([
      getPerformanceKpis(scope, range, perms),
      getPerformanceTrend(scope, range, perms),
    ]);
    return ok({
      range: { preset: range.preset, from: range.from, to: range.to, label: range.label },
      kpis,
      trend,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
