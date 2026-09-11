"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DataTable, type Column } from "@/components/shared/data-table";
import { FormDialog, ConfirmDialog, type FormField } from "@/components/shared/page-kit";
import { StatusBadge } from "@/components/shared";
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
  country: { id: string; name: string; flag: string | null };
};

type Country = { id: string; name: string; flag: string | null };

/**
 * Visa Requirements admin — full CRUD (create, edit, delete) with
 * country-scoped configuration. Admins can configure the list of
 * documents and steps students must submit for a visa application to
 * each country.
 */
export function RequirementsAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/visa/requirements"] });

  const [createOpen, setCreateOpen] = useState(false);
  const [editReq, setEditReq] = useState<Requirement | null>(null);
  const [deleteReq, setDeleteReq] = useState<Requirement | null>(null);

  const { data: countries } = useQuery({
    queryKey: ["/api/countries", "options"],
    queryFn: () => apiFetch<{ data: Country[] }>("/api/countries?pageSize=100"),
  });
  const countryOptions = (countries?.data ?? []).map((c) => ({
    value: c.id,
    label: `${c.flag ? `${c.flag} ` : ""}${c.name}`,
  }));

  const fields: FormField[] = [
    {
      type: "select",
      name: "countryId",
      label: "Country",
      required: true,
      options: countryOptions,
    },
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

  const columns: Column<Requirement>[] = [
    {
      key: "country",
      header: "Country",
      render: (r) => (
        <span className="inline-flex items-center gap-1">
          {r.country.flag && <span aria-hidden>{r.country.flag}</span>}
          {r.country.name}
        </span>
      ),
    },
    { key: "name", header: "Requirement", sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "description", header: "Description", render: (r) => r.description ?? "—" },
    { key: "required", header: "Required", render: (r) => (r.required ? "Yes" : "No") },
    { key: "sortOrder", header: "Order", sortable: true, render: (r) => r.sortOrder },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden /> New Requirement
        </Button>
      </div>
      <DataTable
        endpoint="/api/visa/requirements?status="
        columns={columns}
        searchPlaceholder="Search requirements…"
        emptyMessage="No visa requirements configured yet."
        rowActions={[
          { label: "Edit", onClick: (r) => setEditReq(r) },
          { label: "Delete", destructive: true, onClick: (r) => setDeleteReq(r) },
        ]}
      />

      <FormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New Visa Requirement"
        description="Documents or steps students must submit for a visa application to this country."
        fields={fields}
        endpoint="/api/visa/requirements"
        invalidateKey="/api/visa/requirements"
        successMessage="Requirement created"
        toPayload={(v) => ({
          countryId: v.countryId,
          name: v.name,
          description: v.description || undefined,
          required: v.required !== "false",
          sortOrder: Number(v.sortOrder ?? 0),
          status: v.status || "ACTIVE",
        })}
      />

      {editReq && (
        <FormDialog
          key={editReq.id}
          open={!!editReq}
          onOpenChange={(v) => !v && setEditReq(null)}
          title={`Edit ${editReq.name}`}
          fields={fields.filter((f) => f.name !== "countryId")}
          endpoint="/api/visa/requirements"
          entityId={editReq.id}
          invalidateKey="/api/visa/requirements"
          successMessage="Requirement updated"
          toPayload={(v) => ({
            name: v.name,
            description: v.description || undefined,
            required: v.required !== "false",
            sortOrder: Number(v.sortOrder ?? 0),
            status: v.status || "ACTIVE",
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
    </>
  );
}
