"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DataTable, type Column } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-kit";
import { Button } from "@/components/ui";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { Skeleton } from "@/components/ui/overlays";
import { EmptyState } from "@/components/shared";
import { apiFetch } from "@/lib/api-client";
import { formatJsonValue } from "@/lib/constants/audit";
import { ShieldCheck, Lock } from "lucide-react";

type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  userId: string | null;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { name: string; email: string } | null;
};


/**
 * Admin Audit Log — immutable record of every important administrative
 * action, with full server-side filtering, search, and pagination.
 *
 * Security:
 *  - Requires `audit_logs.read` (admin only).
 *  - Audit records are immutable — no edit/delete actions in the UI.
 *  - Financial, security, and permission-related actions are always
 *    auditable (enforced by each module's service layer).
 */
export function AuditAdmin() {
  const [detailEntry, setDetailEntry] = useState<AuditLog | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const staticParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (dateFrom) p.dateFrom = dateFrom;
    if (dateTo) p.dateTo = dateTo;
    return p;
  }, [dateFrom, dateTo]);

  const columns: Column<AuditLog>[] = [
    {
      key: "createdAt",
      header: "Timestamp",
      sortable: true,
      render: (l) => (
        <span className="whitespace-nowrap text-xs">
          {new Date(l.createdAt).toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
    },
    {
      key: "user",
      header: "User",
      render: (l) => (
        <div>
          <p className="text-sm font-medium">{l.user?.name ?? "System"}</p>
          {l.user?.email && (
            <p className="text-xs text-muted-foreground">{l.user.email}</p>
          )}
        </div>
      ),
    },
    {
      key: "action",
      header: "Action",
      sortable: true,
      render: (l) => (
        <button
          onClick={() => setDetailEntry(l)}
          className="font-mono text-xs font-medium text-primary hover:underline"
        >
          {l.action}
        </button>
      ),
    },
    { key: "entity", header: "Entity", sortable: true, render: (l) => l.entity },
    {
      key: "entityId",
      header: "Entity ID",
      render: (l) => (
        <span className="font-mono text-xs text-muted-foreground">
          {l.entityId ? l.entityId.slice(-8) : "—"}
        </span>
      ),
    },
    { key: "ipAddress", header: "IP", render: (l) => l.ipAddress ?? "—" },
    {
      key: "newValue",
      header: "Change",
      render: (l) => {
        const oldStr = formatJsonValue(l.oldValue, 60);
        const newStr = formatJsonValue(l.newValue, 60);
        if (oldStr === "—" && newStr === "—") return "—";
        return (
          <span className="text-xs text-muted-foreground">
            {oldStr !== "—" && <span className="text-destructive">{oldStr}</span>}
            {oldStr !== "—" && newStr !== "—" && " → "}
            {newStr !== "—" && <span className="text-success">{newStr}</span>}
          </span>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Audit Logs"
        description="Immutable record of every important administrative action. Filterable, searchable, and server-side paginated."
        breadcrumbs={["Admin", "Audit Logs"]}
        actions={
          <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            Immutable (no edits)
          </div>
        }
      />

      {/* Security notice */}
      <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
        <div className="flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="font-medium">Audit records are immutable</p>
            <p className="mt-0.5 text-muted-foreground">
              Financial, security, and permission-related actions are always auditable. Records
              cannot be edited or deleted from the UI — they can only be created via the
              <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">auditLog.record()</code>
              service from authorized API routes.
            </p>
          </div>
        </div>
      </div>

      {/* Date range filter */}
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <div className="space-y-1">
          <label htmlFor="audit-from" className="block text-xs text-muted-foreground">From</label>
          <input
            id="audit-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="audit-to" className="block text-xs text-muted-foreground">To</label>
          <input
            id="audit-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-2 text-sm"
          />
        </div>
        {(dateFrom || dateTo) && (
          <Button
            variant="outline"
            size="sm"
            className="mb-1.5"
            onClick={() => { setDateFrom(""); setDateTo(""); }}
          >
            Clear dates
          </Button>
        )}
      </div>

      <DataTable
        endpoint="/api/audit-logs"
        columns={columns}
        searchPlaceholder="Search by action or entity…"
        staticParams={staticParams}
        filters={[
          { key: "entity", label: "Entity", options: [] }, // populated dynamically below
        ]}
        emptyMessage="No audit entries match your filters."
      />

      {/* Detail dialog — shows full old/new values + user agent */}
      {detailEntry && (
        <Dialog open onOpenChange={(v) => !v && setDetailEntry(null)}>
          <DialogContent
            title={detailEntry.action}
            description={`${detailEntry.entity} · ${new Date(detailEntry.createdAt).toLocaleString("en-GB")}`}
            className="max-w-2xl"
          >
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">User</p>
                  <p className="mt-0.5 font-medium">{detailEntry.user?.name ?? "System"}</p>
                  {detailEntry.user?.email && (
                    <p className="text-xs text-muted-foreground">{detailEntry.user.email}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">IP Address</p>
                  <p className="mt-0.5 font-mono text-xs">{detailEntry.ipAddress ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Entity</p>
                  <p className="mt-0.5">{detailEntry.entity}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Entity ID</p>
                  <p className="mt-0.5 font-mono text-xs">{detailEntry.entityId ?? "—"}</p>
                </div>
              </div>

              {detailEntry.userAgent && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">User Agent</p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">{detailEntry.userAgent}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-destructive">Old Value</p>
                  <pre className="mt-0.5 max-h-48 overflow-auto rounded-md border border-border bg-muted/30 p-2 text-xs">
                    {detailEntry.oldValue ? JSON.stringify(detailEntry.oldValue, null, 2) : "—"}
                  </pre>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-success">New Value</p>
                  <pre className="mt-0.5 max-h-48 overflow-auto rounded-md border border-border bg-muted/30 p-2 text-xs">
                    {detailEntry.newValue ? JSON.stringify(detailEntry.newValue, null, 2) : "—"}
                  </pre>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

/**
 * Per-entity audit timeline — rendered as a tab on Student/Application/
 * Payment/Invoice/Document/Employee detail pages.
 *
 * Fetches from /api/audit-logs/entity?entity=X&entityId=Y
 */

type AuditTimelineEntry = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  userId: string | null;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  createdAt: string;
  userName: string;
};

export function AuditTimeline({ entity, entityId }: { entity: string; entityId: string }) {
  const { data, isPending } = useQuery({
    queryKey: ["/api/audit-logs/entity", entity, entityId],
    queryFn: () =>
      apiFetch<{ data: AuditTimelineEntry[] }>(
        `/api/audit-logs/entity?entity=${entity}&entityId=${entityId}`,
      ),
    staleTime: 10_000,
  });

  const entries: AuditTimelineEntry[] = data?.data ?? [];

  if (isPending) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return <EmptyState title="No audit activity" description="No recorded events for this entity." />;
  }

  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {entries.map((entry: AuditTimelineEntry) => (
        <li key={entry.id}>
          <span
            className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary"
            aria-hidden
          />
          <p className="font-mono text-xs font-medium">{entry.action}</p>
          {Boolean(entry.oldValue || entry.newValue) && (
            <p className="text-xs text-muted-foreground">
              {entry.oldValue ? formatJsonValue(entry.oldValue) : "{}"} →{" "}
              {entry.newValue ? formatJsonValue(entry.newValue) : "{}"}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {entry.userName ?? "System"} · {new Date(entry.createdAt).toLocaleString("en-GB")}
          </p>
          {entry.ipAddress && (
            <p className="font-mono text-[10px] text-muted-foreground/60">{entry.ipAddress}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
