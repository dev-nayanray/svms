"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui";
import { SimpleBarChart, SimplePieChart } from "@/components/charts";
import { ChartCard, DateRangeFilter, KpiGrid, WidgetCard, type RangeValue } from "@/components/dashboard";
import { formatMoney, formatDate } from "@/lib/utils";
import Link from "next/link";

type Point = { name: string; value: number };

type DashboardData = {
  range: string;
  kpis: {
    totalStudents: number;
    activeStudents: number;
    newLeads: number;
    activeApplications: number;
    visaSubmitted: number;
    visaApproved: number;
    visaRefused: number;
    pendingDocuments: number;
    outstandingPayments: number;
    monthlyRevenue: number;
  };
  charts: {
    byCountry: Point[];
    byStage: Point[];
    byIntake: Point[];
    monthly: { name: string; registrations: number; revenue: number }[];
    employeePerformance: { name: string; cases: number }[];
  };
  widgets: {
    todayTasks: number;
    overdueTasks: number;
    pendingDocuments: number;
    upcomingDeadlines: { id: string; title: string; dueDate: string | null; student: { firstName: string } | null }[];
    recentApplications: { id: string; number: string; student: string; country: string; stage: string; createdAt: string }[];
    recentPayments: { id: string; student: string; amount: number; currency: string; method: string; date: string }[];
    recentActivities: { id: string; action: string; entity: string; createdAt: string }[];
  };
};

export function AdminDashboardView() {
  const [filter, setFilter] = useState<RangeValue>({ range: "30d" });

  const queryStr = () => {
    const sp = new URLSearchParams({ range: filter.range });
    if (filter.range === "custom") {
      if (filter.from) sp.set("from", filter.from);
      if (filter.to) sp.set("to", filter.to);
    }
    return sp.toString();
  };

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["admin-dashboard", filter.range, filter.from, filter.to],
    queryFn: () => apiFetch<DashboardData>(`/api/admin/dashboard?${queryStr()}`),
    placeholderData: keepPreviousData,
  });

  const k = data?.kpis;
  const c = data?.charts;
  const w = data?.widgets;

  return (
    <div className="space-y-6">
      {/* Header + filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Business Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Live overview of your consultancy operations
            {data?.range ? ` · ${data.range}` : ""}
            .
          </p>
        </div>
        <DateRangeFilter value={filter} onChange={setFilter} isPending={isPending} />
      </div>

      {/* Global error state */}
      {isError && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load dashboard: {(error as Error).message}
          <Button variant="outline" size="sm" className="ml-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* KPI cards */}
      <KpiGrid
        isPending={isPending && !data}
        kpis={
          !k
            ? Array.from({ length: 10 }, (_, i) => ({ label: `kpi-${i}`, value: "" }))
            : [
                { label: "Total Students", value: k.totalStudents },
                { label: "Active Students", value: k.activeStudents },
                { label: "New Leads", value: k.newLeads },
                { label: "Active Applications", value: k.activeApplications },
                { label: "Visa Submitted", value: k.visaSubmitted },
                { label: "Visa Approved", value: k.visaApproved, tone: "success" },
                { label: "Visa Refused", value: k.visaRefused, tone: "danger" },
                { label: "Pending Documents", value: k.pendingDocuments, tone: k.pendingDocuments > 0 ? "warning" : "default" },
                { label: "Outstanding Payments", value: formatMoney(k.outstandingPayments), tone: k.outstandingPayments > 0 ? "warning" : "default" },
                { label: "Revenue (period)", value: formatMoney(k.monthlyRevenue), tone: "success" },
              ]
        }
      />

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Applications by Country" isPending={isPending} isError={isError} onRetry={() => refetch()} hasData={(c?.byCountry ?? []).length > 0}>
          {c && <SimplePieChart data={c.byCountry} />}
        </ChartCard>
        <ChartCard title="Applications by Stage" isPending={isPending} isError={isError} onRetry={() => refetch()} hasData={(c?.byStage ?? []).length > 0}>
          {c && <SimpleBarChart data={c.byStage} />}
        </ChartCard>
        <ChartCard title="Applications by Intake" isPending={isPending} isError={isError} onRetry={() => refetch()} hasData={(c?.byIntake ?? []).length > 0}>
          {c && <SimpleBarChart data={c.byIntake} />}
        </ChartCard>
        <ChartCard
          title="Visa Decision Statistics"
          isPending={isPending}
          isError={isError}
          onRetry={() => refetch()}
          hasData={!!k && k.visaApproved + k.visaSubmitted + k.visaRefused > 0}
        >
          {k && (
            <SimplePieChart
              data={[
                { name: "Approved", value: k.visaApproved },
                { name: "Submitted (pending)", value: k.visaSubmitted },
                { name: "Refused", value: k.visaRefused },
              ].filter((d) => d.value > 0)}
            />
          )}
        </ChartCard>
        <ChartCard title="Monthly Student Registration" isPending={isPending} isError={isError} onRetry={() => refetch()} hasData={(c?.monthly ?? []).some((m) => m.registrations > 0)}>
          {c && <SimpleBarChart data={c.monthly.map((m) => ({ name: m.name, value: m.registrations }))} />}
        </ChartCard>
        <ChartCard title="Monthly Revenue" isPending={isPending} isError={isError} onRetry={() => refetch()} hasData={(c?.monthly ?? []).some((m) => m.revenue > 0)}>
          {c && <SimpleBarChart data={c.monthly.map((m) => ({ name: m.name, value: m.revenue }))} />}
        </ChartCard>
        <ChartCard title="Employee Performance (cases)" isPending={isPending} isError={isError} onRetry={() => refetch()} hasData={(c?.employeePerformance ?? []).some((e) => e.cases > 0)}>
          {c && <SimpleBarChart data={c.employeePerformance.map((e) => ({ name: e.name, value: e.cases }))} />}
        </ChartCard>
      </div>

      {/* Operational widgets */}
      <div className="grid gap-4 lg:grid-cols-3">
        <WidgetCard title="Today's Tasks" count={w?.todayTasks} isPending={isPending}>
          <WidgetRow label="Overdue tasks" value={w?.overdueTasks} tone={w && w.overdueTasks > 0 ? "danger" : "default"} />
          <WidgetRow label="Pending documents" value={w?.pendingDocuments} tone={w && w.pendingDocuments > 0 ? "warning" : "default"} />
          <Link href="/admin/tasks" className="mt-2 inline-block text-sm text-primary hover:underline">
            View all tasks →
          </Link>
        </WidgetCard>
        <WidgetCard title="Upcoming Deadlines" isPending={isPending}>
          {w && w.upcomingDeadlines.length === 0 && (
            <p className="text-muted-foreground">Nothing scheduled.</p>
          )}
          {w?.upcomingDeadlines.map((t) => (
            <div key={t.id} className="flex justify-between border-b border-border py-1.5 last:border-0">
              <span className="min-w-0 truncate pr-2">{t.title}</span>
              <span className="shrink-0 text-muted-foreground">{formatDate(t.dueDate)}</span>
            </div>
          ))}
        </WidgetCard>
        <WidgetCard title="Recent Applications" isPending={isPending}>
          {w && w.recentApplications.length === 0 && (
            <p className="text-muted-foreground">No applications yet.</p>
          )}
          {w?.recentApplications.map((a) => (
            <Link key={a.id} href={`/admin/applications/${a.id}`} className="flex justify-between border-b border-border py-1.5 last:border-0 hover:bg-muted/40">
              <span className="font-medium">{a.number}</span>
              <span className="min-w-0 truncate pl-2 text-muted-foreground">{a.student} · {a.country}</span>
            </Link>
          ))}
        </WidgetCard>
        <WidgetCard title="Recent Payments" isPending={isPending}>
          {w && w.recentPayments.length === 0 && <p className="text-muted-foreground">No payments yet.</p>}
          {w?.recentPayments.map((p) => (
            <div key={p.id} className="flex justify-between border-b border-border py-1.5 last:border-0">
              <span className="min-w-0 truncate pr-2">{p.student}</span>
              <span className="shrink-0 font-medium">{formatMoney(p.amount, p.currency)}</span>
            </div>
          ))}
        </WidgetCard>
        <WidgetCard title="Recent Activity" isPending={isPending}>
          {w && w.recentActivities.length === 0 && <p className="text-muted-foreground">No activity yet.</p>}
          {w?.recentActivities.map((a) => (
            <div key={a.id} className="flex justify-between border-b border-border py-1.5 last:border-0">
              <span className="font-mono text-xs">{a.action}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatDate(a.createdAt)}</span>
            </div>
          ))}
        </WidgetCard>
        <WidgetCard title="Documents & Finance" isPending={isPending}>
          <WidgetRow label="Pending documents" value={w?.pendingDocuments} tone={w && w.pendingDocuments > 0 ? "warning" : "default"} />
          <WidgetRow label="Outstanding payments" value={k ? formatMoney(k.outstandingPayments) : undefined} tone={k && k.outstandingPayments > 0 ? "warning" : "default"} />
          <div className="mt-2 flex gap-3 text-sm">
            <Link href="/admin/documents" className="text-primary hover:underline">Documents →</Link>
            <Link href="/admin/invoices" className="text-primary hover:underline">Invoices →</Link>
          </div>
        </WidgetCard>
      </div>
    </div>
  );
}

function WidgetRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string | undefined;
  tone?: "default" | "warning" | "danger";
}) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          tone === "danger"
            ? "font-semibold text-destructive"
            : tone === "warning"
              ? "font-semibold text-warning"
              : "font-semibold"
        }
      >
        {value ?? "…"}
      </span>
    </div>
  );
}
