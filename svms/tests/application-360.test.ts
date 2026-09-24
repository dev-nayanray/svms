import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  application: {
    findFirst: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
  },
  conversation: {
    findMany: vi.fn(),
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
  getApplicationById,
  requireApplication,
  changeApplicationStage,
  applicationCaseScope,
} from "@/lib/services/application-cases";
import type { EmployeeScope } from "@/lib/services/employee-dashboard";
import { HttpError } from "@/lib/api";

const ADMIN_SCOPE: EmployeeScope = { isAdmin: true, userId: "u-admin", employeeId: null };
const EMPLOYEE_SCOPE: EmployeeScope = { isAdmin: false, userId: "u-emp", employeeId: "emp-1" };

beforeEach(() => {
  vi.clearAllMocks();
});

// Helper to build a complete application fixture — every test extends this
// so we don't repeat the 30-field shape everywhere.
function makeAppFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "app-1",
    applicationNumber: "APP-2026-000001",
    stageKey: "VISA_SUBMITTED",
    status: "NEW",
    priority: "HIGH",
    deadline: null,
    archivedAt: null,
    notes: null,
    createdAt: new Date("2026-08-01"),
    updatedAt: new Date("2026-08-10"),
    student: {
      id: "stu-1",
      firstName: "Karim",
      lastName: "Ahmed",
      studentId: "STD-2026-000001",
      email: "karim@example.com",
      phone: "+8801711111111",
      country: "Bangladesh",
      nationality: "Bangladeshi",
      user: { avatar: null },
      academicRecords: [],
      englishProficiencies: [],
    },
    country: { id: "c1", name: "Germany" },
    university: { id: "u1", name: "TU Munich", city: "Munich", website: "https://tum.de" },
    course: { id: "co1", name: "B.Sc. CS", degreeLevel: "BACHELOR", duration: "6 semesters", tuitionFee: 0, currency: "EUR" },
    intake: { id: "i1", name: "Fall 2026", deadline: null, month: 9, year: 2026 },
    assignedEmployee: { id: "emp-1", title: "Counselor", user: { name: "Counselor Name", email: "c@x.com" } },
    documents: [],
    tasks: [],
    visaApplications: [],
    payments: [],
    invoices: [],
    stageHistory: [],
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// IDOR closure — invalid IDs + unauthorized access
// ─────────────────────────────────────────────

describe("Application 360 — IDOR closure + invalid IDs", () => {
  it("returns null for a missing application id", async () => {
    prismaMock.application.findFirst.mockResolvedValue(null);
    const result = await getApplicationById(EMPLOYEE_SCOPE, "app-missing");
    expect(result).toBeNull();
  });

  it("returns null when the application belongs to another employee (IDOR)", async () => {
    prismaMock.application.findFirst.mockResolvedValue(null);
    const result = await getApplicationById(EMPLOYEE_SCOPE, "app-foreign");
    expect(result).toBeNull();
    const call = prismaMock.application.findFirst.mock.calls[0][0];
    expect(call.where.id).toBe("app-foreign");
    expect(call.where.OR).toBeDefined();
  });

  it("requireApplication throws HttpError 404 for missing/foreign", async () => {
    prismaMock.application.findFirst.mockResolvedValue(null);
    await expect(requireApplication(EMPLOYEE_SCOPE, "app-x")).rejects.toThrow(HttpError);
    await expect(requireApplication(EMPLOYEE_SCOPE, "app-x")).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("ADMIN: no OR scope filter — sees any application", async () => {
    prismaMock.application.findFirst.mockResolvedValue(null);
    await getApplicationById(ADMIN_SCOPE, "app-anything");
    const call = prismaMock.application.findFirst.mock.calls[0][0];
    expect(call.where.id).toBe("app-anything");
    expect(call.where.OR).toBeUndefined();
  });

  it("EMPLOYEE scope uses OR: student assigned OR app directly assigned", () => {
    const scope = applicationCaseScope(EMPLOYEE_SCOPE);
    expect(scope.OR).toEqual([
      { student: { assignedEmployeeId: "emp-1" } },
      { assignedEmployeeId: "emp-1" },
    ]);
  });
});

// ─────────────────────────────────────────────
// Relationships — every tab gets the data it needs
// ─────────────────────────────────────────────

describe("Application 360 — relationship loading", () => {
  it("loads documents, tasks, visaApplications, payments, invoices, stageHistory in a single findFirst", async () => {
    const fixture = makeAppFixture({
      documents: [{ id: "d1", name: "Passport", status: "APPROVED", uploadedAt: new Date(), reviewedAt: new Date() }],
      tasks: [{ id: "t1", title: "Upload passport", status: "TODO", priority: "HIGH", dueDate: new Date("2026-08-20"), createdAt: new Date(), assignedToId: "u-emp" }],
      visaApplications: [{ id: "v1", stage: "BIOMETRICS", visaType: "Student", submittedAt: new Date(), decisionAt: null }],
      payments: [{ id: "p1", amount: 500, currency: "EUR", status: "PAID", paymentDate: new Date() }],
      invoices: [{ id: "inv1", invoiceNumber: "INV-001", amount: 500, currency: "EUR", status: "PAID", dueDate: null }],
      stageHistory: [{ id: "h1", fromStage: "LEAD", toStage: "COUNSELING", note: "Moving forward", changedById: "u-emp", createdAt: new Date() }],
    });
    prismaMock.application.findFirst.mockResolvedValue(fixture);
    prismaMock.user.findMany.mockResolvedValue([{ id: "u-emp", name: "Counselor Name" }]);
    prismaMock.conversation.findMany.mockResolvedValue([]);

    const result = await getApplicationById(EMPLOYEE_SCOPE, "app-1");
    expect(result).not.toBeNull();
    expect(result?.documents).toHaveLength(1);
    expect(result?.tasks).toHaveLength(1);
    expect(result?.visaApplications).toHaveLength(1);
    expect(result?.payments).toHaveLength(1);
    expect(result?.invoices).toHaveLength(1);
    expect(result?.stageHistory).toHaveLength(1);
  });

  it("loads student academicRecords + englishProficiencies for the Overview tab", async () => {
    const fixture = makeAppFixture({
      student: {
        ...makeAppFixture().student,
        academicRecords: [
          { id: "ar1", level: "BACHELOR", institution: "Dhaka University", passingYear: 2024, result: "3.85" },
        ],
        englishProficiencies: [
          { id: "ep1", testType: "IELTS", overallScore: 7.5, testDate: new Date("2026-07-01") },
        ],
      },
    });
    prismaMock.application.findFirst.mockResolvedValue(fixture);
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.conversation.findMany.mockResolvedValue([]);

    const result = await getApplicationById(EMPLOYEE_SCOPE, "app-1");
    expect(result?.student.academicRecords).toHaveLength(1);
    expect(result?.student.academicRecords[0].institution).toBe("Dhaka University");
    expect(result?.student.englishProficiencies).toHaveLength(1);
    expect(result?.student.englishProficiencies[0].overallScore).toBe(7.5);
  });

  it("loads conversations for the Messages tab", async () => {
    prismaMock.application.findFirst.mockResolvedValue(makeAppFixture());
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.conversation.findMany.mockResolvedValue([
      {
        id: "conv1", subject: "Visa question", createdAt: new Date(), updatedAt: new Date(),
        messages: [{ id: "m1", body: "When is my appointment?", senderId: "u-stu", createdAt: new Date() }],
      },
    ]);

    const result = await getApplicationById(EMPLOYEE_SCOPE, "app-1");
    expect(result?.conversations).toHaveLength(1);
    expect(result?.conversations[0].messages).toHaveLength(1);
    expect(result?.conversations[0].messages[0].body).toBe("When is my appointment?");
  });

  it("resolves university city + website + course degreeLevel + tuitionFee + intake month/year", async () => {
    prismaMock.application.findFirst.mockResolvedValue(makeAppFixture());
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.conversation.findMany.mockResolvedValue([]);

    const result = await getApplicationById(EMPLOYEE_SCOPE, "app-1");
    expect(result?.university?.city).toBe("Munich");
    expect(result?.university?.website).toBe("https://tum.de");
    expect(result?.course?.degreeLevel).toBe("BACHELOR");
    expect(result?.course?.tuitionFee).toBe(0);
    expect(result?.intake?.month).toBe(9);
    expect(result?.intake?.year).toBe(2026);
  });

  it("returns avatar from User (not Student) — destructured into student.avatar", async () => {
    const fixture = makeAppFixture({
      student: { ...makeAppFixture().student, user: { avatar: "data:image/png;base64,xxx" } },
    });
    prismaMock.application.findFirst.mockResolvedValue(fixture);
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.conversation.findMany.mockResolvedValue([]);

    const result = await getApplicationById(EMPLOYEE_SCOPE, "app-1");
    expect(result?.student.avatar).toBe("data:image/png;base64,xxx");
  });
});

// ─────────────────────────────────────────────
// Stage History — actor name resolution + note
// ─────────────────────────────────────────────

describe("Application 360 — stage history + actor names", () => {
  it("resolves actor names via a single batched user.findMany (no N+1)", async () => {
    const fixture = makeAppFixture({
      stageHistory: [
        { id: "h1", fromStage: "LEAD", toStage: "COUNSELING", note: "Note 1", changedById: "u-emp", createdAt: new Date() },
        { id: "h2", fromStage: "COUNSELING", toStage: "VISA_SUBMITTED", note: "Note 2", changedById: "u-admin", createdAt: new Date() },
      ],
    });
    prismaMock.application.findFirst.mockResolvedValue(fixture);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "u-emp", name: "Counselor Name" },
      { id: "u-admin", name: "Admin Name" },
    ]);
    prismaMock.conversation.findMany.mockResolvedValue([]);

    const result = await getApplicationById(EMPLOYEE_SCOPE, "app-1");
    expect(result?.stageHistory[0].changedByName).toBe("Counselor Name");
    expect(result?.stageHistory[1].changedByName).toBe("Admin Name");

    // The user.findMany call should include both actor ids in a single query.
    const userCall = prismaMock.user.findMany.mock.calls[0][0];
    expect(userCall.where.id.in).toContain("u-emp");
    expect(userCall.where.id.in).toContain("u-admin");
  });

  it("uses 'Unknown' when the actor user cannot be found", async () => {
    const fixture = makeAppFixture({
      stageHistory: [
        { id: "h1", fromStage: "LEAD", toStage: "COUNSELING", note: null, changedById: "u-deleted", createdAt: new Date() },
      ],
    });
    prismaMock.application.findFirst.mockResolvedValue(fixture);
    prismaMock.user.findMany.mockResolvedValue([]); // empty — user not found
    prismaMock.conversation.findMany.mockResolvedValue([]);

    const result = await getApplicationById(EMPLOYEE_SCOPE, "app-1");
    expect(result?.stageHistory[0].changedByName).toBe("Unknown");
  });

  it("preserves the note on each history row (the page decides whether to show it)", async () => {
    const fixture = makeAppFixture({
      stageHistory: [
        { id: "h1", fromStage: "LEAD", toStage: "COUNSELING", note: "Confidential note", changedById: "u-emp", createdAt: new Date() },
      ],
    });
    prismaMock.application.findFirst.mockResolvedValue(fixture);
    prismaMock.user.findMany.mockResolvedValue([{ id: "u-emp", name: "Counselor" }]);
    prismaMock.conversation.findMany.mockResolvedValue([]);

    const result = await getApplicationById(EMPLOYEE_SCOPE, "app-1");
    expect(result?.stageHistory[0].note).toBe("Confidential note");
  });
});

// ─────────────────────────────────────────────
// Next Action — derived from earliest open task
// ─────────────────────────────────────────────

describe("Application 360 — Next Action derivation", () => {
  it("derives the next action from the earliest non-completed task", async () => {
    const fixture = makeAppFixture({
      tasks: [
        { id: "t1", title: "Upload passport", status: "TODO", priority: "HIGH", dueDate: new Date("2026-08-20"), createdAt: new Date(), assignedToId: "u-emp" },
        { id: "t2", title: "Submit visa form", status: "TODO", priority: "URGENT", dueDate: new Date("2026-08-15"), createdAt: new Date(), assignedToId: "u-emp" },
        { id: "t3", title: "Old completed task", status: "COMPLETED", priority: "LOW", dueDate: new Date("2026-07-01"), createdAt: new Date(), assignedToId: null },
      ],
    });
    prismaMock.application.findFirst.mockResolvedValue(fixture);
    prismaMock.user.findMany.mockResolvedValue([{ id: "u-emp", name: "Counselor Name" }]);
    prismaMock.conversation.findMany.mockResolvedValue([]);

    const result = await getApplicationById(EMPLOYEE_SCOPE, "app-1");
    expect(result?.nextAction).not.toBeNull();
    expect(result?.nextAction?.title).toBe("Submit visa form"); // earliest due date among open tasks
    expect(result?.nextAction?.assigneeName).toBe("Counselor Name");
    expect(result?.nextAction?.status).toBe("TODO");
  });

  it("returns null nextAction when there are no open tasks", async () => {
    const fixture = makeAppFixture({
      tasks: [
        { id: "t1", title: "Done", status: "COMPLETED", priority: "LOW", dueDate: null, createdAt: new Date(), assignedToId: null },
      ],
    });
    prismaMock.application.findFirst.mockResolvedValue(fixture);
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.conversation.findMany.mockResolvedValue([]);

    const result = await getApplicationById(EMPLOYEE_SCOPE, "app-1");
    expect(result?.nextAction).toBeNull();
  });

  it("resolves task assignee names via a single batched user.findMany", async () => {
    const fixture = makeAppFixture({
      tasks: [
        { id: "t1", title: "Task A", status: "TODO", priority: "HIGH", dueDate: new Date(), createdAt: new Date(), assignedToId: "u-emp2" },
        { id: "t2", title: "Task B", status: "IN_PROGRESS", priority: "MEDIUM", dueDate: new Date(), createdAt: new Date(), assignedToId: "u-emp3" },
      ],
    });
    prismaMock.application.findFirst.mockResolvedValue(fixture);
    prismaMock.user.findMany.mockImplementation((args: { where: { id: { in: string[] } } }) => {
      const requested = args.where.id.in;
      const users = [
        { id: "u-emp2", name: "Emp Two" },
        { id: "u-emp3", name: "Emp Three" },
        { id: "u-emp", name: "Counselor Name" },
      ];
      return Promise.resolve(users.filter((u) => requested.includes(u.id)));
    });
    prismaMock.conversation.findMany.mockResolvedValue([]);

    const result = await getApplicationById(EMPLOYEE_SCOPE, "app-1");
    expect(result?.nextAction?.assigneeName).toBe("Emp Two");
  });
});

// ─────────────────────────────────────────────
// Permissions — stage change requires applications.update
// ─────────────────────────────────────────────

describe("Application 360 — stage change + IDOR", () => {
  it("rejects an invalid stage with 400 BAD_REQUEST", async () => {
    await expect(changeApplicationStage(EMPLOYEE_SCOPE, "a1", "INVALID", { id: "u-1" })).rejects.toMatchObject({
      status: 400,
      code: "BAD_REQUEST",
    });
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

  it("IDOR: foreign application returns 404 (never 403)", async () => {
    prismaMock.application.findFirst.mockResolvedValue(null);
    await expect(changeApplicationStage(EMPLOYEE_SCOPE, "app-foreign", "COUNSELING", { id: "u-1" })).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("updates application + creates a history row on valid transition", async () => {
    prismaMock.application.findFirst
      .mockResolvedValueOnce({ id: "a1", stageKey: "LEAD", studentId: "stu-1" })
      .mockResolvedValueOnce({
        id: "a1", stageKey: "LEAD", status: "NEW", deadline: null,
        student: { id: "stu-1", firstName: "Karim", lastName: "Ahmed", userId: "u-stu" },
        documents: [], payments: [], invoices: [], visaApplications: [],
      });
    prismaMock.$transaction.mockResolvedValue([{}, { id: "hist-1" }]);
    prismaMock.student.findUnique.mockResolvedValue(null);
    const result = await changeApplicationStage(EMPLOYEE_SCOPE, "a1", "COUNSELING", { id: "u-1" }, "Moving forward");
    expect(result.fromStage).toBe("LEAD");
    expect(result.toStage).toBe("COUNSELING");
    expect(result.historyId).toBe("hist-1");
    expect(prismaMock.$transaction).toHaveBeenCalled();
    const txArgs = prismaMock.$transaction.mock.calls[0][0];
    expect(txArgs).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────
// Empty tabs — every tab renders an empty state when relations are absent
// ─────────────────────────────────────────────

describe("Application 360 — empty tabs", () => {
  it("returns empty arrays for every relation when the application is fresh", async () => {
    prismaMock.application.findFirst.mockResolvedValue(makeAppFixture());
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.conversation.findMany.mockResolvedValue([]);

    const result = await getApplicationById(EMPLOYEE_SCOPE, "app-1");
    expect(result?.documents).toEqual([]);
    expect(result?.tasks).toEqual([]);
    expect(result?.visaApplications).toEqual([]);
    expect(result?.payments).toEqual([]);
    expect(result?.invoices).toEqual([]);
    expect(result?.conversations).toEqual([]);
    expect(result?.stageHistory).toEqual([]);
    expect(result?.student.academicRecords).toEqual([]);
    expect(result?.student.englishProficiencies).toEqual([]);
    expect(result?.nextAction).toBeNull();
  });
});

// ─────────────────────────────────────────────
// Error propagation
// ─────────────────────────────────────────────

describe("Application 360 — error propagation", () => {
  it("lets prisma errors bubble (never swallows)", async () => {
    prismaMock.application.findFirst.mockRejectedValue(new Error("DB connection lost"));
    await expect(getApplicationById(EMPLOYEE_SCOPE, "app-1")).rejects.toThrow("DB connection lost");
  });

  it("requireApplication lets the underlying error bubble", async () => {
    prismaMock.application.findFirst.mockRejectedValue(new Error("findFirst failed"));
    await expect(requireApplication(EMPLOYEE_SCOPE, "app-1")).rejects.toThrow("findFirst failed");
  });
});
