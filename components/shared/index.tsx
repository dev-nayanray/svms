import { cn } from "@/lib/utils";

export function StatCard({
  title,
  value,
  hint,
  icon,
}: {
  title: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function TableShell({
  headers,
  children,
  empty,
}: {
  headers: string[];
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs font-medium text-muted-foreground">
          <tr>
            {headers.map((h) => (
              <th key={h} className="whitespace-nowrap px-4 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
      {empty && <div className="p-6 text-center text-sm text-muted-foreground">No records found.</div>}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  basePath,
  query = {},
}: {
  page: number;
  totalPages: number;
  basePath: string;
  query?: Record<string, string | undefined>;
}) {
  const build = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };
  return (
    <div className="flex items-center justify-between px-1 py-3 text-sm">
      <span className="text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <a href={build(page - 1)} className="rounded-md border border-border px-3 py-1 hover:bg-muted">
            Previous
          </a>
        )}
        {page < totalPages && (
          <a href={build(page + 1)} className="rounded-md border border-border px-3 py-1 hover:bg-muted">
            Next
          </a>
        )}
      </div>
    </div>
  );
}

const STATUS_TONES: Record<string, "default" | "success" | "warning" | "destructive" | "info"> = {
  // Active / positive
  ACTIVE: "success",
  APPROVED: "success",
  PAID: "success",
  COMPLETED: "success",
  CONVERTED: "success",
  ISSUED: "info",
  // In progress / informational
  UPLOADED: "info",
  IN_PROGRESS: "info",
  UNDER_REVIEW: "info",
  SUBMITTED: "info",
  BIOMETRICS: "info",
  INTERVIEW: "info",
  PROCESSING: "info",
  PREPARATION: "info",
  TODO: "default",
  // Pending / warning
  PENDING: "warning",
  PARTIAL: "warning",
  REQUESTED: "warning",
  DRAFT: "default",
  // Negative / danger
  REJECTED: "destructive",
  REFUSED: "destructive",
  OVERDUE: "destructive",
  CANCELLED: "destructive",
  LOST: "destructive",
  REFUNDED: "destructive",
  WITHDRAWN: "destructive",
  EXPIRED: "destructive",
  ARCHIVED: "default",
  INACTIVE: "default",
  SUSPENDED: "warning",
  // Lead statuses
  NEW: "info",
  CONTACTED: "info",
  COUNSELING: "info",
  QUALIFIED: "success",
  // Priorities
  LOW: "default",
  MEDIUM: "info",
  HIGH: "warning",
  URGENT: "destructive",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONES[status] ?? "default";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        tone === "success" && "border-success/20 bg-success/10 text-success",
        tone === "warning" && "border-warning/20 bg-warning/10 text-warning",
        tone === "destructive" && "border-destructive/20 bg-destructive/10 text-destructive",
        tone === "info" && "border-info/20 bg-info/10 text-info",
        tone === "default" && "border-border bg-muted text-muted-foreground",
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
