/**
 * Pure helpers for the Admin Reports & Analytics module.
 *
 * No DB access — these functions feed the API routes, UI components, and
 * tests. The report types, filter builders, and CSV helpers are the
 * single source of truth.
 *
 * Security: financial reports (Finance, Employee performance with
 * revenue) require `finance.read` in addition to `reports.read`. The
 * RBAC matrix maps each report type to its required permission set.
 */

export const REPORT_TYPES = [
  "students",
  "leads",
  "applications",
  "visa",
  "employees",
  "finance",
  "documents",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  students: "Student Reports",
  leads: "Lead Reports",
  applications: "Application Reports",
  visa: "Visa Reports",
  employees: "Employee Reports",
  finance: "Finance Reports",
  documents: "Document Reports",
};

/**
 * RBAC matrix: which report types require `finance.read` in addition to
 * `reports.read`. Financial/sensitive reports (finance, employee revenue)
 * are restricted to admins only.
 */
export const SENSITIVE_REPORTS: readonly ReportType[] = ["finance", "employees"];

export function isSensitiveReport(type: string): boolean {
  return (SENSITIVE_REPORTS as readonly string[]).includes(type);
}

/** Filter keys supported by the reports API. */
export const REPORT_FILTER_KEYS = [
  "dateFrom",
  "dateTo",
  "branchId",
  "employeeId",
  "countryId",
  "universityId",
  "courseId",
  "intakeId",
  "status",
] as const;
export type ReportFilterKey = (typeof REPORT_FILTER_KEYS)[number];

export type ReportFilters = {
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  employeeId?: string;
  countryId?: string;
  universityId?: string;
  courseId?: string;
  intakeId?: string;
  status?: string;
};

/**
 * Parse a raw query-string into a typed ReportFilters object. Trims
 * whitespace and drops undefined/empty values.
 */
export function parseReportFilters(raw: Record<string, string | undefined>): ReportFilters {
  const out: ReportFilters = {};
  for (const key of REPORT_FILTER_KEYS) {
    const val = raw[key];
    if (val && val.trim()) {
      (out as Record<string, string>)[key] = val.trim();
    }
  }
  return out;
}

/**
 * Convert a ReportFilters object to a URL query string for the export
 * endpoint. Only non-empty values are included.
 */
export function filtersToQueryString(filters: ReportFilters): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) sp.set(k, v);
  }
  return sp.toString();
}

/**
 * Convert an array of rows to a CSV string. Handles escaping of
 * values containing commas, quotes, or newlines (RFC 4180 compliant).
 *
 * The first row is the header. Each subsequent row is the stringified
 * value of each cell (null/undefined → empty string).
 */
export function rowsToCsv(
  headers: string[],
  rows: Record<string, unknown>[],
): string {
  const escapeCell = (val: unknown): string => {
    if (val == null) return "";
    const str = String(val);
    // Escape quotes by doubling them, wrap in quotes if the cell
    // contains commas, quotes, or newlines.
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeCell).join(",");
  const dataLines = rows.map((row) =>
    headers.map((h) => escapeCell(row[h])).join(","),
  );
  return [headerLine, ...dataLines].join("\r\n");
}

/**
 * Chart data point — used by all chart configs in the reports UI.
 */
export type ChartDataPoint = { name: string; value: number };

/**
 * Resolve a date range from the report filters. Returns the from/to
 * Date pair, or null if no date filtering is requested.
 */
export function resolveDateRange(filters: ReportFilters): {
  from: Date | null;
  to: Date | null;
} {
  const from = filters.dateFrom ? new Date(filters.dateFrom) : null;
  const to = filters.dateTo ? new Date(filters.dateTo) : null;
  // Validate the dates — invalid input returns null (no filtering)
  return {
    from: from && !Number.isNaN(from.getTime()) ? from : null,
    to: to && !Number.isNaN(to.getTime()) ? to : null,
  };
}

/**
 * Build the display label for a date range filter. Returns "All time"
 * when no dates are set, "From {date}" for a single from, "To {date}"
 * for a single to, and "{from} → {to}" for a range.
 */
export function dateRangeLabel(filters: ReportFilters): string {
  const { from, to } = resolveDateRange(filters);
  if (!from && !to) return "All time";
  const fmt = (d: Date) =>
    d.toISOString().slice(0, 10);
  if (from && to) return `${fmt(from)} → ${fmt(to)}`;
  if (from) return `From ${fmt(from)}`;
  if (to) return `To ${fmt(to)}`;
  return "All time";
}
