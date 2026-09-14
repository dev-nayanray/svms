import { NextRequest, NextResponse } from "next/server";
import { guard } from "@/lib/auth/guards";
import {
  type ReportType,
  parseReportFilters,
  isSensitiveReport,
  rowsToCsv,
} from "@/lib/constants/reports";
import { formatDate } from "@/lib/utils";

/**
 * CSV export endpoint for reports. Returns a `text/csv` response with
 * the appropriate `Content-Disposition` header so the browser downloads
 * the file. The CSV data is generated server-side from the same
 * aggregations as the main report endpoint — the browser never
 * processes large datasets.
 *
 * The export format is Excel-ready: UTF-8 BOM, RFC 4180 compliant
 * escaping, CRLF line endings, and a header row.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard("reports.read");
    if (g.error) return g.error;

    const sp = req.nextUrl.searchParams;
    const reportType = (sp.get("type") ?? "applications") as ReportType;
    const filters = parseReportFilters({
      dateFrom: sp.get("dateFrom") ?? undefined,
      dateTo: sp.get("dateTo") ?? undefined,
      branchId: sp.get("branchId") ?? undefined,
      employeeId: sp.get("employeeId") ?? undefined,
      countryId: sp.get("countryId") ?? undefined,
      universityId: sp.get("universityId") ?? undefined,
      courseId: sp.get("courseId") ?? undefined,
      intakeId: sp.get("intakeId") ?? undefined,
      status: sp.get("status") ?? undefined,
    });

    // Sensitive reports require finance.read
    if (isSensitiveReport(reportType)) {
      const fg = await guard("finance.read");
      if (fg.error) return fg.error;
    }

    // Run the report and extract the table data
    const { runReportTable } = await import("@/lib/services/reports-table");
    const { headers, rows } = await runReportTable(reportType, filters);

    // Generate CSV with UTF-8 BOM for Excel compatibility
    const csv = "\uFEFF" + rowsToCsv(headers, rows);
    const filename = `${reportType}-report-${formatDate(new Date())}.csv`.replace(/\s/g, "-");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: (err as Error).message } },
      { status: 500 },
    );
  }
}
