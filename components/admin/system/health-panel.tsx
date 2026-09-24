"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { PageHeader, LoadingState } from "@/components/shared/page-kit";
import { SectionCard, StatusBadge } from "./shared";
import { Button } from "@/components/ui";
import { Activity, Database, Mail, HardDrive, Clock, Cpu, Globe, Shield } from "lucide-react";

type HealthCheck = {
  component: string;
  status: "healthy" | "warning" | "critical" | "not_configured";
  latencyMs?: number;
  message: string;
  details?: Record<string, unknown>;
};

type HealthReport = {
  overall: "healthy" | "warning" | "critical" | "not_configured";
  checks: HealthCheck[];
  timestamp: string;
};

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  database: Database,
  auth: Shield,
  storage: HardDrive,
  email: Mail,
  backup: HardDrive,
  cron: Clock,
  api: Cpu,
  cache: Cpu,
  rateLimit: Activity,
  analytics: Globe,
};

export function HealthPanel() {
  const { data, isPending, refetch } = useQuery({
    queryKey: ["/api/admin/system/health"],
    queryFn: () => apiFetch<HealthReport>("/api/admin/system/health"),
    staleTime: 30 * 1000,
  });

  if (isPending) return <LoadingState label="Running health checks…" />;
  if (!data) return <p className="text-destructive">Failed to load health report.</p>;

  const grouped = groupByStatus(data.checks);

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Health"
        description="Real-time checks across all application dependencies."
        breadcrumbs={["Admin", "System Administration", "Health"]}
        actions={
          <Button variant="outline" onClick={() => refetch()}>
            <Activity className="h-4 w-4" /> Re-run checks
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <SummaryCard label="Overall" status={data.overall} />
        <SummaryCard label="Healthy" status="healthy" count={grouped.healthy.length} />
        <SummaryCard label="Warnings" status="warning" count={grouped.warning.length} />
        <SummaryCard label="Critical" status="critical" count={grouped.critical.length} />
      </div>

      <SectionCard
        title="All Health Checks"
        description={`Last run: ${new Date(data.timestamp).toLocaleString()}`}
      >
        <div className="grid gap-3 md:grid-cols-2">
          {data.checks.map((c) => {
            const Icon = ICONS[c.component] ?? Activity;
            return (
              <div
                key={c.component}
                className={`rounded-md border p-3 ${
                  c.status === "healthy"
                    ? "border-success/30 bg-success/5"
                    : c.status === "warning"
                      ? "border-warning/30 bg-warning/5"
                      : c.status === "critical"
                        ? "border-destructive/30 bg-destructive/5"
                        : "border-border bg-muted/30"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium capitalize">{c.component}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{c.message}</p>
                {c.latencyMs != null && (
                  <p className="mt-1 text-xs font-mono">Latency: {c.latencyMs}ms</p>
                )}
                {c.details && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-muted-foreground">Details</summary>
                    <pre className="mt-1 overflow-x-auto rounded bg-muted/50 p-2 text-[10px] font-mono">
                      {JSON.stringify(c.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

function groupByStatus(checks: HealthCheck[]) {
  const out = { healthy: [] as HealthCheck[], warning: [] as HealthCheck[], critical: [] as HealthCheck[], not_configured: [] as HealthCheck[] };
  for (const c of checks) {
    out[c.status].push(c);
  }
  return out;
}

function SummaryCard({
  label,
  status,
  count,
}: {
  label: string;
  status: "healthy" | "warning" | "critical" | "not_configured";
  count?: number;
}) {
  const tones = {
    healthy: "border-success/30 bg-success/5 text-success",
    warning: "border-warning/30 bg-warning/5 text-warning",
    critical: "border-destructive/30 bg-destructive/5 text-destructive",
    not_configured: "border-border bg-muted/30 text-muted-foreground",
  };
  return (
    <div className={`rounded-lg border p-4 ${tones[status]}`}>
      <p className="text-xs uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums">
        {count != null ? count : <span className="capitalize">{status}</span>}
      </p>
    </div>
  );
}
