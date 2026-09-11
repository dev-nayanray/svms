"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ConfirmDialog, FormDialog, PageHeader, type FormField } from "@/components/shared/page-kit";
import { StatusBadge } from "@/components/shared";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui";
import { apiFetch } from "@/lib/api-client";
import { Plus } from "lucide-react";

type Student = {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: string;
  createdAt: string;
  country: string | null;
  branchId: string | null;
  employee?: { user?: { name?: string } } | null;
};

type EmployeeOption = { id: string; user: { name: string } };
type BranchOption = { id: string; name: string };
type CountryOption = { id: string; name: string };

const STUDENT_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING"];

export function StudentsAdmin() {
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/students"] });

  const [createOpen, setCreateOpen] = useState(false);
  const [newAppOpen, setNewAppOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [assignEmp, setAssignEmp] = useState<Student | null>(null);
  const [assignBranch, setAssignBranch] = useState<Student | null>(null);
  const [suspendStudent, setSuspendStudent] = useState<Student | null>(null);
  const [activateStudent, setActivateStudent] = useState<Student | null>(null);
  const [archiveStudent, setArchiveStudent] = useState<Student | null>(null);

  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");

  const { data: employees } = useQuery({
    queryKey: ["/api/employees", "options"],
    queryFn: () => apiFetch<{ data: EmployeeOption[] }>("/api/employees?pageSize=100"),
  });
  const { data: branches } = useQuery({
    queryKey: ["/api/branches", "options"],
    queryFn: () => apiFetch<{ data: BranchOption[] }>("/api/branches"),
  });
  const { data: countries } = useQuery({
    queryKey: ["/api/countries", "options"],
    queryFn: () => apiFetch<{ data: CountryOption[] }>("/api/countries"),
  });
  const employeeOptions = (employees?.data ?? []).map((e) => ({ value: e.id, label: e.user.name }));
  const branchOptions = (branches?.data ?? []).map((b) => ({ value: b.id, label: b.name }));
  const countryOptions = (countries?.data ?? []).map((c) => ({ value: c.name, label: c.name }));
  const stageOptions = useMemo(
    () =>
      [
        "LEAD", "COUNSELING", "PROFILE_ASSESSMENT", "COUNTRY_SELECTION", "UNIVERSITY_SELECTION",
        "DOCUMENT_COLLECTION", "APPLICATION_SUBMITTED", "CONDITIONAL_OFFER", "UNCONDITIONAL_OFFER",
        "DEPOSIT_PAYMENT", "CONFIRMATION", "VISA_PREPARATION", "VISA_SUBMITTED", "BIOMETRICS",
        "INTERVIEW", "VISA_DECISION", "TRAVEL_PREPARATION", "COMPLETED",
      ].map((s) => ({ value: s, label: s.replace(/_/g, " ") })),
    []
  );

  const staticParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (createdFrom) p.createdFrom = createdFrom;
    if (createdTo) p.createdTo = createdTo;
    return p;
  }, [createdFrom, createdTo]);

  const createFields: FormField[] = [
    { type: "text", name: "firstName", label: "First name", required: true },
    { type: "text", name: "lastName", label: "Last name", required: true },
    { type: "email", name: "email", label: "Email", required: true },
    { type: "text", name: "phone", label: "Phone" },
    { type: "date", name: "dateOfBirth", label: "Date of birth" },
    { type: "text", name: "nationality", label: "Nationality" },
    { type: "text", name: "country", label: "Country of residence" },
    { type: "text", name: "passportNumber", label: "Passport number" },
    { type: "select", name: "assignedEmployeeId", label: "Assigned employee", options: employeeOptions },
    { type: "select", name: "branchId", label: "Branch", options: branchOptions },
    { type: "password", name: "password", label: "Temporary password", placeholder: "min 8 characters" },
  ];

  const editFields: FormField[] = [
    { type: "text", name: "firstName", label: "First name" },
    { type: "text", name: "lastName", label: "Last name" },
    { type: "text", name: "phone", label: "Phone" },
    { type: "text", name: "nationality", label: "Nationality" },
    { type: "text", name: "country", label: "Country of residence" },
    { type: "text", name: "passportNumber", label: "Passport number" },
    { type: "select", name: "assignedEmployeeId", label: "Assigned employee", options: employeeOptions },
    { type: "select", name: "branchId", label: "Branch", options: branchOptions },
    { type: "select", name: "status", label: "Status", options: STUDENT_STATUSES.map((s) => ({ value: s, label: s })) },
  ];

  const columns: Column<Student>[] = [
    { key: "studentId", header: "Student ID", sortable: true, render: (s) => <span className="font-mono text-xs">{s.studentId}</span> },
    {
      key: "name", header: "Name", sortable: true,
      render: (s) => (
        <Link href={`/admin/students/${s.id}`} className="font-medium text-primary hover:underline">
          {s.firstName} {s.lastName}
        </Link>
      ),
    },
    { key: "email", header: "Email", render: (s) => s.email },
    { key: "country", header: "Country", render: (s) => s.country ?? "—" },
    { key: "employee", header: "Counselor", render: (s) => s.employee?.user?.name ?? "—" },
    { key: "status", header: "Status", sortable: true, render: (s) => <StatusBadge status={s.status} /> },
    { key: "createdAt", header: "Registered", sortable: true, render: (s) => new Date(s.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) },
  ];

  const patchStudent = async (id: string, json: Record<string, unknown>, message: string) => {
    try {
      await apiFetch(`/api/students/${id}`, { method: "PATCH", json });
      toast({ title: message, variant: "success" });
      invalidate();
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "error" });
      throw err;
    }
  };

  return (
    <>
      <PageHeader
        title="Students"
        description="Complete student management with case history."
        breadcrumbs={["Admin", "Students"]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setNewAppOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden /> New Application
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden /> New Student
            </Button>
          </div>
        }
      />

      {/* Registration date range */}
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <div className="space-y-1">
          <label htmlFor="reg-from" className="block text-xs text-muted-foreground">Registered from</label>
          <input id="reg-from" type="date" value={createdFrom} onChange={(e) => setCreatedFrom(e.target.value)} className="h-9 rounded-md border border-border bg-card px-2" />
        </div>
        <div className="space-y-1">
          <label htmlFor="reg-to" className="block text-xs text-muted-foreground">Registered to</label>
          <input id="reg-to" type="date" value={createdTo} onChange={(e) => setCreatedTo(e.target.value)} className="h-9 rounded-md border border-border bg-card px-2" />
        </div>
        {(createdFrom || createdTo) && (
          <Button variant="outline" size="sm" className="mb-1.5" onClick={() => { setCreatedFrom(""); setCreatedTo(""); }}>
            Clear dates
          </Button>
        )}
      </div>

      <DataTable
        endpoint="/api/students"
        columns={columns}
        searchPlaceholder="Search by name, email, or ID…"
        staticParams={staticParams}
        filters={[
          { key: "status", label: "Student status", options: STUDENT_STATUSES.map((s) => ({ value: s, label: s })) },
          { key: "appStage", label: "Application stage", options: stageOptions },
          { key: "employeeId", label: "Employee", options: employeeOptions },
          { key: "branchId", label: "Branch", options: branchOptions },
          { key: "country", label: "Country", options: countryOptions },
        ]}
        emptyMessage="No students match your filters."
        rowActions={[
          { label: "View", onClick: (s) => router.push(`/admin/students/${s.id}`) },
          { label: "Edit", onClick: (s) => setEditStudent(s) },
          { label: "Assign Emp", onClick: (s) => setAssignEmp(s) },
          { label: "Assign Branch", onClick: (s) => setAssignBranch(s) },
          { label: "Suspend", destructive: true, onClick: (s) => setSuspendStudent(s) },
          { label: "Activate", onClick: (s) => setActivateStudent(s) },
          { label: "Archive", destructive: true, onClick: (s) => setArchiveStudent(s) },
        ]}
      />

      <FormDialog
        open={createOpen} onOpenChange={setCreateOpen}
        title="Create Student"
        description="Creates the student profile and their login account."
        fields={createFields}
        endpoint="/api/students" invalidateKey="/api/students" successMessage="Student created"
      />

      {editStudent && (
        <FormDialog
          key={editStudent.id} open={!!editStudent} onOpenChange={(v) => !v && setEditStudent(null)}
          title={`Edit ${editStudent.firstName} ${editStudent.lastName}`}
          fields={editFields}
          endpoint="/api/students" entityId={editStudent.id}
          invalidateKey="/api/students" successMessage="Student updated"
        />
      )}

      {assignEmp && (
        <FormDialog
          key={`emp-${assignEmp.id}`} open={!!assignEmp} onOpenChange={(v) => !v && setAssignEmp(null)}
          title={`Assign employee — ${assignEmp.firstName} ${assignEmp.lastName}`}
          fields={[{ type: "select", name: "assignedEmployeeId", label: "Employee", options: employeeOptions, required: true }]}
          endpoint="/api/students" entityId={assignEmp.id}
          invalidateKey="/api/students" successMessage="Employee assigned"
        />
      )}

      {assignBranch && (
        <FormDialog
          key={`branch-${assignBranch.id}`} open={!!assignBranch} onOpenChange={(v) => !v && setAssignBranch(null)}
          title={`Assign branch — ${assignBranch.firstName} ${assignBranch.lastName}`}
          fields={[{ type: "select", name: "branchId", label: "Branch", options: branchOptions, required: true }]}
          endpoint="/api/students" entityId={assignBranch.id}
          invalidateKey="/api/students" successMessage="Branch assigned"
        />
      )}

      {newAppOpen && (
        <NewApplicationDialog
          onClose={() => setNewAppOpen(false)}
          onDone={invalidate}
          countryOptions={countryOptions}
        />
      )}

      <ConfirmDialog
        open={!!suspendStudent} onOpenChange={(v) => !v && setSuspendStudent(null)}
        title="Suspend Student"
        message={`Suspend ${suspendStudent?.firstName} ${suspendStudent?.lastName}? They will be unable to sign in until reactivated.`}
        confirmLabel="Suspend" destructive
        onConfirm={() => patchStudent(suspendStudent!.id, { status: "SUSPENDED" }, "Student suspended")}
      />

      <ConfirmDialog
        open={!!activateStudent} onOpenChange={(v) => !v && setActivateStudent(null)}
        title="Activate Student"
        message={`Reactivate ${activateStudent?.firstName} ${activateStudent?.lastName}?`}
        confirmLabel="Activate"
        onConfirm={() => patchStudent(activateStudent!.id, { status: "ACTIVE" }, "Student activated")}
      />

      <ConfirmDialog
        open={!!archiveStudent} onOpenChange={(v) => !v && setArchiveStudent(null)}
        title="Archive Student"
        message={`Soft-archive ${archiveStudent?.firstName} ${archiveStudent?.lastName}? The record and all case history are retained for audit.`}
        confirmLabel="Archive" destructive
        onConfirm={async () => {
          try {
            await apiFetch(`/api/students/${archiveStudent!.id}`, { method: "DELETE" });
            toast({ title: "Student archived", variant: "success" });
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

function NewApplicationDialog({
  onClose,
  onDone,
  countryOptions,
}: {
  onClose: () => void;
  onDone: () => void;
  countryOptions: { value: string; label: string }[];
}) {
  const { toast } = useToast();
  const [studentId, setStudentId] = useState("");
  const [countryId, setCountryId] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [busy, setBusy] = useState(false);

  const { data: students } = useQuery({
    queryKey: ["/api/students", "appdialog"],
    queryFn: () =>
      apiFetch<{ data: { id: string; firstName: string; lastName: string; studentId: string }[] }>(
        "/api/students?pageSize=100"
      ),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-label="Create application">
      <div className="w-[95vw] max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
        <h2 className="text-base font-semibold">Create Application</h2>
        <div className="mt-4 space-y-3">
          <div className="space-y-1">
            <label htmlFor="app-student" className="text-sm font-medium">Student</label>
            <select
              id="app-student"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm"
            >
              <option value="">Select student…</option>
              {(students?.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName} ({s.studentId})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="app-country" className="text-sm font-medium">Destination country</label>
            <select
              id="app-country"
              value={countryId}
              onChange={(e) => setCountryId(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm"
            >
              <option value="">Select country…</option>
              {countryOptions.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="app-priority" className="text-sm font-medium">Priority</label>
            <select
              id="app-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm"
            >
              {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            disabled={busy || !studentId || !countryId}
            onClick={async () => {
              setBusy(true);
              try {
                await apiFetch("/api/applications", {
                  method: "POST",
                  json: { studentId, countryId, priority },
                });
                toast({ title: "Application created", variant: "success" });
                onDone();
                onClose();
              } catch (err) {
                toast({ title: "Failed", description: (err as Error).message, variant: "error" });
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Creating…" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}
