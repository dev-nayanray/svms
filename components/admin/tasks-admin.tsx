"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ConfirmDialog, FormDialog, PageHeader, type FormField } from "@/components/shared/page-kit";
import { StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { Plus, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_VIEWS,
  TASK_VIEW_LABELS,
  isOverdue,
  type TaskView,
} from "@/lib/constants/tasks";
import { formatDate } from "@/lib/utils";

type Task = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
  student: { id: string; firstName: string; lastName: string; studentId: string } | null;
  application: { id: string; applicationNumber: string } | null;
};

type Meta = {
  employees: { id: string; name: string }[];
  students: { id: string; label: string }[];
  statuses: { value: string; label: string }[];
  priorities: { value: string; label: string }[];
  views: { value: string; label: string }[];
};

const statusOptions = TASK_STATUSES.map((s) => ({
  value: s,
  label: TASK_STATUS_LABELS[s],
}));

const priorityOptions = TASK_PRIORITIES.map((p) => ({
  value: p,
  label: TASK_PRIORITY_LABELS[p],
}));

/**
 * Admin Tasks list — full CRUD via reusable components:
 *  - 5 views: All, Today, Upcoming, Overdue, Completed (toggle chips)
 *  - server-side search (title, description)
 *  - filters: Status, Priority, Employee, Student
 *  - sortable columns (title, status, priority, dueDate, createdAt)
 *  - row actions: Edit, Assign, Complete, Cancel, Archive
 *  - archived toggle to view soft-deleted tasks
 *
 * Employees are auto-scoped to their own tasks server-side; admins see
 * all tasks across the team.
 */
export function TasksAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/tasks"] });

  const [view, setView] = useState<TaskView>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [assignTask, setAssignTask] = useState<Task | null>(null);
  const [statusTask, setStatusTask] = useState<Task | null>(null);
  const [archiveTask, setArchiveTask] = useState<Task | null>(null);

  const { data: meta } = useQuery({
    queryKey: ["/api/tasks/meta"],
    queryFn: () => apiFetch<Meta>("/api/tasks/meta"),
    staleTime: 5 * 60_000,
  });

  const employeeOptions = (meta?.employees ?? []).map((e) => ({
    value: e.id,
    label: e.name,
  }));
  const studentOptions = (meta?.students ?? []).map((s) => ({
    value: s.id,
    label: s.label,
  }));

  const staticParams = useMemo(
    () => ({
      view,
      archived: showArchived ? "true" : "false",
    }),
    [view, showArchived],
  );

  const fields: FormField[] = [
    { type: "text", name: "title", label: "Title", required: true },
    { type: "textarea", name: "description", label: "Description" },
    {
      type: "select",
      name: "assignedToId",
      label: "Assign to",
      required: true,
      options: employeeOptions,
    },
    {
      type: "select",
      name: "studentId",
      label: "Student (optional)",
      options: studentOptions,
    },
    { type: "select", name: "priority", label: "Priority", options: priorityOptions },
    { type: "date", name: "dueDate", label: "Due date" },
  ];

  // Edit fields exclude assignedToId (that goes through the assign action)
  const editFields: FormField[] = [
    { type: "text", name: "title", label: "Title", required: true },
    { type: "textarea", name: "description", label: "Description" },
    {
      type: "select",
      name: "studentId",
      label: "Student (optional)",
      options: studentOptions,
    },
    { type: "select", name: "priority", label: "Priority", options: priorityOptions },
    {
      type: "select",
      name: "status",
      label: "Status",
      options: statusOptions,
    },
    { type: "date", name: "dueDate", label: "Due date" },
  ];

  const columns: Column<Task>[] = [
    {
      key: "title",
      header: "Title",
      sortable: true,
      render: (t) => (
        <div>
          <p className="font-medium">{t.title}</p>
          {t.description && (
            <p className="truncate text-xs text-muted-foreground">{t.description}</p>
          )}
        </div>
      ),
    },
    {
      key: "student",
      header: "Student",
      render: (t) =>
        t.student
          ? `${t.student.firstName} ${t.student.lastName}`
          : "—",
    },
    {
      key: "application",
      header: "Application",
      render: (t) =>
        t.application ? (
          <span className="font-mono text-xs">{t.application.applicationNumber}</span>
        ) : (
          "—"
        ),
    },
    {
      key: "priority",
      header: "Priority",
      sortable: true,
      render: (t) => <StatusBadge status={t.priority} />,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (t) => <StatusBadge status={t.status} />,
    },
    {
      key: "dueDate",
      header: "Due",
      sortable: true,
      render: (t) => {
        if (!t.dueDate) return "—";
        const overdue = isOverdue(t.dueDate, t.status);
        return (
          <span className={overdue ? "font-medium text-destructive" : ""}>
            {overdue && <AlertTriangle className="mr-1 inline h-3 w-3" aria-hidden />}
            {formatDate(t.dueDate)}
          </span>
        );
      },
    },
  ];

  const changeStatus = async (task: Task, status: string) => {
    try {
      await apiFetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        json: { status },
      });
      toast({
        title: `Task ${status.toLowerCase().replace("_", " ")}`,
        variant: "success",
      });
      invalidate();
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "error" });
    }
  };

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Operational tasks across the team — track due dates, priorities, and completion."
        breadcrumbs={["Admin", "Tasks"]}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden /> New Task
          </Button>
        }
      />

      {/* View toggle chips */}
      <div className="flex flex-wrap items-center gap-2">
        {TASK_VIEWS.map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors " +
              (view === v
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70")
            }
          >
            {v === "today" && <Clock className="h-3 w-3" aria-hidden />}
            {v === "upcoming" && <Clock className="h-3 w-3" aria-hidden />}
            {v === "overdue" && <AlertTriangle className="h-3 w-3" aria-hidden />}
            {v === "completed" && <CheckCircle2 className="h-3 w-3" aria-hidden />}
            {TASK_VIEW_LABELS[v]}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 pb-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
      </div>

      <DataTable
        endpoint="/api/tasks"
        columns={columns}
        searchPlaceholder="Search by title or description…"
        staticParams={staticParams}
        filters={[
          { key: "status", label: "Status", options: statusOptions },
          { key: "priority", label: "Priority", options: priorityOptions },
          ...(employeeOptions.length > 0
            ? [{ key: "assignedToId", label: "Employee", options: employeeOptions }]
            : []),
        ]}
        emptyMessage="No tasks match your filters."
        rowActions={[
          { label: "Edit", onClick: (t) => setEditTask(t) },
          { label: "Assign", onClick: (t) => setAssignTask(t) },
          {
            label: "Complete",
            onClick: (t) => setStatusTask(t),
          },
          {
            label: "Cancel",
            destructive: true,
            onClick: (t) => changeStatus(t, "CANCELLED"),
          },
          {
            label: "Archive",
            destructive: true,
            onClick: (t) => setArchiveTask(t),
          },
        ]}
      />

      {/* Create dialog */}
      <FormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New Task"
        fields={fields}
        endpoint="/api/tasks"
        invalidateKey="/api/tasks"
        successMessage="Task created"
        toPayload={(v) => ({
          ...v,
          dueDate: v.dueDate || undefined,
          studentId: v.studentId || undefined,
        })}
      />

      {/* Edit dialog */}
      {editTask && (
        <FormDialog
          key={editTask.id}
          open={!!editTask}
          onOpenChange={(v) => !v && setEditTask(null)}
          title={`Edit ${editTask.title}`}
          fields={editFields}
          endpoint="/api/tasks"
          entityId={editTask.id}
          invalidateKey="/api/tasks"
          successMessage="Task updated"
          toPayload={(v) => ({
            title: v.title,
            description: v.description || undefined,
            studentId: v.studentId || undefined,
            priority: v.priority || "MEDIUM",
            status: v.status || "TODO",
            dueDate: v.dueDate || undefined,
          })}
        />
      )}

      {/* Assign/reassign dialog */}
      {assignTask && (
        <FormDialog
          key={`assign-${assignTask.id}`}
          open={!!assignTask}
          onOpenChange={(v) => !v && setAssignTask(null)}
          title={`Assign — ${assignTask.title}`}
          description="Reassign this task to a different employee."
          fields={[
            {
              type: "select",
              name: "assignedToId",
              label: "Employee",
              required: true,
              options: employeeOptions,
            },
          ]}
          endpoint="/api/tasks"
          entityId={assignTask.id}
          invalidateKey="/api/tasks"
          successMessage="Task reassigned"
          toPayload={(v) => ({ assignedToId: v.assignedToId })}
          extraPayload={{}}
        />
      )}

      {/* Complete confirm */}
      <ConfirmDialog
        open={!!statusTask}
        onOpenChange={(v) => !v && setStatusTask(null)}
        title="Complete Task"
        message={`Mark "${statusTask?.title}" as completed?`}
        confirmLabel="Complete"
        onConfirm={async () => {
          if (statusTask) {
            await changeStatus(statusTask, "COMPLETED");
          }
        }}
      />

      {/* Archive confirm */}
      <ConfirmDialog
        open={!!archiveTask}
        onOpenChange={(v) => !v && setArchiveTask(null)}
        title="Archive Task"
        message={`Archive "${archiveTask?.title}"? Archived tasks are hidden from the default list but retain their data for audit trails.`}
        confirmLabel="Archive"
        destructive
        onConfirm={async () => {
          try {
            await apiFetch(`/api/tasks/${archiveTask!.id}`, { method: "DELETE" });
            toast({ title: "Task archived", variant: "success" });
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
