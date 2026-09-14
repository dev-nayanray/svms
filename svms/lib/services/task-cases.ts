import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import type { EmployeeScope } from "@/lib/services/employee-dashboard";
import { taskScope } from "@/lib/services/employee-dashboard";
import type { JsonValue } from "@prisma/client/runtime/library";
import { emitNotification } from "@/lib/services/notification-cases";
// titleCase not needed in this file — statuses/priorities are already uppercase

/**
 * Employee Task Management service — server-side data layer for
 * /employee/tasks and the task CRUD APIs.
 *
 * IDOR closure: EMPLOYEE sees tasks assigned to them (assignedToId = session userId).
 * ADMIN sees all. Foreign tasks return 404 (never 403).
 *
 * Overdue detection is server-side — the service computes it from the
 * current server time + dueDate. The UI never decides what's overdue.
 */

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const TASK_VIEWS = ["all", "today", "upcoming", "overdue", "completed"] as const;

export type TaskView = (typeof TASK_VIEWS)[number];

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type TaskListFilters = {
  search?: string;
  status?: string;
  priority?: string;
  studentId?: string;
  applicationId?: string;
  assignedToId?: string;
  dueFrom?: string;
  dueTo?: string;
};

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  overdue: boolean;
  student: { id: string; firstName: string; lastName: string; studentId: string } | null;
  application: { id: string; applicationNumber: string } | null;
  assignee: { id: string; name: string } | null;
};

export type TaskListResult = {
  rows: TaskRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  counts: { all: number; today: number; upcoming: number; overdue: number; completed: number };
};

// ─────────────────────────────────────────────
// Overdue detection — pure, server-side
// ─────────────────────────────────────────────

export function isOverdue(dueDate: Date | null, status: string, now: Date = new Date()): boolean {
  if (!dueDate) return false;
  if (status === "COMPLETED" || status === "CANCELLED") return false;
  return dueDate < now;
}

// isToday/isUpcoming not currently used externally — kept for reference.
// The list query computes today/upcoming inline via Prisma date operators.

// ─────────────────────────────────────────────
// List — paginated with views + filters + sort
// ─────────────────────────────────────────────

export async function listTasks(
  scope: EmployeeScope,
  params: {
    view?: TaskView;
    filters?: TaskListFilters;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<TaskListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const view = params.view ?? "all";
  const filters = params.filters ?? {};
  const now = new Date();
  const owner = taskScope(scope);

  // Build the where clause from filters
  const fieldFilters: Record<string, unknown> = {};
  if (filters.status) fieldFilters.status = filters.status;
  if (filters.priority) fieldFilters.priority = filters.priority;
  if (filters.studentId) fieldFilters.studentId = filters.studentId;
  if (filters.applicationId) fieldFilters.applicationId = filters.applicationId;
  if (filters.assignedToId) fieldFilters.assignedToId = filters.assignedToId;

  const search = filters.search?.trim();
  const searchFilter = search
    ? { title: { contains: search, mode: "insensitive" as const } }
    : {};

  const dueRange: Record<string, unknown> = {};
  if (filters.dueFrom) {
    const d = new Date(filters.dueFrom);
    if (!isNaN(d.getTime())) dueRange.gte = d;
  }
  if (filters.dueTo) {
    const d = new Date(filters.dueTo);
    if (!isNaN(d.getTime())) dueRange.lte = d;
  }
  if (Object.keys(dueRange).length > 0) fieldFilters.dueDate = dueRange;

  const baseWhere: Record<string, unknown> = { ...owner, ...searchFilter, ...fieldFilters };

  // Apply view-specific filters
  let viewWhere: Record<string, unknown> = { ...baseWhere };
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  if (view === "today") {
    viewWhere = { ...baseWhere, status: { in: ["TODO", "IN_PROGRESS"] }, dueDate: { gte: startOfToday, lte: endOfToday } };
  } else if (view === "upcoming") {
    viewWhere = { ...baseWhere, status: { in: ["TODO", "IN_PROGRESS"] }, dueDate: { gt: endOfToday } };
  } else if (view === "overdue") {
    viewWhere = { ...baseWhere, status: { in: ["TODO", "IN_PROGRESS"] }, dueDate: { lt: now } };
  } else if (view === "completed") {
    viewWhere = { ...baseWhere, status: "COMPLETED" };
  }

  // Count for each view (for the tab badges) — single batched query via count()
  const [rows, total, countAll, countToday, countUpcoming, countOverdue, countCompleted] = await Promise.all([
    prisma.task.findMany({
      where: viewWhere,
      orderBy: [
        { status: "asc" }, // TODO/IN_PROGRESS first
        { dueDate: "asc" },
        { createdAt: "desc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, title: true, description: true, priority: true, status: true,
        dueDate: true, createdAt: true, updatedAt: true,
        student: { select: { id: true, firstName: true, lastName: true, studentId: true } },
        application: { select: { id: true, applicationNumber: true } },
        assignedToId: true,
      },
    }),
    prisma.task.count({ where: viewWhere }),
    prisma.task.count({ where: { ...baseWhere } }),
    prisma.task.count({ where: { ...baseWhere, status: { in: ["TODO", "IN_PROGRESS"] as string[] }, dueDate: { gte: startOfToday, lte: endOfToday } } }),
    prisma.task.count({ where: { ...baseWhere, status: { in: ["TODO", "IN_PROGRESS"] as string[] }, dueDate: { gt: endOfToday } } }),
    prisma.task.count({ where: { ...baseWhere, status: { in: ["TODO", "IN_PROGRESS"] as string[] }, dueDate: { lt: now } } }),
    prisma.task.count({ where: { ...baseWhere, status: "COMPLETED" } }),
  ]);

  // Resolve assignee names
  const assigneeIds = Array.from(new Set(rows.map((r) => r.assignedToId).filter(Boolean))) as string[];
  const assignees = assigneeIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, name: true } })
    : [];
  const assigneeMap = new Map(assignees.map((u) => [u.id, u.name]));

  const mapped: TaskRow[] = rows.map((t) => ({
    id: t.id, title: t.title, description: t.description, priority: t.priority,
    status: t.status, dueDate: t.dueDate, createdAt: t.createdAt, updatedAt: t.updatedAt,
    overdue: isOverdue(t.dueDate, t.status, now),
    student: t.student,
    application: t.application,
    assignee: t.assignedToId ? { id: t.assignedToId, name: assigneeMap.get(t.assignedToId) ?? "Unknown" } : null,
  }));

  return {
    rows: mapped, total, page, pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    counts: { all: countAll, today: countToday, upcoming: countUpcoming, overdue: countOverdue, completed: countCompleted },
  };
}

// ─────────────────────────────────────────────
// Single task
// ─────────────────────────────────────────────

export type TaskDetail = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  overdue: boolean;
  student: { id: string; firstName: string; lastName: string; studentId: string } | null;
  application: { id: string; applicationNumber: string } | null;
  assignee: { id: string; name: string } | null;
};

export async function getTaskById(scope: EmployeeScope, id: string): Promise<TaskDetail | null> {
  const owner = taskScope(scope);
  const task = await prisma.task.findFirst({
    where: { id, ...owner },
    select: {
      id: true, title: true, description: true, priority: true, status: true,
      dueDate: true, createdAt: true, updatedAt: true, assignedToId: true,
      student: { select: { id: true, firstName: true, lastName: true, studentId: true } },
      application: { select: { id: true, applicationNumber: true } },
    },
  });
  if (!task) return null;

  let assignee: { id: string; name: string } | null = null;
  if (task.assignedToId) {
    const user = await prisma.user.findUnique({ where: { id: task.assignedToId }, select: { id: true, name: true } });
    if (user) assignee = user;
  }

  return {
    ...task,
    overdue: isOverdue(task.dueDate, task.status),
    assignee,
  };
}

export async function requireTask(scope: EmployeeScope, id: string): Promise<TaskDetail> {
  const t = await getTaskById(scope, id);
  if (!t) throw new HttpError(404, "NOT_FOUND", "Task not found");
  return t;
}

// ─────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────

export async function createTask(
  scope: EmployeeScope,
  input: {
    title: string;
    description?: string;
    studentId?: string;
    applicationId?: string;
    assignedToId?: string;
    priority?: string;
    dueDate?: Date | null;
  },
  actor: { id: string; ipAddress?: string; userAgent?: string },
): Promise<{ id: string }> {
  // EMPLOYEE can only create tasks for students they own (or without a student link)
  if (input.studentId && !scope.isAdmin) {
    const student = await prisma.student.findFirst({
      where: { id: input.studentId, assignedEmployee: { userId: scope.userId } },
      select: { id: true },
    });
    if (!student) throw new HttpError(403, "FORBIDDEN", "You can only create tasks for your own students");
  }

  // SECURITY: if assignedToId is provided, verify it points at a real
  // Employee user. Without this, a malicious employee could assign
  // tasks to arbitrary user ids (e.g. the admin's), polluting their
  // task list with fabricated items.
  if (input.assignedToId && input.assignedToId !== actor.id) {
    const target = await prisma.user.findUnique({
      where: { id: input.assignedToId },
      select: { id: true, roleName: true },
    });
    if (!target || (target.roleName !== "EMPLOYEE" && target.roleName !== "ADMIN")) {
      throw new HttpError(400, "BAD_REQUEST", "Assignee must be an employee");
    }
  }

  const task = await prisma.task.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      studentId: input.studentId ?? null,
      applicationId: input.applicationId ?? null,
      assignedToId: input.assignedToId ?? actor.id,
      priority: input.priority ?? "MEDIUM",
      dueDate: input.dueDate ?? null,
      status: "TODO",
    },
  });

  // Audit log — task creation affects the assignee's workload.
  try {
    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: "task.created",
        entity: "Task",
        entityId: task.id,
        newValue: { title: input.title, assignedToId: input.assignedToId ?? actor.id, priority: input.priority ?? "MEDIUM" } as unknown as JsonValue,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      },
    });
  } catch (err) { console.error("[task-create] audit failed", err); }

  // Notify the assignee if different from the actor
  if (task.assignedToId && task.assignedToId !== actor.id) {
    await emitNotification({
      userId: task.assignedToId,
      type: "TASK_ASSIGNED",
      title: `New task: ${input.title}`,
      message: `You have been assigned a new task.`,
      link: "/employee/tasks",
      entityType: "Task",
      entityId: task.id,
    });
  }

  return { id: task.id };
}

export async function updateTask(
  scope: EmployeeScope,
  id: string,
  input: {
    title?: string;
    description?: string;
    priority?: string;
    dueDate?: Date | null;
  },
  actor: { id: string; ipAddress?: string; userAgent?: string },
): Promise<void> {
  const owner = taskScope(scope);
  const task = await prisma.task.findFirst({ where: { id, ...owner }, select: { id: true, title: true, dueDate: true, priority: true, status: true } });
  if (!task) throw new HttpError(404, "NOT_FOUND", "Task not found");

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.dueDate !== undefined) data.dueDate = input.dueDate;

  await prisma.task.update({ where: { id }, data: { ...data, updatedAt: new Date() } });

  // Audit log
  try {
    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: "task.updated",
        entity: "Task",
        entityId: id,
        oldValue: { title: task.title, priority: task.priority, dueDate: task.dueDate } as unknown as JsonValue,
        newValue: data as unknown as JsonValue,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      },
    });
  } catch (err) { console.error("[task-update] audit failed", err); }
}

export async function completeTask(
  scope: EmployeeScope,
  id: string,
  actor: { id: string; ipAddress?: string; userAgent?: string },
): Promise<void> {
  const owner = taskScope(scope);
  const task = await prisma.task.findFirst({ where: { id, ...owner }, select: { id: true, status: true, assignedToId: true, title: true, studentId: true } });
  if (!task) throw new HttpError(404, "NOT_FOUND", "Task not found");
  if (task.status === "COMPLETED") return; // no-op
  if (task.status === "CANCELLED") throw new HttpError(409, "CONFLICT", "Cannot complete a cancelled task");

  await prisma.task.update({ where: { id }, data: { status: "COMPLETED", updatedAt: new Date() } });

  // Audit log
  try {
    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: "task.completed",
        entity: "Task",
        entityId: id,
        oldValue: { status: task.status } as unknown as JsonValue,
        newValue: { status: "COMPLETED" } as unknown as JsonValue,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      },
    });
  } catch (err) { console.error("[task-complete] audit failed", err); }

  // Notify the creator/assigner if different
  if (task.assignedToId && task.assignedToId !== actor.id) {
    await emitNotification({
      userId: task.assignedToId,
      type: "TASK_COMPLETED",
      title: `Task completed: ${task.title}`,
      message: `The task "${task.title}" has been completed.`,
      link: "/employee/tasks",
      entityType: "Task",
      entityId: id,
    });
  }

  // Notify the student if linked
  if (task.studentId) {
    try {
      const student = await prisma.student.findUnique({ where: { id: task.studentId }, select: { userId: true } });
      if (student) {
        await emitNotification({
          userId: student.userId,
          type: "TASK_COMPLETED",
          title: `Task completed: ${task.title}`,
          message: `A task on your application has been completed.`,
          link: "/employee/tasks",
          entityType: "Task",
          entityId: id,
        });
      }
    } catch (err) {
      console.error("[task-complete] student notification failed", err);
    }
  }
}

export async function cancelTask(
  scope: EmployeeScope,
  id: string,
  actor: { id: string; ipAddress?: string; userAgent?: string },
): Promise<void> {
  const owner = taskScope(scope);
  const task = await prisma.task.findFirst({ where: { id, ...owner }, select: { id: true, status: true, title: true } });
  if (!task) throw new HttpError(404, "NOT_FOUND", "Task not found");
  if (task.status === "CANCELLED") return; // no-op
  if (task.status === "COMPLETED") throw new HttpError(409, "CONFLICT", "Cannot cancel a completed task");

  await prisma.task.update({ where: { id }, data: { status: "CANCELLED", updatedAt: new Date() } });

  // Audit log
  try {
    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: "task.cancelled",
        entity: "Task",
        entityId: id,
        oldValue: { status: task.status } as unknown as JsonValue,
        newValue: { status: "CANCELLED" } as unknown as JsonValue,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      },
    });
  } catch (err) { console.error("[task-cancel] audit failed", err); }
}

export async function reassignTask(
  scope: EmployeeScope,
  id: string,
  newAssigneeId: string,
  actor: { id: string; ipAddress?: string; userAgent?: string },
): Promise<void> {
  const owner = taskScope(scope);
  const task = await prisma.task.findFirst({ where: { id, ...owner }, select: { id: true, assignedToId: true, title: true } });
  if (!task) throw new HttpError(404, "NOT_FOUND", "Task not found");

  // Verify the target assignee exists AND is an employee/admin.
  // Without the role check, a malicious employee could reassign tasks
  // to a student or to a suspended user.
  const targetUser = await prisma.user.findUnique({
    where: { id: newAssigneeId },
    select: { id: true, name: true, roleName: true, status: true },
  });
  if (!targetUser) throw new HttpError(400, "BAD_REQUEST", "Target assignee not found");
  if (targetUser.roleName !== "EMPLOYEE" && targetUser.roleName !== "ADMIN") {
    throw new HttpError(400, "BAD_REQUEST", "Assignee must be an employee");
  }
  if (targetUser.status !== "ACTIVE") {
    throw new HttpError(400, "BAD_REQUEST", "Cannot reassign to an inactive user");
  }

  const oldValue = { assignedToId: task.assignedToId };
  await prisma.task.update({ where: { id }, data: { assignedToId: newAssigneeId, updatedAt: new Date() } });

  // Audit log — reassignment is workflow-sensitive (can be abused to
  // dump work onto a colleague or quietly take over a high-commission case).
  try {
    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: "task.reassigned",
        entity: "Task",
        entityId: id,
        oldValue: oldValue as unknown as JsonValue,
        newValue: { assignedToId: newAssigneeId } as unknown as JsonValue,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
      },
    });
  } catch (err) { console.error("[task-reassign] audit failed", err); }

  // Notify the new assignee
  if (newAssigneeId !== actor.id) {
    await emitNotification({
      userId: newAssigneeId,
      type: "TASK_REASSIGNED",
      title: `Task reassigned: ${task.title}`,
      message: `This task has been reassigned to you.`,
      link: "/employee/tasks",
      entityType: "Task",
      entityId: id,
    });
  }

  // Notify the old assignee
  if (task.assignedToId && task.assignedToId !== actor.id && task.assignedToId !== newAssigneeId) {
    await emitNotification({
      userId: task.assignedToId,
      type: "TASK_REASSIGNED",
      title: `Task reassigned: ${task.title}`,
      message: `The task "${task.title}" has been reassigned to another employee.`,
      link: "/employee/tasks",
      entityType: "Task",
      entityId: id,
    });
  }
}
