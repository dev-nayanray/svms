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
import {
  DOC_REQUIREMENT_SCOPES,
  DOC_REQUIREMENT_SCOPE_LABELS,
} from "@/lib/constants/countries";

type Requirement = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  required: boolean;
  appliesTo: string;
  status: string;
  country: { id: string; name: string } | null;
};

const appliesToOptions = DOC_REQUIREMENT_SCOPES.map((s) => ({
  value: s,
  label: DOC_REQUIREMENT_SCOPE_LABELS[s],
}));

/**
 * Country-scoped document requirements manager. Lists requirements that are
 * either explicitly scoped to this country OR are global (no countryId).
 * Create new country-scoped requirements here; global ones are managed via
 * the documents admin (TODO).
 */
export function CountryDocumentRequirements({ countryId }: { countryId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["/api/document-requirements", { countryId }] });

  const [createOpen, setCreateOpen] = useState(false);
  const [editReq, setEditReq] = useState<Requirement | null>(null);
  const [deleteReq, setDeleteReq] = useState<Requirement | null>(null);

  // We query for both country-scoped + global requirements so admins can see
  // the full effective rule set for this country at a glance.
  const query = `countryId=${countryId}&status=`;
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["/api/document-requirements", { countryId }],
    queryFn: () => apiFetch<{ data: Requirement[] }>(`/api/document-requirements?${query}`),
  });

  const fields: FormField[] = [
    { type: "text", name: "name", label: "Requirement name", required: true, placeholder: "Bank Statement" },
    { type: "text", name: "code", label: "Code (lowercase, e.g. bank_statement)", required: true },
    { type: "textarea", name: "description", label: "Description" },
    {
      type: "select",
      name: "appliesTo",
      label: "Applies to",
      options: appliesToOptions,
    },
    {
      type: "select",
      name: "required",
      label: "Required",
      options: [
        { value: "true", label: "Required" },
        { value: "false", label: "Optional" },
      ],
    },
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

  const rows = data?.data ?? [];

  const columns: Column<Requirement>[] = [
    { key: "name", header: "Requirement", sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
    {
      key: "code",
      header: "Code",
      render: (r) => <span className="font-mono text-xs">{r.code}</span>,
    },
    { key: "appliesTo", header: "Scope", render: (r) => DOC_REQUIREMENT_SCOPE_LABELS[r.appliesTo as keyof typeof DOC_REQUIREMENT_SCOPE_LABELS] ?? r.appliesTo },
    { key: "country", header: "Scope Country", render: (r) => r.country?.name ?? "Global" },
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
          title="No document requirements configured"
          description="Add the documents students must submit when applying to this country. Global requirements also appear here."
        />
      ) : (
        <DataTable
          endpoint={`/api/document-requirements?${query}`}
          columns={columns}
          searchPlaceholder="Search document requirements…"
          emptyMessage="No document requirements configured."
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
        title="New Document Requirement"
        description="Documents students must submit. The code is permanent — pick a stable lowercase identifier."
        fields={fields}
        endpoint="/api/document-requirements"
        invalidateKey="/api/document-requirements"
        successMessage="Requirement created"
        toPayload={(values) => ({
          name: values.name,
          code: values.code,
          description: values.description || undefined,
          countryId,
          appliesTo: values.appliesTo ?? "APPLICATION",
          required: values.required !== "false",
          status: values.status ?? "ACTIVE",
        })}
      />

      {editReq && (
        <FormDialog
          key={editReq.id}
          open={!!editReq}
          onOpenChange={(v) => !v && setEditReq(null)}
          title={`Edit ${editReq.name}`}
          description={`Code ${editReq.code} (immutable)`}
          fields={fields.filter((f) => f.name !== "code")}
          endpoint="/api/document-requirements"
          entityId={editReq.id}
          invalidateKey="/api/document-requirements"
          successMessage="Requirement updated"
          toPayload={(values) => ({
            name: values.name,
            description: values.description || undefined,
            appliesTo: values.appliesTo ?? "APPLICATION",
            required: values.required !== "false",
            status: values.status ?? "ACTIVE",
          })}
        />
      )}

      <ConfirmDialog
        open={!!deleteReq}
        onOpenChange={(v) => !v && setDeleteReq(null)}
        title="Delete Requirement"
        message={`Permanently delete "${deleteReq?.name}"? If documents have been uploaded against it, you'll be prompted to deactivate instead.`}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          try {
            await apiFetch(`/api/document-requirements/${deleteReq!.id}`, { method: "DELETE" });
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
