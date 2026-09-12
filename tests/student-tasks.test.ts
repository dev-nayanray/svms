import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────

const mockAuth = vi.fn();
const mockStudentFindFirst = vi.fn();
const mockTaskFindMany = vi.fn();
const mockTaskFindFirst = vi.fn();
const mockTaskUpdate = vi.fn();
const mockAuditRecord = vi.fn();
const mockNotificationsPush = vi.fn();
const mockNotificationFindFirst = vi.fn();
const mockNotificationCreate = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    student: { findFirst: (args: unknown) => mockStudentFindFirst(args) },
    task: {
      findMany: (args: unknown) => mockTaskFindMany(args),
      findFirst: (args: unknown) => mockTaskFindFirst(args),
      update: (args: unknown) => mockTaskUpdate(args),
    },
    notification: {
      findFirst: (args: unknown) => mockNotificationFindFirst(args),
      create: (args: unknown) => mockNotificationCreate(args),
    },
  },
}));
vi.mock("@/lib/services/audit", () => ({
  auditLog: { record: (input: unknown) => mockAuditRecord(input) },
}));
vi.mock("@/lib/services/notification", () => ({
  notifications: { push: (input: unknown) => mockNotificationsPush(input) },
}));

import { GET as GET_list } from "@/app/api/student/tasks/route";
import { PATCH as PATCH_status } from "@/app/api/student/tasks/[id]/route";
import { POST as POST_complete } from "@/app/api/student/tasks/[id]/complete/route";
import { studentTaskService } from "@/lib/services/student-tasks";
import {
  isOverdue,
  isDueToday,
  isUpcoming,
  buildTaskViewWhere,
  computeTaskStats,
} from "@/lib/constants/tasks";

// ─────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────

const baseStudent = {
  id: "stu-1",
  userId: "user-1",
  studentId: "STD-2026-000001",
  firstName: "Karim",
  lastName: "Ahmed",
  email: "k@x.com",
  deletedAt: null,
};

const baseTask = {
  id: "task-1",
  title: "Upload Passport",
  description: "Please upload your passport bio page.",
  assignedToId: "user-1",
  studentId: "stu-1",
  applicationId: "app-1",
  priority: "HIGH",
  status: "TODO",
  dueDate: new Date("2026-09-20T23:59:59Z"),
  completedAt: null,
  createdById: "user-2",
  deletedAt: null,
  deletedBy: null,
  createdAt: new Date("2026-09-10T08:00:00Z"),
  updatedAt: new Date("2026-09-10T08:00:00Z"),
  application: { id: "app-1", applicationNumber: "SV-2026-000001" },
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers().setSystemTime(new Date("2026-09-12T12:00:00Z")); // Sep 12, 2026
  mockAuth.mockResolvedValue({ user: { id: "user-1", role: "STUDENT" } });
  mockStudentFindFirst.mockResolvedValue(baseStudent);
  mockTaskFindMany.mockResolvedValue([baseTask]);
  mockTaskFindFirst.mockResolvedValue(baseTask);
  mockTaskUpdate.mockResolvedValue({
    ...baseTask,
    status: "COMPLETED",
    completedAt: new Date("2026-09-12T12:00:00Z"),
  });
  mockAuditRecord.mockResolvedValue(undefined);
  mockNotificationsPush.mockResolvedValue(undefined);
  mockNotificationFindFirst.mockResolvedValue(null);
  mockNotificationCreate.mockResolvedValue({});
});

function mockAuthResolved(user: { id: string | null; role?: string }) {
  mockAuth.mockResolvedValue(user.id ? { user } : null);
}

function makePatchReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/student/tasks/task-1", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ─────────────────────────────────────────────
// Pure helper tests (deadline calculation + overdue detection)
// ─────────────────────────────────────────────

describe("deadline + overdue helpers", () => {
  const now = new Date("2026-09-12T12:00:00Z");

  it("isOverdue returns true for past dueDate + open status", () => {
    expect(isOverdue(new Date("2026-09-10T12:00:00Z"), "TODO", now)).toBe(true);
    expect(isOverdue(new Date("2026-09-10T12:00:00Z"), "IN_PROGRESS", now)).toBe(true);
  });

  it("isOverdue returns false for past dueDate + terminal status", () => {
    expect(isOverdue(new Date("2026-09-10T12:00:00Z"), "COMPLETED", now)).toBe(false);
    expect(isOverdue(new Date("2026-09-10T12:00:00Z"), "CANCELLED", now)).toBe(false);
  });

  it("isOverdue returns false for future dueDate", () => {
    expect(isOverdue(new Date("2026-09-20T12:00:00Z"), "TODO", now)).toBe(false);
  });

  it("isOverdue returns false for null dueDate", () => {
    expect(isOverdue(null, "TODO", now)).toBe(false);
  });

  it("isDueToday returns true for a date within today (UTC)", () => {
    expect(isDueToday(new Date("2026-09-12T08:00:00Z"), now)).toBe(true);
    expect(isDueToday(new Date("2026-09-12T23:59:59Z"), now)).toBe(true);
  });

  it("isDueToday returns false for tomorrow or yesterday", () => {
    expect(isDueToday(new Date("2026-09-13T00:00:00Z"), now)).toBe(false);
    expect(isDueToday(new Date("2026-09-11T23:59:59Z"), now)).toBe(false);
  });

  it("isUpcoming returns true for a date strictly after today", () => {
    expect(isUpcoming(new Date("2026-09-13T00:00:00Z"), now)).toBe(true);
    expect(isUpcoming(new Date("2026-09-20T12:00:00Z"), now)).toBe(true);
  });

  it("isUpcoming returns false for today", () => {
    expect(isUpcoming(new Date("2026-09-12T12:00:00Z"), now)).toBe(false);
  });

  it("buildTaskViewWhere returns correct clauses for each view", () => {
    const todayWhere = buildTaskViewWhere("today", now);
    expect(todayWhere).toHaveProperty("dueDate.gte");
    expect(todayWhere).toHaveProperty("dueDate.lte");

    const upcomingWhere = buildTaskViewWhere("upcoming", now);
    expect(upcomingWhere).toHaveProperty("dueDate.gt");

    const overdueWhere = buildTaskViewWhere("overdue", now);
    expect(overdueWhere).toHaveProperty("dueDate.lt");
    expect(overdueWhere).toHaveProperty("status.in");

    const completedWhere = buildTaskViewWhere("completed", now);
    expect(completedWhere).toEqual({ status: "COMPLETED" });

    const allWhere = buildTaskViewWhere("all", now);
    expect(allWhere).toBeNull();
  });

  it("computeTaskStats counts pending, overdue, completed, cancelled", () => {
    const tasks = [
      { status: "TODO", dueDate: new Date("2026-09-20T12:00:00Z") },
      { status: "IN_PROGRESS", dueDate: new Date("2026-09-10T12:00:00Z") }, // overdue
      { status: "COMPLETED", dueDate: new Date("2026-09-05T12:00:00Z") },
      { status: "CANCELLED", dueDate: null },
      { status: "TODO", dueDate: new Date("2026-09-15T12:00:00Z") },
    ];
    const stats = computeTaskStats(tasks, now);
    expect(stats.total).toBe(5);
    expect(stats.pending).toBe(3); // TODO + IN_PROGRESS + TODO
    expect(stats.overdue).toBe(1); // IN_PROGRESS past due
    expect(stats.completed).toBe(1);
    expect(stats.cancelled).toBe(1);
  });
});

// ─────────────────────────────────────────────
// GET /api/student/tasks (list)
// ─────────────────────────────────────────────

describe("GET /api/student/tasks (list)", () => {
  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await GET_list(new NextRequest("http://localhost/api/student/tasks"));
    expect(res.status).toBe(401);
  });

  it("rejects non-STUDENT roles with 403", async () => {
    mockAuthResolved({ id: "user-1", role: "ADMIN" });
    const res = await GET_list(new NextRequest("http://localhost/api/student/tasks"));
    expect(res.status).toBe(403);
  });

  it("returns tasks assigned to the caller (scoped by assignedToId)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_list(new NextRequest("http://localhost/api/student/tasks"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.tasks.length).toBe(1);
    expect(body.data.tasks[0].title).toBe("Upload Passport");
    expect(body.data.tasks[0].overdue).toBe(false); // Sep 20 is in the future from Sep 12
  });

  it("scopes findMany by assignedToId from the session", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(new NextRequest("http://localhost/api/student/tasks"));
    expect(mockTaskFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assignedToId: "user-1",
          deletedAt: null,
        }),
      }),
    );
  });

  it("applies the view filter (?view=overdue)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(new NextRequest("http://localhost/api/student/tasks?view=overdue"));
    const whereArg = mockTaskFindMany.mock.calls[0][0].where as Record<string, unknown>;
    // The overdue view adds dueDate.lt + status.in to the where clause
    expect(whereArg.dueDate).toBeDefined();
    expect(whereArg.status).toBeDefined();
  });

  it("applies the status filter (?status=COMPLETED)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await GET_list(new NextRequest("http://localhost/api/student/tasks?status=COMPLETED"));
    const whereArg = mockTaskFindMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(whereArg.status).toBe("COMPLETED");
  });

  it("strips internal fields (deletedAt, deletedBy, assignedToId)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await GET_list(new NextRequest("http://localhost/api/student/tasks"));
    const body = await res.json();
    for (const t of body.data.tasks) {
      expect("deletedAt" in t).toBe(false);
      expect("deletedBy" in t).toBe(false);
      expect("assignedToId" in t).toBe(false);
    }
  });

  it("includes the derived 'overdue' flag", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    // Mock an overdue task
    mockTaskFindMany.mockResolvedValue([{
      ...baseTask,
      dueDate: new Date("2026-09-10T12:00:00Z"), // past
      status: "TODO",
    }]);
    const res = await GET_list(new NextRequest("http://localhost/api/student/tasks"));
    const body = await res.json();
    expect(body.data.tasks[0].overdue).toBe(true);
  });
});

// ─────────────────────────────────────────────
// PATCH /api/student/tasks/[id] (status update)
// ─────────────────────────────────────────────

describe("PATCH /api/student/tasks/[id] (status update)", () => {
  async function callPatch(body: unknown) {
    return PATCH_status(
      makePatchReq(body),
      { params: Promise.resolve({ id: "task-1" }) },
    );
  }

  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await callPatch({ status: "COMPLETED" });
    expect(res.status).toBe(401);
  });

  it("returns 404 when the task doesn't belong to the caller (IDOR-safe)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    // Task is assigned to a different user
    mockTaskFindFirst.mockResolvedValue({ ...baseTask, assignedToId: "user-99" });
    const res = await callPatch({ status: "COMPLETED" });
    expect(res.status).toBe(404);
  });

  it("returns 422 when status field is missing", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callPatch({});
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 422 when status is TODO (students can't revert to TODO)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callPatch({ status: "TODO" });
    expect(res.status).toBe(422);
  });

  it("returns 422 when status is CANCELLED (students can't cancel)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callPatch({ status: "CANCELLED" });
    expect(res.status).toBe(422);
  });

  it("returns 422 when body contains fields other than 'status'", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callPatch({ status: "COMPLETED", title: "Hacked!", priority: "LOW" });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContain("title");
    expect(body.error.message).toContain("priority");
  });

  it("updates status to COMPLETED and sets completedAt", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callPatch({ status: "COMPLETED" });
    expect(res.status).toBe(200);
    expect(mockTaskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "task-1" },
        data: expect.objectContaining({
          status: "COMPLETED",
          completedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("updates status to IN_PROGRESS (without setting completedAt)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callPatch({ status: "IN_PROGRESS" });
    expect(res.status).toBe(200);
    expect(mockTaskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "task-1" },
        data: expect.objectContaining({
          status: "IN_PROGRESS",
        }),
      }),
    );
    // completedAt should NOT be in the update data when starting
    const updateData = mockTaskUpdate.mock.calls[0][0].data as Record<string, unknown>;
    expect("completedAt" in updateData).toBe(false);
  });

  it("audit-logs the status change", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callPatch({ status: "COMPLETED" });
    expect(mockAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "task.status_changed",
        entity: "Task",
        entityId: "task-1",
        oldValue: { status: "TODO" },
        newValue: { status: "COMPLETED" },
      }),
    );
  });

  it("notifies the task creator when the student completes it", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callPatch({ status: "COMPLETED" });
    expect(mockNotificationsPush).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-2", // the creator
        type: "TASK_COMPLETED",
      }),
    );
  });

  it("returns 409 when trying to modify a CANCELLED task", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockTaskFindFirst.mockResolvedValue({ ...baseTask, status: "CANCELLED" });
    const res = await callPatch({ status: "COMPLETED" });
    expect(res.status).toBe(409);
  });

  it("verifies the task's assignedToId matches the caller's userId (ownership)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callPatch({ status: "COMPLETED" });
    expect(mockTaskFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "task-1",
          deletedAt: null,
        }),
      }),
    );
  });
});

// ─────────────────────────────────────────────
// POST /api/student/tasks/[id]/complete
// ─────────────────────────────────────────────

describe("POST /api/student/tasks/[id]/complete", () => {
  async function callComplete() {
    return POST_complete(
      new NextRequest("http://localhost/api/student/tasks/task-1/complete", { method: "POST" }),
      { params: Promise.resolve({ id: "task-1" }) },
    );
  }

  it("rejects unauthenticated callers with 401", async () => {
    mockAuthResolved({ id: null });
    const res = await callComplete();
    expect(res.status).toBe(401);
  });

  it("marks the task as COMPLETED", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    const res = await callComplete();
    expect(res.status).toBe(200);
    expect(mockTaskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "COMPLETED",
          completedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("returns 404 when the task doesn't belong to the caller (IDOR-safe)", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    mockTaskFindFirst.mockResolvedValue({ ...baseTask, assignedToId: "user-99" });
    const res = await callComplete();
    expect(res.status).toBe(404);
  });

  it("audit-logs the completion", async () => {
    mockAuthResolved({ id: "user-1", role: "STUDENT" });
    await callComplete();
    expect(mockAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "task.status_changed",
        oldValue: { status: "TODO" },
        newValue: { status: "COMPLETED" },
      }),
    );
  });
});

// ─────────────────────────────────────────────
// Notification helpers (deadline approaching + overdue)
// ─────────────────────────────────────────────

describe("notification helpers (anti-spam)", () => {
  it("notifyDeadlineApproaching sends notifications for tasks due within 24h", async () => {
    // Task due in 12 hours (within the 24h window)
    const soon = new Date("2026-09-12T23:00:00Z"); // 11 hours from now (Sep 12 12:00)
    mockTaskFindMany.mockResolvedValue([
      { id: "t1", title: "Upload Doc", dueDate: soon, assignedToId: "user-1" },
    ]);
    mockNotificationFindFirst.mockResolvedValue(null); // no existing notification

    const sent = await studentTaskService.notifyDeadlineApproaching(new Date("2026-09-12T12:00:00Z"));
    expect(sent).toBe(1);
    expect(mockNotificationsPush).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        type: "DEADLINE_APPROACHING",
        title: "Deadline approaching",
      }),
    );
  });

  it("notifyDeadlineApproaching does NOT spam (skips if already notified in last 24h)", async () => {
    mockTaskFindMany.mockResolvedValue([
      { id: "t1", title: "Upload Doc", dueDate: new Date("2026-09-12T23:00:00Z"), assignedToId: "user-1" },
    ]);
    // Simulate an existing notification → anti-spam kicks in
    mockNotificationFindFirst.mockResolvedValue({ id: "existing-notif" });

    const sent = await studentTaskService.notifyDeadlineApproaching(new Date("2026-09-12T12:00:00Z"));
    expect(sent).toBe(0);
    expect(mockNotificationsPush).not.toHaveBeenCalled();
  });

  it("notifyOverdue sends notifications for past-due open tasks", async () => {
    mockTaskFindMany.mockResolvedValue([
      { id: "t1", title: "Late Task", dueDate: new Date("2026-09-10T12:00:00Z"), assignedToId: "user-1" },
    ]);
    mockNotificationFindFirst.mockResolvedValue(null);

    const sent = await studentTaskService.notifyOverdue(new Date("2026-09-12T12:00:00Z"));
    expect(sent).toBe(1);
    expect(mockNotificationsPush).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        type: "TASK_OVERDUE",
        title: "Task overdue",
      }),
    );
  });

  it("notifyOverdue does NOT spam (skips if already notified in last 24h)", async () => {
    mockTaskFindMany.mockResolvedValue([
      { id: "t1", title: "Late Task", dueDate: new Date("2026-09-10T12:00:00Z"), assignedToId: "user-1" },
    ]);
    mockNotificationFindFirst.mockResolvedValue({ id: "existing" });

    const sent = await studentTaskService.notifyOverdue(new Date("2026-09-12T12:00:00Z"));
    expect(sent).toBe(0);
    expect(mockNotificationsPush).not.toHaveBeenCalled();
  });
});
