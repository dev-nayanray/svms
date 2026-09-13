import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Standard employee page header — title + optional description + optional
 * actions slot. Keeps every employee page visually consistent.
 */
export function EmployeePageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground text-pretty">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * Simple stat card used across the employee dashboard. Numbers + label,
 * with an optional delta hint.
 */
export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "success" | "warning" | "destructive" | "info";
}) {
  const toneClass = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
    info: "text-info",
  }[tone];
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("mt-2 text-2xl font-semibold tabular-nums", toneClass)}>{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

/**
 * Empty-state placeholder for routes that ship later. Keeps the nav real
 * and reachable; the underlying page surfaces a clear "coming soon" card.
 */
export function ComingSoonCard({ title }: { title: string }) {
  return (
    <Card className="mx-auto max-w-md mt-12 text-center">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          This module ships in an upcoming release. The route is live so navigation
          and breadcrumbs work end-to-end.
        </p>
      </CardContent>
    </Card>
  );
}
