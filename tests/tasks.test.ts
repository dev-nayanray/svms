import { describe, it, expect } from "vitest";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  OPEN_TASK_STATUSES,
  TERMINAL_TASK_STATUSES,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_WEIGHT,
  TASK_VIEWS,
  TASK_VIEW_LABELS,
  TASK_SORT_KEYS,
  isOverdue,
  isDueToday,
  isUpcoming,
  buildTaskViewWhere,
  buildAdminTaskWhere,
  computeTaskStats,
} from "@/lib/constants/tasks";
import {
  taskSchema,
  taskUpdateSchema,
  taskAssignSchema,
} from "@/lib/validations";

describe("task enums", () => {
  it("exposes the canonical statuses", () => {
    expect(TASK_STATUSES).toEqual(["TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);
  });

  it("labels every status", () => {
    expect(TASK_STATUS_LABELS.TODO).toBe("To Do");
    expect(TASK_STATUS_LABELS.IN_PROGRESS).toBe("In Progress");
    expect(TASK_STATUS_LABELS.COMPLETED).toBe("Completed");
    expect(TASK_STATUS_LABELS.CANCELLED).toBe("Cancelled");
  });

  it("identifies open statuses", () => {
    expect(OPEN_TASK_STATUSES).toEqual(["TODO", "IN_PROGRESS"]);
  });

  it("identifies terminal statuses", () => {
    expect(TERMINAL_TASK_STATUSES).toEqual(["COMPLETED", "CANCELLED"]);
  });

  it("exposes the canonical priorities", () => {
    expect(TASK_PRIORITIES).toEqual(["LOW", "MEDIUM", "HIGH", "URGENT"]);
  });

  it("labels every priority", () => {
    expect(TASK_PRIORITY_LABELS.LOW).toBe("Low");
    expect(TASK_PRIORITY_LABELS.MEDIUM).toBe("Medium");
    expect(TASK_PRIORITY_LABELS.HIGH).toBe("High");
    expect(TASK_PRIORITY_LABELS.URGENT).toBe("Urgent");
  });

  it("assigns correct priority weights", () => {
    expect(TASK_PRIORITY_WEIGHT.URGENT).toBe(4);
    expect(TASK_PRIORITY_WEIGHT.HIGH).toBe(3);
    expect(TASK_PRIORITY_WEIGHT.MEDIUM).toBe(2);
    expect(TASK_PRIORITY_WEIGHT.LOW).toBe(1);
    expect(TASK_PRIORITY_WEIGHT.URGENT).toBeGreaterThan(TASK_PRIORITY_WEIGHT.LOW);
  });

  it("exposes the 5 views", () => {
    expect(TASK_VIEWS).toEqual(["all", "today", "upcoming", "overdue", "completed"]);
  });

  it("labels every view", () => {
    expect(TASK_VIEW_LABELS.all).toBe("All");
    expect(TASK_VIEW_LABELS.today).toBe("Today");
    expect(TASK_VIEW_LABELS.upcoming).toBe("Upcoming");
    expect(TASK_VIEW_LABELS.overdue).toBe("Overdue");
    expect(TASK_VIEW_LABELS.completed).toBe("Completed");
  });

  it("exposes a stable sort allow-list", () => {
    expect(TASK_SORT_KEYS).toEqual([
      "title",
      "status",
      "priority",
      "dueDate",
      "createdAt",
      "updatedAt",
    ]);
  });
});

describe("isOverdue", () => {
  const now = new Date("2026-09-10T12:00:00Z");
  const past = new Date("2026-09-01T00:00:00Z");
  const future = new Date("2026-12-31T00:00:00Z");

  it("returns true for a past due date with an open status", () => {
    expect(isOverdue(past, "TODO", now)).toBe(true);
    expect(isOverdue(past, "IN_PROGRESS", now)).toBe(true);
  });

  it("returns false for a past due date with a terminal status", () => {
    expect(isOverdue(past, "COMPLETED", now)).toBe(false);
    expect(isOverdue(past, "CANCELLED", now)).toBe(false);
  });

  it("returns false for a future due date", () => {
    expect(isOverdue(future, "TODO", now)).toBe(false);
  });

  it("returns false for a null due date", () => {
    expect(isOverdue(null, "TODO", now)).toBe(false);
    expect(isOverdue(undefined, "TODO", now)).toBe(false);
  });

  it("accepts ISO date strings", () => {
    expect(isOverdue("2026-09-01", "TODO", now)).toBe(true);
  });

  it("returns false for invalid dates", () => {
    expect(isOverdue(new Date("not-a-date"), "TODO", now)).toBe(false);
  });
});

describe("isDueToday", () => {
  const now = new Date("2026-09-10T12:00:00Z");

  it("returns true for a due date within today (UTC)", () => {
    expect(isDueToday(new Date("2026-09-10T00:00:00Z"), now)).toBe(true);
    expect(isDueToday(new Date("2026-09-10T23:59:59Z"), now)).toBe(true);
  });

  it("returns false for a due date on a different day", () => {
    expect(isDueToday(new Date("2026-09-09T23:59:59Z"), now)).toBe(false);
    expect(isDueToday(new Date("2026-09-11T00:00:00Z"), now)).toBe(false);
  });

  it("returns false for a null due date", () => {
    expect(isDueToday(null, now)).toBe(false);
  });

  it("accepts ISO date strings", () => {
    expect(isDueToday("2026-09-10", now)).toBe(true);
  });
});

describe("isUpcoming", () => {
  const now = new Date("2026-09-10T12:00:00Z");

  it("returns true for a due date strictly after today", () => {
    expect(isUpcoming(new Date("2026-09-11T00:00:00Z"), now)).toBe(true);
    expect(isUpcoming(new Date("2026-12-31T00:00:00Z"), now)).toBe(true);
  });

  it("returns false for a due date today", () => {
    expect(isUpcoming(new Date("2026-09-10T12:00:00Z"), now)).toBe(false);
  });

  it("returns false for a past due date", () => {
    expect(isUpcoming(new Date("2026-09-01T00:00:00Z"), now)).toBe(false);
  });

  it("returns false for a null due date", () => {
    expect(isUpcoming(null, now)).toBe(false);
  });
});

describe("buildTaskViewWhere", () => {
  const now = new Date("2026-09-10T12:00:00Z");

  it("returns null for the 'all' view", () => {
    expect(buildTaskViewWhere("all", now)).toBeNull();
  });

  it("returns a date range for the 'today' view", () => {
    const where = buildTaskViewWhere("today", now);
    expect(where).toHaveProperty("dueDate");
    expect(where!.dueDate).toHaveProperty("gte");
    expect(where!.dueDate).toHaveProperty("lte");
  });

  it("returns a gt filter for the 'upcoming' view", () => {
    const where = buildTaskViewWhere("upcoming", now);
    expect(where).toHaveProperty("dueDate");
    expect(where!.dueDate).toHaveProperty("gt");
  });

  it("returns a lt + open-status filter for the 'overdue' view", () => {
    const where = buildTaskViewWhere("overdue", now);
    expect(where).toHaveProperty("dueDate");
    expect(where!.dueDate).toHaveProperty("lt");
    expect(where).toHaveProperty("status");
    expect(where!.status).toEqual({ in: ["TODO", "IN_PROGRESS"] });
  });

  it("returns a status filter for the 'completed' view", () => {
    const where = buildTaskViewWhere("completed", now);
    expect(where).toEqual({ status: "COMPLETED" });
  });
});

describe("buildAdminTaskWhere", () => {
  it("always filters by deletedAt null when not archived", () => {
    const where = buildAdminTaskWhere({});
    expect(where.AND).toContainEqual({ deletedAt: null });
  });

  it("filters by deletedAt not-null when archived=true", () => {
    const where = buildAdminTaskWhere({ archived: true });
    expect(where.AND).toContainEqual({ deletedAt: { not: null } });
  });

  it("applies status filter", () => {
    const where = buildAdminTaskWhere({ status: "TODO" });
    expect(where.AND).toContainEqual({ status: "TODO" });
  });

  it("applies priority filter", () => {
    const where = buildAdminTaskWhere({ priority: "HIGH" });
    expect(where.AND).toContainEqual({ priority: "HIGH" });
  });

  it("applies assignedToId filter", () => {
    const where = buildAdminTaskWhere({ assignedToId: "u1" });
    expect(where.AND).toContainEqual({ assignedToId: "u1" });
  });

  it("applies studentId filter", () => {
    const where = buildAdminTaskWhere({ studentId: "s1" });
    expect(where.AND).toContainEqual({ studentId: "s1" });
  });

  it("applies applicationId filter", () => {
    const where = buildAdminTaskWhere({ applicationId: "a1" });
    expect(where.AND).toContainEqual({ applicationId: "a1" });
  });

  it("searches across title and description", () => {
    const where = buildAdminTaskWhere({ search: "passport" });
    expect(where.AND).toContainEqual({
      OR: [
        { title: { contains: "passport", mode: "insensitive" } },
        { description: { contains: "passport", mode: "insensitive" } },
      ],
    });
  });

  it("trims whitespace from search", () => {
    const where = buildAdminTaskWhere({ search: "  test  " });
    expect(where.AND).toContainEqual({
      OR: [
        { title: { contains: "test", mode: "insensitive" } },
        { description: { contains: "test", mode: "insensitive" } },
      ],
    });
  });

  it("applies the 'overdue' view filter on top of the standard filters", () => {
    const where = buildAdminTaskWhere({
      view: "overdue",
      status: "TODO",
    });
    // 1 (deletedAt) + 1 (status) + 1 (overdue view: { dueDate: lt, status: in })
    // The overdue view's where clause is a single object with both
    // dueDate and status keys, so it counts as ONE AND clause.
    expect(where.AND).toHaveLength(3);
    // Verify the overdue view clause is present
    const andClauses = where.AND as Record<string, unknown>[];
    const overdueClause = andClauses.find(
      (c) => typeof c === "object" && c !== null && "dueDate" in c,
    );
    expect(overdueClause).toBeDefined();
    expect(overdueClause).toHaveProperty("status");
  });

  it("applies the 'completed' view filter", () => {
    const where = buildAdminTaskWhere({ view: "completed" });
    expect(where.AND).toContainEqual({ status: "COMPLETED" });
  });

  it("does not add a view clause for 'all'", () => {
    const where = buildAdminTaskWhere({ view: "all" });
    // Only deletedAt — no view clause
    expect(where.AND).toHaveLength(1);
  });
});

describe("computeTaskStats", () => {
  const now = new Date("2026-09-10T12:00:00Z");
  const past = "2026-09-01";
  const future = "2026-12-31";

  it("counts pending, overdue, completed, cancelled, total", () => {
    const tasks = [
      { status: "TODO", dueDate: past },        // pending + overdue
      { status: "IN_PROGRESS", dueDate: future }, // pending
      { status: "COMPLETED", dueDate: past },    // completed
      { status: "CANCELLED", dueDate: null },    // cancelled
    ];
    const stats = computeTaskStats(tasks, now);
    expect(stats.pending).toBe(2);
    expect(stats.overdue).toBe(1);
    expect(stats.completed).toBe(1);
    expect(stats.cancelled).toBe(1);
    expect(stats.total).toBe(4);
  });

  it("does not count completed tasks as overdue even with a past due date", () => {
    const stats = computeTaskStats(
      [{ status: "COMPLETED", dueDate: past }],
      now,
    );
    expect(stats.overdue).toBe(0);
    expect(stats.completed).toBe(1);
  });

  it("returns zeros for an empty list", () => {
    const stats = computeTaskStats([], now);
    expect(stats).toEqual({ pending: 0, overdue: 0, completed: 0, cancelled: 0, total: 0 });
  });

  it("counts tasks with null due dates as pending but not overdue", () => {
    const stats = computeTaskStats(
      [{ status: "TODO", dueDate: null }],
      now,
    );
    expect(stats.pending).toBe(1);
    expect(stats.overdue).toBe(0);
  });
});

describe("taskSchema", () => {
  it("requires title and assignedToId", () => {
    expect(taskSchema.safeParse({}).success).toBe(false);
    expect(
      taskSchema.safeParse({ title: "X", assignedToId: "u1" }).success,
    ).toBe(true);
  });

  it("defaults priority to MEDIUM", () => {
    const out = taskSchema.parse({ title: "X", assignedToId: "u1" });
    expect(out.priority).toBe("MEDIUM");
  });

  it("accepts an optional dueDate as an ISO string", () => {
    expect(
      taskSchema.safeParse({
        title: "X",
        assignedToId: "u1",
        dueDate: "2026-12-31",
      }).success,
    ).toBe(true);
  });

  it("rejects invalid priorities", () => {
    expect(
      taskSchema.safeParse({
        title: "X",
        assignedToId: "u1",
        priority: "CRITICAL",
      }).success,
    ).toBe(false);
  });

  it("accepts optional studentId and applicationId", () => {
    expect(
      taskSchema.safeParse({
        title: "X",
        assignedToId: "u1",
        studentId: "s1",
        applicationId: "a1",
      }).success,
    ).toBe(true);
  });

  it("rejects descriptions longer than 5000 chars", () => {
    expect(
      taskSchema.safeParse({
        title: "X",
        assignedToId: "u1",
        description: "a".repeat(5001),
      }).success,
    ).toBe(false);
  });
});

describe("taskUpdateSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(taskUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("accepts partial updates", () => {
    expect(
      taskUpdateSchema.safeParse({ title: "Updated" }).success,
    ).toBe(true);
    expect(
      taskUpdateSchema.safeParse({ status: "COMPLETED" }).success,
    ).toBe(true);
  });

  it("accepts nullable dueDate", () => {
    expect(
      taskUpdateSchema.safeParse({ dueDate: null }).success,
    ).toBe(true);
  });

  it("rejects invalid status values", () => {
    expect(
      taskUpdateSchema.safeParse({ status: "PENDING" }).success,
    ).toBe(false);
  });

  it("rejects invalid priority values", () => {
    expect(
      taskUpdateSchema.safeParse({ priority: "CRITICAL" }).success,
    ).toBe(false);
  });

  it("does NOT accept assignedToId (that goes through the assign path)", () => {
    // assignedToId is not in the taskUpdateSchema — Zod strips unknown
    // keys by default, so safeParse succeeds but the parsed output
    // should NOT carry assignedToId.
    const parsed = taskUpdateSchema.safeParse({
      assignedToId: "u2",
      title: "X",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).not.toHaveProperty("assignedToId");
    }
  });
});

describe("taskAssignSchema", () => {
  it("requires assignedToId", () => {
    expect(taskAssignSchema.safeParse({}).success).toBe(false);
    expect(
      taskAssignSchema.safeParse({ assignedToId: "u1" }).success,
    ).toBe(true);
  });

  it("rejects empty strings", () => {
    expect(
      taskAssignSchema.safeParse({ assignedToId: "" }).success,
    ).toBe(false);
  });
});
