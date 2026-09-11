"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/overlays";

type Kpi = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warning" | "danger" | "success";
};

export function KpiGrid({ kpis, isPending }: { kpis: Kpi[]; isPending: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5">
      {isPending
        ? Array.from({ length: kpis.length || 10 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-7 w-14" />
              <Skeleton className="mt-1 h-2 w-16" />
            </div>
          ))
        : kpis.map((k) => (
            <div key={k.label} className="rounded-lg border border-border bg-card p-3.5">
              <p className="text-[11px] font-medium text-muted-foreground">{k.label}</p>
              <p
                className={cn(
                  "mt-1.5 text-xl font-bold tracking-tight",
                  k.tone === "warning" && "text-warning",
                  k.tone === "danger" && "text-destructive",
                  k.tone === "success" && "text-success",
                )}
              >
                {k.value}
              </p>
              {k.hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{k.hint}</p>}
            </div>
          ))}
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
  height = 240,
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
    <div className="rounded-lg border border-border bg-card">
      <div className="px-4 py-3 border-b border-border">
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <div className="p-4" style={{ minHeight: height }}>
        {isPending ? (
          <div
            className="flex h-full items-end gap-2"
            aria-busy="true"
            aria-label={`${title} loading`}
          >
            {[40, 70, 55, 85, 60, 75, 50].map((h, i) => (
              <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
            ))}
          </div>
        ) : isError ? (
          <div
            role="alert"
            className="flex h-full flex-col items-center justify-center gap-2 text-sm text-destructive"
          >
            Failed to load chart.
            {onRetry && (
              <button
                onClick={onRetry}
                className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-muted"
              >
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
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-semibold">{title}</span>
        {count !== undefined && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
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
            "h-8 rounded-md border px-2.5 text-xs font-medium transition-colors",
            value.range === p.value
              ? "border-primary bg-primary text-primary-foreground"
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
          className="h-8 rounded-md border border-border bg-card px-2 text-xs"
          aria-label="From date"
        />
        <input
          type="date"
          value={value.to ?? ""}
          onChange={(e) => onChange({ range: "custom", from: value.from, to: e.target.value })}
          className="h-8 rounded-md border border-border bg-card px-2 text-xs"
          aria-label="To date"
        />
        {isCustom && (
          <button
            onClick={() => onChange({ range: "30d" })}
            className="h-8 rounded-md border border-border px-2 text-xs hover:bg-muted"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
