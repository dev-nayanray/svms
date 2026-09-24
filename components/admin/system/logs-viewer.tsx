"use client";

import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { PageHeader } from "@/components/shared/page-kit";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SectionCard, StatusBadge } from "./shared";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { useMutation } from "@tanstack/react-query";
import { FileText, AlertTriangle, CheckCircle2, Info } from "lucide-react";

type LogEntry = {
  id: string;
  type: string;
  severity: string;
  description: string;
  resolved: string;
  ipAddress: string | null;
  resource: string | null;
  createdAt: string;
  metadata: unknown;
};

const SEVERITY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  DEBUG: FileText,
  INFO: Info,
  WARNING: AlertTriangle,
  ERROR: AlertTriangle,
  CRITICAL: AlertTriangle,
};

export function LogsViewer() {
  const columns: Column<LogEntry>[] = [
    {
      key: "createdAt",
      header: "Timestamp",
      sortable: true,
      render: (l) => (
        <span className="whitespace-nowrap text-xs">
          {new Date(l.createdAt).toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
    },
    {
      key: "severity",
      header: "Severity",
      sortable: true,
      render: (l) => {
        const Icon = SEVERITY_ICON[l.severity] ?? Info;
        return (
          <span className="flex items-center gap-1">
            <Icon className={`h-3 w-3 ${l.severity === "CRITICAL" || l.severity === "ERROR" ? "text-destructive" : l.severity === "WARNING" ? "text-warning" : "text-info"}`} />
            <StatusBadge status={l.severity === "ERROR" || l.severity === "CRITICAL" ? "critical" : l.severity === "WARNING" ? "warning" : "info"} label={l.severity} />
          </span>
        );
      },
    },
    {
      key: "type",
      header: "Module",
      render: (l) => <code className="text-xs">{l.type}</code>,
    },
    {
      key: "description",
      header: "Description",
      render: (l) => (
        <div className="max-w-md">
          <p className="text-xs">{l.description}</p>
          {l.resource && <p className="font-mono text-[10px] text-muted-foreground">{l.resource}</p>}
        </div>
      ),
    },
    {
      key: "resolved",
      header: "Status",
      render: (l) => (
        <StatusBadge
          status={l.resolved === "OPEN" ? "warning" : l.resolved === "RESOLVED" ? "healthy" : "info"}
          label={l.resolved}
        />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (l) => <ResolveButton id={l.id} resolved={l.resolved} />,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="System Logs"
        description="Operational events, security incidents, backup errors, and cron failures."
        breadcrumbs={["Admin", "System Administration", "Logs"]}
      />

      <SectionCard
        title="Recent Events"
        description="Server-side paginated, filtered, and searchable."
      >
        <DataTable
          endpoint="/api/admin/system/logs"
          columns={columns}
          searchPlaceholder="Search event descriptions…"
          filters={[
            {
              key: "type",
              label: "Module",
              options: [
                { value: "backup", label: "Backups" },
                { value: "restore", label: "Restores" },
                { value: "verify", label: "Verification" },
                { value: "cron", label: "Cron jobs" },
                { value: "auth", label: "Authentication" },
                { value: "security", label: "Security" },
                { value: "config", label: "Configuration" },
                { value: "storage", label: "Storage" },
                { value: "email", label: "Email" },
                { value: "api", label: "API" },
                { value: "system", label: "System" },
              ],
            },
            {
              key: "severity",
              label: "Severity",
              options: [
                { value: "DEBUG", label: "Debug" },
                { value: "INFO", label: "Info" },
                { value: "WARNING", label: "Warning" },
                { value: "ERROR", label: "Error" },
                { value: "CRITICAL", label: "Critical" },
              ],
            },
            {
              key: "resolved",
              label: "Status",
              options: [
                { value: "OPEN", label: "Open" },
                { value: "ACKNOWLEDGED", label: "Acknowledged" },
                { value: "RESOLVED", label: "Resolved" },
              ],
            },
          ]}
          emptyMessage="No log entries found."
        />
      </SectionCard>
    </div>
  );
}

function ResolveButton({ id, resolved }: { id: string; resolved: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (resolution: "ACKNOWLEDGED" | "RESOLVED") =>
      apiFetch(`/api/admin/system/logs/${id}/resolve`, { method: "PATCH", json: { resolution } }),
    onSuccess: () => {
      toast({ title: "Event marked as resolved", variant: "success" });
      qc.invalidateQueries({ queryKey: ["/api/admin/system/logs"] });
    },
    onError: (err) => toast({ title: "Failed to resolve", description: (err as Error).message, variant: "error" }),
  });

  if (resolved === "RESOLVED") {
    return (
      <span className="flex items-center gap-1 text-xs text-success">
        <CheckCircle2 className="h-3 w-3" /> Resolved
      </span>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate(resolved === "OPEN" ? "ACKNOWLEDGED" : "RESOLVED")}
    >
      {resolved === "OPEN" ? "Acknowledge" : "Resolve"}
    </Button>
  );
}
