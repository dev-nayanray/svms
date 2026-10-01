"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui";

/**
 * Reusable building blocks for the System Administration module.
 */

export type Status =
  | "healthy"
  | "warning"
  | "critical"
  | "not_configured"
  | "PASS"
  | "WARN"
  | "FAIL"
  | "INFO"
  | "info"
  | "unknown";

export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  const map: Record<Status, { tone: "default" | "success" | "warning" | "destructive" | "info"; text: string }> = {
    healthy: { tone: "success", text: "Healthy" },
    warning: { tone: "warning", text: "Warning" },
    critical: { tone: "destructive", text: "Critical" },
    not_configured: { tone: "default", text: "Not Configured" },
    PASS: { tone: "success", text: "PASS" },
    WARN: { tone: "warning", text: "WARN" },
    FAIL: { tone: "destructive", text: "FAIL" },
    INFO: { tone: "info", text: "INFO" },
    info: { tone: "info", text: "Info" },
    unknown: { tone: "default", text: "—" },
  };
  const entry = map[status] ?? map.unknown;
  return (
    <Badge tone={entry.tone}>
      {label ?? entry.text}
    </Badge>
  );
}

export function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "success" | "warning" | "destructive" | "info";
  onClick?: () => void;
}) {
  const tones = {
    default: "border-border",
    success: "border-success/30 bg-success/5",
    warning: "border-warning/30 bg-warning/5",
    destructive: "border-destructive/30 bg-destructive/5",
    info: "border-info/30 bg-info/5",
  } as const;
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className={cn(
        "flex w-full flex-col items-start gap-1 rounded-lg border bg-card p-4 text-left transition-colors",
        tones[tone],
        onClick && "hover:bg-muted/50",
      )}
    >
      <div className="flex w-full items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </button>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4", className)}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

export function bytesToHuman(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function msToHuman(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60 * 1000) return `${(ms / 1000).toFixed(1)} s`;
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}m ${sec}s`;
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)}d ago`;
  return d.toLocaleDateString("en-GB");
}
