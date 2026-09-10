"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ConfirmDialog, FormDialog, PageHeader, type FormField } from "@/components/shared/page-kit";
import { StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { Plus, Building2 } from "lucide-react";
import {
  UNIVERSITY_STATUSES,
  UNIVERSITY_STATUS_LABELS,
  formatFee,
} from "@/lib/constants/universities-admin";

type Country = { id: string; name: string; flag: string | null };
type University = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  website: string | null;
  logo: string | null;
  description: string | null;
  ranking: number | null;
  applicationFee: number | null;
  status: string;
  deletedAt: string | null;
  createdAt: string;
  country: Country;
  _count?: {
    courses: number;
    applications: number;
  };
};

const statusOptions = UNIVERSITY_STATUSES.map((s) => ({
  value: s,
  label: UNIVERSITY_STATUS_LABELS[s],
}));

/**
 * Admin Universities list — full CRUD via reusable components:
 *  - server-side search (name, city, country), filters (status, country)
 *  - sortable columns (name, ranking, applicationFee, status, createdAt)
 *  - row actions: View, Edit, Status (activate/deactivate), Archive
 *  - archived toggle to view soft-deleted universities
 *  - shared FormDialog/ConfirmDialog for create/edit/archive
 *
 * All mutations go through the `/api/universities` REST envelope so RBAC,
 * Zod validation and audit logging stay centralized server-side.
 */
export function UniversitiesAdmin() {
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/universities"] });

  const [createOpen, setCreateOpen] = useState(false);
  const [editUni, setEditUni] = useState<University | null>(null);
  const [archiveUni, setArchiveUni] = useState<University | null>(null);
  const [statusUni, setStatusUni] = useState<University | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Pull the country list once for the filter dropdown + create/edit form.
  const { data: countries } = useQuery({
    queryKey: ["/api/countries", "options"],
    queryFn: () => apiFetch<{ data: Country[] }>("/api/countries?pageSize=100"),
  });
  const countryOptions = (countries?.data ?? []).map((c) => ({
    value: c.id,
    label: `${c.flag ? `${c.flag} ` : ""}${c.name}`,
  }));

  const staticParams = useMemo(
    () => ({ archived: showArchived ? "true" : "false" }),
    [showArchived],
  );

  const fields: FormField[] = [
    { type: "text", name: "name", label: "Name", required: true, placeholder: "University of Manchester" },
    {
      type: "select",
      name: "countryId",
      label: "Country",
      options: countryOptions,
      required: true,
    },
    { type: "text", name: "city", label: "City", placeholder: "Manchester" },
    { type: "text", name: "website", label: "Website", placeholder: "https://…" },
    { type: "text", name: "logo", label: "Logo URL", placeholder: "https://…/logo.png" },
    { type: "number", name: "ranking", label: "Ranking", placeholder: "32" },
    { type: "number", name: "applicationFee", label: "Application fee (USD)", placeholder: "125" },
    {
      type: "select",
      name: "status",
      label: "Status",
      options: statusOptions,
    },
    { type: "textarea", name: "description", label: "Description" },
  ];

  const columns: Column<University>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      render: (u) => (
        <Link
          href={`/admin/universities/${u.id}`}
          className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
        >
          {u.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={u.logo}
              alt=""
              className="h-6 w-6 rounded object-contain"
              loading="lazy"
            />
          ) : (
            <span className="grid h-6 w-6 place-items-center rounded bg-primary/10 text-[10px] font-semibold text-primary">
              <Building2 className="h-3.5 w-3.5" aria-hidden />
            </span>
          )}
          {u.name}
        </Link>
      ),
    },
    {
      key: "country",
      header: "Country",
      render: (u) => (
        <span className="inline-flex items-center gap-1">
          {u.country.flag && <span aria-hidden>{u.country.flag}</span>}
          {u.country.name}
        </span>
      ),
    },
    { key: "city", header: "City", render: (u) => u.city ?? "—" },
    { key: "ranking", header: "Ranking", sortable: true, render: (u) => (u.ranking ? `#${u.ranking}` : "—") },
    {
      key: "applicationFee",
      header: "App Fee",
      sortable: true,
      render: (u) => formatFee(u.applicationFee),
    },
    { key: "courses", header: "Courses", render: (u) => u._count?.courses ?? 0 },
    { key: "applications", header: "Active Apps", render: (u) => u._count?.applications ?? 0 },
    { key: "status", header: "Status", sortable: true, render: (u) => <StatusBadge status={u.status} /> },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      render: (u) =>
        new Date(u.createdAt).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
    },
  ];

  return (
    <>
      <PageHeader
        title="Universities"
        description="Partner university catalog — manage programs, intakes, and applications per university."
        breadcrumbs={["Admin", "Universities"]}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden /> New University
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
        endpoint="/api/universities"
        columns={columns}
        searchPlaceholder="Search by name, city, or country…"
        staticParams={staticParams}
        filters={[
          { key: "status", label: "Status", options: statusOptions },
          { key: "countryId", label: "Country", options: countryOptions },
        ]}
        emptyMessage="No universities match your filters."
        rowActions={[
          { label: "View", onClick: (u) => router.push(`/admin/universities/${u.id}`) },
          { label: "Edit", onClick: (u) => setEditUni(u) },
          { label: "Status", onClick: (u) => setStatusUni(u) },
          {
            label: "Archive",
            destructive: true,
            onClick: (u) => setArchiveUni(u),
          },
        ]}
      />

      <FormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New University"
        fields={fields}
        endpoint="/api/universities"
        invalidateKey="/api/universities"
        successMessage="University created"
        toPayload={(values) => ({
          ...values,
          ranking: values.ranking ? Number(values.ranking) : undefined,
          applicationFee: values.applicationFee ? Number(values.applicationFee) : undefined,
          website: values.website?.trim() ? values.website.trim() : undefined,
          logo: values.logo?.trim() ? values.logo.trim() : undefined,
          city: values.city?.trim() ? values.city.trim() : undefined,
          description: values.description?.trim() ? values.description.trim() : undefined,
        })}
      />

      {editUni && (
        <FormDialog
          key={editUni.id}
          open={!!editUni}
          onOpenChange={(v) => !v && setEditUni(null)}
          title={`Edit ${editUni.name}`}
          description={`Slug: ${editUni.slug} (immutable)`}
          fields={fields}
          endpoint="/api/universities"
          entityId={editUni.id}
          invalidateKey="/api/universities"
          successMessage="University updated"
          toPayload={(values) => ({
            ...values,
            ranking: values.ranking ? Number(values.ranking) : undefined,
            applicationFee: values.applicationFee ? Number(values.applicationFee) : undefined,
            website: values.website?.trim() ? values.website.trim() : undefined,
            logo: values.logo?.trim() ? values.logo.trim() : undefined,
            city: values.city?.trim() ? values.city.trim() : undefined,
            description: values.description?.trim() ? values.description.trim() : undefined,
          })}
        />
      )}

      <ConfirmDialog
        open={!!statusUni}
        onOpenChange={(v) => !v && setStatusUni(null)}
        title={statusUni?.status === "ACTIVE" ? "Deactivate University" : "Activate University"}
        message={
          statusUni?.status === "ACTIVE"
            ? `Deactivate ${statusUni?.name}? Existing applications keep their data but the university won't be selectable for new applications.`
            : `Activate ${statusUni?.name}? It becomes selectable for new applications.`
        }
        confirmLabel={statusUni?.status === "ACTIVE" ? "Deactivate" : "Activate"}
        destructive={statusUni?.status === "ACTIVE"}
        onConfirm={async () => {
          try {
            const next = statusUni!.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
            await apiFetch(`/api/universities/${statusUni!.id}`, {
              method: "PATCH",
              json: { status: next },
            });
            toast({
              title: next === "ACTIVE" ? "University activated" : "University deactivated",
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
        open={!!archiveUni}
        onOpenChange={(v) => !v && setArchiveUni(null)}
        title={archiveUni?.deletedAt ? "Unarchive University" : "Archive University"}
        message={
          archiveUni?.deletedAt
            ? `Restore ${archiveUni?.name} to the active catalog?`
            : `Archive ${archiveUni?.name}? Archived universities are hidden from the default list and cannot be selected for new applications. Existing applications retain their data.`
        }
        confirmLabel={archiveUni?.deletedAt ? "Unarchive" : "Archive"}
        destructive={!archiveUni?.deletedAt}
        onConfirm={async () => {
          try {
            await apiFetch(`/api/universities/${archiveUni!.id}`, {
              method: "PATCH",
              json: { archived: !archiveUni!.deletedAt },
            });
            toast({
              title: archiveUni!.deletedAt ? "University unarchived" : "University archived",
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
