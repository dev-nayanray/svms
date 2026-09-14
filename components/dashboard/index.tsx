"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/overlays";
import {
  Users,
  Target,
  FolderKanban,
  Stamp,
  FileText,
  CreditCard,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

type Kpi = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warning" | "danger" | "success";
  icon?: string;
  href?: string;
};

const KPI_ICONS: Record<string, LucideIcon> = {
  students: Users,
  leads: Target,
  applications: FolderKanban,
  visa: Stamp,
  documents: FileText,
  payments: CreditCard,
  revenue: TrendingUp,
};

export function KpiGrid({ kpis, isPending }: { kpis: Kpi[]; isPending: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {isPending
        ? Array.from({ length: kpis.length || 10 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2.5 h-8 w-16" />
              <Skeleton className="mt-1.5 h-2.5 w-12" />
            </div>
          ))
        : kpis.map((k) => {
            const Icon = k.icon ? KPI_ICONS[k.icon] : null;
            const toneClass =
              k.tone === "warning"
                ? "text-warning"
                : k.tone === "danger"
                  ? "text-destructive"
                  : k.tone === "success"
                    ? "text-success"
                    : "text-foreground";
            const content = (
              <>
                {k.tone && k.tone !== "default" && (
                  <div
                    className={cn(
                      "absolute inset-x-0 top-0 h-0.5",
                      k.tone === "success" && "bg-success/50",
                      k.tone === "warning" && "bg-warning/50",
                      k.tone === "danger" && "bg-destructive/50",
                    )}
                    aria-hidden
                  />
                )}
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {k.label}
                </p>
                <p className={cn("mt-2 text-2xl font-bold tracking-tight", toneClass)}>
                  {k.value}
                </p>
                {k.hint && (
                  <p className="mt-1 text-[11px] text-muted-foreground">{k.hint}</p>
                )}
                {Icon && (
                  <span className="absolute right-3 top-3 text-muted-foreground/15 transition-colors group-hover:text-muted-foreground/25">
                    <Icon className="h-7 w-7" aria-hidden />
                  </span>
                )}
                {k.href && (
                  <span className="absolute bottom-2 right-3 text-[10px] font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    View →
                  </span>
                )}
              </>
            );
            const cardClasses = cn(
              "group relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
              k.tone === "success" && "border-success/20",
              k.tone === "warning" && "border-warning/20",
              k.tone === "danger" && "border-destructive/20",
              k.href && "cursor-pointer",
            );
            if (k.href) {
              return (
                <a key={k.label} href={k.href} className={cardClasses}>
                  {content}
                </a>
              );
            }
            return (
              <div key={k.label} className={cardClasses}>
                {content}
              </div>
            );
          })}
    </div>
  );
}

export function ChartCard({
  title,
  isPending,
  isError,
  hasData,
  onRetry,
  children,
  height = 220,
}: {
  title: string;
  isPending: boolean;
  isError?: boolean;
  hasData: boolean;
  onRetry?: () => void;
  children: React.ReactNode;
  height?: number;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-semibold tracking-tight">{title}</p>
        {isPending && (
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Loading…
          </span>
        )}
      </div>
      <div className="p-4" style={{ minHeight: height }}>
        {isPending ? (
          <div className="flex h-full items-end gap-2" aria-busy="true" aria-label={`${title} loading`}>
            {[40, 70, 55, 85, 60, 75, 50].map((h, i) => (
              <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
            ))}
          </div>
        ) : isError ? (
          <div role="alert" className="flex h-full flex-col items-center justify-center gap-2 text-sm text-destructive">
            Failed to load chart.
            {onRetry && (
              <button onClick={onRetry} className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-muted">
                Retry
              </button>
            )}
          </div>
        ) : !hasData ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No data yet
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export function WidgetCard({
  title,
  count,
  isPending,
  children,
}: {
  title: string;
  count?: number | string;
  isPending?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-semibold tracking-tight">{title}</span>
        {count !== undefined && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
            {isPending ? "…" : count}
          </span>
        )}
      </div>
      <div className="p-4 text-sm">
        {isPending ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export type RangeValue = { range: string; from?: string; to?: string };

export function DateRangeFilter({
  value,
  onChange,
  isPending,
}: {
  value: RangeValue;
  onChange: (v: RangeValue) => void;
  isPending?: boolean;
}) {
  const presets = [
    { value: "today", label: "Today" },
    { value: "7d", label: "7D" },
    { value: "30d", label: "30D" },
    { value: "90d", label: "90D" },
    { value: "year", label: "Year" },
  ];
  const isCustom = value.range === "custom";

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Date range filter">
      {presets.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange({ range: p.value })}
          aria-pressed={value.range === p.value}
          disabled={isPending}
          className={cn(
            "h-8 rounded-lg border px-2.5 text-xs font-semibold transition-all",
            value.range === p.value
              ? "border-primary bg-primary text-primary-foreground shadow-sm"
              : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {p.label}
        </button>
      ))}
      <div className={cn("flex items-center gap-1", isCustom ? "" : "opacity-60")}>
        <input
          type="date"
          value={value.from ?? ""}
          onChange={(e) => onChange({ range: "custom", from: e.target.value, to: value.to })}
          className="h-8 rounded-lg border border-border bg-card px-2 text-xs focus:border-primary focus:outline-none"
          aria-label="From date"
        />
        <input
          type="date"
          value={value.to ?? ""}
          onChange={(e) => onChange({ range: "custom", from: value.from, to: e.target.value })}
          className="h-8 rounded-lg border border-border bg-card px-2 text-xs focus:border-primary focus:outline-none"
          aria-label="To date"
        />
        {isCustom && (
          <button
            onClick={() => onChange({ range: "30d" })}
            className="h-8 rounded-lg border border-border px-2 text-xs hover:bg-muted"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
