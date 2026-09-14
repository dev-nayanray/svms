import { NextRequest } from "next/server";
import { ok, handleApiError, HttpError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { resolveDashboardRange } from "@/lib/utils/dashboard-range";
import {
  getReport,
  REPORT_KINDS,
  type ReportKind,
  type ReportFilters,
} from "@/lib/services/report-cases";

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
    const limit = Math.min(500, Math.max(1, Number(sp.get("limit") ?? 100)));
    const result = await getReport(scope, kind, range, filters, limit);
    return ok({ range: { preset: range.preset, from: range.from, to: range.to, label: range.label }, ...result });
  } catch (err) {
    return handleApiError(err);
  }
}
