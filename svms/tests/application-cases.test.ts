import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  application: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
  applicationStageHistory: {
    create: vi.fn(),
  },
  employee: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  student: {
    findUnique: vi.fn(),
  },
  notification: {
    create: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn((args: unknown[]) => Promise.all(args)),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  listApplications,
  getKanbanBoard,
  getApplicationById,
  requireApplication,
  changeApplicationStage,
  changeApplicationPriority,
  assignApplication,
  applicationCaseScope,
  type ApplicationListFilters,
} from "@/lib/services/application-cases";
import type { EmployeeScope } from "@/lib/services/employee-dashboard";
import { HttpError } from "@/lib/api";

const ADMIN_SCOPE: EmployeeScope = { isAdmin: true, userId: "u-admin", employeeId: null };
const EMPLOYEE_SCOPE: EmployeeScope = { isAdmin: false, userId: "u-emp", employeeId: "emp-1" };

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// Scope — IDOR closure
// ─────────────────────────────────────────────

describe("applicationCaseScope — IDOR closure", () => {
  it("ADMIN scope is empty — sees all applications", () => {
    expect(applicationCaseScope(ADMIN_SCOPE)).toEqual({});
  });

  it("EMPLOYEE scope uses OR: student assigned OR application directly assigned", () => {
    const scope = applicationCaseScope(EMPLOYEE_SCOPE);
    expect(scope.OR).toEqual([
      { student: { assignedEmployeeId: "emp-1" } },
      { assignedEmployeeId: "emp-1" },
    ]);
  });
});

// ─────────────────────────────────────────────
// listApplications — IDOR + filters + sort + pagination
// ─────────────────────────────────────────────

describe("listApplications — IDOR scope", () => {
  it("EMPLOYEE: where clause embeds the OR scope filter", async () => {
    prismaMock.application.findMany.mockResolvedValue([]);
    prismaMock.application.count.mockResolvedValue(0);
    await listApplications(EMPLOYEE_SCOPE, {});
    const call = prismaMock.application.findMany.mock.calls[0][0];
    expect(call.where.OR).toBeDefined();
    expect(call.where.OR[0]).toEqual({ student: { assignedEmployeeId: "emp-1" } });
    expect(call.where.OR[1]).toEqual({ assignedEmployeeId: "emp-1" });
  });

  it("ADMIN: no scope filter in where clause", async () => {
    prismaMock.application.findMany.mockResolvedValue([]);
    prismaMock.application.count.mockResolvedValue(0);
    await listApplications(ADMIN_SCOPE, {});
    const call = prismaMock.application.findMany.mock.calls[0][0];
    expect(call.where.OR).toBeUndefined();
  });

  it("default: archived applications excluded (archivedAt: null)", async () => {
    prismaMock.application.findMany.mockResolvedValue([]);
    prismaMock.application.count.mockResolvedValue(0);
    await listApplications(EMPLOYEE_SCOPE, {});
    const call = prismaMock.application.findMany.mock.calls[0][0];
    expect(call.where.archivedAt).toBeNull();
  });

  it("archived=true: only archived applications returned", async () => {
    prismaMock.application.findMany.mockResolvedValue([]);
    prismaMock.application.count.mockResolvedValue(0);
    await listApplications(EMPLOYEE_SCOPE, { filters: { archived: true } });
    const call = prismaMock.application.findMany.mock.calls[0][0];
    expect(call.where.archivedAt).toEqual({ not: null });
  });
});

describe("listApplications — search", () => {
  it("builds OR across applicationNumber + student name/studentId", async () => {
    prismaMock.application.findMany.mockResolvedValue([]);
    prismaMock.application.count.mockResolvedValue(0);
    await listApplications(EMPLOYEE_SCOPE, { filters: { search: "Karim" } });
    const call = prismaMock.application.findMany.mock.calls[0][0];
    expect(call.where.OR).toEqual(expect.arrayContaining([
      { applicationNumber: { contains: "Karim", mode: "insensitive" } },
      { student: { firstName: { contains: "Karim", mode: "insensitive" } } },
    ]));
  });
});

describe("listApplications — filters", () => {
  it("applies stage, status, priority, country, university, course, intake, assignee filters", async () => {
    prismaMock.application.findMany.mockResolvedValue([]);
    prismaMock.application.count.mockResolvedValue(0);
    const filters: ApplicationListFilters = {
      stage: "VISA_SUBMITTED", status: "NEW", priority: "HIGH",
      countryId: "c1", universityId: "u1", courseId: "co1",
      intakeId: "i1", assignedEmployeeId: "emp-2",
    };
    await listApplications(EMPLOYEE_SCOPE, { filters });
    const call = prismaMock.application.findMany.mock.calls[0][0];
    expect(call.where.stageKey).toBe("VISA_SUBMITTED");
    expect(call.where.status).toBe("NEW");
    expect(call.where.priority).toBe("HIGH");
    expect(call.where.countryId).toBe("c1");
    expect(call.where.universityId).toBe("u1");
    expect(call.where.courseId).toBe("co1");
    expect(call.where.intakeId).toBe("i1");
    expect(call.where.assignedEmployeeId).toBe("emp-2");
  });

  it("applies deadline range filter", async () => {
    prismaMock.application.findMany.mockResolvedValue([]);
    prismaMock.application.count.mockResolvedValue(0);
    await listApplications(EMPLOYEE_SCOPE, {
      filters: { deadlineFrom: "2026-01-01", deadlineTo: "2026-12-31" },
    });
    const call = prismaMock.application.findMany.mock.calls[0][0];
    expect(call.where.deadline.gte).toEqual(new Date("2026-01-01"));
    expect(call.where.deadline.lte).toEqual(new Date("2026-12-31"));
  });

  it("ignores invalid date strings", async () => {
    prismaMock.application.findMany.mockResolvedValue([]);
    prismaMock.application.count.mockResolvedValue(0);
    await listApplications(EMPLOYEE_SCOPE, {
      filters: { deadlineFrom: "bad", deadlineTo: "also-bad" },
    });
    const call = prismaMock.application.findMany.mock.calls[0][0];
    expect(call.where.deadline).toBeUndefined();
  });
});

describe("listApplications — sorting", () => {
  it("unknown sort key falls back to updatedAt desc", async () => {
    prismaMock.application.findMany.mockResolvedValue([]);
    prismaMock.application.count.mockResolvedValue(0);
    // @ts-expect-error — intentionally bad key
    await listApplications(EMPLOYEE_SCOPE, { sortBy: "evil" });
    const call = prismaMock.application.findMany.mock.calls[0][0];
    expect(call.orderBy[0]).toHaveProperty("updatedAt");
  });

  it("priority sort uses JS-based pagination (findMany then slice)", async () => {
    prismaMock.application.findMany.mockResolvedValue([
      { id: "a1", priority: "LOW" },
      { id: "a2", priority: "URGENT" },
      { id: "a3", priority: "MEDIUM" },
    ]);
    // The second findMany call (for the paginated rows)
    prismaMock.application.findMany.mockResolvedValueOnce([
      { id: "a1", priority: "LOW" },
      { id: "a2", priority: "URGENT" },
      { id: "a3", priority: "MEDIUM" },
    ]).mockResolvedValueOnce([
      { id: "a2", priority: "URGENT", applicationNumber: "APP-2", stageKey: "LEAD", status: "NEW", deadline: null, archivedAt: null, createdAt: new Date(), updatedAt: new Date(), student: { id: "s1", firstName: "S", lastName: "1", studentId: "STD-1", email: "s@x.com", phone: null }, country: null, university: null, course: null, intake: null, assignedEmployee: null, tasks: [] },
      { id: "a3", priority: "MEDIUM", applicationNumber: "APP-3", stageKey: "LEAD", status: "NEW", deadline: null, archivedAt: null, createdAt: new Date(), updatedAt: new Date(), student: { id: "s1", firstName: "S", lastName: "1", studentId: "STD-1", email: "s@x.com", phone: null }, country: null, university: null, course: null, intake: null, assignedEmployee: null, tasks: [] },
      { id: "a1", priority: "LOW", applicationNumber: "APP-1", stageKey: "LEAD", status: "NEW", deadline: null, archivedAt: null, createdAt: new Date(), updatedAt: new Date(), student: { id: "s1", firstName: "S", lastName: "1", studentId: "STD-1", email: "s@x.com", phone: null }, country: null, university: null, course: null, intake: null, assignedEmployee: null, tasks: [] },
    ]);
    const result = await listApplications(EMPLOYEE_SCOPE, { sortBy: "priority", sortOrder: "desc", pageSize: 3 });
    expect(result.rows[0].priority).toBe("URGENT");
    expect(result.rows[1].priority).toBe("MEDIUM");
    expect(result.rows[2].priority).toBe("LOW");
  });
});

describe("listApplications — pagination", () => {
  it("defaults to page 1, pageSize 20", async () => {
    prismaMock.application.findMany.mockResolvedValue([]);
    prismaMock.application.count.mockResolvedValue(0);
    const result = await listApplications(EMPLOYEE_SCOPE, {});
    expect(prismaMock.application.findMany.mock.calls[0][0].skip).toBe(0);
    expect(prismaMock.application.findMany.mock.calls[0][0].take).toBe(20);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it("clamps pageSize to 1–100", async () => {
    prismaMock.application.findMany.mockResolvedValue([]);
    prismaMock.application.count.mockResolvedValue(0);
    await listApplications(EMPLOYEE_SCOPE, { pageSize: 5000 });
    expect(prismaMock.application.findMany.mock.calls[0][0].take).toBe(100);
    await listApplications(EMPLOYEE_SCOPE, { pageSize: 0 });
    // For priority sort path: first call is id-only (no take/skip), second is by ids.
    // For non-priority: the latest findMany has take=1.
    const calls = prismaMock.application.findMany.mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.take).toBe(1);
  });
});

describe("listApplications — empty + populated", () => {
  it("returns empty rows + totalPages=1 when database is empty", async () => {
    prismaMock.application.findMany.mockResolvedValue([]);
    prismaMock.application.count.mockResolvedValue(0);
    const result = await listApplications(EMPLOYEE_SCOPE, {});
    expect(result.rows).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(1);
  });

  it("maps rows with nextDeadline computed from tasks/intake/app deadlines", async () => {
    const fakeRow = {
      id: "a1", applicationNumber: "APP-1", stageKey: "VISA_SUBMITTED", status: "NEW",
      priority: "HIGH", deadline: null, archivedAt: null, notes: null,
      createdAt: new Date("2026-08-01"), updatedAt: new Date("2026-08-10"),
      student: { id: "s1", firstName: "Karim", lastName: "Ahmed", studentId: "STD-1", email: "k@x.com", phone: "+88" },
      country: { name: "Germany" }, university: { name: "TU Munich" }, course: { name: "CS" },
      intake: { name: "Fall 2026", deadline: new Date("2026-09-01") },
      assignedEmployee: { id: "emp-1", user: { name: "Counselor" } },
      tasks: [{ dueDate: new Date("2026-08-20"), title: "Upload passport" }],
    };
    prismaMock.application.findMany.mockResolvedValue([fakeRow]);
    prismaMock.application.count.mockResolvedValue(1);
    const result = await listApplications(EMPLOYEE_SCOPE, {});
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].applicationNumber).toBe("APP-1");
    expect(result.rows[0].university?.name).toBe("TU Munich");
    expect(result.rows[0].nextDeadline).toEqual(new Date("2026-08-20")); // earliest
    expect(result.rows[0].nextAction).toBe("Upload passport");
  });
});

// ─────────────────────────────────────────────
// getKanbanBoard — grouped by stage
// ─────────────────────────────────────────────

describe("getKanbanBoard", () => {
  it("returns all 18 stages even when database is empty", async () => {
    prismaMock.application.findMany.mockResolvedValue([]);
    const board = await getKanbanBoard(EMPLOYEE_SCOPE);
    expect(board).toHaveLength(18);
    expect(board[0].stage).toBe("LEAD");
    expect(board[17].stage).toBe("COMPLETED");
    expect(board.every((col) => col.count === 0 && col.cards.length === 0)).toBe(true);
  });

  it("groups applications by stageKey", async () => {
    const rows = [
      { id: "a1", applicationNumber: "APP-1", stageKey: "LEAD", status: "NEW", priority: "HIGH", deadline: null, archivedAt: null, notes: null, createdAt: new Date(), updatedAt: new Date(), student: { id: "s1", firstName: "A", lastName: "B", studentId: "STD-1", email: "a@x.com", phone: null }, country: null, university: null, course: null, intake: null, assignedEmployee: null, tasks: [] },
      { id: "a2", applicationNumber: "APP-2", stageKey: "VISA_SUBMITTED", status: "NEW", priority: "URGENT", deadline: null, archivedAt: null, notes: null, createdAt: new Date(), updatedAt: new Date(), student: { id: "s2", firstName: "C", lastName: "D", studentId: "STD-2", email: "c@x.com", phone: null }, country: null, university: null, course: null, intake: null, assignedEmployee: null, tasks: [] },
    ];
    prismaMock.application.findMany.mockResolvedValue(rows);
    const board = await getKanbanBoard(EMPLOYEE_SCOPE);
    const leadCol = board.find((c) => c.stage === "LEAD");
    const visaCol = board.find((c) => c.stage === "VISA_SUBMITTED");
    expect(leadCol?.count).toBe(1);
    expect(leadCol?.cards[0].applicationNumber).toBe("APP-1");
    expect(visaCol?.count).toBe(1);
    expect(visaCol?.cards[0].applicationNumber).toBe("APP-2");
  });
});

// ─────────────────────────────────────────────
// getApplicationById — IDOR + full aggregate
// ─────────────────────────────────────────────

describe("getApplicationById — IDOR closure", () => {
  it("returns null for missing/foreign application", async () => {
    prismaMock.application.findFirst.mockResolvedValue(null);
    const result = await getApplicationById(EMPLOYEE_SCOPE, "app-missing");
    expect(result).toBeNull();
    const call = prismaMock.application.findFirst.mock.calls[0][0];
    expect(call.where.id).toBe("app-missing");
    expect(call.where.OR).toBeDefined();
  });

  it("ADMIN: no OR scope filter", async () => {
    prismaMock.application.findFirst.mockResolvedValue(null);
    await getApplicationById(ADMIN_SCOPE, "app-anything");
    const call = prismaMock.application.findFirst.mock.calls[0][0];
    expect(call.where.OR).toBeUndefined();
  });
});

describe("requireApplication — 404", () => {
  it("throws HttpError 404 for missing/foreign application", async () => {
    prismaMock.application.findFirst.mockResolvedValue(null);
    await expect(requireApplication(EMPLOYEE_SCOPE, "app-x")).rejects.toThrow(HttpError);
    await expect(requireApplication(EMPLOYEE_SCOPE, "app-x")).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

// ─────────────────────────────────────────────
// changeApplicationStage — validation + IDOR + history
// ─────────────────────────────────────────────

describe("changeApplicationStage", () => {
  it("rejects an invalid stage key with 400", async () => {
    await expect(changeApplicationStage(EMPLOYEE_SCOPE, "a1", "INVALID_STAGE", { id: "u-1" })).rejects.toThrow(HttpError);
    await expect(changeApplicationStage(EMPLOYEE_SCOPE, "a1", "INVALID_STAGE", { id: "u-1" })).rejects.toMatchObject({ status: 400, code: "BAD_REQUEST" });
  });

  it("returns a no-op when the stage is the same (no history row created)", async () => {
    prismaMock.application.findFirst.mockResolvedValue({ id: "a1", stageKey: "LEAD", studentId: "stu-1" });
    const result = await changeApplicationStage(EMPLOYEE_SCOPE, "a1", "LEAD", { id: "u-1" });
    expect(result.fromStage).toBe("LEAD");
    expect(result.toStage).toBe("LEAD");
    expect(result.historyId).toBe("");
    expect(prismaMock.application.update).not.toHaveBeenCalled();
    expect(prismaMock.applicationStageHistory.create).not.toHaveBeenCalled();
  });

  it("updates the application + creates a history row on valid transition", async () => {
    // First findFirst: the IDOR-scoped lookup
    prismaMock.application.findFirst
      .mockResolvedValueOnce({ id: "a1", stageKey: "LEAD", studentId: "stu-1" })
      // Second findFirst: loadStageRuleSnapshot
      .mockResolvedValueOnce({
        id: "a1", stageKey: "LEAD", status: "NEW", deadline: null,
        student: { id: "stu-1", firstName: "Karim", lastName: "Ahmed", userId: "u-stu" },
        documents: [], payments: [], invoices: [], visaApplications: [],
      });
    prismaMock.$transaction.mockResolvedValue([{}, { id: "hist-1" }]);
    prismaMock.student.findUnique.mockResolvedValue(null); // notification lookup
    const result = await changeApplicationStage(EMPLOYEE_SCOPE, "a1", "COUNSELING", { id: "u-1" }, "Moving forward");
    expect(result.fromStage).toBe("LEAD");
    expect(result.toStage).toBe("COUNSELING");
    expect(result.historyId).toBe("hist-1");
    expect(prismaMock.$transaction).toHaveBeenCalled();
    const txArgs = prismaMock.$transaction.mock.calls[0][0];
    expect(txArgs).toHaveLength(2);
  });

  it("IDOR: foreign application returns 404", async () => {
    prismaMock.application.findFirst.mockResolvedValue(null);
    await expect(changeApplicationStage(EMPLOYEE_SCOPE, "app-foreign", "COUNSELING", { id: "u-1" })).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

// ─────────────────────────────────────────────
// changeApplicationPriority — validation + IDOR
// ─────────────────────────────────────────────

describe("changeApplicationPriority", () => {
  it("rejects an invalid priority with 400", async () => {
    await expect(changeApplicationPriority(EMPLOYEE_SCOPE, "a1", "SUPER")).rejects.toMatchObject({ status: 400, code: "BAD_REQUEST" });
  });

  it("accepts LOW / MEDIUM / HIGH / URGENT", async () => {
    for (const p of ["LOW", "MEDIUM", "HIGH", "URGENT"]) {
      prismaMock.application.findFirst.mockResolvedValueOnce({ id: "a1" });
      prismaMock.application.update.mockResolvedValueOnce({});
      await changeApplicationPriority(EMPLOYEE_SCOPE, "a1", p);
      expect(prismaMock.application.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ priority: p }) }));
    }
  });

  it("IDOR: foreign application returns 404", async () => {
    prismaMock.application.findFirst.mockResolvedValue(null);
    await expect(changeApplicationPriority(EMPLOYEE_SCOPE, "app-foreign", "HIGH")).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

// ─────────────────────────────────────────────
// assignApplication — validation + IDOR
// ─────────────────────────────────────────────

describe("assignApplication", () => {
  it("assigns to a valid employee", async () => {
    prismaMock.application.findFirst.mockResolvedValue({ id: "a1", assignedEmployeeId: null });
    prismaMock.employee.findFirst.mockResolvedValue({ id: "emp-2" });
    prismaMock.application.update.mockResolvedValue({});
    await assignApplication(EMPLOYEE_SCOPE, "a1", "emp-2", { id: "u-1" });
    expect(prismaMock.application.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ assignedEmployeeId: "emp-2" }) }));
  });

  it("unassigns when employeeId is null", async () => {
    prismaMock.application.findFirst.mockResolvedValue({ id: "a1", assignedEmployeeId: "emp-2" });
    prismaMock.application.update.mockResolvedValue({});
    await assignApplication(EMPLOYEE_SCOPE, "a1", null, { id: "u-1" });
    expect(prismaMock.application.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ assignedEmployeeId: null }) }));
  });

  it("rejects when the target employee does not exist", async () => {
    prismaMock.application.findFirst.mockResolvedValue({ id: "a1", assignedEmployeeId: null });
    prismaMock.employee.findFirst.mockResolvedValue(null);
    await expect(assignApplication(EMPLOYEE_SCOPE, "a1", "emp-nonexistent", { id: "u-1" })).rejects.toMatchObject({ status: 400, code: "BAD_REQUEST" });
  });

  it("IDOR: foreign application returns 404", async () => {
    prismaMock.application.findFirst.mockResolvedValue(null);
    await expect(assignApplication(EMPLOYEE_SCOPE, "app-foreign", "emp-2", { id: "u-1" })).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

// ─────────────────────────────────────────────
// Error propagation
// ─────────────────────────────────────────────

describe("error propagation", () => {
  it("listApplications lets prisma errors bubble", async () => {
    prismaMock.application.findMany.mockRejectedValue(new Error("DB lost"));
    prismaMock.application.count.mockResolvedValue(0);
    await expect(listApplications(EMPLOYEE_SCOPE, {})).rejects.toThrow("DB lost");
  });

  it("getKanbanBoard lets prisma errors bubble", async () => {
    prismaMock.application.findMany.mockRejectedValue(new Error("DB lost"));
    await expect(getKanbanBoard(EMPLOYEE_SCOPE)).rejects.toThrow("DB lost");
  });
});
