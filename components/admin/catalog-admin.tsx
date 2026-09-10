"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ConfirmDialog, FormDialog, PageHeader, type FormField } from "@/components/shared/page-kit";
import { StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { Plus } from "lucide-react";

type University = {
  id: string;
  name: string;
  website: string | null;
  ranking: number | null;
  applicationFee: number | null;
  status: string;
  country: { id: string; name: string };
  _count?: { courses: number };
};

export function UniversitiesAdmin() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editUni, setEditUni] = useState<University | null>(null);
  const [deleteUni, setDeleteUni] = useState<University | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/universities"] });

  const { data: countries } = useQuery({
    queryKey: ["/api/countries", "options"],
    queryFn: () => apiFetch<{ data: { id: string; name: string }[] }>("/api/countries"),
  });
  const countryOptions = (countries?.data ?? []).map((c) => ({ value: c.id, label: c.name }));

  const fields: FormField[] = [
    { type: "text", name: "name", label: "Name", required: true },
    { type: "select", name: "countryId", label: "Country", options: countryOptions, required: true },
    { type: "text", name: "website", label: "Website", placeholder: "https://…" },
    { type: "number", name: "ranking", label: "Ranking" },
    { type: "number", name: "applicationFee", label: "Application fee (USD)" },
    { type: "textarea", name: "description", label: "Description" },
  ];

  const columns: Column<University>[] = [
    { key: "name", header: "Name", sortable: true, render: (u) => <span className="font-medium">{u.name}</span> },
    { key: "country", header: "Country", render: (u) => u.country.name },
    { key: "ranking", header: "Ranking", render: (u) => u.ranking ?? "—" },
    { key: "courses", header: "Courses", render: (u) => u._count?.courses ?? 0 },
    { key: "applicationFee", header: "App Fee", render: (u) => (u.applicationFee ? `$${u.applicationFee}` : "—") },
    { key: "status", header: "Status", render: (u) => <StatusBadge status={u.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Universities"
        description="Partner university catalog."
        breadcrumbs={["Admin", "Universities"]}
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" aria-hidden /> New University</Button>}
      />
      <DataTable
        endpoint="/api/universities"
        columns={columns}
        searchPlaceholder="Search universities…"
        emptyMessage="No universities yet."
        rowActions={[
          { label: "Edit", onClick: (u) => setEditUni(u) },
          { label: "Delete", destructive: true, onClick: (u) => setDeleteUni(u) },
        ]}
      />
      <FormDialog
        open={createOpen} onOpenChange={setCreateOpen}
        title="New University" fields={fields}
        endpoint="/api/universities" invalidateKey="/api/universities" successMessage="University created"
      />
      {editUni && (
        <FormDialog
          key={editUni.id} open={!!editUni} onOpenChange={(v) => !v && setEditUni(null)}
          title={`Edit ${editUni.name}`} fields={fields}
          endpoint="/api/universities" entityId={editUni.id}
          invalidateKey="/api/universities" successMessage="University updated"
        />
      )}
      <ConfirmDialog
        open={!!deleteUni} onOpenChange={(v) => !v && setDeleteUni(null)}
        title="Delete University"
        message={`Soft-delete ${deleteUni?.name}? Its courses are retained.`}
        confirmLabel="Delete" destructive
        onConfirm={async () => {
          try {
            await apiFetch(`/api/universities/${deleteUni!.id}`, { method: "DELETE" });
            toast({ title: "University deleted", variant: "success" });
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

type Course = {
  id: string;
  name: string;
  degreeLevel: string;
  tuitionFee: number | null;
  currency: string;
  status: string;
  university: { id: string; name: string };
};

export function CoursesAdmin() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);

  const { data: universities } = useQuery({
    queryKey: ["/api/universities", "options"],
    queryFn: () => apiFetch<{ data: University[] }>("/api/universities?pageSize=100"),
  });
  const uniOptions = (universities?.data ?? []).map((u) => ({ value: u.id, label: u.name }));

  const fields: FormField[] = [
    { type: "select", name: "universityId", label: "University", options: uniOptions, required: true },
    { type: "text", name: "name", label: "Course name", required: true },
    { type: "select", name: "degreeLevel", label: "Degree level", required: true, options: [
      { value: "FOUNDATION", label: "Foundation" }, { value: "BACHELOR", label: "Bachelor" },
      { value: "MASTER", label: "Master" }, { value: "PHD", label: "PhD" }, { value: "DIPLOMA", label: "Diploma" },
    ]},
    { type: "text", name: "duration", label: "Duration", placeholder: "3 years" },
    { type: "number", name: "tuitionFee", label: "Tuition fee" },
    { type: "text", name: "englishRequirements", label: "English requirements", placeholder: "IELTS 6.5 overall" },
  ];

  const columns: Column<Course>[] = [
    { key: "name", header: "Course", sortable: true, render: (c) => <span className="font-medium">{c.name}</span> },
    { key: "university", header: "University", render: (c) => c.university.name },
    { key: "degreeLevel", header: "Level", render: (c) => c.degreeLevel },
    { key: "tuitionFee", header: "Tuition", render: (c) => (c.tuitionFee != null ? `${c.currency} ${c.tuitionFee.toLocaleString()}` : "—") },
    { key: "status", header: "Status", render: (c) => <StatusBadge status={c.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Courses"
        description="Programs offered by partner universities."
        breadcrumbs={["Admin", "Courses"]}
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" aria-hidden /> New Course</Button>}
      />
      <DataTable
        endpoint="/api/courses"
        columns={columns}
        searchPlaceholder="Search courses…"
        filters={[
          { key: "degreeLevel", label: "Level", options: ["FOUNDATION", "BACHELOR", "MASTER", "PHD", "DIPLOMA"].map((d) => ({ value: d, label: d })) },
        ]}
        emptyMessage="No courses yet."
        rowActions={[{ label: "Edit", onClick: (c) => setEditCourse(c) }]}
      />
      <FormDialog
        open={createOpen} onOpenChange={setCreateOpen}
        title="New Course" fields={fields}
        endpoint="/api/courses" invalidateKey="/api/courses" successMessage="Course created"
      />
      {editCourse && (
        <FormDialog
          key={editCourse.id} open={!!editCourse} onOpenChange={(v) => !v && setEditCourse(null)}
          title={`Edit ${editCourse.name}`} fields={fields}
          endpoint="/api/courses" entityId={editCourse.id}
          invalidateKey="/api/courses" successMessage="Course updated"
        />
      )}
    </>
  );
}

type Country = { id: string; name: string; code: string; currency: string | null; status: string; _count?: { universities: number } };

export function CountriesAdmin() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editCountry, setEditCountry] = useState<Country | null>(null);

  const fields: FormField[] = [
    { type: "text", name: "name", label: "Country name", required: true },
    { type: "text", name: "code", label: "ISO code (2-3)", required: true, placeholder: "GB" },
    { type: "text", name: "currency", label: "Currency", placeholder: "GBP" },
    { type: "textarea", name: "description", label: "Description" },
  ];

  const columns: Column<Country>[] = [
    { key: "name", header: "Name", sortable: true, render: (c) => <span className="font-medium">{c.name}</span> },
    { key: "code", header: "Code", render: (c) => <span className="font-mono text-xs">{c.code}</span> },
    { key: "currency", header: "Currency", render: (c) => c.currency ?? "—" },
    { key: "universities", header: "Universities", render: (c) => c._count?.universities ?? 0 },
    { key: "status", header: "Status", render: (c) => <StatusBadge status={c.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Countries"
        description="Destination countries."
        breadcrumbs={["Admin", "Countries"]}
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" aria-hidden /> New Country</Button>}
      />
      <DataTable
        endpoint="/api/countries"
        columns={columns}
        emptyMessage="No countries yet."
        rowActions={[{ label: "Edit", onClick: (c) => setEditCountry(c) }]}
      />
      <FormDialog
        open={createOpen} onOpenChange={setCreateOpen}
        title="New Country" fields={fields}
        endpoint="/api/countries" invalidateKey="/api/countries" successMessage="Country created"
      />
      {editCountry && (
        <FormDialog
          key={editCountry.id} open={!!editCountry} onOpenChange={(v) => !v && setEditCountry(null)}
          title={`Edit ${editCountry.name}`} fields={fields}
          endpoint="/api/countries" entityId={editCountry.id}
          invalidateKey="/api/countries" successMessage="Country updated"
        />
      )}
    </>
  );
}

type Intake = {
  id: string;
  name: string;
  month: number;
  year: number;
  deadline: string | null;
  status: string;
  course: { name: string; university: { name: string } };
};

export function IntakesAdmin() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editIntake, setEditIntake] = useState<Intake | null>(null);

  const { data: courses } = useQuery({
    queryKey: ["/api/courses", "options"],
    queryFn: () => apiFetch<{ data: Course[] }>("/api/courses?pageSize=100"),
  });
  const courseOptions = (courses?.data ?? []).map((c) => ({ value: c.id, label: `${c.name} (${c.university.name})` }));

  const fields: FormField[] = [
    { type: "select", name: "courseId", label: "Course", options: courseOptions, required: true },
    { type: "text", name: "name", label: "Intake name", required: true, placeholder: "September 2027" },
    { type: "number", name: "month", label: "Month (1-12)", required: true },
    { type: "number", name: "year", label: "Year", required: true },
    { type: "date", name: "deadline", label: "Application deadline" },
  ];

  const columns: Column<Intake>[] = [
    { key: "name", header: "Intake", sortable: true, render: (i) => <span className="font-medium">{i.name}</span> },
    { key: "course", header: "Course", render: (i) => `${i.course.name} — ${i.course.university.name}` },
    { key: "deadline", header: "Deadline", render: (i) => (i.deadline ? new Date(i.deadline).toLocaleDateString("en-GB") : "—") },
    { key: "status", header: "Status", render: (i) => <StatusBadge status={i.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Intakes"
        description="Application windows per course."
        breadcrumbs={["Admin", "Intakes"]}
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" aria-hidden /> New Intake</Button>}
      />
      <DataTable
        endpoint="/api/intakes"
        columns={columns}
        searchPlaceholder="Search intakes…"
        emptyMessage="No intakes yet."
        rowActions={[{ label: "Edit", onClick: (i) => setEditIntake(i) }]}
      />
      <FormDialog
        open={createOpen} onOpenChange={setCreateOpen}
        title="New Intake" fields={fields}
        endpoint="/api/intakes" invalidateKey="/api/intakes" successMessage="Intake created"
      />
      {editIntake && (
        <FormDialog
          key={editIntake.id} open={!!editIntake} onOpenChange={(v) => !v && setEditIntake(null)}
          title={`Edit ${editIntake.name}`} fields={fields}
          endpoint="/api/intakes" entityId={editIntake.id}
          invalidateKey="/api/intakes" successMessage="Intake updated"
        />
      )}
    </>
  );
}

type Branch = {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  email: string | null;
  status: string;
  _count?: { users: number; students: number; employees: number };
};

export function BranchesAdmin() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);

  const fields: FormField[] = [
    { type: "text", name: "name", label: "Branch name", required: true },
    { type: "text", name: "code", label: "Code", required: true, placeholder: "HQ" },
    { type: "text", name: "phone", label: "Phone" },
    { type: "email", name: "email", label: "Email" },
    { type: "text", name: "address", label: "Address" },
  ];

  const columns: Column<Branch>[] = [
    { key: "name", header: "Branch", render: (b) => <span className="font-medium">{b.name}</span> },
    { key: "code", header: "Code", render: (b) => <span className="font-mono text-xs">{b.code}</span> },
    { key: "employees", header: "Employees", render: (b) => b._count?.employees ?? 0 },
    { key: "students", header: "Students", render: (b) => b._count?.students ?? 0 },
    { key: "status", header: "Status", render: (b) => <StatusBadge status={b.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Branches"
        description="Office locations — foundation for branch-level access control."
        breadcrumbs={["Admin", "Branches"]}
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" aria-hidden /> New Branch</Button>}
      />
      <DataTable
        endpoint="/api/branches"
        columns={columns}
        emptyMessage="No branches yet."
        rowActions={[{ label: "Edit", onClick: (b) => setEditBranch(b) }]}
      />
      <FormDialog
        open={createOpen} onOpenChange={setCreateOpen}
        title="New Branch" fields={fields}
        endpoint="/api/branches" invalidateKey="/api/branches" successMessage="Branch created"
      />
      {editBranch && (
        <FormDialog
          key={editBranch.id} open={!!editBranch} onOpenChange={(v) => !v && setEditBranch(null)}
          title={`Edit ${editBranch.name}`} fields={fields}
          endpoint="/api/branches" entityId={editBranch.id}
          invalidateKey="/api/branches" successMessage="Branch updated"
        />
      )}
    </>
  );
}
