/**
 * Pure helpers for the Admin Task Management module.
 *
 * No DB access — these functions feed the API routes, UI components, and
 * tests. The status/priority enums, view filters, and overdue detection
 * logic are the single source of truth.
 *
 * Task status flow: TODO → IN_PROGRESS → COMPLETED | CANCELLED
 */

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/** Statuses that count as "open" (not done). */
export const OPEN_TASK_STATUSES = ["TODO", "IN_PROGRESS"] as const;

/** Statuses that count as "done" (terminal). */
export const TERMINAL_TASK_STATUSES = ["COMPLETED", "CANCELLED"] as const;

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

/** Priority sort weight — higher number = higher priority. */
export const TASK_PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

/**
 * Task list views — each view applies a different filter set on top of
 * the user's search/status/priority filters.
 */
export const TASK_VIEWS = ["all", "today", "upcoming", "overdue", "completed"] as const;
export type TaskView = (typeof TASK_VIEWS)[number];

export const TASK_VIEW_LABELS: Record<TaskView, string> = {
  all: "All",
  today: "Today",
  upcoming: "Upcoming",
  overdue: "Overdue",
  completed: "Completed",
};

/** Sort keys allowed for the admin task list. */
export const TASK_SORT_KEYS = [
  "title",
  "status",
  "priority",
  "dueDate",
  "createdAt",
  "updatedAt",
] as const;
export type TaskSortKey = (typeof TASK_SORT_KEYS)[number];

/**
 * Returns true if a task is overdue — its due date is in the past AND
 * its status is not terminal (COMPLETED or CANCELLED).
 */
export function isOverdue(
  dueDate: Date | string | null | undefined,
  status: string,
  now: Date = new Date(),
): boolean {
  if (!dueDate) return false;
  if ((TERMINAL_TASK_STATUSES as readonly string[]).includes(status)) return false;
  const d = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < now.getTime();
}

/**
 * Returns true if a task is due today — its due date falls within the
 * current calendar day (start of today to end of today, UTC).
 */
export function isDueToday(
  dueDate: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!dueDate) return false;
  const d = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  if (Number.isNaN(d.getTime())) return false;
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);
  return d.getTime() >= startOfToday.getTime() && d.getTime() <= endOfToday.getTime();
}

/**
 * Returns true if a task is upcoming — its due date is in the future
 * AND it's not due today. Used by the "Upcoming" view.
 */
export function isUpcoming(
  dueDate: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!dueDate) return false;
  const d = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  if (Number.isNaN(d.getTime())) return false;
  const endOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + 24 * 60 * 60 * 1000 - 1,
  );
  return d.getTime() > endOfToday.getTime();
}

/**
 * Build a Prisma `where` fragment for the admin task list based on the
 * selected view. The view filter is AND-combined with the standard
 * search/status/priority/employee filters.
 *
 * Views:
 *  - all: no date filter
 *  - today: dueDate falls within today (UTC)
 *  - upcoming: dueDate is strictly after today
 *  - overdue: dueDate is in the past AND status is open
 *  - completed: status is COMPLETED
 */
export function buildTaskViewWhere(
  view: TaskView,
  now: Date = new Date(),
): Record<string, unknown> | null {
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);

  switch (view) {
    case "today":
      return { dueDate: { gte: startOfToday, lte: endOfToday } };
    case "upcoming":
      return { dueDate: { gt: endOfToday } };
    case "overdue":
      return {
        dueDate: { lt: startOfToday },
        status: { in: [...OPEN_TASK_STATUSES] },
      };
    case "completed":
      return { status: "COMPLETED" };
    case "all":
    default:
      return null;
  }
}

/**
 * Build a Prisma `where` fragment for the admin task list. Enforces the
 * soft-delete filter (deletedAt null) and AND-combines the optional
 * discovery filters + the view filter.
 */
export function buildAdminTaskWhere(filters: {
  search?: string;
  status?: string;
  priority?: string;
  assignedToId?: string;
  studentId?: string;
  applicationId?: string;
  view?: TaskView;
  archived?: boolean;
}): Record<string, unknown> {
  const search = filters.search?.trim();
  const andClauses: Record<string, unknown>[] = [
    { deletedAt: filters.archived ? { not: null } : null },
  ];

  if (filters.status) {
    andClauses.push({ status: filters.status });
  }
  if (filters.priority) {
    andClauses.push({ priority: filters.priority });
  }
  if (filters.assignedToId) {
    andClauses.push({ assignedToId: filters.assignedToId });
  }
  if (filters.studentId) {
    andClauses.push({ studentId: filters.studentId });
  }
  if (filters.applicationId) {
    andClauses.push({ applicationId: filters.applicationId });
  }
  if (search) {
    andClauses.push({
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  // Apply the view filter
  if (filters.view && filters.view !== "all") {
    const viewWhere = buildTaskViewWhere(filters.view);
    if (viewWhere) {
      andClauses.push(viewWhere);
    }
  }

  return { AND: andClauses };
}

/**
 * Compute task statistics for an employee (or the whole team).
 * Returns counts of pending, overdue, completed, and cancelled tasks.
 */
export function computeTaskStats(
  tasks: { status: string; dueDate: Date | string | null }[],
  now: Date = new Date(),
): {
  pending: number;
  overdue: number;
  completed: number;
  cancelled: number;
  total: number;
} {
  const total = tasks.length;
  const pending = tasks.filter(
    (t) => (OPEN_TASK_STATUSES as readonly string[]).includes(t.status),
  ).length;
  const overdue = tasks.filter(
    (t) => isOverdue(t.dueDate, t.status, now),
  ).length;
  const completed = tasks.filter((t) => t.status === "COMPLETED").length;
  const cancelled = tasks.filter((t) => t.status === "CANCELLED").length;
  return { pending, overdue, completed, cancelled, total };
}
