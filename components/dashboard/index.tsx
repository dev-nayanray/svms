"use client";

import { Card, CardContent } from "@/components/ui";
import { Skeleton } from "@/components/ui/overlays";
import { EmptyState } from "@/components/shared";
import { cn } from "@/lib/utils";

/** Grid of KPI cards with a skeleton loading state. */
export function KpiGrid({
  kpis,
  isPending,
}: {
  kpis: { label: string; value: string | number; tone?: "default" | "warning" | "danger" | "success" }[];
  isPending: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {isPending
        ? Array.from({ length: kpis.length || 10 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-2 p-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-16" />
              </CardContent>
            </Card>
          ))
        : kpis.map((k) => (
            <Card key={k.label}>
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
                <p
                  className={cn(
                    "mt-1 text-2xl font-semibold",
                    k.tone === "warning" && "text-warning",
                    k.tone === "danger" && "text-destructive",
                    k.tone === "success" && "text-success"
                  )}
                >
                  {k.value}
                </p>
              </CardContent>
            </Card>
          ))}
    </div>
  );
}

/** Chart card with loading skeleton, empty state, and error state baked in. */
export function ChartCard({
  title,
  isPending,
  isError,
  hasData,
  onRetry,
  children,
  height = 260,
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
    <Card>
      <div className="p-4 pb-2 text-base font-semibold">{title}</div>
      <div className="p-4 pt-2" style={{ minHeight: height }}>
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
          <EmptyState title="No data yet" description="This chart fills in as records accumulate." />
        ) : (
          children
        )}
      </div>
    </Card>
  );
}

/** Compact operational widget card with title, optional count badge, and body. */
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
    <Card>
      <div className="flex items-center justify-between p-4 pb-2">
        <span className="text-base font-semibold">{title}</span>
        {count !== undefined && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            {isPending ? "…" : count}
          </span>
        )}
      </div>
      <div className="p-4 pt-2 text-sm">
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
    </Card>
  );
}

export type RangeValue = { range: string; from?: string; to?: string };

/** Preset + custom date-range filter bar. */
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
    { value: "7d", label: "7 Days" },
    { value: "30d", label: "30 Days" },
    { value: "90d", label: "90 Days" },
    { value: "year", label: "This Year" },
  ];
  const isCustom = value.range === "custom";

  return (
    <div className="flex flex-wrap items-end gap-2" role="group" aria-label="Date range filter">
      {presets.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange({ range: p.value })}
          aria-pressed={value.range === p.value}
          disabled={isPending}
          className={cn(
            "h-9 rounded-md border px-3 text-sm font-medium transition-colors",
            value.range === p.value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border hover:bg-muted"
          )}
        >
          {p.label}
        </button>
      ))}
      <div className={cn("flex items-end gap-1.5", isCustom ? "" : "opacity-70")}>
        <div className="space-y-1">
          <label htmlFor="range-from" className="block text-xs text-muted-foreground">From</label>
          <input
            id="range-from"
            type="date"
            value={value.from ?? ""}
            onChange={(e) => onChange({ range: "custom", from: e.target.value, to: value.to })}
            className="h-9 rounded-md border border-border bg-card px-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="range-to" className="block text-xs text-muted-foreground">To</label>
          <input
            id="range-to"
            type="date"
            value={value.to ?? ""}
            onChange={(e) => onChange({ range: "custom", from: value.from, to: e.target.value })}
            className="h-9 rounded-md border border-border bg-card px-2 text-sm"
          />
        </div>
        {isCustom && (
          <button
            onClick={() => onChange({ range: "30d" })}
            className="h-9 rounded-md border border-border px-3 text-sm hover:bg-muted"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
