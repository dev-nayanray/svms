"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DataTable, type Column } from "@/components/shared/data-table";
import { FormDialog, type FormField } from "@/components/shared/page-kit";
import { Button } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import { Plus } from "lucide-react";

type Requirement = {
  id: string;
  name: string;
  description: string | null;
  required: boolean;
  sortOrder: number;
  status: string;
  country: { id: string; name: string };
};

export function RequirementsAdmin() {
  const [createOpen, setCreateOpen] = useState(false);

  const { data: countries } = useQuery({
    queryKey: ["/api/countries", "options"],
    queryFn: () => apiFetch<{ data: { id: string; name: string }[] }>("/api/countries"),
  });

  const fields: FormField[] = [
    {
      type: "select", name: "countryId", label: "Country", required: true,
      options: (countries?.data ?? []).map((c) => ({ value: c.id, label: c.name })),
    },
    { type: "text", name: "name", label: "Requirement name", required: true, placeholder: "TB Test Certificate" },
    { type: "textarea", name: "description", label: "Description" },
    { type: "number", name: "sortOrder", label: "Sort order" },
  ];

  const columns: Column<Requirement>[] = [
    { key: "country", header: "Country", render: (r) => r.country.name },
    { key: "name", header: "Requirement", render: (r) => <span className="font-medium">{r.name}</span> },
    { key: "description", header: "Description", render: (r) => r.description ?? "—" },
    { key: "required", header: "Required", render: (r) => (r.required ? "Yes" : "No") },
    { key: "sortOrder", header: "Order", render: (r) => r.sortOrder },
  ];

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden /> New Requirement
        </Button>
      </div>
      <DataTable
        endpoint="/api/visa/requirements"
        columns={columns}
        searchPlaceholder="Search requirements…"
        emptyMessage="No visa requirements configured yet."
      />
      <FormDialog
        open={createOpen} onOpenChange={setCreateOpen}
        title="New Visa Requirement" fields={fields}
        endpoint="/api/visa/requirements"
        invalidateKey="/api/visa/requirements"
        successMessage="Requirement created"
        toPayload={(v) => ({ ...v, sortOrder: Number(v.sortOrder ?? 0) })}
      />
    </>
  );
}
