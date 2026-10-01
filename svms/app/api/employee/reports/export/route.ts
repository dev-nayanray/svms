import { NextRequest } from "next/server";
import { handleApiError, HttpError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { resolveDashboardRange } from "@/lib/utils/dashboard-range";
import {
  getReport,
  reportToCsv,
  REPORT_KINDS,
  type ReportKind,
  type ReportFilters,
} from "@/lib/services/report-cases";

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
  return { isAdmin: role === "ADMIN", userId: session.user.id, employeeId };
}

/**
 * GET /api/employee/reports/export?kind=students&preset=30d
 *
 * Returns a CSV file with the report rows + a summary footer. The CSV
 * is RFC 4180-escaped. Suitable for direct Excel / Numbers / Sheets
 * import. PII is included only to the extent the caller is authorized
 * to see it (scope filter applied server-side).
 */
export async function GET(req: NextRequest) {
  try {
    const scope = await resolveScope();
    const sp = req.nextUrl.searchParams;
    const range = resolveDashboardRange({
      preset: sp.get("preset"),
      from: sp.get("from"),
      to: sp.get("to"),
      tz: sp.get("tz"),
    });
    const kindRaw = sp.get("kind") ?? "pipeline";
    const kind: ReportKind = (REPORT_KINDS as readonly string[]).includes(kindRaw)
      ? (kindRaw as ReportKind)
      : "pipeline";
    const filters: ReportFilters = {
      countryId: sp.get("countryId") ?? undefined,
      status: sp.get("status") ?? undefined,
      stage: sp.get("stage") ?? undefined,
      employeeId: sp.get("employeeId") ?? undefined,
    };
    const limit = Math.min(2000, Math.max(1, Number(sp.get("limit") ?? 500)));
    const result = await getReport(scope, kind, range, filters, limit);
    const csv = reportToCsv(result);
    const filename = `${kind}-report-${range.preset}.csv`;
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
