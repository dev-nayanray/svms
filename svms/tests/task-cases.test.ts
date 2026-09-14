import { describe, it, expect, vi, beforeEach } from "vitest";

// Pure function tests
import { isOverdue, TASK_STATUSES, TASK_PRIORITIES, TASK_VIEWS } from "@/lib/services/task-cases";

describe("isOverdue — server-side date logic", () => {
  const now = new Date("2026-09-14T12:00:00Z");

  it("returns false for null dueDate", () => {
    expect(isOverdue(null, "TODO", now)).toBe(false);
  });

  it("returns false for COMPLETED tasks even if dueDate is past", () => {
    expect(isOverdue(new Date("2026-08-01"), "COMPLETED", now)).toBe(false);
  });

  it("returns false for CANCELLED tasks even if dueDate is past", () => {
    expect(isOverdue(new Date("2026-08-01"), "CANCELLED", now)).toBe(false);
  });

  it("returns true for TODO tasks with past dueDate", () => {
    expect(isOverdue(new Date("2026-08-01"), "TODO", now)).toBe(true);
  });

  it("returns true for IN_PROGRESS tasks with past dueDate", () => {
    expect(isOverdue(new Date("2026-08-01"), "IN_PROGRESS", now)).toBe(true);
  });

  it("returns false for future dueDate", () => {
    expect(isOverdue(new Date("2026-12-01"), "TODO", now)).toBe(false);
  });

  it("returns false when dueDate equals now (boundary — not strictly past)", () => {
    expect(isOverdue(now, "TODO", now)).toBe(false);
  });

  it("returns true when dueDate is 1ms before now", () => {
    expect(isOverdue(new Date(now.getTime() - 1), "TODO", now)).toBe(true);
  });
});

describe("TASK constants", () => {
  it("has 4 statuses", () => {
    expect(TASK_STATUSES).toEqual(["TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);
  });

  it("has 4 priorities", () => {
    expect(TASK_PRIORITIES).toEqual(["LOW", "MEDIUM", "HIGH", "URGENT"]);
  });

  it("has 5 views", () => {
    expect(TASK_VIEWS).toEqual(["all", "today", "upcoming", "overdue", "completed"]);
  });
});

// Service tests with mocked prisma
const prismaMock = vi.hoisted(() => ({
  task: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn(), create: vi.fn() },
  user: { findMany: vi.fn(), findUnique: vi.fn() },
  student: { findFirst: vi.fn(), findUnique: vi.fn() },
  notification: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  listTasks,
  getTaskById,
  requireTask,
  createTask,
  updateTask,
  completeTask,
  cancelTask,
  reassignTask,
} from "@/lib/services/task-cases";
import type { EmployeeScope } from "@/lib/services/employee-dashboard";

const ADMIN_SCOPE: EmployeeScope = { isAdmin: true, userId: "u-admin", employeeId: null };
const EMPLOYEE_SCOPE: EmployeeScope = { isAdmin: false, userId: "u-emp", employeeId: "emp-1" };

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// IDOR closure
// ─────────────────────────────────────────────

describe("task IDOR closure", () => {
  it("EMPLOYEE scope embeds assignedToId filter", async () => {
    prismaMock.task.findMany.mockResolvedValue([]);
    prismaMock.task.count.mockResolvedValue(0);
    await listTasks(EMPLOYEE_SCOPE, {});
    const call = prismaMock.task.findMany.mock.calls[0][0];
    expect(call.where.assignedToId).toBe("u-emp");
  });

  it("ADMIN scope is empty — sees all tasks", async () => {
    prismaMock.task.findMany.mockResolvedValue([]);
    prismaMock.task.count.mockResolvedValue(0);
    await listTasks(ADMIN_SCOPE, {});
    const call = prismaMock.task.findMany.mock.calls[0][0];
    expect(call.where.assignedToId).toBeUndefined();
  });

  it("getTaskById returns null for foreign tasks", async () => {
    prismaMock.task.findFirst.mockResolvedValue(null);
    const result = await getTaskById(EMPLOYEE_SCOPE, "task-foreign");
    expect(result).toBeNull();
  });

  it("requireTask throws 404 for missing/foreign", async () => {
    prismaMock.task.findFirst.mockResolvedValue(null);
    await expect(requireTask(EMPLOYEE_SCOPE, "task-missing")).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

// ─────────────────────────────────────────────
// List — views + filters + pagination
// ─────────────────────────────────────────────

describe("listTasks — views", () => {
  it("today view filters to TODO/IN_PROGRESS with today's dueDate", async () => {
    prismaMock.task.findMany.mockResolvedValue([]);
    prismaMock.task.count.mockResolvedValue(0);
    await listTasks(EMPLOYEE_SCOPE, { view: "today" });
    const call = prismaMock.task.findMany.mock.calls[0][0];
    expect(call.where.status).toEqual({ in: ["TODO", "IN_PROGRESS"] });
    expect(call.where.dueDate.gte).toBeInstanceOf(Date);
    expect(call.where.dueDate.lte).toBeInstanceOf(Date);
  });

  it("upcoming view filters to TODO/IN_PROGRESS with future dueDate", async () => {
    prismaMock.task.findMany.mockResolvedValue([]);
    prismaMock.task.count.mockResolvedValue(0);
    await listTasks(EMPLOYEE_SCOPE, { view: "upcoming" });
    const call = prismaMock.task.findMany.mock.calls[0][0];
    expect(call.where.dueDate.gt).toBeInstanceOf(Date);
  });

  it("overdue view filters to TODO/IN_PROGRESS with past dueDate", async () => {
    prismaMock.task.findMany.mockResolvedValue([]);
    prismaMock.task.count.mockResolvedValue(0);
    await listTasks(EMPLOYEE_SCOPE, { view: "overdue" });
    const call = prismaMock.task.findMany.mock.calls[0][0];
    expect(call.where.dueDate.lt).toBeInstanceOf(Date);
  });

  it("completed view filters to status=COMPLETED", async () => {
    prismaMock.task.findMany.mockResolvedValue([]);
    prismaMock.task.count.mockResolvedValue(0);
    await listTasks(EMPLOYEE_SCOPE, { view: "completed" });
    const call = prismaMock.task.findMany.mock.calls[0][0];
    expect(call.where.status).toBe("COMPLETED");
  });

  it("all view does not add view-specific filters", async () => {
    prismaMock.task.findMany.mockResolvedValue([]);
    prismaMock.task.count.mockResolvedValue(0);
    await listTasks(EMPLOYEE_SCOPE, { view: "all" });
    const call = prismaMock.task.findMany.mock.calls[0][0];
    expect(call.where.status).toBeUndefined();
  });

  it("returns counts for every view (for tab badges)", async () => {
    prismaMock.task.findMany.mockResolvedValue([]);
    prismaMock.task.count.mockResolvedValue(0);
    const result = await listTasks(EMPLOYEE_SCOPE, {});
    expect(result.counts).toEqual(expect.objectContaining({
      all: 0, today: 0, upcoming: 0, overdue: 0, completed: 0,
    }));
  });
});

describe("listTasks — filters", () => {
  it("applies search filter on title", async () => {
    prismaMock.task.findMany.mockResolvedValue([]);
    prismaMock.task.count.mockResolvedValue(0);
    await listTasks(EMPLOYEE_SCOPE, { filters: { search: "passport" } });
    const call = prismaMock.task.findMany.mock.calls[0][0];
    expect(call.where.title).toEqual({ contains: "passport", mode: "insensitive" });
  });

  it("applies priority + status + studentId + applicationId filters", async () => {
    prismaMock.task.findMany.mockResolvedValue([]);
    prismaMock.task.count.mockResolvedValue(0);
    await listTasks(EMPLOYEE_SCOPE, {
      filters: { priority: "HIGH", status: "TODO", studentId: "s1", applicationId: "a1", assignedToId: "u-2" },
    });
    const call = prismaMock.task.findMany.mock.calls[0][0];
    expect(call.where.priority).toBe("HIGH");
    expect(call.where.status).toBe("TODO");
    expect(call.where.studentId).toBe("s1");
    expect(call.where.applicationId).toBe("a1");
    expect(call.where.assignedToId).toBe("u-2");
  });
});

describe("listTasks — pagination", () => {
  it("defaults to page 1, pageSize 20", async () => {
    prismaMock.task.findMany.mockResolvedValue([]);
    prismaMock.task.count.mockResolvedValue(0);
    const result = await listTasks(EMPLOYEE_SCOPE, {});
    expect(prismaMock.task.findMany.mock.calls[0][0].skip).toBe(0);
    expect(prismaMock.task.findMany.mock.calls[0][0].take).toBe(20);
    expect(result.totalPages).toBe(1);
  });

  it("clamps pageSize to 100", async () => {
    prismaMock.task.findMany.mockResolvedValue([]);
    prismaMock.task.count.mockResolvedValue(0);
    await listTasks(EMPLOYEE_SCOPE, { pageSize: 5000 });
    expect(prismaMock.task.findMany.mock.calls[0][0].take).toBe(100);
  });
});

// ─────────────────────────────────────────────
// Create — ownership + notification
// ─────────────────────────────────────────────

describe("createTask", () => {
  it("creates a task with default values", async () => {
    prismaMock.task.create.mockResolvedValue({ id: "t1", assignedToId: "u-emp" });
    const result = await createTask(EMPLOYEE_SCOPE, { title: "Upload passport" }, { id: "u-emp" });
    expect(result.id).toBe("t1");
    expect(prismaMock.task.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        title: "Upload passport",
        priority: "MEDIUM",
        status: "TODO",
        assignedToId: "u-emp",
      }),
    }));
  });

  it("blocks creating tasks for students not assigned to the employee", async () => {
    prismaMock.student.findFirst.mockResolvedValue(null);
    await expect(createTask(EMPLOYEE_SCOPE, { title: "Task", studentId: "stu-foreign" }, { id: "u-emp" })).rejects.toMatchObject({
      status: 403, code: "FORBIDDEN",
    });
  });

  it("emits notification to assignee when different from actor", async () => {
    prismaMock.task.create.mockResolvedValue({ id: "t1", assignedToId: "u-other" });
    prismaMock.notification.findFirst.mockResolvedValue(null); // no dedup hit
    prismaMock.notification.create.mockResolvedValue({ id: "n1" });
    await createTask(EMPLOYEE_SCOPE, { title: "Review doc", assignedToId: "u-other" }, { id: "u-emp" });
    expect(prismaMock.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: "u-other", type: "TASK_ASSIGNED" }),
    }));
  });

  it("does NOT notify when assignee is the actor", async () => {
    prismaMock.task.create.mockResolvedValue({ id: "t1", assignedToId: "u-emp" });
    await createTask(EMPLOYEE_SCOPE, { title: "My task", assignedToId: "u-emp" }, { id: "u-emp" });
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
// Complete + cancel
// ─────────────────────────────────────────────

describe("completeTask", () => {
  it("marks a TODO task as COMPLETED", async () => {
    prismaMock.task.findFirst.mockResolvedValue({ id: "t1", status: "TODO", assignedToId: null, title: "Task", studentId: null });
    prismaMock.task.update.mockResolvedValue({});
    await completeTask(EMPLOYEE_SCOPE, "t1", { id: "u-emp" });
    expect(prismaMock.task.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "COMPLETED" }),
    }));
  });

  it("is a no-op when already COMPLETED", async () => {
    prismaMock.task.findFirst.mockResolvedValue({ id: "t1", status: "COMPLETED", assignedToId: null, title: "T", studentId: null });
    await completeTask(EMPLOYEE_SCOPE, "t1", { id: "u-emp" });
    expect(prismaMock.task.update).not.toHaveBeenCalled();
  });

  it("blocks completing a CANCELLED task (409)", async () => {
    prismaMock.task.findFirst.mockResolvedValue({ id: "t1", status: "CANCELLED", assignedToId: null, title: "T", studentId: null });
    await expect(completeTask(EMPLOYEE_SCOPE, "t1", { id: "u-emp" })).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });

  it("notifies the assignee on completion", async () => {
    prismaMock.task.findFirst.mockResolvedValue({ id: "t1", status: "TODO", assignedToId: "u-other", title: "Task", studentId: null });
    prismaMock.task.update.mockResolvedValue({});
    prismaMock.notification.findFirst.mockResolvedValue(null);
    prismaMock.notification.create.mockResolvedValue({ id: "n1" });
    await completeTask(EMPLOYEE_SCOPE, "t1", { id: "u-emp" });
    expect(prismaMock.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: "u-other", type: "TASK_COMPLETED" }),
    }));
  });

  it("notifies the linked student on completion", async () => {
    prismaMock.task.findFirst.mockResolvedValue({ id: "t1", status: "TODO", assignedToId: null, title: "Task", studentId: "s1" });
    prismaMock.task.update.mockResolvedValue({});
    prismaMock.student.findUnique.mockResolvedValue({ userId: "u-stu" });
    prismaMock.notification.findFirst.mockResolvedValue(null);
    prismaMock.notification.create.mockResolvedValue({ id: "n2" });
    await completeTask(EMPLOYEE_SCOPE, "t1", { id: "u-emp" });
    expect(prismaMock.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: "u-stu", type: "TASK_COMPLETED" }),
    }));
  });

  it("IDOR: foreign task returns 404", async () => {
    prismaMock.task.findFirst.mockResolvedValue(null);
    await expect(completeTask(EMPLOYEE_SCOPE, "t-foreign", { id: "u-emp" })).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

describe("cancelTask", () => {
  it("marks a TODO task as CANCELLED", async () => {
    prismaMock.task.findFirst.mockResolvedValue({ id: "t1", status: "TODO" });
    prismaMock.task.update.mockResolvedValue({});
    await cancelTask(EMPLOYEE_SCOPE, "t1", { id: "u-emp" });
    expect(prismaMock.task.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "CANCELLED" }),
    }));
  });

  it("is a no-op when already CANCELLED", async () => {
    prismaMock.task.findFirst.mockResolvedValue({ id: "t1", status: "CANCELLED" });
    await cancelTask(EMPLOYEE_SCOPE, "t1", { id: "u-emp" });
    expect(prismaMock.task.update).not.toHaveBeenCalled();
  });

  it("blocks cancelling a COMPLETED task (409)", async () => {
    prismaMock.task.findFirst.mockResolvedValue({ id: "t1", status: "COMPLETED" });
    await expect(cancelTask(EMPLOYEE_SCOPE, "t1", { id: "u-emp" })).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });
});

// ─────────────────────────────────────────────
// Reassign
// ─────────────────────────────────────────────

describe("reassignTask", () => {
  it("reassigns and notifies the new assignee", async () => {
    prismaMock.task.findFirst.mockResolvedValue({ id: "t1", assignedToId: "u-old", title: "Task" });
    prismaMock.user.findUnique.mockResolvedValue({ id: "u-new", name: "New Person" });
    prismaMock.task.update.mockResolvedValue({});
    prismaMock.notification.findFirst.mockResolvedValue(null);
    prismaMock.notification.create.mockResolvedValue({ id: "n1" });
    await reassignTask(EMPLOYEE_SCOPE, "t1", "u-new", { id: "u-emp" });
    expect(prismaMock.task.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ assignedToId: "u-new" }),
    }));
    expect(prismaMock.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: "u-new", type: "TASK_REASSIGNED" }),
    }));
  });

  it("notifies the old assignee (if different from actor and new)", async () => {
    prismaMock.task.findFirst.mockResolvedValue({ id: "t1", assignedToId: "u-old", title: "Task" });
    prismaMock.user.findUnique.mockResolvedValue({ id: "u-new", name: "New" });
    prismaMock.task.update.mockResolvedValue({});
    prismaMock.notification.findFirst.mockResolvedValue(null);
    prismaMock.notification.create.mockResolvedValue({ id: "n1" });
    await reassignTask(EMPLOYEE_SCOPE, "t1", "u-new", { id: "u-emp" });
    // Two notifications: one to new assignee, one to old
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(2);
  });

  it("blocks reassigning to a nonexistent user (400)", async () => {
    prismaMock.task.findFirst.mockResolvedValue({ id: "t1", assignedToId: "u-old", title: "Task" });
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(reassignTask(EMPLOYEE_SCOPE, "t1", "u-nonexistent", { id: "u-emp" })).rejects.toMatchObject({ status: 400, code: "BAD_REQUEST" });
  });

  it("IDOR: foreign task returns 404", async () => {
    prismaMock.task.findFirst.mockResolvedValue(null);
    await expect(reassignTask(EMPLOYEE_SCOPE, "t-foreign", "u-new", { id: "u-emp" })).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

// ─────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────

describe("updateTask", () => {
  it("updates permitted fields only", async () => {
    prismaMock.task.findFirst.mockResolvedValue({ id: "t1", title: "Old", dueDate: null });
    prismaMock.task.update.mockResolvedValue({});
    await updateTask(EMPLOYEE_SCOPE, "t1", { title: "New Title", priority: "HIGH", dueDate: new Date("2026-10-01") }, { id: "u-emp" });
    const call = prismaMock.task.update.mock.calls[0][0];
    expect(call.data.title).toBe("New Title");
    expect(call.data.priority).toBe("HIGH");
    expect(call.data.dueDate).toEqual(new Date("2026-10-01"));
  });

  it("IDOR: foreign task returns 404", async () => {
    prismaMock.task.findFirst.mockResolvedValue(null);
    await expect(updateTask(EMPLOYEE_SCOPE, "t-foreign", { title: "X" }, { id: "u-emp" })).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

// ─────────────────────────────────────────────
// Error propagation
// ─────────────────────────────────────────────

describe("error propagation", () => {
  it("listTasks lets prisma errors bubble", async () => {
    prismaMock.task.findMany.mockRejectedValue(new Error("DB lost"));
    prismaMock.task.count.mockResolvedValue(0);
    await expect(listTasks(EMPLOYEE_SCOPE, {})).rejects.toThrow("DB lost");
  });
});
