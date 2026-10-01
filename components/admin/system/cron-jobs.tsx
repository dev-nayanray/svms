"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { PageHeader } from "@/components/shared/page-kit";
import { SectionCard, StatusBadge, timeAgo } from "@/components/admin/system/shared";
import { Button } from "@/components/ui";
import { Clock, Loader2, RefreshCw } from "lucide-react";

type Job = {
  name: string;
  description: string;
  schedule: string;
  endpoint: string;
  lastRun: {
    name: string;
    lastRunAt: string | null;
    lastStatus: string | null;
    lastError: string | null;
  };
};

/**
 * Cron Jobs panel — read-only view of scheduled jobs + their last-run status.
 * Triggers can be added manually via the "Run now" button (admin-only).
 */
export function CronJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<{ jobs: Job[] }>("/api/admin/system/jobs");
      setJobs(data.jobs);
    } finally {
      setLoading(false);
    }
  }
  void load;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await apiFetch<{ jobs: Job[] }>("/api/admin/system/jobs");
        if (!cancelled) setJobs(data.jobs);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function trigger(jobName: string, endpoint: string) {
    setTriggering(jobName);
    try {
      const token = process.env.NEXT_PUBLIC_CRON_SECRET ?? "";
      const sep = endpoint.includes("?") ? "&" : "?";
      await fetch(`${endpoint}${sep}token=${token}`);
      // Refresh via the same IIFE pattern
      setLoading(true);
      try {
        const data = await apiFetch<{ jobs: Job[] }>("/api/admin/system/jobs");
        setJobs(data.jobs);
      } finally {
        setLoading(false);
      }
    } finally {
      setTriggering(null);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cron Jobs"
        description="Scheduled background jobs running on Vercel Cron."
        breadcrumbs={["Admin", "System Administration", "Cron Jobs"]}
        actions={
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        }
      />

      <SectionCard
        title="Configured Jobs"
        description="Jobs defined in vercel.json + tracked in the SystemHealthCheck table."
      >
        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={job.name} className="rounded-md border border-border bg-background/50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <code className="text-sm font-medium">{job.name}</code>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{job.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                    <span className="font-mono text-muted-foreground">{job.schedule}</span>
                    <StatusBadge
                      status={
                        job.lastRun.lastStatus === "COMPLETED" || job.lastRun.lastStatus === "healthy"
                          ? "healthy"
                          : job.lastRun.lastStatus === "FAILED" || job.lastRun.lastStatus === "critical"
                            ? "critical"
                            : "not_configured"
                      }
                      label={job.lastRun.lastStatus ?? "Never run"}
                    />
                    {job.lastRun.lastRunAt && (
                      <span className="text-muted-foreground">Last: {timeAgo(job.lastRun.lastRunAt)}</span>
                    )}
                  </div>
                  {job.lastRun.lastError && (
                    <p className="mt-2 rounded bg-destructive/5 p-2 text-xs text-destructive">
                      {job.lastRun.lastError}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={triggering === job.name}
                  onClick={() => trigger(job.name, job.endpoint)}
                >
                  {triggering === job.name ? "Running…" : "Run now"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="vercel.json Configuration"
        description="The cron jobs are declared here. Vercel automatically calls these endpoints on schedule."
      >
        <pre className="overflow-x-auto rounded-md bg-muted/50 p-3 text-xs font-mono">
{`{
  "crons": [
    { "path": "/api/admin/system/backups/cron?job=daily-backup",      "schedule": "0 2 * * *" },
    { "path": "/api/admin/system/backups/cron?job=weekly-backup",     "schedule": "0 3 * * 1" },
    { "path": "/api/admin/system/backups/cron?job=monthly-backup",    "schedule": "0 4 1 * *" },
    { "path": "/api/admin/system/jobs/cron?job=cleanup-deleted-backups", "schedule": "0 5 * * *" },
    { "path": "/api/admin/system/health/cron?job=health-check",       "schedule": "*/15 * * * *" }
  ]
}`}
        </pre>
        <p className="mt-2 text-xs text-muted-foreground">
          Each endpoint requires <code className="rounded bg-muted px-1.5 py-0.5">CRON_SECRET</code> in production — set it as an env var in your Vercel project.
        </p>
      </SectionCard>
    </div>
  );
}
