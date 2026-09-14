import { NextRequest } from "next/server";
import { ok, fail, handleApiError, HttpError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { resolveDashboardRange } from "@/lib/utils/dashboard-range";
import { getEmployeeDashboard, type EmployeeScope } from "@/lib/services/employee-dashboard";

export const dynamic = "force-dynamic";

/**
 * GET /api/employee/dashboard?preset=30d&tz=Asia/Dhaka
 *
 * Returns the caller's dashboard aggregate — KPIs, pipeline, visa cases,
 * pending documents, upcoming deadlines, my tasks, upcoming appointments,
 * and recent activity. The employee is resolved from the session, never
 * from client input — IDOR-safe.
 *
 * Query params:
 *  • preset — one of `today | 7d | 30d | 90d | year | custom` (default: 30d)
 *  • from / to — ISO date strings, required when preset=custom
 *  • tz — IANA timezone name (default: UTC)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
    const role = (session.user as { role?: string }).role;
    if (role !== "EMPLOYEE" && role !== "ADMIN") throw new HttpError(403, "FORBIDDEN", "Employees only");

    const sp = req.nextUrl.searchParams;
    const range = resolveDashboardRange({
      preset: sp.get("preset"),
      from: sp.get("from"),
      to: sp.get("to"),
      tz: sp.get("tz"),
    });

    let employeeId: string | null = null;
    if (role === "EMPLOYEE") {
      const employee = await prisma.employee.findFirst({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (!employee) throw new HttpError(403, "FORBIDDEN", "No employee record linked");
      employeeId = employee.id;
    }

    const perms = {
      students: hasPermission(role, "students.read"),
      leads: hasPermission(role, "leads.read"),
      applications: hasPermission(role, "applications.read"),
      documents: hasPermission(role, "documents.read"),
      visa: hasPermission(role, "visa.read"),
      tasks: hasPermission(role, "tasks.read"),
      appointments: hasPermission(role, "tasks.read"),
      payments: hasPermission(role, "payments.read"),
      invoices: hasPermission(role, "invoices.read"),
    };

    const scope: EmployeeScope = {
      isAdmin: role === "ADMIN",
      userId: session.user.id,
      employeeId,
    };

    const data = await getEmployeeDashboard(scope, range, perms);
    return ok(data);
  } catch (err) {
    return handleApiError(err);
  }
}
