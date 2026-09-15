"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui";
import { SimpleBarChart, SimplePieChart } from "@/components/charts";
import { ChartCard, DateRangeFilter, KpiGrid, WidgetCard, type RangeValue } from "@/components/dashboard";
import { formatMoney, formatDate } from "@/lib/utils";
import Link from "next/link";
import { AlertCircle, RefreshCw, Plus, UserPlus, FileText, CreditCard, CheckSquare } from "lucide-react";

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
  const loading = isPending && !data;

  return (
    <div className="space-y-6">
      {/* ── Header + filters ── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Business Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Live overview of your consultancy operations
            {data?.range ? ` · ${data.range}` : ""}
          </p>
        </div>
        <DateRangeFilter value={filter} onChange={setFilter} isPending={isPending} />
      </div>

      {/* ── Quick Actions ── */}
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/students" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary-hover hover:-translate-y-0.5">
          <UserPlus className="h-4 w-4" /> New Student
        </Link>
        <Link href="/admin/tasks" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-semibold shadow-sm transition-all hover:bg-muted hover:-translate-y-0.5">
          <CheckSquare className="h-4 w-4" /> New Task
        </Link>
        <Link href="/admin/invoices" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-semibold shadow-sm transition-all hover:bg-muted hover:-translate-y-0.5">
          <CreditCard className="h-4 w-4" /> New Invoice
        </Link>
        <Link href="/admin/leads" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-semibold shadow-sm transition-all hover:bg-muted hover:-translate-y-0.5">
          <Plus className="h-4 w-4" /> New Lead
        </Link>
        <Link href="/admin/applications" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-semibold shadow-sm transition-all hover:bg-muted hover:-translate-y-0.5">
          <FileText className="h-4 w-4" /> New Application
        </Link>
      </div>

      {/* ── Error state ── */}
      {isError && (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" aria-hidden />
          <span>Failed to load dashboard: {(error as Error).message}</span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      )}

      {/* ── Action Required — consolidated attention banner ── */}
      {k && (w?.overdueTasks || 0) > 0 || (k?.pendingDocuments || 0) > 0 || (k?.outstandingPayments || 0) > 0 ? (
        <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-4 dark:bg-amber-950/10">
          <h2 className="flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-4 w-4" /> Action Required
          </h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {(w?.overdueTasks ?? 0) > 0 && (
              <Link href="/admin/tasks" className="group inline-flex items-center gap-2 rounded-lg border border-amber-300/50 bg-white px-3 py-2 text-sm font-medium shadow-sm transition-all hover:border-amber-400 hover:shadow dark:bg-card">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-red-500/15 text-xs font-bold text-red-600">{w?.overdueTasks}</span>
                Overdue tasks
                <span className="text-amber-500 transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            )}
            {(k?.pendingDocuments ?? 0) > 0 && (
              <Link href="/admin/documents" className="group inline-flex items-center gap-2 rounded-lg border border-amber-300/50 bg-white px-3 py-2 text-sm font-medium shadow-sm transition-all hover:border-amber-400 hover:shadow dark:bg-card">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-amber-500/15 text-xs font-bold text-amber-600">{k?.pendingDocuments}</span>
                Documents need review
                <span className="text-amber-500 transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            )}
            {(k?.outstandingPayments ?? 0) > 0 && (
              <Link href="/admin/invoices" className="group inline-flex items-center gap-2 rounded-lg border border-amber-300/50 bg-white px-3 py-2 text-sm font-medium shadow-sm transition-all hover:border-amber-400 hover:shadow dark:bg-card">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-blue-500/15 text-xs font-bold text-blue-600">{formatMoney(k?.outstandingPayments ?? 0)}</span>
                Outstanding payments
                <span className="text-amber-500 transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            )}
          </div>
        </div>
      ) : null}

      {/* ── KPI Cards — clickable, navigate to filtered list ── */}
      <KpiGrid
        isPending={loading}
        kpis={
          !k
            ? Array.from({ length: 10 }, (_, i) => ({ label: `kpi-${i}`, value: "" }))
            : [
                { label: "Total Students", value: k.totalStudents, icon: "students", href: "/admin/students" },
                { label: "Active Students", value: k.activeStudents, icon: "students", href: "/admin/students?status=ACTIVE" },
                { label: "New Leads", value: k.newLeads, icon: "leads", href: "/admin/leads" },
                { label: "Active Applications", value: k.activeApplications, icon: "applications", href: "/admin/applications" },
                { label: "Revenue (period)", value: formatMoney(k.monthlyRevenue), tone: "success", icon: "revenue", href: "/admin/payments" },
                { label: "Visa Submitted", value: k.visaSubmitted, icon: "visa", href: "/admin/visa" },
                { label: "Visa Approved", value: k.visaApproved, tone: "success", icon: "visa", href: "/admin/visa" },
                { label: "Visa Refused", value: k.visaRefused, tone: "danger", icon: "visa", href: "/admin/visa" },
                { label: "Pending Documents", value: k.pendingDocuments, tone: k.pendingDocuments > 0 ? "warning" : "default", icon: "documents", href: "/admin/documents" },
                { label: "Outstanding", value: formatMoney(k.outstandingPayments), tone: k.outstandingPayments > 0 ? "warning" : "default", icon: "payments", href: "/admin/invoices" },
              ]
        }
      />

      {/* ── Charts — 2 columns ── */}
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

      {/* ── Operational Widgets — 3 columns ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <WidgetCard title="Today's Tasks" count={w?.todayTasks} isPending={loading}>
          <WidgetRow label="Overdue tasks" value={w?.overdueTasks} tone={w && w.overdueTasks > 0 ? "danger" : "default"} />
          <WidgetRow label="Pending documents" value={w?.pendingDocuments} tone={w && w.pendingDocuments > 0 ? "warning" : "default"} />
          <Link href="/admin/tasks" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
            View all tasks →
          </Link>
        </WidgetCard>

        <WidgetCard title="Upcoming Deadlines" isPending={loading}>
          {w && w.upcomingDeadlines.length === 0 && <p className="text-muted-foreground">Nothing scheduled.</p>}
          {w?.upcomingDeadlines.map((d) => (
            <div key={d.id} className="flex justify-between border-b border-border py-1.5 last:border-0 last:pb-0">
              <span className="min-w-0 truncate pr-2">{d.title}</span>
              <span className="shrink-0 text-xs font-medium text-muted-foreground">{formatDate(d.dueDate)}</span>
            </div>
          ))}
        </WidgetCard>

        <WidgetCard title="Recent Applications" isPending={loading}>
          {w && w.recentApplications.length === 0 && <p className="text-muted-foreground">No applications yet.</p>}
          {w?.recentApplications.map((a) => (
            <Link key={a.id} href={`/admin/applications/${a.id}`} className="flex justify-between border-b border-border py-1.5 last:border-0 last:pb-0 hover:bg-muted/40">
              <span className="font-medium">{a.number}</span>
              <span className="min-w-0 truncate pl-2 text-xs text-muted-foreground">{a.student} · {a.country}</span>
            </Link>
          ))}
        </WidgetCard>

        <WidgetCard title="Recent Payments" isPending={loading}>
          {w && w.recentPayments.length === 0 && <p className="text-muted-foreground">No payments yet.</p>}
          {w?.recentPayments.map((p) => (
            <div key={p.id} className="flex justify-between border-b border-border py-1.5 last:border-0 last:pb-0">
              <span className="min-w-0 truncate pr-2">{p.student}</span>
              <span className="shrink-0 font-semibold">{formatMoney(p.amount, p.currency)}</span>
            </div>
          ))}
        </WidgetCard>

        <WidgetCard title="Recent Activity" isPending={loading}>
          {w && w.recentActivities.length === 0 && <p className="text-muted-foreground">No activity yet.</p>}
          {w?.recentActivities.map((a) => (
            <div key={a.id} className="flex justify-between border-b border-border py-1.5 last:border-0 last:pb-0">
              <span className="min-w-0 truncate font-mono text-xs">{a.action}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatDate(a.createdAt)}</span>
            </div>
          ))}
        </WidgetCard>

        <WidgetCard title="Documents & Finance" isPending={loading}>
          <WidgetRow label="Pending documents" value={w?.pendingDocuments} tone={w && w.pendingDocuments > 0 ? "warning" : "default"} />
          <WidgetRow label="Outstanding payments" value={k ? formatMoney(k.outstandingPayments) : undefined} tone={k && k.outstandingPayments > 0 ? "warning" : "default"} />
          <div className="mt-3 flex gap-4 text-sm">
            <Link href="/admin/documents" className="font-medium text-primary hover:underline">Documents →</Link>
            <Link href="/admin/invoices" className="font-medium text-primary hover:underline">Invoices →</Link>
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
    <div className="flex justify-between py-1">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          tone === "danger"
            ? "font-bold text-destructive"
            : tone === "warning"
              ? "font-bold text-warning"
              : "font-semibold"
        }
      >
        {value ?? "…"}
      </span>
    </div>
  );
}
