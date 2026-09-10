"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DataTable, type Column } from "@/components/shared/data-table";
import { FormDialog, ConfirmDialog, type FormField } from "@/components/shared/page-kit";
import { StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { Plus } from "lucide-react";

type Course = {
  id: string;
  name: string;
  degreeLevel: string;
  duration: string | null;
  tuitionFee: number | null;
  currency: string;
  applicationFee: number | null;
  applicationDeadline: string | null;
  ieltsRequirement: string | null;
  toeflRequirement: string | null;
  pteRequirement: string | null;
  englishRequirements: string | null;
  academicRequirements: string | null;
  status: string;
  _count?: { intakes: number; applications: number };
};

const DEGREE_LEVEL_OPTIONS = [
  { value: "FOUNDATION", label: "Foundation" },
  { value: "BACHELOR", label: "Bachelor" },
  { value: "MASTER", label: "Master" },
  { value: "PHD", label: "PhD" },
  { value: "DIPLOMA", label: "Diploma" },
];

/**
 * University-scoped course manager. Reuses the shared DataTable +
 * FormDialog + ConfirmDialog primitives — same shape as the global
 * Courses admin, but pre-scoped to a single university and with full
 * edit/delete (the global admin only allows create/edit).
 *
 * The universityId is injected into every payload so the admin doesn't
 * need to re-select it per course.
 */
export function UniversityCourses({ universityId }: { universityId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["/api/courses", { universityId }] });

  const [createOpen, setCreateOpen] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [deleteCourse, setDeleteCourse] = useState<Course | null>(null);

  const fields: FormField[] = [
    { type: "text", name: "name", label: "Course name", required: true, placeholder: "MSc Computer Science" },
    { type: "select", name: "degreeLevel", label: "Degree level", required: true, options: DEGREE_LEVEL_OPTIONS },
    { type: "text", name: "duration", label: "Duration", placeholder: "3 years" },
    { type: "number", name: "tuitionFee", label: "Tuition fee" },
    { type: "text", name: "currency", label: "Currency", placeholder: "USD" },
    { type: "number", name: "applicationFee", label: "Application fee" },
    { type: "date", name: "applicationDeadline", label: "Application deadline" },
    { type: "text", name: "ieltsRequirement", label: "IELTS requirement", placeholder: "6.5 overall, no band below 6.0" },
    { type: "text", name: "toeflRequirement", label: "TOEFL requirement", placeholder: "90 iBT" },
    { type: "text", name: "pteRequirement", label: "PTE requirement", placeholder: "62 overall" },
    { type: "textarea", name: "academicRequirements", label: "Academic requirements" },
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

  const columns: Column<Course>[] = [
    {
      key: "name",
      header: "Course",
      sortable: true,
      render: (c) => <span className="font-medium">{c.name}</span>,
    },
    { key: "degreeLevel", header: "Level", sortable: true, render: (c) => c.degreeLevel },
    { key: "duration", header: "Duration", render: (c) => c.duration ?? "—" },
    {
      key: "tuitionFee",
      header: "Tuition",
      sortable: true,
      render: (c) =>
        c.tuitionFee != null
          ? `${c.currency} ${c.tuitionFee.toLocaleString("en-US")}`
          : "—",
    },
    {
      key: "intakes",
      header: "Intakes",
      render: (c) => c._count?.intakes ?? 0,
    },
    {
      key: "applications",
      header: "Apps",
      render: (c) => c._count?.applications ?? 0,
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
    { key: "status", header: "Status", render: (c) => <StatusBadge status={c.status} /> },
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden /> Add Course
        </Button>
      </div>

      <DataTable
        endpoint={`/api/courses?universityId=${universityId}&pageSize=100`}
        columns={columns}
        searchPlaceholder="Search courses…"
        emptyMessage="No courses for this university yet."
        rowActions={[
          { label: "Edit", onClick: (c) => setEditCourse(c) },
          { label: "Delete", destructive: true, onClick: (c) => setDeleteCourse(c) },
        ]}
      />

      <FormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New Course"
        description="Add a program offered by this university."
        fields={fields}
        endpoint="/api/courses"
        invalidateKey="/api/courses"
        successMessage="Course created"
        toPayload={(values) => ({
          universityId,
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
        open={!!deleteCourse}
        onOpenChange={(v) => !v && setDeleteCourse(null)}
        title="Delete Course"
        message={`Soft-delete ${deleteCourse?.name}? Active applications referencing this course are blocked from deletion — deactivate instead if needed.`}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          try {
            await apiFetch(`/api/courses/${deleteCourse!.id}`, { method: "DELETE" });
            toast({ title: "Course deleted", variant: "success" });
            invalidate();
          } catch (err) {
            toast({ title: "Failed", description: (err as Error).message, variant: "error" });
            throw err;
          }
        }}
      />

      {/* Hint for admins about what courses represent and what fields to
          fill in — the DataTable already renders its own empty state. */}
      <p className="text-xs text-muted-foreground">
        Courses are the programs this university offers. Add tuition, English-test
        requirements, and application deadlines so students can self-assess readiness.
      </p>
    </div>
  );
}
