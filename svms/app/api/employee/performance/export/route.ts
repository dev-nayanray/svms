import { NextRequest } from "next/server";
import { handleApiError, HttpError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { resolveDashboardRange } from "@/lib/utils/dashboard-range";
import {
  getPerformanceKpis,
  kpisToCsv,
} from "@/lib/services/performance-cases";

export const dynamic = "force-dynamic";

async function resolveScope() {
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
  const perms = {
    students: hasPermission(role, "students.read"),
    applications: hasPermission(role, "applications.read"),
    documents: hasPermission(role, "documents.read"),
    visa: hasPermission(role, "visa.read"),
    tasks: hasPermission(role, "tasks.read"),
    appointments: hasPermission(role, "tasks.read"),
    leads: hasPermission(role, "leads.read"),
    payments: hasPermission(role, "payments.read"),
  };
  return {
    scope: { isAdmin: role === "ADMIN", userId: session.user.id, employeeId },
    perms,
  };
}

/**
 * GET /api/employee/performance/export?preset=30d
 *
 * Returns the KPIs as a flat CSV (metric, value) — suitable for Excel
 * / Numbers / Sheets import. Only the caller's authorized metrics
 * are included; the scope filter is applied server-side.
 */
export async function GET(req: NextRequest) {
  try {
    const { scope, perms } = await resolveScope();
    const sp = req.nextUrl.searchParams;
    const range = resolveDashboardRange({
      preset: sp.get("preset"),
      from: sp.get("from"),
      to: sp.get("to"),
      tz: sp.get("tz"),
    });
    const kpis = await getPerformanceKpis(scope, range, perms);
    const csv = kpisToCsv(kpis, range.label);
    const filename = `performance-${range.preset}.csv`;
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
