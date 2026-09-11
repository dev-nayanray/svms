"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ConfirmDialog, FormDialog, PageHeader, type FormField } from "@/components/shared/page-kit";
import { StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { Plus } from "lucide-react";
import {
  BRANCH_STATUSES,
  BRANCH_STATUS_LABELS,
} from "@/lib/constants/branches";

type Employee = { id: string; user: { name: string } };
type Branch = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  managerId: string | null;
  status: string;
  deletedAt: string | null;
  createdAt: string;
  manager: { id: string; user: { name: string } } | null;
  _count?: { employees: number; students: number; users: number };
};

const statusOptions = BRANCH_STATUSES.map((s) => ({
  value: s,
  label: BRANCH_STATUS_LABELS[s],
}));

/**
 * Admin Branches list — full CRUD via reusable components:
 *  - search (name, code, address), status filter, archived toggle
 *  - sortable columns (name, code, status, createdAt)
 *  - row actions: View, Edit, Status (activate/deactivate), Archive
 */
export function BranchesAdmin() {
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/branches"] });

  const [createOpen, setCreateOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [statusBranch, setStatusBranch] = useState<Branch | null>(null);
  const [archiveBranch, setArchiveBranch] = useState<Branch | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const { data: employees } = useQuery({
    queryKey: ["/api/employees", "options"],
    queryFn: () =>
      apiFetch<{ data: Employee[] }>("/api/employees?pageSize=100"),
  });
  const managerOptions = (employees?.data ?? []).map((e) => ({
    value: e.id,
    label: e.user.name,
  }));

  const staticParams = useMemo(
    () => ({ archived: showArchived ? "true" : "false" }),
    [showArchived],
  );

  const fields: FormField[] = [
    { type: "text", name: "name", label: "Branch name", required: true },
    { type: "text", name: "code", label: "Code", required: true, placeholder: "HQ" },
    { type: "text", name: "address", label: "Address" },
    { type: "text", name: "phone", label: "Phone" },
    { type: "email", name: "email", label: "Email" },
    { type: "select", name: "managerId", label: "Manager", options: managerOptions },
    { type: "select", name: "status", label: "Status", options: statusOptions },
  ];

  const columns: Column<Branch>[] = [
    {
      key: "name",
      header: "Branch",
      sortable: true,
      render: (b) => (
        <button
          onClick={() => router.push(`/admin/branches/${b.id}`)}
          className="font-medium text-primary hover:underline"
        >
          {b.name}
        </button>
      ),
    },
    { key: "code", header: "Code", sortable: true, render: (b) => <span className="font-mono text-xs">{b.code}</span> },
    {
      key: "manager",
      header: "Manager",
      render: (b) => b.manager?.user.name ?? "—",
    },
    { key: "employees", header: "Employees", render: (b) => b._count?.employees ?? 0 },
    { key: "students", header: "Students", render: (b) => b._count?.students ?? 0 },
    { key: "status", header: "Status", sortable: true, render: (b) => <StatusBadge status={b.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Branches"
        description="Office locations — foundation for branch-level access control and multi-branch scoping."
        breadcrumbs={["Admin", "Branches"]}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden /> New Branch
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex items-center gap-2 pb-2">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
        {showArchived && (
          <Button variant="outline" size="sm" className="mb-1.5" onClick={() => setShowArchived(false)}>
            Clear
          </Button>
        )}
      </div>

      <DataTable
        endpoint="/api/branches"
        columns={columns}
        searchPlaceholder="Search by name, code, or address…"
        staticParams={staticParams}
        filters={[{ key: "status", label: "Status", options: statusOptions }]}
        emptyMessage="No branches match your filters."
        rowActions={[
          { label: "View", onClick: (b) => router.push(`/admin/branches/${b.id}`) },
          { label: "Edit", onClick: (b) => setEditBranch(b) },
          { label: "Status", onClick: (b) => setStatusBranch(b) },
          {
            label: "Archive",
            destructive: true,
            onClick: (b) => setArchiveBranch(b),
          },
        ]}
      />

      <FormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New Branch"
        fields={fields}
        endpoint="/api/branches"
        invalidateKey="/api/branches"
        successMessage="Branch created"
        toPayload={(v) => ({
          ...v,
          managerId: v.managerId || undefined,
          email: v.email?.trim() || undefined,
          address: v.address?.trim() || undefined,
          phone: v.phone?.trim() || undefined,
        })}
      />

      {editBranch && (
        <FormDialog
          key={editBranch.id}
          open={!!editBranch}
          onOpenChange={(v) => !v && setEditBranch(null)}
          title={`Edit ${editBranch.name}`}
          fields={fields}
          endpoint="/api/branches"
          entityId={editBranch.id}
          invalidateKey="/api/branches"
          successMessage="Branch updated"
          toPayload={(v) => ({
            ...v,
            managerId: v.managerId || undefined,
            email: v.email?.trim() || undefined,
            address: v.address?.trim() || undefined,
            phone: v.phone?.trim() || undefined,
          })}
        />
      )}

      <ConfirmDialog
        open={!!statusBranch}
        onOpenChange={(v) => !v && setStatusBranch(null)}
        title={statusBranch?.status === "ACTIVE" ? "Deactivate Branch" : "Activate Branch"}
        message={
          statusBranch?.status === "ACTIVE"
            ? `Deactivate ${statusBranch?.name}? Existing students and employees keep their data but the branch won't be selectable for new assignments.`
            : `Activate ${statusBranch?.name}? It becomes selectable for new assignments.`
        }
        confirmLabel={statusBranch?.status === "ACTIVE" ? "Deactivate" : "Activate"}
        destructive={statusBranch?.status === "ACTIVE"}
        onConfirm={async () => {
          try {
            const next = statusBranch!.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
            await apiFetch(`/api/branches/${statusBranch!.id}`, {
              method: "PATCH",
              json: { status: next },
            });
            toast({
              title: next === "ACTIVE" ? "Branch activated" : "Branch deactivated",
              variant: "success",
            });
            invalidate();
          } catch (err) {
            toast({ title: "Failed", description: (err as Error).message, variant: "error" });
            throw err;
          }
        }}
      />

      <ConfirmDialog
        open={!!archiveBranch}
        onOpenChange={(v) => !v && setArchiveBranch(null)}
        title={archiveBranch?.deletedAt ? "Unarchive Branch" : "Archive Branch"}
        message={
          archiveBranch?.deletedAt
            ? `Restore ${archiveBranch?.name} to the active list?`
            : `Archive ${archiveBranch?.name}? Archived branches are hidden from the default list. Employees and students must be reassigned first.`
        }
        confirmLabel={archiveBranch?.deletedAt ? "Unarchive" : "Archive"}
        destructive={!archiveBranch?.deletedAt}
        onConfirm={async () => {
          try {
            await apiFetch(`/api/branches/${archiveBranch!.id}`, {
              method: "PATCH",
              json: { archived: !archiveBranch!.deletedAt },
            });
            toast({
              title: archiveBranch!.deletedAt ? "Branch unarchived" : "Branch archived",
              variant: "success",
            });
            invalidate();
          } catch (err) {
            toast({ title: "Failed", description: (err as Error).message, variant: "error" });
            throw err;
          }
        }}
      />
    </>
  );
}
