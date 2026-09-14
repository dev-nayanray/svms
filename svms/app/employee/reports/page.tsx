import { redirect } from "next/navigation";
import Link from "next/link";
import { Download, AlertCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { EmployeePageHeader } from "@/components/employee/ui";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui";
import { formatDate, titleCase, cn } from "@/lib/utils";
import { resolveDashboardRange } from "@/lib/utils/dashboard-range";
import { DateRangeFilter } from "@/components/employee/date-range-filter";
import {
  getReport,
  REPORT_KINDS,
  type ReportKind,
  type ReportFilters,
} from "@/lib/services/report-cases";

export const dynamic = "force-dynamic";

const REPORT_LABELS: Record<ReportKind, string> = {
  students: "My Students",
  applications: "My Applications",
  pipeline: "Application Pipeline",
  documents: "Documents",
  visa: "Visa Cases",
  tasks: "Tasks",
  appointments: "Appointments",
  payments: "Payments",
  leads: "Leads",
};

export default async function EmployeeReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    preset?: string; from?: string; to?: string; tz?: string;
    kind?: string; status?: string; stage?: string; countryId?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/reports");
  const role = (session.user as { role?: string }).role;
  if (role !== "EMPLOYEE" && role !== "ADMIN") redirect("/403");
  if (!hasPermission(role, "reports.read")) redirect("/403");

  let employeeId: string | null = null;
  if (role === "EMPLOYEE") {
    const employee = await prisma.employee.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!employee) redirect("/403");
    employeeId = employee.id;
  }
  const scope = { isAdmin: role === "ADMIN", userId: session.user.id, employeeId };

  const sp = await searchParams;
  const range = resolveDashboardRange({
    preset: sp.preset, from: sp.from, to: sp.to, tz: sp.tz,
  });

  const kindRaw = sp.kind ?? "pipeline";
  const kind: ReportKind = (REPORT_KINDS as readonly string[]).includes(kindRaw)
    ? (kindRaw as ReportKind)
    : "pipeline";

  const filters: ReportFilters = {
    countryId: sp.countryId,
    status: sp.status,
    stage: sp.stage,
  };

  let report;
  let loadError: string | null = null;
  try {
    report = await getReport(scope, kind, range, filters, 50);
  } catch (err) {
    console.error("[employee/reports]", err);
    loadError = "Could not load report — server error.";
    report = { kind, total: 0, rows: [] };
  }

  return (
    <div>
      <EmployeePageHeader
        title="Reports"
        description={`Authorized data · ${range.label}`}
        actions={<DateRangeFilter activePreset={range.preset} customFrom={sp.from} customTo={sp.to} />}
      />

      {/* Report kind selector */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {REPORT_KINDS.map((k) => {
          const active = k === kind;
          const href = buildHref({ kind: k, sp, range });
          return (
            <Link
              key={k}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {REPORT_LABELS[k]}
            </Link>
          );
        })}
      </div>

      {loadError && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{loadError}</span>
        </div>
      )}

      <ReportView
        report={report}
        range={range}
        kind={kind}
        sp={sp}
      />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

function buildHref(args: {
  kind: ReportKind;
  sp: { preset?: string; from?: string; to?: string; status?: string; stage?: string; countryId?: string };
  range: { preset: string };
}): string {
  const params = new URLSearchParams();
  params.set("kind", args.kind);
  params.set("preset", args.range.preset);
  if (args.sp.from) params.set("from", args.sp.from);
  if (args.sp.to) params.set("to", args.sp.to);
  if (args.sp.status) params.set("status", args.sp.status);
  if (args.sp.stage) params.set("stage", args.sp.stage);
  if (args.sp.countryId) params.set("countryId", args.sp.countryId);
  return `/employee/reports?${params.toString()}`;
}

// ── Report view ───────────────────────────────────────────────────────

function ReportView({
  report,
  range,
  kind,
  sp,
}: {
  report: { kind: ReportKind; total: number; rows: Record<string, unknown>[]; buckets?: { label: string; count: number }[]; summary?: Record<string, number | string> };
  range: { preset: string; label: string };
  kind: ReportKind;
  sp: { status?: string; stage?: string; countryId?: string };
}) {
  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {report.summary && Object.keys(report.summary).length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {Object.entries(report.summary).map(([key, value]) => (
            <div key={key} className="rounded-md border border-border bg-card p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {titleCase(key)}
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{String(value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Export button */}
      <div className="flex justify-end">
        <a href={buildExportUrl(kind, range.preset, sp)}>
          <Button variant="outline" size="sm">
            <Download className="h-3.5 w-3.5" aria-hidden /> Export CSV
          </Button>
        </a>
      </div>

      {/* Distribution chart */}
      {report.buckets && report.buckets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Distribution by {kind === "pipeline" ? "stage" : "status"}</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart buckets={report.buckets} />
          </CardContent>
        </Card>
      )}

      {/* Data table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{REPORT_LABELS[kind]} ({report.total})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {report.rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No records match these filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    {Object.keys(report.rows[0]).map((col) => (
                      <th key={col} className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {titleCase(col)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {report.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-muted/20">
                      {Object.entries(row).map(([col, value]) => (
                        <td key={col} className="px-3 py-2 text-xs">
                          {formatCell(col, value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatCell(col: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return "—";
  if (value instanceof Date) {
    if (col === "createdAt" || col === "updatedAt" || col === "dueDate" || col === "nextFollowUp" || col === "scheduledAt" || col === "submittedAt" || col === "decisionAt" || col === "uploadedAt" || col === "reviewedAt" || col === "paymentDate") {
      return formatDate(value);
    }
    return value.toISOString();
  }
  if (typeof value === "number") {
    return value.toLocaleString();
  }
  return String(value);
}

function buildExportUrl(
  kind: ReportKind,
  preset: string,
  sp: { status?: string; stage?: string; countryId?: string },
): string {
  const params = new URLSearchParams();
  params.set("kind", kind);
  params.set("preset", preset);
  if (sp.status) params.set("status", sp.status);
  if (sp.stage) params.set("stage", sp.stage);
  if (sp.countryId) params.set("countryId", sp.countryId);
  return `/api/employee/reports/export?${params.toString()}`;
}

// ── Simple bar chart ─────────────────────────────────────────────────

function SimpleBarChart({ buckets }: { buckets: { label: string; count: number }[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {buckets.map((b) => (
        <div key={b.label} className="rounded-md border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs font-medium text-muted-foreground">{b.label}</p>
            <span className="text-sm font-bold tabular-nums">{b.count}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(b.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
