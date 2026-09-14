"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ConfirmDialog, FormDialog, PageHeader, type FormField } from "@/components/shared/page-kit";
import { StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { Plus } from "lucide-react";
import {
  INTAKE_STATUSES,
  INTAKE_STATUS_LABELS,
  intakeStartLabel,
} from "@/lib/constants/courses-admin";
import { intakeDeadlineUrgency } from "@/lib/constants/courses";

type Country = { id: string; name: string; flag: string | null };
type University = { id: string; name: string };
type CourseOption = { id: string; name: string; university: { name: string } };

type Intake = {
  id: string;
  name: string;
  month: number;
  year: number;
  deadline: string | null;
  status: string;
  deletedAt: string | null;
  createdAt: string;
  course: {
    id: string;
    name: string;
    degreeLevel: string;
    university: {
      id: string;
      name: string;
      country: Country;
    };
  };
  _count?: { applications: number };
};

const statusOptions = INTAKE_STATUSES.map((s) => ({
  value: s,
  label: INTAKE_STATUS_LABELS[s],
}));

/**
 * Admin Intakes list — full CRUD via reusable components:
 *  - server-side search (intake name, course name, university name)
 *  - filters: status, country, university, course
 *  - sortable columns (name, year, month, deadline, status, createdAt)
 *  - row actions: Edit, Status (activate/deactivate), Archive
 *  - archived toggle to view soft-deleted intakes
 *  - deadline urgency badges (urgent ≤7d, soon ≤30d)
 */
export function IntakesAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/intakes"] });

  const [createOpen, setCreateOpen] = useState(false);
  const [editIntake, setEditIntake] = useState<Intake | null>(null);
  const [archiveIntake, setArchiveIntake] = useState<Intake | null>(null);
  const [statusIntake, setStatusIntake] = useState<Intake | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const { data: countries } = useQuery({
    queryKey: ["/api/countries", "options"],
    queryFn: () => apiFetch<{ data: Country[] }>("/api/countries?pageSize=100"),
  });
  const countryOptions = (countries?.data ?? []).map((c) => ({
    value: c.id,
    label: `${c.flag ? `${c.flag} ` : ""}${c.name}`,
  }));

  const { data: universities } = useQuery({
    queryKey: ["/api/universities", "options"],
    queryFn: () => apiFetch<{ data: University[] }>("/api/universities?pageSize=100"),
  });
  const universityOptions = (universities?.data ?? []).map((u) => ({
    value: u.id,
    label: u.name,
  }));

  const { data: coursesData } = useQuery({
    queryKey: ["/api/courses", "options"],
    queryFn: () =>
      apiFetch<{ data: CourseOption[] }>("/api/courses?pageSize=100"),
  });
  const courseOptions = (coursesData?.data ?? []).map((c) => ({
    value: c.id,
    label: `${c.name} (${c.university.name})`,
  }));

  const staticParams = useMemo(
    () => ({ archived: showArchived ? "true" : "false" }),
    [showArchived],
  );

  const fields: FormField[] = [
    { type: "select", name: "courseId", label: "Course", options: courseOptions, required: true },
    { type: "text", name: "name", label: "Intake name", required: true, placeholder: "September 2027" },
    { type: "number", name: "month", label: "Start month (1-12)", required: true },
    { type: "number", name: "year", label: "Start year", required: true },
    { type: "date", name: "deadline", label: "Application deadline" },
    {
      type: "select",
      name: "status",
      label: "Status",
      options: statusOptions,
    },
  ];

  const now = new Date();

  const columns: Column<Intake>[] = [
    {
      key: "name",
      header: "Intake",
      sortable: true,
      render: (i) => <span className="font-medium">{i.name}</span>,
    },
    {
      key: "course",
      header: "Course",
      render: (i) => (
        <div>
          <p className="text-sm">{i.course.name}</p>
          <p className="text-xs text-muted-foreground">{i.course.university.name}</p>
        </div>
      ),
    },
    {
      key: "year",
      header: "Start",
      sortable: true,
      render: (i) => intakeStartLabel(i.month, i.year),
    },
    {
      key: "deadline",
      header: "Deadline",
      sortable: true,
      render: (i) => {
        if (!i.deadline) return "—";
        const urgency = intakeDeadlineUrgency(i.deadline, now);
        const dateStr = new Date(i.deadline).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        const tone =
          urgency === "urgent"
            ? "text-destructive font-medium"
            : urgency === "soon"
              ? "text-warning font-medium"
              : "";
        return <span className={tone}>{dateStr}</span>;
      },
    },
    { key: "applications", header: "Apps", render: (i) => i._count?.applications ?? 0 },
    { key: "status", header: "Status", sortable: true, render: (i) => <StatusBadge status={i.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Intakes"
        description="Application windows per course — manage intake start dates and deadlines."
        breadcrumbs={["Admin", "Intakes"]}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden /> New Intake
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
        endpoint="/api/intakes"
        columns={columns}
        searchPlaceholder="Search by intake, course, or university…"
        staticParams={staticParams}
        filters={[
          { key: "status", label: "Status", options: statusOptions },
          { key: "countryId", label: "Country", options: countryOptions },
          { key: "universityId", label: "University", options: universityOptions },
          ...(courseOptions.length > 0
            ? [{ key: "courseId", label: "Course", options: courseOptions }]
            : []),
        ]}
        emptyMessage="No intakes match your filters."
        rowActions={[
          { label: "Edit", onClick: (i) => setEditIntake(i) },
          { label: "Status", onClick: (i) => setStatusIntake(i) },
          {
            label: "Archive",
            destructive: true,
            onClick: (i) => setArchiveIntake(i),
          },
        ]}
      />

      <FormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New Intake"
        fields={fields}
        endpoint="/api/intakes"
        invalidateKey="/api/intakes"
        successMessage="Intake created"
        toPayload={(values) => ({
          courseId: values.courseId,
          name: values.name,
          month: Number(values.month),
          year: Number(values.year),
          deadline: values.deadline || undefined,
          status: values.status || "ACTIVE",
        })}
      />

      {editIntake && (
        <FormDialog
          key={editIntake.id}
          open={!!editIntake}
          onOpenChange={(v) => !v && setEditIntake(null)}
          title={`Edit ${editIntake.name}`}
          fields={fields}
          endpoint="/api/intakes"
          entityId={editIntake.id}
          invalidateKey="/api/intakes"
          successMessage="Intake updated"
          toPayload={(values) => ({
            courseId: values.courseId,
            name: values.name,
            month: Number(values.month),
            year: Number(values.year),
            deadline: values.deadline || undefined,
            status: values.status || "ACTIVE",
          })}
        />
      )}

      <ConfirmDialog
        open={!!statusIntake}
        onOpenChange={(v) => !v && setStatusIntake(null)}
        title={statusIntake?.status === "ACTIVE" ? "Deactivate Intake" : "Activate Intake"}
        message={
          statusIntake?.status === "ACTIVE"
            ? `Deactivate ${statusIntake?.name}? It won't be selectable for new applications.`
            : `Activate ${statusIntake?.name}? It becomes selectable for new applications.`
        }
        confirmLabel={statusIntake?.status === "ACTIVE" ? "Deactivate" : "Activate"}
        destructive={statusIntake?.status === "ACTIVE"}
        onConfirm={async () => {
          try {
            const next = statusIntake!.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
            await apiFetch(`/api/intakes/${statusIntake!.id}`, {
              method: "PATCH",
              json: { status: next },
            });
            toast({
              title: next === "ACTIVE" ? "Intake activated" : "Intake deactivated",
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
        open={!!archiveIntake}
        onOpenChange={(v) => !v && setArchiveIntake(null)}
        title={archiveIntake?.deletedAt ? "Unarchive Intake" : "Archive Intake"}
        message={
          archiveIntake?.deletedAt
            ? `Restore ${archiveIntake?.name} to the active catalog?`
            : `Archive ${archiveIntake?.name}? Archived intakes are hidden from the default list.`
        }
        confirmLabel={archiveIntake?.deletedAt ? "Unarchive" : "Archive"}
        destructive={!archiveIntake?.deletedAt}
        onConfirm={async () => {
          try {
            await apiFetch(`/api/intakes/${archiveIntake!.id}`, {
              method: "PATCH",
              json: { archived: !archiveIntake!.deletedAt },
            });
            toast({
              title: archiveIntake!.deletedAt ? "Intake unarchived" : "Intake archived",
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
