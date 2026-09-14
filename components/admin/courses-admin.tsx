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
  COURSE_DEGREE_LEVELS,
  COURSE_DEGREE_LABELS,
} from "@/lib/constants/courses";
import {
  COURSE_STATUSES,
  COURSE_STATUS_LABELS,
  formatTuition,
} from "@/lib/constants/courses-admin";

type Country = { id: string; name: string; flag: string | null };
type University = { id: string; name: string };
type IntakeOption = { id: string; name: string; courseName: string };

type Course = {
  id: string;
  name: string;
  slug: string;
  degreeLevel: string;
  duration: string | null;
  tuitionFee: number | null;
  currency: string;
  applicationFee: number | null;
  applicationDeadline: string | null;
  ieltsRequirement: string | null;
  toeflRequirement: string | null;
  pteRequirement: string | null;
  academicRequirements: string | null;
  status: string;
  deletedAt: string | null;
  createdAt: string;
  university: { id: string; name: string; country: Country };
  _count?: { intakes: number; applications: number };
};

const statusOptions = COURSE_STATUSES.map((s) => ({
  value: s,
  label: COURSE_STATUS_LABELS[s],
}));

const degreeOptions = COURSE_DEGREE_LEVELS.map((d) => ({
  value: d,
  label: COURSE_DEGREE_LABELS[d],
}));

const englishTestOptions = [
  { value: "ielts", label: "Has IELTS" },
  { value: "toefl", label: "Has TOEFL" },
  { value: "pte", label: "Has PTE" },
  { value: "any", label: "Any English test" },
];

/**
 * Admin Courses list — full CRUD via reusable components:
 *  - server-side search (name, university, country), 6 filters (status,
 *    country, university, degree, tuition range, englishTest, intake)
 *  - sortable columns (name, tuitionFee, degreeLevel, status, createdAt)
 *  - row actions: View, Edit, Status (activate/deactivate), Archive
 *  - archived toggle to view soft-deleted courses
 *  - shared FormDialog/ConfirmDialog for create/edit/archive
 */
export function CoursesAdmin() {
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/courses"] });

  const [createOpen, setCreateOpen] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [archiveCourse, setArchiveCourse] = useState<Course | null>(null);
  const [statusCourse, setStatusCourse] = useState<Course | null>(null);
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

  const { data: intakesData } = useQuery({
    queryKey: ["/api/intakes", "options"],
    queryFn: () =>
      apiFetch<{ data: IntakeOption[] }>("/api/intakes?pageSize=100"),
  });
  const intakeOptions = (intakesData?.data ?? []).map((i) => ({
    value: i.id,
    label: `${i.name} — ${i.courseName}`,
  }));

  const staticParams = useMemo(
    () => ({ archived: showArchived ? "true" : "false" }),
    [showArchived],
  );

  const fields: FormField[] = [
    { type: "select", name: "universityId", label: "University", options: universityOptions, required: true },
    { type: "text", name: "name", label: "Course name", required: true },
    { type: "select", name: "degreeLevel", label: "Degree level", required: true, options: degreeOptions },
    { type: "text", name: "duration", label: "Duration", placeholder: "3 years" },
    { type: "number", name: "tuitionFee", label: "Tuition fee" },
    { type: "text", name: "currency", label: "Currency", placeholder: "USD" },
    { type: "number", name: "applicationFee", label: "Application fee" },
    { type: "date", name: "applicationDeadline", label: "Application deadline" },
    { type: "text", name: "ieltsRequirement", label: "IELTS requirement", placeholder: "6.5 overall, no band below 6.0" },
    { type: "text", name: "toeflRequirement", label: "TOEFL requirement", placeholder: "90 iBT, no section below 20" },
    { type: "text", name: "pteRequirement", label: "PTE requirement", placeholder: "62 overall, no section below 59" },
    { type: "textarea", name: "academicRequirements", label: "Academic requirements" },
    {
      type: "select",
      name: "status",
      label: "Status",
      options: statusOptions,
    },
  ];

  const columns: Column<Course>[] = [
    {
      key: "name",
      header: "Course",
      sortable: true,
      render: (c) => <span className="font-medium">{c.name}</span>,
    },
    {
      key: "university",
      header: "University",
      render: (c) => (
        <span className="inline-flex items-center gap-1">
          {c.university.country.flag && <span aria-hidden>{c.university.country.flag}</span>}
          {c.university.name}
        </span>
      ),
    },
    {
      key: "degreeLevel",
      header: "Level",
      sortable: true,
      render: (c) => COURSE_DEGREE_LABELS[c.degreeLevel as keyof typeof COURSE_DEGREE_LABELS] ?? c.degreeLevel,
    },
    {
      key: "tuitionFee",
      header: "Tuition",
      sortable: true,
      render: (c) => formatTuition(c.tuitionFee, c.currency),
    },
    {
      key: "applicationDeadline",
      header: "Deadline",
      render: (c) =>
        c.applicationDeadline
          ? new Date(c.applicationDeadline).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "—",
    },
    { key: "intakes", header: "Intakes", render: (c) => c._count?.intakes ?? 0 },
    { key: "applications", header: "Apps", render: (c) => c._count?.applications ?? 0 },
    { key: "status", header: "Status", sortable: true, render: (c) => <StatusBadge status={c.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Courses"
        description="Programs offered by partner universities — manage tuition, English-test requirements, and application deadlines."
        breadcrumbs={["Admin", "Courses"]}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden /> New Course
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
        endpoint="/api/courses"
        columns={columns}
        searchPlaceholder="Search by course, university, or country…"
        staticParams={staticParams}
        filters={[
          { key: "status", label: "Status", options: statusOptions },
          { key: "countryId", label: "Country", options: countryOptions },
          { key: "universityId", label: "University", options: universityOptions },
          { key: "degreeLevel", label: "Level", options: degreeOptions },
          { key: "englishTest", label: "English", options: englishTestOptions },
          ...(intakeOptions.length > 0
            ? [{ key: "intakeId", label: "Intake", options: intakeOptions }]
            : []),
        ]}
        emptyMessage="No courses match your filters."
        rowActions={[
          { label: "View", onClick: (c) => router.push(`/admin/courses/${c.id}`) },
          { label: "Edit", onClick: (c) => setEditCourse(c) },
          { label: "Status", onClick: (c) => setStatusCourse(c) },
          {
            label: "Archive",
            destructive: true,
            onClick: (c) => setArchiveCourse(c),
          },
        ]}
      />

      <FormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New Course"
        fields={fields}
        endpoint="/api/courses"
        invalidateKey="/api/courses"
        successMessage="Course created"
        toPayload={(values) => ({
          universityId: values.universityId,
          name: values.name,
          degreeLevel: values.degreeLevel,
          duration: values.duration || undefined,
          tuitionFee: values.tuitionFee ? Number(values.tuitionFee) : undefined,
          currency: values.currency || "USD",
          applicationFee: values.applicationFee ? Number(values.applicationFee) : undefined,
          applicationDeadline: values.applicationDeadline || undefined,
          ieltsRequirement: values.ieltsRequirement || undefined,
          toeflRequirement: values.toeflRequirement || undefined,
          pteRequirement: values.pteRequirement || undefined,
          academicRequirements: values.academicRequirements || undefined,
          status: values.status || "ACTIVE",
        })}
      />

      {editCourse && (
        <FormDialog
          key={editCourse.id}
          open={!!editCourse}
          onOpenChange={(v) => !v && setEditCourse(null)}
          title={`Edit ${editCourse.name}`}
          fields={fields}
          endpoint="/api/courses"
          entityId={editCourse.id}
          invalidateKey="/api/courses"
          successMessage="Course updated"
          toPayload={(values) => ({
            universityId: values.universityId,
            name: values.name,
            degreeLevel: values.degreeLevel,
            duration: values.duration || undefined,
            tuitionFee: values.tuitionFee ? Number(values.tuitionFee) : undefined,
            currency: values.currency || "USD",
            applicationFee: values.applicationFee ? Number(values.applicationFee) : undefined,
            applicationDeadline: values.applicationDeadline || undefined,
            ieltsRequirement: values.ieltsRequirement || undefined,
            toeflRequirement: values.toeflRequirement || undefined,
            pteRequirement: values.pteRequirement || undefined,
            academicRequirements: values.academicRequirements || undefined,
            status: values.status || "ACTIVE",
          })}
        />
      )}

      <ConfirmDialog
        open={!!statusCourse}
        onOpenChange={(v) => !v && setStatusCourse(null)}
        title={statusCourse?.status === "ACTIVE" ? "Deactivate Course" : "Activate Course"}
        message={
          statusCourse?.status === "ACTIVE"
            ? `Deactivate ${statusCourse?.name}? Existing applications keep their data but the course won't be selectable for new applications.`
            : `Activate ${statusCourse?.name}? It becomes selectable for new applications.`
        }
        confirmLabel={statusCourse?.status === "ACTIVE" ? "Deactivate" : "Activate"}
        destructive={statusCourse?.status === "ACTIVE"}
        onConfirm={async () => {
          try {
            const next = statusCourse!.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
            await apiFetch(`/api/courses/${statusCourse!.id}`, {
              method: "PATCH",
              json: { status: next },
            });
            toast({
              title: next === "ACTIVE" ? "Course activated" : "Course deactivated",
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
        open={!!archiveCourse}
        onOpenChange={(v) => !v && setArchiveCourse(null)}
        title={archiveCourse?.deletedAt ? "Unarchive Course" : "Archive Course"}
        message={
          archiveCourse?.deletedAt
            ? `Restore ${archiveCourse?.name} to the active catalog?`
            : `Archive ${archiveCourse?.name}? Archived courses are hidden from the default list. Existing applications retain their data.`
        }
        confirmLabel={archiveCourse?.deletedAt ? "Unarchive" : "Archive"}
        destructive={!archiveCourse?.deletedAt}
        onConfirm={async () => {
          try {
            await apiFetch(`/api/courses/${archiveCourse!.id}`, {
              method: "PATCH",
              json: { archived: !archiveCourse!.deletedAt },
            });
            toast({
              title: archiveCourse!.deletedAt ? "Course unarchived" : "Course archived",
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
