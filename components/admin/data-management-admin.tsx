"use client";

import { useRef, useState } from "react";
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
  Upload,
  CheckCircle2,
  XCircle,
  Eye,
  FileUp,
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
      a.download = `${moduleKey}-export-${new Date().toISOString().slice(0, 10)}.${format === "json" ? "json" : "csv"}`;
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

      {/* Import Section */}
      <ImportSection />

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

// ── Import Section ─────────────────────────────────────────────────

type ImportPreviewResult = {
  module: string;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: { row: number; field?: string; error: string; severity: string }[];
  preview: { row: number; data: Record<string, unknown>; status: string; error?: string }[];
};

type ImportExecuteResult = {
  module: string;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: { row: number; field?: string; error: string; severity: string }[];
};

function ImportSection() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [mode, setMode] = useState<"create" | "update" | "validate">("create");
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<ImportExecuteResult | null>(null);

  function handleFileSelect(f: File) {
    setFile(f);
    setPreview(null);
    setResult(null);
    setPayload(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        setPayload(json);
        toast({ title: `File loaded: ${json.module ?? "unknown"} (${json.records?.length ?? 0} records)` });
      } catch {
        toast({ title: "Invalid JSON file", variant: "error" });
        setFile(null);
      }
    };
    reader.readAsText(f);
  }

  async function handlePreview() {
    if (!payload) return;
    setLoading(true);
    try {
      const res = await apiFetch<ImportPreviewResult>("/api/admin/data/import/preview", {
        method: "POST",
        json: payload,
      });
      setPreview(res);
      if (res.errors?.length > 0) {
        toast({ title: `Preview complete — ${res.failed} errors found`, variant: "error" });
      } else {
        toast({ title: `Preview complete — ${res.total} records, ${res.skipped} duplicates`, variant: "success" });
      }
    } catch (err) {
      toast({ title: "Preview failed", description: (err as Error).message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleExecute() {
    if (!payload) return;
    if (!confirm(`Import ${preview?.total ?? 0} records in "${mode}" mode? This will modify the database.`)) return;
    setExecuting(true);
    try {
      const res = await apiFetch<ImportExecuteResult>("/api/admin/data/import/execute", {
        method: "POST",
        json: { ...payload, mode },
      });
      setResult(res);
      toast({
        title: `Import complete — ${res.created} created, ${res.updated} updated, ${res.skipped} skipped`,
        variant: res.failed > 0 ? "error" : "success",
      });
    } catch (err) {
      toast({ title: "Import failed", description: (err as Error).message, variant: "error" });
    } finally {
      setExecuting(false);
    }
  }

  async function downloadTemplate(module: string) {
    try {
      const template = await apiFetch<Record<string, unknown>>(`/api/admin/data/templates?module=${module}`);
      const blob = new Blob([JSON.stringify(template, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${module}-template.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Template downloaded", variant: "success" });
    } catch (err) {
      toast({ title: "Failed to download template", variant: "error" });
    }
  }

  function reset() {
    setFile(null);
    setPayload(null);
    setPreview(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Upload className="h-5 w-5 text-primary" />
        Import Data
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload a JSON file to import data. Preview and validate before executing.
      </p>

      {/* File Upload */}
      {!file && (
        <div className="mt-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex min-h-[100px] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 p-4 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <FileUp className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Click to select a JSON file</p>
            <p className="text-xs text-muted-foreground">Supported format: .json</p>
          </button>
        </div>
      )}

      {/* File Loaded */}
      {file && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <FileJson className="h-5 w-5 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
                {payload ? ` · Module: ${String(payload.module ?? "?")} · ${Array.isArray(payload.records) ? payload.records.length : 0} records` : ""}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={reset}>
              <XCircle className="h-4 w-4" />
            </Button>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={handlePreview} disabled={loading || !payload} size="sm">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
              Preview & Validate
            </Button>
            <Button onClick={handleExecute} disabled={executing || !payload || !preview} size="sm" variant="outline">
              {executing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Execute Import
            </Button>
          </div>

          {/* Mode Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Import mode:</span>
            <div className="flex gap-1">
              {(["create", "update", "validate"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    mode === m ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m === "create" ? "Create New" : m === "update" ? "Update Existing" : "Validate Only"}
                </button>
              ))}
            </div>
          </div>

          {/* Preview Results */}
          {preview && (
            <div className="space-y-3 rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold">Preview Results</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <StatBox label="Total" value={preview.total} />
                <StatBox label="Valid" value={preview.total - preview.skipped - preview.failed} tone="text-emerald-600" />
                <StatBox label="Duplicates" value={preview.skipped} tone="text-amber-600" />
                <StatBox label="Invalid" value={preview.failed} tone="text-red-600" />
                <StatBox label="Errors" value={preview.errors.length} tone="text-red-600" />
              </div>

              {/* Error list (first 10) */}
              {preview.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-red-200 bg-red-50/50 p-3 dark:bg-red-950/10">
                  <p className="mb-2 text-xs font-semibold text-red-600">Errors ({preview.errors.length}):</p>
                  {preview.errors.slice(0, 10).map((err, i) => (
                    <p key={i} className="text-xs text-red-700 dark:text-red-400">
                      Row {err.row}{err.field ? ` · ${err.field}` : ""}: {err.error}
                    </p>
                  ))}
                  {preview.errors.length > 10 && (
                    <p className="mt-1 text-xs text-muted-foreground">...and {preview.errors.length - 10} more</p>
                  )}
                </div>
              )}

              {/* Preview table (first 5 rows) */}
              {preview.preview.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="pb-1 pr-2">Row</th>
                        <th className="pb-1 pr-2">Status</th>
                        <th className="pb-1 pr-2">Key Fields</th>
                        <th className="pb-1">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.preview.slice(0, 5).map((row) => (
                        <tr key={row.row} className="border-b border-border/50">
                          <td className="py-1.5 pr-2 tabular-nums">{row.row}</td>
                          <td className="py-1.5 pr-2">
                            {row.status === "valid" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                            {row.status === "duplicate" && <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                            {row.status === "invalid" && <XCircle className="h-3.5 w-3.5 text-red-600" />}
                          </td>
                          <td className="py-1.5 pr-2 truncate">{Object.entries(row.data).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(", ")}</td>
                          <td className="py-1.5 truncate text-muted-foreground">{row.error ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Execution Results */}
          {result && (
            <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 dark:bg-emerald-950/10">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                Import Complete
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatBox label="Created" value={result.created} tone="text-emerald-600" />
                <StatBox label="Updated" value={result.updated} tone="text-blue-600" />
                <StatBox label="Skipped" value={result.skipped} tone="text-amber-600" />
                <StatBox label="Failed" value={result.failed} tone="text-red-600" />
              </div>
              {result.errors.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-lg border border-red-200 bg-red-50/50 p-2 dark:bg-red-950/10">
                  {result.errors.slice(0, 5).map((err, i) => (
                    <p key={i} className="text-xs text-red-700 dark:text-red-400">
                      Row {err.row}: {err.error}
                    </p>
                  ))}
                </div>
              )}
              <Button size="sm" variant="outline" onClick={reset}>Import Another File</Button>
            </div>
          )}
        </div>
      )}

      {/* Templates */}
      <div className="mt-6 border-t border-border pt-4">
        <h3 className="text-sm font-semibold">Download Templates</h3>
        <p className="mt-1 text-xs text-muted-foreground">JSON templates with example data and field descriptions.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {["students", "leads", "applications", "documents", "payments", "invoices", "tasks", "appointments", "universities", "courses", "countries"].map((mod) => (
            <button
              key={mod}
              onClick={() => downloadTemplate(mod)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              <FileJson className="h-3 w-3" />
              {mod}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-2 text-center">
      <p className={cn("text-lg font-bold tabular-nums", tone)}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
