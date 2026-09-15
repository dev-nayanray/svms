"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-kit";
import { Button, Badge } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import {
  Download,
  FileJson,
  FileSpreadsheet,
  Database,
  Users,
  FolderKanban,
  FileText,
  CreditCard,
  Receipt,
  CheckSquare,
  CalendarClock,
  Building2,
  BookOpen,
  Globe,
  GraduationCap,
  GitBranch,
  Stamp,
  MessageSquare,
  Bell,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Overview = {
  students: number; leads: number; applications: number; documents: number;
  payments: number; invoices: number; tasks: number; appointments: number;
  universities: number; courses: number; countries: number; employees: number;
  branches: number; visa: number; messages: number; notifications: number;
  auditLogs: number; demoStudents: number;
};

type Module = {
  key: string;
  label: string;
  icon: React.ReactNode;
  count: number;
  isPII?: boolean;
};

export function DataManagementAdmin() {
  const { toast } = useToast();
  const [exporting, setExporting] = useState<string | null>(null);

  const { data: overview, isLoading } = useQuery<Overview>({
    queryKey: ["/api/admin/data/overview"],
    queryFn: () => apiFetch<Overview>("/api/admin/data/overview"),
  });

  const modules: Module[] = overview ? [
    { key: "students", label: "Students", icon: <Users className="h-4 w-4" />, count: overview.students, isPII: true },
    { key: "leads", label: "Leads", icon: <Users className="h-4 w-4" />, count: overview.leads, isPII: true },
    { key: "applications", label: "Applications", icon: <FolderKanban className="h-4 w-4" />, count: overview.applications },
    { key: "documents", label: "Documents", icon: <FileText className="h-4 w-4" />, count: overview.documents },
    { key: "payments", label: "Payments", icon: <CreditCard className="h-4 w-4" />, count: overview.payments, isPII: true },
    { key: "invoices", label: "Invoices", icon: <Receipt className="h-4 w-4" />, count: overview.invoices, isPII: true },
    { key: "tasks", label: "Tasks", icon: <CheckSquare className="h-4 w-4" />, count: overview.tasks },
    { key: "appointments", label: "Appointments", icon: <CalendarClock className="h-4 w-4" />, count: overview.appointments },
    { key: "universities", label: "Universities", icon: <Building2 className="h-4 w-4" />, count: overview.universities },
    { key: "courses", label: "Courses", icon: <BookOpen className="h-4 w-4" />, count: overview.courses },
    { key: "countries", label: "Countries", icon: <Globe className="h-4 w-4" />, count: overview.countries },
    { key: "employees", label: "Employees", icon: <GraduationCap className="h-4 w-4" />, count: overview.employees, isPII: true },
    { key: "branches", label: "Branches", icon: <GitBranch className="h-4 w-4" />, count: overview.branches },
    { key: "visa", label: "Visa", icon: <Stamp className="h-4 w-4" />, count: overview.visa },
    { key: "messages", label: "Messages", icon: <MessageSquare className="h-4 w-4" />, count: overview.messages },
    { key: "notifications", label: "Notifications", icon: <Bell className="h-4 w-4" />, count: overview.notifications },
  ] : [];

  async function handleExport(moduleKey: string, format: "json" | "csv") {
    const mod = modules.find((m) => m.key === moduleKey);
    if (!mod) return;

    if (mod.isPII) {
      if (!confirm(`This export may contain personally identifiable information from ${mod.label}. Handle the downloaded file securely. Continue?`)) {
        return;
      }
    }

    setExporting(`${moduleKey}-${format}`);
    try {
      const url = `/api/admin/data/export?module=${moduleKey}&format=${format}&limit=10000`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${moduleKey}-export-${Date.now()}.${format === "json" ? "json" : "csv"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      toast({ title: "Export complete", description: `${mod.label} exported as ${format.toUpperCase()}`, variant: "success" });
    } catch (err) {
      toast({ title: "Export failed", description: (err as Error).message, variant: "error" });
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Management"
        description="Import, export, validate and manage system data securely."
      />

      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-card" />
          ))
        ) : (
          <>
            <OverviewCard icon={<Users className="h-4 w-4" />} label="Students" value={overview!.students} />
            <OverviewCard icon={<FolderKanban className="h-4 w-4" />} label="Applications" value={overview!.applications} />
            <OverviewCard icon={<FileText className="h-4 w-4" />} label="Documents" value={overview!.documents} />
            <OverviewCard icon={<CreditCard className="h-4 w-4" />} label="Payments" value={overview!.payments} />
            <OverviewCard icon={<Receipt className="h-4 w-4" />} label="Invoices" value={overview!.invoices} />
            <OverviewCard icon={<CheckSquare className="h-4 w-4" />} label="Tasks" value={overview!.tasks} />
          </>
        )}
      </div>

      {/* Demo Data Warning */}
      {overview && overview.demoStudents > 0 && (
        <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-4 dark:bg-amber-950/10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              {overview.demoStudents.toLocaleString()} demo records detected
            </p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            These are synthetic records (email pattern: demo+N@euroscope.demo). Use the &ldquo;Demo Only&rdquo; filter in exports to isolate them.
          </p>
        </div>
      )}

      {/* Export Section */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Download className="h-5 w-5 text-primary" />
          Export Data
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Export module data as JSON or CSV. Sensitive fields (passwords, tokens) are automatically excluded.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-4 font-semibold">Module</th>
                <th className="pb-2 pr-4 font-semibold">Records</th>
                <th className="pb-2 pr-4 font-semibold">PII</th>
                <th className="pb-2 pr-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {modules.map((mod) => (
                <tr key={mod.key} className="py-2">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
                        {mod.icon}
                      </span>
                      <span className="font-medium">{mod.label}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 tabular-nums">{mod.count.toLocaleString()}</td>
                  <td className="py-3 pr-4">
                    {mod.isPII ? (
                      <Badge tone="warning">PII</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExport(mod.key, "json")}
                        disabled={exporting === `${mod.key}-json` || mod.count === 0}
                      >
                        {exporting === `${mod.key}-json` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FileJson className="h-3.5 w-3.5" />
                        )}
                        JSON
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExport(mod.key, "csv")}
                        disabled={exporting === `${mod.key}-csv` || mod.count === 0}
                      >
                        {exporting === `${mod.key}-csv` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FileSpreadsheet className="h-3.5 w-3.5" />
                        )}
                        CSV
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Stats */}
      {overview && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Database Summary</h3>
            <div className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total Records</span><span className="font-semibold tabular-nums">{(overview.students + overview.applications + overview.documents + overview.payments + overview.invoices + overview.tasks + overview.appointments + overview.visa + overview.messages + overview.notifications).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Demo Records</span><span className="font-semibold tabular-nums">{overview.demoStudents.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Audit Logs</span><span className="font-semibold tabular-nums">{overview.auditLogs.toLocaleString()}</span></div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Reference Data</h3>
            <div className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Countries</span><span className="font-semibold tabular-nums">{overview.countries}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Universities</span><span className="font-semibold tabular-nums">{overview.universities}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Courses</span><span className="font-semibold tabular-nums">{overview.courses}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Branches</span><span className="font-semibold tabular-nums">{overview.branches}</span></div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Security</h3>
            <div className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Sensitive fields excluded</span><span className="font-semibold text-emerald-600">✓ Auto</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Rate limited</span><span className="font-semibold text-emerald-600">✓ 10/10s</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Audit logged</span><span className="font-semibold text-emerald-600">✓ All exports</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Max records per export</span><span className="font-semibold">10,000</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</span>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}
