import { NextRequest, NextResponse } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { auditLog } from "@/lib/services/audit";
import { rateLimit, RATE_LIMIT_PRESETS } from "@/lib/security/rate-limit";
import {
  exportAsJson,
  exportAsCsv,
  isPIIModule,
  type ExportModule,
  type ExportFilters,
} from "@/lib/services/data-export";
import { z } from "zod";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  module: z.enum([
    "students", "leads", "applications", "documents", "payments", "invoices",
    "tasks", "appointments", "universities", "courses", "countries", "employees",
    "branches", "visa", "messages", "notifications",
  ]),
  format: z.enum(["json", "csv"]).default("json"),
  status: z.string().optional(),
  branchId: z.string().optional(),
  employeeId: z.string().optional(),
  countryId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  demoOnly: z.enum(["true", "false"]).default("false"),
  limit: z.coerce.number().int().min(1).max(10000).default(10000),
});

/**
 * GET /api/admin/data/export?module=students&format=json
 *
 * Exports data in JSON or CSV format. Admin-only, rate-limited,
 * audit-logged. Sensitive fields (passwords, tokens) are never exported.
 *
 * Query params:
 *  - module (required): which entity to export
 *  - format: json | csv (default: json)
 *  - status: filter by status
 *  - branchId: filter by branch
 *  - employeeId: filter by assigned employee
 *  - countryId: filter by country
 *  - dateFrom / dateTo: date range filter (createdAt)
 *  - demoOnly: export only demo records (email contains "euroscope.demo")
 *  - limit: max records (default 10000, max 10000)
 */
export async function GET(req: NextRequest) {
  try {
    const limited = rateLimit(req, RATE_LIMIT_PRESETS.export, "data-export");
    if (limited) return limited as Response;

    const g = await guard();
    if (g.error) return g.error;

    const sp = req.nextUrl.searchParams;
    const params = querySchema.parse({
      module: sp.get("module") ?? "",
      format: sp.get("format") ?? "json",
      status: sp.get("status") ?? undefined,
      branchId: sp.get("branchId") ?? undefined,
      employeeId: sp.get("employeeId") ?? undefined,
      countryId: sp.get("countryId") ?? undefined,
      dateFrom: sp.get("dateFrom") ?? undefined,
      dateTo: sp.get("dateTo") ?? undefined,
      demoOnly: sp.get("demoOnly") ?? "false",
      limit: sp.get("limit") ?? "10000",
    });

    const filters: ExportFilters = {
      status: params.status,
      branchId: params.branchId,
      employeeId: params.employeeId,
      countryId: params.countryId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      demoOnly: params.demoOnly === "true",
    };

    // Audit log the export
    await auditLog.record({
      userId: g.user.id,
      action: "data.export",
      entity: "DataExport",
      newValue: { module: params.module, format: params.format, filters, limit: params.limit },
    });

    const isPII = isPIIModule(params.module as ExportModule);

    if (params.format === "json") {
      const result = await exportAsJson(params.module as ExportModule, filters, params.limit);
      return new NextResponse(result.data, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${params.module}-export-${Date.now()}.json"`,
          "X-PII-Warning": isPII ? "true" : "false",
        },
      });
    } else {
      const result = await exportAsCsv(params.module as ExportModule, filters, params.limit);
      return new NextResponse(result.data, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${params.module}-export-${Date.now()}.csv"`,
          "X-PII-Warning": isPII ? "true" : "false",
        },
      });
    }
  } catch (err) {
    return handleApiError(err);
  }
}
