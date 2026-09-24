"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { PageHeader, LoadingState } from "@/components/shared/page-kit";
import { MetricCard, SectionCard, StatusBadge, bytesToHuman, timeAgo, msToHuman } from "./shared";
import { Button } from "@/components/ui";
import Link from "next/link";
import {
  Activity,
  Database,
  ShieldCheck,
  Search,
  BarChart3,
  DatabaseBackup,
  Settings,
  FileText,
  Wrench,
  Server,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

type Overview = {
  appVersion: string;
  environment: string;
  lastDeployment: string | null;
  appUrl: string;
  database: { status: string; latencyMs?: number; provider: string };
  backup: {
    lastSuccessful: {
      reference: string;
      createdAt: string;
      sizeBytes: number;
      documentCount: number;
      status: string;
      verified: boolean;
    } | null;
    totalBackups: number;
    storageProvider: string;
    autoEnabled: boolean;
    nextScheduledRun: string | null;
  };
  security: {
    failedLogins24h: number;
    pendingEvents: number;
    authConfigured: boolean;
    httpsEnabled: boolean;
  };
  sessions: { activeUsers5m: number; activeUsers1h: number };
  seo: { siteName: string; canonicalBase: string; robotsTxt: boolean; sitemapXml: boolean; indexPrivateRoutes: boolean };
  analytics: { ga4: boolean; gtm: boolean; meta: boolean; vercelAnalytics: boolean };
  storage: { provider: string; documentCount: number; bytesUsed: number };
  cron: { isVercel: boolean; jobsConfigured: number };
  health: {
    database: string;
    auth: string;
    storage: string;
    email: string;
    backup: string;
    analytics: string;
  };
  maintenance: { active: boolean; message: string; startedAt: string | null };
  env: { totalConfigured: number; totalVars: number; missingCritical: string[] };
};

export function SystemOverview() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["/api/admin/system"],
    queryFn: () => apiFetch<Overview>("/api/admin/system"),
    staleTime: 30 * 1000, // 30s — overview is dynamic
  });

  if (isPending) return <LoadingState label="Loading system overview…" />;
  if (isError || !data) {
    return (
      <div className="p-4">
        <p className="text-destructive">Failed to load system overview.</p>
        <Button onClick={() => refetch()} className="mt-2">Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Administration"
        description={`Production health, backup, security & analytics for ${data.seo.siteName || "Euroscope"}.`}
        breadcrumbs={["Admin", "System Administration", "Overview"]}
        actions={
          <Button variant="outline" onClick={() => refetch()}>
            Refresh
          </Button>
        }
      />

      {/* Critical alerts row */}
      {(data.maintenance.active ||
        data.health.database === "critical" ||
        data.security.pendingEvents > 0 ||
        data.env.missingCritical.length > 0) && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />
            <div className="flex-1 space-y-1 text-sm">
              <p className="font-medium">Active alerts requiring attention:</p>
              <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                {data.maintenance.active && (
                  <li>Maintenance mode is ON — started {timeAgo(data.maintenance.startedAt)}</li>
                )}
                {data.health.database === "critical" && <li>Database is unreachable</li>}
                {data.security.pendingEvents > 0 && (
                  <li>{data.security.pendingEvents} pending high-severity security event(s)</li>
                )}
                {data.env.missingCritical.length > 0 && (
                  <li>Missing critical env vars: {data.env.missingCritical.join(", ")}</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Top metric grid — System status row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        <MetricCard
          label="Environment"
          value={<span className="capitalize">{data.environment}</span>}
          sub={data.appVersion ? `v${data.appVersion}` : undefined}
          icon={Server}
        />
        <MetricCard
          label="Database"
          value={<StatusBadge status={data.health.database as "healthy" | "warning" | "critical"} />}
          sub={data.database.latencyMs ? `${data.database.latencyMs}ms response` : undefined}
          icon={Database}
          tone={data.health.database === "healthy" ? "success" : data.health.database === "warning" ? "warning" : "destructive"}
        />
        <MetricCard
          label="Auth"
          value={<StatusBadge status={data.security.authConfigured ? "healthy" : "critical"} />}
          sub={data.security.httpsEnabled ? "HTTPS enabled" : "HTTPS required"}
          icon={ShieldCheck}
          tone={data.security.authConfigured && data.security.httpsEnabled ? "success" : "destructive"}
        />
        <MetricCard
          label="Storage"
          value={bytesToHuman(data.storage.bytesUsed)}
          sub={`${data.storage.documentCount} files`}
          icon={DatabaseBackup}
          tone="info"
        />
        <MetricCard
          label="Active sessions"
          value={data.sessions.activeUsers5m}
          sub={`${data.sessions.activeUsers1h} in last hour`}
          icon={Users}
        />
        <MetricCard
          label="Pending security events"
          value={data.security.pendingEvents}
          sub={`${data.security.failedLogins24h} failed logins (24h)`}
          icon={AlertTriangle}
          tone={data.security.pendingEvents > 0 ? "warning" : "success"}
        />
      </div>

      {/* Backup row */}
      <SectionCard
        title="Backup & Restore"
        description="Last successful backup, scheduled next run, and storage provider."
        actions={
          <Link href="/admin/system/backups">
            <Button variant="outline" size="sm">Manage backups</Button>
          </Link>
        }
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricCard
            label="Last backup"
            value={data.backup.lastSuccessful ? data.backup.lastSuccessful.reference : "—"}
            sub={data.backup.lastSuccessful ? timeAgo(data.backup.lastSuccessful.createdAt) : "No backups yet"}
            icon={Clock}
            tone={data.backup.lastSuccessful ? "success" : "warning"}
          />
          <MetricCard
            label="Backup size"
            value={data.backup.lastSuccessful ? bytesToHuman(data.backup.lastSuccessful.sizeBytes) : "—"}
            sub={data.backup.lastSuccessful ? `${data.backup.lastSuccessful.documentCount} docs` : undefined}
          />
          <MetricCard
            label="Storage"
            value={<span className="capitalize">{data.backup.storageProvider}</span>}
            sub={`${data.backup.totalBackups} total backups`}
          />
          <MetricCard
            label="Auto-backup"
            value={<StatusBadge status={data.backup.autoEnabled ? "healthy" : "not_configured"} />}
            sub={data.backup.nextScheduledRun ? `Next: ${timeAgo(data.backup.nextScheduledRun)}` : "Disabled"}
            tone={data.backup.autoEnabled ? "success" : "default"}
          />
        </div>
      </SectionCard>

      {/* Health & Analytics row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="System Health"
          description="Real-time checks across all dependencies."
          actions={
            <Link href="/admin/system/health">
              <Button variant="outline" size="sm">View details</Button>
            </Link>
          }
        >
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <HealthMini label="Application" status={data.health.auth} />
            <HealthMini label="Database" status={data.health.database} />
            <HealthMini label="Auth" status={data.health.auth} />
            <HealthMini label="Storage" status={data.health.storage} />
            <HealthMini label="Email" status={data.health.email} />
            <HealthMini label="Backup" status={data.health.backup} />
            <HealthMini label="Analytics" status={data.health.analytics} />
            <HealthMini label="Cron" status={data.cron.isVercel ? "healthy" : "warning"} />
            <HealthMini label="Rate limit" status="healthy" />
          </div>
        </SectionCard>

        <SectionCard
          title="Analytics & Tracking"
          description="Configured providers and consent state."
          actions={
            <Link href="/admin/system/analytics">
              <Button variant="outline" size="sm">Manage</Button>
            </Link>
          }
        >
          <div className="grid grid-cols-2 gap-2">
            <ProviderMini name="Google Analytics 4" enabled={data.analytics.ga4} />
            <ProviderMini name="Google Tag Manager" enabled={data.analytics.gtm} />
            <ProviderMini name="Meta Pixel" enabled={data.analytics.meta} />
            <ProviderMini name="Vercel Analytics" enabled={data.analytics.vercelAnalytics} />
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Tracking is gated by user consent. Marketing pixels only fire after explicit opt-in.
          </div>
        </SectionCard>
      </div>

      {/* SEO + Cron + Maintenance row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          title="SEO"
          description="robots.txt, sitemap.xml, and indexing posture."
          actions={
            <Link href="/admin/system/seo">
              <Button variant="outline" size="sm">Manage</Button>
            </Link>
          }
        >
          <div className="space-y-2 text-sm">
            <Row label="robots.txt" value={<StatusBadge status={data.seo.robotsTxt ? "healthy" : "critical"} />} />
            <Row label="sitemap.xml" value={<StatusBadge status={data.seo.sitemapXml ? "healthy" : "critical"} />} />
            <Row
              label="Private routes blocked"
              value={<StatusBadge status={data.seo.indexPrivateRoutes ? "warning" : "healthy"} label={data.seo.indexPrivateRoutes ? "Allowed (risky)" : "Blocked"} />}
            />
            <Row label="Canonical base" value={<code className="text-xs">{data.seo.canonicalBase}</code>} />
          </div>
        </SectionCard>

        <SectionCard
          title="Cron / Background Jobs"
          description="Scheduled tasks running in production."
          actions={
            <Link href="/admin/system/health">
              <Button variant="outline" size="sm">View jobs</Button>
            </Link>
          }
        >
          <div className="space-y-2 text-sm">
            <Row label="Environment" value={data.cron.isVercel ? "Vercel Cron" : "Self-hosted"} />
            <Row label="Configured jobs" value={data.cron.jobsConfigured} />
            <Row label="Maintenance" value={<StatusBadge status={data.maintenance.active ? "warning" : "healthy"} label={data.maintenance.active ? "Active" : "Off"} />} />
          </div>
        </SectionCard>

        <SectionCard
          title="Environment Variables"
          description="Critical + optional configuration."
          actions={
            <Link href="/admin/system/configuration">
              <Button variant="outline" size="sm">View all</Button>
            </Link>
          }
        >
          <div className="space-y-2 text-sm">
            <Row
              label="Configured"
              value={<span className="font-mono">{data.env.totalConfigured}/{data.env.totalVars}</span>}
            />
            {data.env.missingCritical.length > 0 ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
                <p className="font-medium text-destructive">Missing critical:</p>
                <ul className="mt-1 list-disc pl-4 text-destructive/80">
                  {data.env.missingCritical.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <Row label="Critical vars" value={<CheckCircle2 className="h-4 w-4 text-success" />} />
            )}
          </div>
        </SectionCard>
      </div>

      {/* Quick links */}
      <SectionCard title="Quick Links" description="Jump to any system administration module.">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <QuickLink href="/admin/system/backups" icon={DatabaseBackup} label="Backups" />
          <QuickLink href="/admin/system/security" icon={ShieldCheck} label="Security" />
          <QuickLink href="/admin/system/seo" icon={Search} label="SEO" />
          <QuickLink href="/admin/system/analytics" icon={BarChart3} label="Analytics" />
          <QuickLink href="/admin/system/health" icon={Activity} label="Health" />
          <QuickLink href="/admin/system/configuration" icon={Settings} label="Config" />
          <QuickLink href="/admin/system/logs" icon={FileText} label="Logs" />
          <QuickLink href="/admin/system/maintenance" icon={Wrench} label="Maintenance" />
          <QuickLink href="/admin/system/disaster-recovery" icon={FileText} label="Disaster Recovery" />
          <QuickLink href="/admin/system/audit" icon={FileText} label="Audit" />
        </div>
      </SectionCard>
    </div>
  );
}

function HealthMini({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-background/50 p-2">
      <span className="text-xs">{label}</span>
      <StatusBadge status={status as "healthy" | "warning" | "critical" | "not_configured"} />
    </div>
  );
}

function ProviderMini({ name, enabled }: { name: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-background/50 p-2">
      <span className="text-xs">{name}</span>
      <StatusBadge status={enabled ? "healthy" : "not_configured"} label={enabled ? "On" : "Off"} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-md border border-border bg-background/50 p-3 text-center hover:bg-muted/50"
    >
      <Icon className="h-5 w-5 text-muted-foreground" />
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}

void msToHuman; // silence unused import
