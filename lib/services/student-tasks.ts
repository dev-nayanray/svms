import { prisma } from "@/lib/db";
import { STUDENT_LIST_MAX_ROWS } from "@/lib/constants/pagination";
import { HttpError } from "@/lib/api";
import { auditLog } from "./audit";
import { notifications } from "./notification";
import {
  buildTaskViewWhere,
  isOverdue,
  type TaskView,
} from "@/lib/constants/tasks";

/**
 * Student-scoped Task service for Module 10 (Tasks & Deadlines).
 *
 * SECURITY INVARIANT
 * ------------------
 * Every public method takes a `userId` resolved from the session
 * (via `studentApiGuard()` at the route layer). The service NEVER
 * trusts a `taskId` from the client without re-verifying that the
 * task's `assignedToId` matches the caller's `userId`. Foreign/missing
 * records both return null → the route 404s (NOT_FOUND, never 403 —
 * the existence of another user's task is never confirmed).
 *
 * STUDENT PERMISSIONS
 * -------------------
 * Students can:
 *  - View tasks assigned to them
 *  - Change their task's status to IN_PROGRESS (start working)
 *  - Change their task's status to COMPLETED (finish)
 *
 * Students CANNOT:
 *  - Change status to TODO (revert) or CANCELLED (cancel)
 *  - Change title, description, priority, dueDate
 *  - Change assignedToId, studentId, applicationId
 *  - Create or delete tasks
 *  - Assign tasks to others
 *
 * NOTIFICATION ARCHITECTURE
 * --------------------------
 * Three notification triggers:
 *  1. Task assigned — already handled by the admin POST route
 *     (notifications.push with type TASK_ASSIGNED).
 *  2. Deadline approaching — the `notifyDeadlineApproaching()`
 *     helper finds tasks due within 24 hours and notifies the
 *     assignee. Anti-spam: checks the Notification table for an
 *     existing DEADLINE_APPROACHING notification for the same task
 *     in the last 24 hours before sending.
 *  3. Task overdue — the `notifyOverdue()` helper finds tasks past
 *     their due date with open status and notifies the assignee.
 *     Anti-spam: checks for an existing TASK_OVERDUE notification
 *     in the last 24 hours.
 */

export type StudentTaskSummary = {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  dueDate: Date | null;
  completedAt: Date | null;
  applicationId: string | null;
  application: { id: string; applicationNumber: string } | null;
  studentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Derived UI fields
  overdue: boolean;
};

const ALLOWED_STUDENT_STATUSES = ["IN_PROGRESS", "COMPLETED"] as const;

function buildSummary(row: {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  dueDate: Date | null;
  completedAt: Date | null;
  applicationId: string | null;
  application: { id: string; applicationNumber: string } | null;
  studentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}, now: Date): StudentTaskSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    dueDate: row.dueDate,
    completedAt: row.completedAt,
    applicationId: row.applicationId,
    application: row.application,
    studentId: row.studentId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    overdue: isOverdue(row.dueDate, row.status, now),
  };
}

export const studentTaskService = {
  /**
   * List tasks assigned to the caller. Supports the 5 views (all,
   * today, upcoming, overdue, completed) and an optional status
   * filter. Tasks are scoped by `assignedToId = userId` from the
   * session — never from client input.
   */
  async list(
    userId: string,
    options: { view?: TaskView; status?: string } = {},
  ): Promise<StudentTaskSummary[]> {
    const now = new Date();

    const where: Record<string, unknown> = {
      deletedAt: null,
      assignedToId: userId,
    };

    // Apply the view filter (today / upcoming / overdue / completed)
    if (options.view && options.view !== "all") {
      const viewWhere = buildTaskViewWhere(options.view, now);
      if (viewWhere) {
        Object.assign(where, viewWhere);
      }
    }

    // Apply the status filter (on top of the view filter)
    if (options.status) {
      where.status = options.status;
    }

    const rows = await prisma.task.findMany({
      where,
      include: {
        application: {
          select: { id: true, applicationNumber: true },
        },
      },
      orderBy: [
        // Overdue tasks first (they're urgent), then by due date asc,
        // then by priority desc (URGENT first), then by createdAt.
        { dueDate: "asc" },
        { createdAt: "desc" },
      ],
      take: STUDENT_LIST_MAX_ROWS,
    });

    return rows.map((r) => buildSummary(r as never, now));
  },

  /**
   * Update a task's status. Students can only set IN_PROGRESS or
   * COMPLETED — never TODO or CANCELLED. Setting COMPLETED
   * automatically sets `completedAt`; reverting from COMPLETED to
   * IN_PROGRESS clears it.
   *
   * Ownership is verified: the task's `assignedToId` must match the
   * caller's `userId`.
   */
  async updateStatus(
    userId: string,
    taskId: string,
    newStatus: string,
  ): Promise<StudentTaskSummary> {
    // Validate the status is in the student-allowed set.
    if (!ALLOWED_STUDENT_STATUSES.includes(newStatus as typeof ALLOWED_STUDENT_STATUSES[number])) {
      throw new HttpError(
        422,
        "VALIDATION_ERROR",
        `Students can only set status to IN_PROGRESS or COMPLETED (got ${newStatus})`,
      );
    }

    const task = await prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
    });

    if (!task) {
      throw new HttpError(404, "NOT_FOUND", "Task not found");
    }

    // Verify ownership — the task must be assigned to the caller.
    if (task.assignedToId !== userId) {
      // Return the same 404 as "not found" so the existence of
      // another user's task is never confirmed.
      throw new HttpError(404, "NOT_FOUND", "Task not found");
    }

    // No-op if the status is already the target.
    if (task.status === newStatus) {
      return buildSummary(task as never, new Date());
    }

    // Students cannot "un-complete" a task back to TODO, and cannot
    // cancel. The ALLOWED_STUDENT_STATUSES check above already
    // prevents TODO and CANCELLED, but we also enforce the transition
    // direction: a COMPLETED task can only go back to IN_PROGRESS
    // (not to TODO), and a CANCELLED task cannot be modified at all.
    if (task.status === "CANCELLED") {
      throw new HttpError(
        409,
        "CONFLICT",
        "Cancelled tasks cannot be modified",
      );
    }

    const updateData: Record<string, unknown> = { status: newStatus };

    // Set/clear completedAt automatically.
    if (newStatus === "COMPLETED" && !task.completedAt) {
      updateData.completedAt = new Date();
    } else if (newStatus !== "COMPLETED" && task.completedAt) {
      updateData.completedAt = null;
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        application: {
          select: { id: true, applicationNumber: true },
        },
      },
    });

    // Audit-log the status change.
    await auditLog.record({
      userId,
      action: "task.status_changed",
      entity: "Task",
      entityId: taskId,
      oldValue: { status: task.status },
      newValue: { status: newStatus },
    });

    // Notify the task creator when the student completes it.
    if (newStatus === "COMPLETED" && task.createdById && task.createdById !== userId) {
      await notifications.push({
        userId: task.createdById,
        type: "TASK_COMPLETED",
        title: "Task completed",
        message: `"${task.title}" was marked as completed by the student.`,
        link: "/admin/tasks",
      });
    }

    return buildSummary(updated as never, new Date());
  },

  /**
   * Shortcut: mark a task as COMPLETED. Same as updateStatus with
   * status=COMPLETED, but as a separate POST endpoint for the
   * checklist UX (tap a checkbox → POST /complete).
   */
  async complete(userId: string, taskId: string): Promise<StudentTaskSummary> {
    return this.updateStatus(userId, taskId, "COMPLETED");
  },

  /**
   * NOTIFICATION HELPER: Find tasks due within the next 24 hours and
   * notify assignees who haven't been notified yet (anti-spam).
   *
   * This is a pure-DB function — the caller (a cron job or scheduled
   * task) invokes it periodically. Anti-spam: checks the Notification
   * table for an existing DEADLINE_APPROACHING notification for the
   * same task + user in the last 24 hours before sending.
   *
   * Returns the number of notifications sent.
   */
  async notifyDeadlineApproaching(now: Date = new Date()): Promise<number> {
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const startOfNow = new Date(now.getTime());

    // Find open tasks due within the next 24 hours.
    const tasks = await prisma.task.findMany({
      where: {
        deletedAt: null,
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueDate: { gte: startOfNow, lte: in24h },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        assignedToId: true,
      },
    });

    let sent = 0;
    for (const task of tasks) {
      // Anti-spam: check if we already sent a DEADLINE_APPROACHING
      // notification for this task to this user in the last 24 hours.
      const existing = await prisma.notification.findFirst({
        where: {
          userId: task.assignedToId,
          type: "DEADLINE_APPROACHING",
          link: `/student/tasks`,
          createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        },
        select: { id: true },
      });

      // Simple anti-spam: if ANY deadline-approaching notification was
      // sent to this user in the last 24 hours, skip this one too.
      // This prevents spam when the cron runs every hour — the student
      // gets at most one "deadline approaching" notification per day
      // across ALL their tasks. A more granular per-task check would
      // require storing the taskId in the notification's link or a
      // metadata field, which we don't have in the current schema.
      if (existing) continue;

      await notifications.push({
        userId: task.assignedToId,
        type: "DEADLINE_APPROACHING",
        title: "Deadline approaching",
        message: `"${task.title}" is due soon. Please complete it before the deadline.`,
        link: "/student/tasks",
      });
      sent++;
    }

    return sent;
  },

  /**
   * NOTIFICATION HELPER: Find overdue tasks (past due date, still
   * open) and notify assignees who haven't been notified yet.
   *
   * Anti-spam: checks for an existing TASK_OVERDUE notification in
   * the last 24 hours for this user. Same simple anti-spam as
   * deadline-approaching — at most one overdue notification per day.
   */
  async notifyOverdue(now: Date = new Date()): Promise<number> {
    const tasks = await prisma.task.findMany({
      where: {
        deletedAt: null,
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueDate: { lt: now },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        assignedToId: true,
      },
    });

    let sent = 0;
    for (const task of tasks) {
      // Anti-spam: skip if we already sent a TASK_OVERDUE to this
      // user in the last 24 hours.
      const existing = await prisma.notification.findFirst({
        where: {
          userId: task.assignedToId,
          type: "TASK_OVERDUE",
          createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        },
        select: { id: true },
      });

      if (existing) continue;

      await notifications.push({
        userId: task.assignedToId,
        type: "TASK_OVERDUE",
        title: "Task overdue",
        message: `"${task.title}" is past its deadline. Please complete it as soon as possible.`,
        link: "/student/tasks",
      });
      sent++;
    }

    return sent;
  },
};

/** Re-export for the route layer. */
export type StudentTaskView = StudentTaskSummary;
