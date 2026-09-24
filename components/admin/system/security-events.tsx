"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { PageHeader } from "@/components/shared/page-kit";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SectionCard, StatusBadge } from "@/components/admin/system/shared";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { ShieldAlert, CheckCircle2 } from "lucide-react";

type SecurityEvent = {
  id: string;
  type: string;
  severity: string;
  description: string;
  userId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  resource: string | null;
  resolved: string;
  resolvedById: string | null;
  resolvedAt: string | null;
  metadata: unknown;
  createdAt: string;
};

export function SecurityEvents() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const resolveMutation = useMutation({
    mutationFn: async ({ id, resolution }: { id: string; resolution: "ACKNOWLEDGED" | "RESOLVED" }) =>
      apiFetch(`/api/admin/system/logs/${id}/resolve`, { method: "PATCH", json: { resolution } }),
    onSuccess: () => {
      toast({ title: "Event resolved", variant: "success" });
      qc.invalidateQueries({ queryKey: ["/api/admin/system/security/events"] });
    },
    onError: (err) => toast({ title: "Failed", description: (err as Error).message, variant: "error" }),
  });

  const columns: Column<SecurityEvent>[] = [
    {
      key: "createdAt",
      header: "Timestamp",
      sortable: true,
      render: (e) => (
        <span className="whitespace-nowrap text-xs">
          {new Date(e.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
        </span>
      ),
    },
    {
      key: "severity",
      header: "Severity",
      sortable: true,
      render: (e) => (
        <StatusBadge
          status={e.severity === "CRITICAL" ? "critical" : e.severity === "HIGH" ? "warning" : "info"}
          label={e.severity}
        />
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (e) => <code className="text-xs">{e.type}</code>,
    },
    {
      key: "description",
      header: "Description",
      render: (e) => (
        <div className="max-w-md">
          <p className="text-xs">{e.description}</p>
          {e.resource && <p className="font-mono text-[10px] text-muted-foreground">{e.resource}</p>}
          {e.ipAddress && <p className="font-mono text-[10px] text-muted-foreground">IP: {e.ipAddress}</p>}
        </div>
      ),
    },
    {
      key: "resolved",
      header: "Status",
      render: (e) => (
        <StatusBadge
          status={e.resolved === "OPEN" ? "warning" : e.resolved === "RESOLVED" ? "healthy" : "info"}
          label={e.resolved}
        />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (e) => (
        <div className="flex gap-1">
          {e.resolved === "OPEN" && (
            <Button
              size="sm"
              variant="outline"
              disabled={resolveMutation.isPending}
              onClick={() => resolveMutation.mutate({ id: e.id, resolution: "ACKNOWLEDGED" })}
            >
              Acknowledge
            </Button>
          )}
          {e.resolved !== "RESOLVED" && (
            <Button
              size="sm"
              variant="outline"
              disabled={resolveMutation.isPending}
              onClick={() => resolveMutation.mutate({ id: e.id, resolution: "RESOLVED" })}
            >
              Resolve
            </Button>
          )}
          {e.resolved === "RESOLVED" && (
            <span className="flex items-center gap-1 text-xs text-success">
              <CheckCircle2 className="h-3 w-3" /> Resolved
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Security Events"
        description="Audit of security-sensitive events: failed logins, suspicious requests, rate-limit hits, config changes."
        breadcrumbs={["Admin", "System Administration", "Security", "Events"]}
      />

      <SectionCard
        title="Events"
        description="Server-side paginated, filtered, searchable. Acknowledge or resolve open events."
        actions={<ShieldAlert className="h-4 w-4 text-muted-foreground" />}
      >
        <DataTable
          endpoint="/api/admin/system/security/events"
          columns={columns}
          searchPlaceholder="Search event descriptions…"
          filters={[
            {
              key: "type",
              label: "Type",
              options: [
                { value: "backup", label: "Backup" },
                { value: "restore", label: "Restore" },
                { value: "auth", label: "Auth" },
                { value: "security", label: "Security" },
                { value: "config", label: "Config" },
                { value: "storage", label: "Storage" },
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
                { value: "LOW", label: "Low" },
                { value: "MEDIUM", label: "Medium" },
                { value: "HIGH", label: "High" },
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
          emptyMessage="No security events recorded."
        />
      </SectionCard>
    </div>
  );
}
