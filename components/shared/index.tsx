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
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
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
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
      <p className="font-semibold text-foreground">{title}</p>
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
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/30 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <tr>
            {headers.map((h) => (
              <th key={h} className="whitespace-nowrap px-4 py-3 font-semibold">
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
          <a href={build(page - 1)} className="rounded-lg border border-border px-3 py-1.5 font-medium hover:bg-muted transition-colors">
            Previous
          </a>
        )}
        {page < totalPages && (
          <a href={build(page + 1)} className="rounded-lg border border-border px-3 py-1.5 font-medium hover:bg-muted transition-colors">
            Next
          </a>
        )}
      </div>
    </div>
  );
}

const STATUS_TONES: Record<string, "default" | "success" | "warning" | "destructive" | "info"> = {
  ACTIVE: "success",
  APPROVED: "success",
  PAID: "success",
  COMPLETED: "success",
  CONVERTED: "success",
  ISSUED: "info",
  UPLOADED: "info",
  IN_PROGRESS: "info",
  UNDER_REVIEW: "info",
  SUBMITTED: "info",
  BIOMETRICS: "info",
  INTERVIEW: "info",
  PROCESSING: "info",
  PREPARATION: "info",
  TODO: "default",
  PENDING: "warning",
  PARTIAL: "warning",
  REQUESTED: "warning",
  DRAFT: "default",
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
  NEW: "info",
  CONTACTED: "info",
  COUNSELING: "info",
  QUALIFIED: "success",
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
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        tone === "success" && "border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
        tone === "warning" && "border-amber-500/20 bg-amber-500/10 text-amber-600",
        tone === "destructive" && "border-red-500/20 bg-red-500/10 text-red-600",
        tone === "info" && "border-blue-500/20 bg-blue-500/10 text-blue-600",
        tone === "default" && "border-border bg-muted text-muted-foreground",
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
