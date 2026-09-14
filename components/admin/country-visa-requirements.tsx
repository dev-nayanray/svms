"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DataTable, type Column } from "@/components/shared/data-table";
import { FormDialog, ConfirmDialog, type FormField } from "@/components/shared/page-kit";
import { StatusBadge, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { Plus } from "lucide-react";

type Requirement = {
  id: string;
  name: string;
  description: string | null;
  required: boolean;
  sortOrder: number;
  status: string;
};

/**
 * Country-scoped visa requirements manager. Reuses the shared DataTable +
 * FormDialog + ConfirmDialog primitives — same shape as the global visa
 * requirements admin, but pre-scoped to a single country and with full
 * edit/delete (the global admin only allows create).
 */
export function CountryVisaRequirements({ countryId }: { countryId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["/api/visa/requirements", { countryId }] });

  const [createOpen, setCreateOpen] = useState(false);
  const [editReq, setEditReq] = useState<Requirement | null>(null);
  const [deleteReq, setDeleteReq] = useState<Requirement | null>(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["/api/visa/requirements", { countryId }],
    queryFn: () =>
      apiFetch<{ data: Requirement[] }>(
        `/api/visa/requirements?countryId=${countryId}&status=`,
      ),
  });

  const fields: FormField[] = [
    { type: "text", name: "name", label: "Requirement name", required: true, placeholder: "TB Test Certificate" },
    { type: "textarea", name: "description", label: "Description" },
    {
      type: "select",
      name: "required",
      label: "Required",
      options: [
        { value: "true", label: "Required" },
        { value: "false", label: "Optional" },
      ],
    },
    { type: "number", name: "sortOrder", label: "Sort order" },
    {
      type: "select",
      name: "status",
      label: "Status",
      options: [
        { value: "ACTIVE", label: "Active" },
        { value: "INACTIVE", label: "Inactive" },
      ],
    },
  ];

  const toPayload = (values: Record<string, string>) => ({
    countryId,
    name: values.name,
    description: values.description || undefined,
    required: values.required !== "false",
    sortOrder: Number(values.sortOrder ?? 0),
    status: values.status ?? "ACTIVE",
  });

  const rows = data?.data ?? [];

  const columns: Column<Requirement>[] = [
    { key: "sortOrder", header: "Order", sortable: true, render: (r) => r.sortOrder },
    { key: "name", header: "Requirement", sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "description", header: "Description", render: (r) => r.description ?? "—" },
    { key: "required", header: "Required", render: (r) => (r.required ? "Yes" : "No") },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden /> Add Requirement
        </Button>
      </div>

      {rows.length === 0 && !isPending ? (
        <EmptyState
          title="No visa requirements configured"
          description="Add the documents and steps students must submit for a visa application to this country."
        />
      ) : (
        <DataTable
          endpoint={`/api/visa/requirements?countryId=${countryId}&status=`}
          columns={columns}
          searchPlaceholder="Search requirements…"
          emptyMessage="No visa requirements configured."
          rowActions={[
            { label: "Edit", onClick: (r) => setEditReq(r) },
            { label: "Delete", destructive: true, onClick: (r) => setDeleteReq(r) },
          ]}
        />
      )}

      {isError && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {(error as Error).message}
          <Button variant="outline" size="sm" className="ml-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      <FormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New Visa Requirement"
        description="Documents or steps students must submit for a visa application."
        fields={fields}
        endpoint="/api/visa/requirements"
        invalidateKey="/api/visa/requirements"
        successMessage="Requirement created"
        toPayload={toPayload}
      />

      {editReq && (
        <FormDialog
          key={editReq.id}
          open={!!editReq}
          onOpenChange={(v) => !v && setEditReq(null)}
          title={`Edit ${editReq.name}`}
          fields={fields}
          endpoint="/api/visa/requirements"
          entityId={editReq.id}
          invalidateKey="/api/visa/requirements"
          successMessage="Requirement updated"
          toPayload={(values) => ({
            name: values.name,
            description: values.description || undefined,
            required: values.required !== "false",
            sortOrder: Number(values.sortOrder ?? 0),
            status: values.status ?? "ACTIVE",
          })}
        />
      )}

      <ConfirmDialog
        open={!!deleteReq}
        onOpenChange={(v) => !v && setDeleteReq(null)}
        title="Delete Requirement"
        message={`Permanently delete "${deleteReq?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          try {
            await apiFetch(`/api/visa/requirements/${deleteReq!.id}`, { method: "DELETE" });
            toast({ title: "Requirement deleted", variant: "success" });
            invalidate();
          } catch (err) {
            toast({ title: "Failed", description: (err as Error).message, variant: "error" });
            throw err;
          }
        }}
      />
    </div>
  );
}
