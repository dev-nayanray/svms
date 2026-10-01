import { redirect } from "next/navigation";
import { Download, AlertCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { EmployeePageHeader, StatCard } from "@/components/employee/ui";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui";
import { resolveDashboardRange } from "@/lib/utils/dashboard-range";
import { DateRangeFilter } from "@/components/employee/date-range-filter";
import {
  getPerformanceKpis,
  getPerformanceTrend,
  type PerformanceKpis as Kpis,
  type TrendPoint,
  type PerformancePermissions,
} from "@/lib/services/performance-cases";

export const dynamic = "force-dynamic";

export default async function EmployeePerformancePage({
  searchParams,
}: {
  searchParams: Promise<{
    preset?: string; from?: string; to?: string; tz?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/employee/performance");
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

  const sp = await searchParams;
  const range = resolveDashboardRange({
    preset: sp.preset, from: sp.from, to: sp.to, tz: sp.tz,
  });

  let kpis: Kpis;
  let trend: TrendPoint[];
  let loadError: string | null = null;
  try {
    [kpis, trend] = await Promise.all([
      getPerformanceKpis(scope, range, perms),
      getPerformanceTrend(scope, range, perms),
    ]);
  } catch (err) {
    console.error("[employee/performance]", err);
    loadError = "Could not load performance data — server error.";
    kpis = {
      assignedStudents: 0, activeCases: 0, completedCases: 0,
      applicationsSubmitted: 0, visaSubmissions: 0, visaApprovals: 0,
      pendingDocuments: 0, documentsReviewed: 0,
      completedTasks: 0, overdueTasks: 0,
      appointments: 0, convertedLeads: 0,
    };
    trend = [];
  }

  return (
    <div>
      <EmployeePageHeader
        title="Performance"
        description={`Your KPIs · ${range.label}`}
        actions={
          <div className="flex items-center gap-2">
            <DateRangeFilter activePreset={range.preset} customFrom={sp.from} customTo={sp.to} />
            <a href={`/api/employee/performance/export?preset=${range.preset}${sp.from ? `&from=${sp.from}` : ""}${sp.to ? `&to=${sp.to}` : ""}`}>
              <Button variant="outline" size="sm">
                <Download className="h-3.5 w-3.5" aria-hidden /> Export
              </Button>
            </a>
          </div>
        }
      />

      {loadError && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{loadError}</span>
        </div>
      )}

      {/* KPI grid — 12 cards */}
      <section aria-label="Key performance indicators" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {perms.students && (
          <StatCard label="Assigned Students" value={kpis.assignedStudents} hint="Current" tone="info" />
        )}
        {perms.applications && (
          <>
            <StatCard label="Active Cases" value={kpis.activeCases} hint="In progress" tone="warning" />
            <StatCard label="Completed Cases" value={kpis.completedCases} hint="All-time" tone="success" />
            <StatCard label="Applications Submitted" value={kpis.applicationsSubmitted} hint={range.label} tone="default" />
          </>
        )}
        {perms.visa && (
          <>
            <StatCard label="Visa Submissions" value={kpis.visaSubmissions} hint={range.label} tone="info" />
            <StatCard label="Visa Approvals" value={kpis.visaApprovals} hint={range.label} tone="success" />
          </>
        )}
        {perms.documents && (
          <>
            <StatCard label="Pending Documents" value={kpis.pendingDocuments} hint="Awaiting review" tone="warning" />
            <StatCard label="Documents Reviewed" value={kpis.documentsReviewed} hint={range.label} tone="default" />
          </>
        )}
        {perms.tasks && (
          <>
            <StatCard label="Completed Tasks" value={kpis.completedTasks} hint={range.label} tone="success" />
            <StatCard label="Overdue Tasks" value={kpis.overdueTasks} hint="Past due" tone="destructive" />
          </>
        )}
        {perms.appointments && (
          <StatCard label="Appointments" value={kpis.appointments} hint={range.label} tone="info" />
        )}
        {perms.leads && (
          <StatCard label="Converted Leads" value={kpis.convertedLeads} hint={range.label} tone="success" />
        )}
      </section>

      {/* Trend chart */}
      {trend.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Activity Trend — {range.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart points={trend} />
          </CardContent>
        </Card>
      )}

      {/* Conversion funnel */}
      {perms.leads && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Lead Conversion — {range.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <ConversionFunnel kpis={kpis} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Trend chart (simple SVG line chart) ───────────────────────────────

function TrendChart({ points }: { points: TrendPoint[] }) {
  if (points.length === 0) {
    return <p className="p-6 text-center text-sm text-muted-foreground">No activity in this range.</p>;
  }

  const series: { key: keyof Omit<TrendPoint, "date" | "label">; label: string; color: string }[] = [
    { key: "applications", label: "Applications", color: "#3b82f6" },
    { key: "documents", label: "Documents", color: "#10b981" },
    { key: "tasks", label: "Tasks", color: "#f59e0b" },
    { key: "leads", label: "Leads", color: "#8b5cf6" },
  ];

  const maxValue = Math.max(
    1,
    ...points.flatMap((p) => series.map((s) => p[s.key] as number)),
  );

  const chartWidth = 800;
  const chartHeight = 200;
  const padding = { top: 10, right: 20, bottom: 30, left: 30 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const xStep = points.length > 1 ? innerWidth / (points.length - 1) : 0;
  const yScale = (v: number) => innerHeight - (v / maxValue) * innerHeight;

  return (
    <div>
      {/* Legend */}
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden />
            <span className="text-muted-foreground">{s.label}</span>
          </span>
        ))}
      </div>

      {/* Chart */}
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="h-auto w-full min-w-[600px]"
          role="img"
          aria-label="Activity trend over the selected range"
        >
          {/* Y axis grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = padding.top + t * innerHeight;
            const value = Math.round(maxValue * (1 - t));
            return (
              <g key={t}>
                <line
                  x1={padding.left} x2={chartWidth - padding.right}
                  y1={y} y2={y}
                  stroke="currentColor" strokeOpacity="0.1" strokeWidth="1"
                />
                <text
                  x={padding.left - 6} y={y + 3}
                  textAnchor="end" fontSize="10" fill="currentColor" fillOpacity="0.5"
                >
                  {value}
                </text>
              </g>
            );
          })}

          {/* X axis labels — show every Nth to avoid overlap */}
          {points.map((p, i) => {
            const showLabel = points.length <= 12 || i % Math.ceil(points.length / 10) === 0;
            if (!showLabel) return null;
            const x = padding.left + i * xStep;
            return (
              <text
                key={i}
                x={x} y={chartHeight - padding.bottom + 16}
                textAnchor="middle" fontSize="10" fill="currentColor" fillOpacity="0.6"
              >
                {p.label}
              </text>
            );
          })}

          {/* Lines */}
          {series.map((s) => {
            const path = points
              .map((p, i) => {
                const x = padding.left + i * xStep;
                const y = padding.top + yScale(p[s.key] as number);
                return `${i === 0 ? "M" : "L"}${x},${y}`;
              })
              .join(" ");
            return (
              <path
                key={s.key}
                d={path}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ── Conversion funnel ────────────────────────────────────────────────

function ConversionFunnel({ kpis }: { kpis: Kpis }) {
  const stages = [
    { label: "Leads Converted", value: kpis.convertedLeads, color: "bg-success" },
    { label: "Applications Submitted", value: kpis.applicationsSubmitted, color: "bg-info" },
    { label: "Visa Submissions", value: kpis.visaSubmissions, color: "bg-primary" },
    { label: "Visa Approvals", value: kpis.visaApprovals, color: "bg-success" },
  ];
  const max = Math.max(1, ...stages.map((s) => s.value));

  return (
    <div className="space-y-3">
      {stages.map((s) => (
        <div key={s.label} className="flex items-center gap-3">
          <div className="w-48 shrink-0 text-xs font-medium text-muted-foreground">{s.label}</div>
          <div className="flex-1">
            <div className="h-6 overflow-hidden rounded-md bg-muted">
              <div
                className={`flex h-full items-center justify-end px-2 text-xs font-semibold text-white ${s.color}`}
                style={{ width: `${Math.max(8, (s.value / max) * 100)}%` }}
              >
                {s.value}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
