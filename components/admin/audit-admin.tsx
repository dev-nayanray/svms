"use client";

import { DataTable, type Column } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-kit";

type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  userId: string | null;
  ipAddress: string | null;
  createdAt: string;
};

export function AuditAdmin() {
  const columns: Column<AuditLog>[] = [
    { key: "createdAt", header: "Date", sortable: true, render: (l) => new Date(l.createdAt).toLocaleString("en-GB") },
    { key: "action", header: "Action", sortable: true, render: (l) => <span className="font-mono text-xs font-medium">{l.action}</span> },
    { key: "entity", header: "Entity", render: (l) => l.entity },
    { key: "entityId", header: "Entity ID", render: (l) => <span className="font-mono text-xs text-muted-foreground">{l.entityId ?? "—"}</span> },
    { key: "userId", header: "Actor", render: (l) => <span className="font-mono text-xs text-muted-foreground">{l.userId ?? "system"}</span> },
    { key: "ipAddress", header: "IP", render: (l) => l.ipAddress ?? "—" },
  ];

  return (
    <>
      <PageHeader
        title="Audit Logs"
        description="Every important administrative action, immutably recorded."
        breadcrumbs={["Admin", "Audit Logs"]}
      />
      <DataTable
        endpoint="/api/audit-logs"
        columns={columns}
        searchPlaceholder="Search by action or entity…"
        emptyMessage="No audit entries yet."
      />
    </>
  );
}
