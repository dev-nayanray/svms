"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ConfirmDialog, FormDialog, PageHeader, type FormField } from "@/components/shared/page-kit";
import { StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { Plus, Globe } from "lucide-react";
import { resolveCountryFlag } from "@/lib/constants/countries";
import {
  COUNTRY_STATUSES,
  COUNTRY_STATUS_LABELS,
} from "@/lib/constants/countries";

type Country = {
  id: string;
  name: string;
  code: string;
  flag: string | null;
  currency: string | null;
  description: string | null;
  status: string;
  deletedAt: string | null;
  createdAt: string;
  _count?: {
    universities?: number;
    applications?: number;
    visaRequirements?: number;
  };
};

const statusOptions = COUNTRY_STATUSES.map((s) => ({
  value: s,
  label: COUNTRY_STATUS_LABELS[s],
}));

/**
 * Admin Countries list — full CRUD via reusable components:
 *  - server-side search, status filter, archived toggle
 *  - sortable columns (name/code/status/createdAt)
 *  - row actions: View, Edit, Activate/Deactivate, Archive/Unarchive
 *  - shared FormDialog/ConfirmDialog for create/edit/archive
 *
 * All mutations go through the `/api/countries` REST envelope so RBAC,
 * Zod validation and audit logging stay centralized server-side.
 */
export function CountriesAdmin() {
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/countries"] });

  const [createOpen, setCreateOpen] = useState(false);
  const [editCountry, setEditCountry] = useState<Country | null>(null);
  const [archiveCountry, setArchiveCountry] = useState<Country | null>(null);
  const [statusCountry, setStatusCountry] = useState<Country | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const staticParams = useMemo(
    () => ({ archived: showArchived ? "true" : "false" }),
    [showArchived],
  );

  const fields: FormField[] = [
    { type: "text", name: "name", label: "Country name", required: true, placeholder: "United Kingdom" },
    { type: "text", name: "code", label: "ISO code (2-3 letters)", required: true, placeholder: "GB" },
    { type: "text", name: "flag", label: "Flag override (emoji or text)", placeholder: "🇬🇧 — leave blank to derive from code" },
    { type: "text", name: "currency", label: "Currency", placeholder: "GBP" },
    {
      type: "select",
      name: "status",
      label: "Status",
      options: statusOptions,
    },
    { type: "textarea", name: "description", label: "Description" },
  ];

  const columns: Column<Country>[] = [
    {
      key: "name",
      header: "Country",
      sortable: true,
      render: (c) => (
        <Link
          href={`/admin/countries/${c.id}`}
          className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
        >
          <span aria-hidden className="text-base leading-none">
            {resolveCountryFlag(c.code, c.flag) ?? <Globe className="h-4 w-4 text-muted-foreground" />}
          </span>
          {c.name}
        </Link>
      ),
    },
    { key: "code", header: "Code", sortable: true, render: (c) => <span className="font-mono text-xs">{c.code}</span> },
    { key: "currency", header: "Currency", render: (c) => c.currency ?? "—" },
    { key: "universities", header: "Universities", render: (c) => c._count?.universities ?? 0 },
    { key: "applications", header: "Active Apps", render: (c) => c._count?.applications ?? 0 },
    { key: "visaRequirements", header: "Visa Reqs", render: (c) => c._count?.visaRequirements ?? 0 },
    { key: "status", header: "Status", sortable: true, render: (c) => <StatusBadge status={c.status} /> },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      render: (c) => new Date(c.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    },
  ];

  return (
    <>
      <PageHeader
        title="Countries"
        description="Destination countries — manage catalog, visa requirements, and document requirements per country."
        breadcrumbs={["Admin", "Countries"]}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden /> New Country
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
        endpoint="/api/countries"
        columns={columns}
        searchPlaceholder="Search by name, code, or currency…"
        staticParams={staticParams}
        filters={[{ key: "status", label: "Status", options: statusOptions }]}
        emptyMessage="No countries match your filters."
        rowActions={[
          { label: "View", onClick: (c) => router.push(`/admin/countries/${c.id}`) },
          { label: "Edit", onClick: (c) => setEditCountry(c) },
          { label: "Status", onClick: (c) => setStatusCountry(c) },
          {
            label: "Archive",
            destructive: true,
            onClick: (c) => setArchiveCountry(c),
          },
        ]}
      />

      <FormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New Country"
        fields={fields}
        endpoint="/api/countries"
        invalidateKey="/api/countries"
        successMessage="Country created"
      />

      {editCountry && (
        <FormDialog
          key={editCountry.id}
          open={!!editCountry}
          onOpenChange={(v) => !v && setEditCountry(null)}
          title={`Edit ${editCountry.name}`}
          fields={fields}
          endpoint="/api/countries"
          entityId={editCountry.id}
          invalidateKey="/api/countries"
          successMessage="Country updated"
          toPayload={(values) => ({
            ...values,
            // Always coerce code to uppercase client-side for nicer UX; the
            // server re-normalizes so this is just cosmetic.
            code: values.code?.toUpperCase(),
            // Don't send empty flag as a string — let schema omit it.
            flag: values.flag?.trim() ? values.flag.trim() : undefined,
          })}
        />
      )}

      <ConfirmDialog
        open={!!statusCountry}
        onOpenChange={(v) => !v && setStatusCountry(null)}
        title={statusCountry?.status === "ACTIVE" ? "Deactivate Country" : "Activate Country"}
        message={
          statusCountry?.status === "ACTIVE"
            ? `Deactivate ${statusCountry?.name}? Existing applications keep their data but the country won't be selectable for new applications.`
            : `Activate ${statusCountry?.name}? It becomes selectable for new applications.`
        }
        confirmLabel={statusCountry?.status === "ACTIVE" ? "Deactivate" : "Activate"}
        destructive={statusCountry?.status === "ACTIVE"}
        onConfirm={async () => {
          try {
            const next = statusCountry!.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
            await apiFetch(`/api/countries/${statusCountry!.id}`, {
              method: "PATCH",
              json: { status: next },
            });
            toast({
              title: next === "ACTIVE" ? "Country activated" : "Country deactivated",
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
        open={!!archiveCountry}
        onOpenChange={(v) => !v && setArchiveCountry(null)}
        title={archiveCountry?.deletedAt ? "Unarchive Country" : "Archive Country"}
        message={
          archiveCountry?.deletedAt
            ? `Restore ${archiveCountry?.name} to the active catalog?`
            : `Archive ${archiveCountry?.name}? Archived countries are hidden from the default list and cannot be selected for new applications. Existing applications retain their data.`
        }
        confirmLabel={archiveCountry?.deletedAt ? "Unarchive" : "Archive"}
        destructive={!archiveCountry?.deletedAt}
        onConfirm={async () => {
          try {
            await apiFetch(`/api/countries/${archiveCountry!.id}`, {
              method: "PATCH",
              json: { archived: !archiveCountry!.deletedAt },
            });
            toast({
              title: archiveCountry!.deletedAt ? "Country unarchived" : "Country archived",
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
