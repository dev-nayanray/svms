"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ConfirmDialog, FormDialog, PageHeader, type FormField } from "@/components/shared/page-kit";
import { StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { Plus } from "lucide-react";

type Employee = {
  id: string;
  title: string | null;
  branchId: string | null;
  user: { id: string; name: string; email: string; status: string; lastLoginAt: string | null };
  _count?: { students: number; leads: number };
};

const CREATE_FIELDS: FormField[] = [
  { type: "text", name: "name", label: "Full name", required: true },
  { type: "email", name: "email", label: "Email", required: true },
  { type: "text", name: "phone", label: "Phone" },
  { type: "text", name: "title", label: "Job title", placeholder: "Senior Counselor" },
  { type: "password", name: "password", label: "Password", required: true },
];

export function EmployeesAdmin() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [deleteEmp, setDeleteEmp] = useState<Employee | null>(null);
  const [roleEmp, setRoleEmp] = useState<Employee | null>(null);
  const [branchEmp, setBranchEmp] = useState<Employee | null>(null);
  const [resetEmp, setResetEmp] = useState<Employee | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/employees"] });

  const [statusEmp, setStatusEmp] = useState<Employee | null>(null);
  const patchEmployee = async (id: string, json: Record<string, unknown>, message: string) => {
    try {
      await apiFetch(`/api/employees/${id}`, { method: "PATCH", json });
      toast({ title: message, variant: "success" });
      invalidate();
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "error" });
      throw err;
    }
  };

  const { data: branches } = useQuery({
    queryKey: ["/api/branches", "options"],
    queryFn: () => apiFetch<{ data: { id: string; name: string }[] }>("/api/branches"),
  });

  const editFields: FormField[] = [
    { type: "text", name: "name", label: "Full name" },
    { type: "text", name: "phone", label: "Phone" },
    { type: "text", name: "title", label: "Job title" },
    ...(branches?.data.length
      ? [{
          type: "select" as const, name: "branchId", label: "Branch",
          options: branches.data.map((b) => ({ value: b.id, label: b.name })),
        }]
      : []),
    {
      type: "select" as const, name: "status", label: "Status",
      options: ["ACTIVE", "INACTIVE", "SUSPENDED"].map((s) => ({ value: s, label: s })),
    },
  ];

  const columns: Column<Employee>[] = [
    {
      key: "name", header: "Name", sortable: true,
      render: (e) => (
        <Link href={`/admin/employees/${e.id}`} className="font-medium text-primary hover:underline">
          {e.user.name}
        </Link>
      ),
    },
    { key: "email", header: "Email", render: (e) => e.user.email },
    { key: "title", header: "Title", render: (e) => e.title ?? "—" },
    { key: "students", header: "Students", render: (e) => e._count?.students ?? 0 },
    { key: "leads", header: "Leads", render: (e) => e._count?.leads ?? 0 },
    { key: "status", header: "Status", render: (e) => <StatusBadge status={e.user.status} /> },
    { key: "lastLoginAt", header: "Last Login", render: (e) => (e.user.lastLoginAt ? new Date(e.user.lastLoginAt).toLocaleDateString("en-GB") : "—") },
  ];

  return (
    <>
      <PageHeader
        title="Employees"
        description="Counselors and staff with system access."
        breadcrumbs={["Admin", "Employees"]}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden /> New Employee
          </Button>
        }
      />
      <DataTable
        endpoint="/api/employees"
        columns={columns}
        searchPlaceholder="Search employees…"
        emptyMessage="No employees yet."
        rowActions={[
          { label: "View", onClick: (e) => router.push(`/admin/employees/${e.id}`) },
          { label: "Edit", onClick: (e) => setEditEmp(e) },
          { label: "Assign Role", onClick: (e) => setRoleEmp(e) },
          { label: "Assign Branch", onClick: (e) => setBranchEmp(e) },
          { label: "Status", destructive: true, onClick: (e) => setStatusEmp(e) },
          { label: "Reset Access", onClick: (e) => setResetEmp(e) },
        ]}
      />
      <FormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New Employee"
        description="Creates a counselor user account."
        fields={CREATE_FIELDS}
        endpoint="/api/employees"
        invalidateKey="/api/employees"
        successMessage="Employee created"
      />
      {editEmp && (
        <FormDialog
          key={editEmp.id}
          open={!!editEmp}
          onOpenChange={(v) => !v && setEditEmp(null)}
          title={`Edit ${editEmp.user.name}`}
          fields={editFields}
          endpoint="/api/employees"
          entityId={editEmp.id}
          invalidateKey="/api/employees"
          successMessage="Employee updated"
        />
      )}
      {roleEmp && (
        <FormDialog
          key={`role-${roleEmp.id}`} open={!!roleEmp} onOpenChange={(v) => !v && setRoleEmp(null)}
          title={`Assign role — ${roleEmp.user.name}`}
          description="Admins manage the whole system; employees handle assigned cases."
          fields={[{ type: "select", name: "roleName", label: "Role", required: true, options: [
            { value: "EMPLOYEE", label: "Employee / Counselor" },
            { value: "ADMIN", label: "Administrator" },
          ] }]}
          endpoint="/api/employees" entityId={roleEmp.id}
          invalidateKey="/api/employees" successMessage="Role assigned"
        />
      )}

      {branchEmp && (
        <FormDialog
          key={`br-${branchEmp.id}`} open={!!branchEmp} onOpenChange={(v) => !v && setBranchEmp(null)}
          title={`Assign branch — ${branchEmp.user.name}`}
          fields={[{ type: "select", name: "branchId", label: "Branch", required: true,
            options: (branches?.data ?? []).map((b) => ({ value: b.id, label: b.name })) }]}
          endpoint="/api/employees" entityId={branchEmp.id}
          invalidateKey="/api/employees" successMessage="Branch assigned"
        />
      )}

      <ConfirmDialog
        open={!!statusEmp} onOpenChange={(v) => !v && setStatusEmp(null)}
        title={statusEmp?.user.status === "ACTIVE" ? "Deactivate Employee" : "Activate Employee"}
        message={
          statusEmp?.user.status === "ACTIVE"
            ? `Deactivate ${statusEmp?.user.name}? They will be unable to sign in until reactivated.`
            : `Reactivate ${statusEmp?.user.name}?`
        }
        confirmLabel={statusEmp?.user.status === "ACTIVE" ? "Deactivate" : "Activate"}
        destructive={statusEmp?.user.status === "ACTIVE"}
        onConfirm={() => patchEmployee(statusEmp!.id, { status: statusEmp!.user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }, "Status updated")}
      />

      <ConfirmDialog
        open={!!resetEmp} onOpenChange={(v) => !v && setResetEmp(null)}
        title="Reset Access"
        message={`Generate a new temporary password for ${resetEmp?.user.name}? It is shown once and must be shared securely. The current password stops working immediately.`}
        confirmLabel="Reset"
        destructive
        onConfirm={async () => {
          try {
            const res = await apiFetch<{ temporaryPassword: string; email: string }>(
              `/api/employees/${resetEmp!.id}/reset-access`,
              { method: "POST" }
            );
            toast({
              title: "Access reset",
              description: `Temporary password for ${res.email}: ${res.temporaryPassword} (copy now — shown once)`,
              variant: "success",
            });
          } catch (err) {
            toast({ title: "Failed", description: (err as Error).message, variant: "error" });
            throw err;
          }
        }}
      />

      <ConfirmDialog
        open={!!deleteEmp}
        onOpenChange={(v) => !v && setDeleteEmp(null)}
        title="Deactivate Employee"
        message={`Deactivate ${deleteEmp?.user.name}? Their account will be disabled and assignments retained (soft delete).`}
        confirmLabel="Deactivate"
        destructive
        onConfirm={async () => {
          try {
            await apiFetch(`/api/employees/${deleteEmp!.id}`, { method: "DELETE" });
            toast({ title: "Employee deactivated", variant: "success" });
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
