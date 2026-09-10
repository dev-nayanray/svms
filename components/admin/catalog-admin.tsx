"use client";

import { useState } from "react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { FormDialog, PageHeader, type FormField } from "@/components/shared/page-kit";
import { StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui";
import { Plus } from "lucide-react";

// Note: UniversitiesAdmin moved to components/admin/universities-admin.tsx
// Note: CoursesAdmin moved to components/admin/courses-admin.tsx
// Note: IntakesAdmin moved to components/admin/intakes-admin.tsx
// Each module now has full CRUD with archive/status actions, tabbed detail
// pages, and dedicated filter sets.

type Branch = {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  email: string | null;
  status: string;
  _count?: { users: number; students: number; employees: number };
};

export function BranchesAdmin() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);

  const fields: FormField[] = [
    { type: "text", name: "name", label: "Branch name", required: true },
    { type: "text", name: "code", label: "Code", required: true, placeholder: "HQ" },
    { type: "text", name: "phone", label: "Phone" },
    { type: "email", name: "email", label: "Email" },
    { type: "text", name: "address", label: "Address" },
  ];

  const columns: Column<Branch>[] = [
    { key: "name", header: "Branch", render: (b) => <span className="font-medium">{b.name}</span> },
    { key: "code", header: "Code", render: (b) => <span className="font-mono text-xs">{b.code}</span> },
    { key: "employees", header: "Employees", render: (b) => b._count?.employees ?? 0 },
    { key: "students", header: "Students", render: (b) => b._count?.students ?? 0 },
    { key: "status", header: "Status", render: (b) => <StatusBadge status={b.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Branches"
        description="Office locations — foundation for branch-level access control."
        breadcrumbs={["Admin", "Branches"]}
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" aria-hidden /> New Branch</Button>}
      />
      <DataTable
        endpoint="/api/branches"
        columns={columns}
        emptyMessage="No branches yet."
        rowActions={[{ label: "Edit", onClick: (b) => setEditBranch(b) }]}
      />
      <FormDialog
        open={createOpen} onOpenChange={setCreateOpen}
        title="New Branch" fields={fields}
        endpoint="/api/branches" invalidateKey="/api/branches" successMessage="Branch created"
      />
      {editBranch && (
        <FormDialog
          key={editBranch.id} open={!!editBranch} onOpenChange={(v) => !v && setEditBranch(null)}
          title={`Edit ${editBranch.name}`} fields={fields}
          endpoint="/api/branches" entityId={editBranch.id}
          invalidateKey="/api/branches" successMessage="Branch updated"
        />
      )}
    </>
  );
}
