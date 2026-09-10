"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ConfirmDialog, FormDialog, PageHeader, type FormField } from "@/components/shared/page-kit";
import { StatusBadge, EmptyState } from "@/components/shared";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui";
import { apiFetch, type Paged } from "@/lib/api-client";
import { formatApplicationNumber } from "@/lib/constants/applications";
import { Kanban, Table as TableIcon, Plus } from "lucide-react";

type App = {
  id: string;
  applicationNumber: string;
  stageKey: string;
  status: string;
  priority: string;
  createdAt: string;
  student: { id: string; firstName: string; lastName: string };
  country: { id: string; name: string };
  university?: { id: string; name: string } | null;
};

type Option = { value: string; label: string };

export function ApplicationsAdmin() {
  const router = useRouter();
  const { toast } = useToast();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries();

  const [view, setView] = useState<"table" | "kanban">("table");
  const [createOpen, setCreateOpen] = useState(false);
  const [editApp, setEditApp] = useState<App | null>(null);
  const [assignApp, setAssignApp] = useState<App | null>(null);
  const [archiveApp, setArchiveApp] = useState<App | null>(null);
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  void setStageFilter;
  const [kanbanStage, setKanbanStage] = useState("");

  const { data: stages } = useQuery({
    queryKey: ["/api/stages"],
    queryFn: () => apiFetch<{ data: { key: string; name: string; color: string }[] }>("/api/stages"),
  });
  const { data: countries } = useQuery({
    queryKey: ["/api/countries", "app-options"],
    queryFn: () => apiFetch<{ data: { id: string; name: string }[] }>("/api/countries"),
  });
  const { data: universities } = useQuery({
    queryKey: ["/api/universities", "app-options"],
    queryFn: () => apiFetch<Paged<{ id: string; name: string }>>("/api/universities?pageSize=100"),
  });
  const { data: courses } = useQuery({
    queryKey: ["/api/courses", "app-options"],
    queryFn: () => apiFetch<Paged<{ id: string; name: string }>>("/api/courses?pageSize=100"),
  });
  const { data: intakes } = useQuery({
    queryKey: ["/api/intakes", "app-options"],
    queryFn: () => apiFetch<Paged<{ id: string; name: string }>>("/api/intakes?pageSize=100"),
  });
  const { data: employees } = useQuery({
    queryKey: ["/api/employees", "app-options"],
    queryFn: () => apiFetch<Paged<{ id: string; user: { name: string } }>>("/api/employees?pageSize=100"),
  });
  const { data: branches } = useQuery({
    queryKey: ["/api/branches", "app-options"],
    queryFn: () => apiFetch<{ data: { id: string; name: string }[] }>("/api/branches"),
  });

  const stageOptions: Option[] = (stages?.data ?? []).map((s) => ({ value: s.key, label: s.name.replace(/_/g, " ") }));
  const countryOptions = (countries?.data ?? []).map((c) => ({ value: c.id, label: c.name }));
  const uniOptions = (universities?.data ?? []).map((u) => ({ value: u.id, label: u.name }));
  const courseOptions = (courses?.data ?? []).map((c) => ({ value: c.id, label: c.name }));
  const intakeOptions = (intakes?.data ?? []).map((i) => ({ value: i.id, label: i.name }));
  const employeeOptions = (employees?.data ?? []).map((e) => ({ value: e.id, label: e.user.name }));
  const branchOptions = (branches?.data ?? []).map((b) => ({ value: b.id, label: b.name }));

  const staticParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (createdFrom) p.createdFrom = createdFrom;
    if (createdTo) p.createdTo = createdTo;
    if (stageFilter) p.stage = stageFilter;
    return p;
  }, [createdFrom, createdTo, stageFilter]);

  const editFields: FormField[] = [
    { type: "select", name: "universityId", label: "University", options: uniOptions },
    { type: "select", name: "intakeId", label: "Intake", options: intakeOptions },
    { type: "select", name: "priority", label: "Priority", options: [
      { value: "LOW", label: "Low" }, { value: "MEDIUM", label: "Medium" },
      { value: "HIGH", label: "High" }, { value: "URGENT", label: "Urgent" },
    ]},
    { type: "select", name: "status", label: "Status", options: [
      { value: "ACTIVE", label: "Active" }, { value: "ON_HOLD", label: "On hold" },
      { value: "COMPLETED", label: "Completed" }, { value: "CANCELLED", label: "Cancelled" },
    ]},
  ];

  const columns: Column<App>[] = [
    {
      key: "applicationNumber", header: "Number", sortable: true,
      render: (a) => (
        <Link href={`/admin/applications/${a.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
          {a.applicationNumber}
        </Link>
      ),
    },
    {
      key: "student", header: "Student",
      render: (a) => (
        <Link href={`/admin/students/${a.student.id}`} className="hover:underline">
          {a.student.firstName} {a.student.lastName}
        </Link>
      ),
    },
    { key: "country", header: "Country", render: (a) => a.country.name },
    { key: "university", header: "University", render: (a) => a.university?.name ?? "—" },
    { key: "stageKey", header: "Stage", sortable: true, render: (a) => <StatusBadge status={a.stageKey} /> },
    { key: "status", header: "Status", sortable: true, render: (a) => <StatusBadge status={a.status} /> },
    { key: "priority", header: "Priority", sortable: true, render: (a) => <StatusBadge status={a.priority} /> },
    { key: "createdAt", header: "Created", sortable: true, render: (a) => new Date(a.createdAt).toLocaleDateString("en-GB") },
  ];

  return (
    <>
      <PageHeader
        title="Applications"
        description="Dynamic pipeline from lead to travel preparation."
        breadcrumbs={["Admin", "Applications"]}
        actions={
          <div className="flex gap-2">
            <div className="flex rounded-md border border-border" role="group" aria-label="View mode">
              <button
                onClick={() => setView("table")}
                aria-pressed={view === "table"}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium ${view === "table" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                <TableIcon className="h-4 w-4" aria-hidden /> Table
              </button>
              <button
                onClick={() => setView("kanban")}
                aria-pressed={view === "kanban"}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium ${view === "kanban" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                <Kanban className="h-4 w-4" aria-hidden /> Kanban
              </button>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden /> New Application
            </Button>
          </div>
        }
      />

      {/* Date + stage filter (stage doubles as the Kanban column focus in kanban view) */}
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <div className="space-y-1">
          <label htmlFor="app-from" className="block text-xs text-muted-foreground">Created from</label>
          <input id="app-from" type="date" value={createdFrom} onChange={(e) => setCreatedFrom(e.target.value)} className="h-9 rounded-md border border-border bg-card px-2" />
        </div>
        <div className="space-y-1">
          <label htmlFor="app-to" className="block text-xs text-muted-foreground">Created to</label>
          <input id="app-to" type="date" value={createdTo} onChange={(e) => setCreatedTo(e.target.value)} className="h-9 rounded-md border border-border bg-card px-2" />
        </div>
        {(createdFrom || createdTo) && (
          <Button variant="outline" size="sm" className="mb-1.5" onClick={() => { setCreatedFrom(""); setCreatedTo(""); }}>
            Clear dates
          </Button>
        )}
      </div>

      {view === "table" ? (
        <DataTable
          endpoint="/api/applications"
          columns={columns}
          searchPlaceholder="Search by application number…"
          staticParams={staticParams}
          filters={[
            { key: "stage", label: "Stage", options: stageOptions },
            { key: "status", label: "Status", options: ["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"].map((s) => ({ value: s, label: s.replace("_", " ") })) },
            { key: "countryId", label: "Country", options: countryOptions },
            { key: "universityId", label: "University", options: uniOptions },
            { key: "courseId", label: "Course", options: courseOptions },
            { key: "employeeId", label: "Employee", options: employeeOptions },
            { key: "branchId", label: "Branch", options: branchOptions },
            { key: "intakeId", label: "Intake", options: intakeOptions },
            { key: "priority", label: "Priority", options: ["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => ({ value: p, label: p })) },
          ]}
          emptyMessage="No applications match your filters."
          rowActions={[
            { label: "View", onClick: (a) => router.push(`/admin/applications/${a.id}`) },
            { label: "Edit", onClick: (a) => setEditApp(a) },
            { label: "Assign", onClick: (a) => setAssignApp(a) },
            { label: "Archive", destructive: true, onClick: (a) => setArchiveApp(a) },
          ]}
        />
      ) : (
        <KanbanBoard
          stages={stages?.data ?? []}
          staticParams={staticParams}
          focusStage={kanbanStage}
          onFocusStage={setKanbanStage}
        />
      )}

      {createOpen && (
        <CreateApplicationDialog
          countryOptions={countryOptions}
          onClose={() => setCreateOpen(false)}
          onDone={invalidate}
        />
      )}

      {editApp && (
        <FormDialog
          key={editApp.id} open={!!editApp} onOpenChange={(v) => !v && setEditApp(null)}
          title={`Edit ${editApp.applicationNumber}`}
          fields={editFields}
          endpoint="/api/applications" entityId={editApp.id}
          invalidateKey="/api/applications" successMessage="Application updated"
        />
      )}

      {assignApp && (
        <FormDialog
          key={`assign-${assignApp.id}`} open={!!assignApp} onOpenChange={(v) => !v && setAssignApp(null)}
          title={`Assign employee — ${assignApp.applicationNumber}`}
          fields={[{ type: "select", name: "employeeId", label: "Employee", options: employeeOptions, required: true }]}
          endpoint={`/api/applications/${assignApp.id}/assign`}
          invalidateKey="/api/applications" successMessage="Employee assigned"
        />
      )}

      <ConfirmDialog
        open={!!archiveApp} onOpenChange={(v) => !v && setArchiveApp(null)}
        title="Archive Application"
        message={`Archive ${archiveApp?.applicationNumber}? The record, timeline, and audit history are retained (soft delete).`}
        confirmLabel="Archive" destructive
        onConfirm={async () => {
          try {
            await apiFetch(`/api/applications/${archiveApp!.id}`, { method: "DELETE" });
            toast({ title: "Application archived", variant: "success" });
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

function KanbanBoard({
  stages,
  staticParams,
  focusStage,
  onFocusStage,
}: {
  stages: { key: string; name: string; color: string }[];
  staticParams: Record<string, string>;
  focusStage: string;
  onFocusStage: (s: string) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const query = useMemo(() => {
    const sp = new URLSearchParams({ page: "1", pageSize: "100", ...staticParams });
    if (focusStage) sp.set("stage", focusStage);
    return sp.toString();
  }, [staticParams, focusStage]);

  const { data, isPending } = useQuery({
    queryKey: ["kanban", query],
    queryFn: () => apiFetch<Paged<App>>(`/api/applications?${query}`),
    placeholderData: keepPreviousData,
  });

  const apps = data?.data ?? [];
  const visibleStages = focusStage ? stages.filter((s) => s.key === focusStage) : stages;

  const moveStage = async (id: string, number_: string, stageKey: string) => {
    try {
      await apiFetch(`/api/applications/${id}/status`, { method: "PATCH", json: { stageKey } });
      toast({ title: `${number_} moved to ${stageKey.replace(/_/g, " ").toLowerCase()}`, variant: "success" });
      qc.invalidateQueries();
    } catch (err) {
      toast({ title: "Move failed", description: (err as Error).message, variant: "error" });
    }
  };

  if (stages.length === 0) {
    return <EmptyState title="Pipeline not configured" description="Application stages must be seeded (npm run seed)." />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="kanban-stage" className="text-muted-foreground">Focus stage:</label>
        <select
          id="kanban-stage"
          value={focusStage}
          onChange={(e) => onFocusStage(e.target.value)}
          className="h-8 rounded-md border border-border bg-card px-2 text-sm"
        >
          <option value="">All stages</option>
          {stages.map((s) => (
            <option key={s.key} value={s.key}>{s.name.replace(/_/g, " ")}</option>
          ))}
        </select>
        {isPending && <span className="text-xs text-muted-foreground" aria-busy="true">Loading…</span>}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {visibleStages.map((stage) => {
          const stageApps = apps.filter((a) => a.stageKey === stage.key);
          return (
            <section
              key={stage.key}
              className="flex w-64 shrink-0 flex-col rounded-lg border border-border bg-muted/30"
              aria-label={`${stage.name} column`}
            >
              <header className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                  <span className="h-2 w-2 rounded-full" style={{ background: stage.color }} aria-hidden />
                  {stage.name.replace(/_/g, " ")}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                  {stageApps.length}
                </span>
              </header>
              <div className="flex-1 space-y-2 p-2">
                {stageApps.length === 0 && (
                  <p className="px-1 py-4 text-center text-xs text-muted-foreground">Empty</p>
                )}
                {stageApps.map((a) => (
                  <article key={a.id} className="rounded-md border border-border bg-card p-2.5 shadow-sm">
                    <Link href={`/admin/applications/${a.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">
                      {a.applicationNumber}
                    </Link>
                    <p className="mt-0.5 truncate text-xs">
                      {a.student.firstName} {a.student.lastName} · {a.country.name}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between gap-1">
                      <StatusBadge status={a.priority} />
                      <select
                        value={a.stageKey}
                        onChange={(e) => moveStage(a.id, a.applicationNumber, e.target.value)}
                        aria-label={`Move ${a.applicationNumber} to another stage`}
                        className="h-6 max-w-32 rounded border border-border bg-card px-1 text-xs"
                      >
                        {stages.map((s) => (
                          <option key={s.key} value={s.key}>{s.name.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function CreateApplicationDialog({
  countryOptions,
  onClose,
  onDone,
}: {
  countryOptions: Option[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const { data: students } = useQuery({
    queryKey: ["/api/students", "app-create"],
    queryFn: () => apiFetch<Paged<{ id: string; firstName: string; lastName: string; studentId: string }>>("/api/students?pageSize=100"),
  });

  const { data: universities } = useQuery({
    queryKey: ["/api/universities", "app-create"],
    queryFn: () => apiFetch<Paged<{ id: string; name: string }>>("/api/universities?pageSize=100"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-label="Create application">
      <div className="w-[95vw] max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
        <h2 className="text-base font-semibold">New Application</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Number is generated server-side as {formatApplicationNumber(new Date().getFullYear(), 1)}… — callers never supply it.
        </p>
        <div className="mt-4 space-y-3">
          {([
            { name: "studentId", label: "Student", options: (students?.data ?? []).map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName} (${s.studentId})` })), required: true },
            { name: "countryId", label: "Destination country", options: countryOptions, required: true },
            { name: "universityId", label: "University (optional)", options: (universities?.data ?? []).map((u) => ({ value: u.id, label: u.name })) },
          ] as { name: string; label: string; options: Option[]; required?: boolean }[]).map((f) => (
            <div key={f.name} className="space-y-1">
              <label htmlFor={`ca-${f.name}`} className="text-sm font-medium">
                {f.label}{f.required && <span className="text-destructive"> *</span>}
              </label>
              <select
                id={`ca-${f.name}`}
                value={values[f.name] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm"
              >
                <option value="">Select…</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          ))}
          <div className="space-y-1">
            <label htmlFor="ca-priority" className="text-sm font-medium">Priority</label>
            <select
              id="ca-priority"
              value={values.priority ?? "MEDIUM"}
              onChange={(e) => setValues((v) => ({ ...v, priority: e.target.value }))}
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
            disabled={busy || !values.studentId || !values.countryId}
            onClick={async () => {
              setBusy(true);
              try {
                await apiFetch("/api/applications", {
                  method: "POST",
                  json: {
                    studentId: values.studentId,
                    countryId: values.countryId,
                    ...(values.universityId ? { universityId: values.universityId } : {}),
                    priority: values.priority ?? "MEDIUM",
                  },
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
