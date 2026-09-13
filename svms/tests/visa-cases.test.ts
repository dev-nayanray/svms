import { describe, it, expect, vi, beforeEach } from "vitest";

// Pure rules tests
import {
  validateVisaTransitionShape,
  VISA_STAGES,
} from "@/lib/services/visa-cases";

describe("validateVisaTransitionShape — forward-only", () => {
  it("allows the immediate forward successor", () => {
    expect(validateVisaTransitionShape("PREPARATION", "SUBMITTED")).toBeNull();
    expect(validateVisaTransitionShape("SUBMITTED", "BIOMETRICS")).toBeNull();
    expect(validateVisaTransitionShape("PROCESSING", "APPROVED")).toBeNull();
  });

  it("blocks forward skips (PREPARATION → APPROVED)", () => {
    const block = validateVisaTransitionShape("PREPARATION", "APPROVED");
    expect(block).not.toBeNull();
    expect(block!.code).toBe("SKIP_BLOCKED");
  });

  it("blocks transitions from terminal stages (APPROVED → anything)", () => {
    const block = validateVisaTransitionShape("APPROVED", "PROCESSING");
    expect(block).not.toBeNull();
    expect(block!.code).toBe("TERMINAL");
  });

  it("blocks transitions from COMPLETED (terminal)", () => {
    const block = validateVisaTransitionShape("COMPLETED", "PREPARATION");
    expect(block).not.toBeNull();
    expect(block!.code).toBe("TERMINAL");
  });

  it("allows backward rework to PREPARATION from non-terminal stages", () => {
    expect(validateVisaTransitionShape("BIOMETRICS", "PREPARATION")).toBeNull();
    expect(validateVisaTransitionShape("INTERVIEW", "PREPARATION")).toBeNull();
    expect(validateVisaTransitionShape("PROCESSING", "PREPARATION")).toBeNull();
    expect(validateVisaTransitionShape("REFUSED", "PREPARATION")).toBeNull();
  });

  it("blocks backward transitions not in the allowlist (PROCESSING → SUBMITTED)", () => {
    const block = validateVisaTransitionShape("PROCESSING", "SUBMITTED");
    expect(block).not.toBeNull();
    expect(block!.code).toBe("BACKWARD_BLOCKED");
  });

  it("returns null for same-stage (no-op)", () => {
    expect(validateVisaTransitionShape("PREPARATION", "PREPARATION")).toBeNull();
  });

  it("rejects unknown stages", () => {
    expect(validateVisaTransitionShape("INVALID", "SUBMITTED")!.code).toBe("INVALID_FROM");
    expect(validateVisaTransitionShape("PREPARATION", "INVALID")!.code).toBe("INVALID_TO");
  });
});

describe("VISA_STAGES — all 9 stages present", () => {
  it("includes PREPARATION, SUBMITTED, BIOMETRICS, INTERVIEW, PROCESSING, APPROVED, REFUSED, WITHDRAWN, COMPLETED", () => {
    expect(VISA_STAGES).toHaveLength(9);
    expect(VISA_STAGES).toContain("PREPARATION");
    expect(VISA_STAGES).toContain("WITHDRAWN");
    expect(VISA_STAGES).toContain("COMPLETED");
  });
});

// Service-level tests with mocked prisma
const prismaMock = vi.hoisted(() => ({
  visaApplication: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
  visaStageHistory: { create: vi.fn() },
  user: { findMany: vi.fn() },
  appointment: { findMany: vi.fn() },
  visaRequirement: { findMany: vi.fn() },
  notification: { create: vi.fn() },
  auditLog: { create: vi.fn() },
  application: { findFirst: vi.fn() },
  country: { findMany: vi.fn() },
  employee: { findFirst: vi.fn() },
  $transaction: vi.fn((args: unknown[]) => Promise.all(args)),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  listVisaApplications,
  getVisaById,
  requireVisa,
  changeVisaStage,
  getVisaTransitionPreviews,
} from "@/lib/services/visa-cases";
import type { EmployeeScope } from "@/lib/services/employee-dashboard";

const ADMIN_SCOPE: EmployeeScope = { isAdmin: true, userId: "u-admin", employeeId: null };
const EMPLOYEE_SCOPE: EmployeeScope = { isAdmin: false, userId: "u-emp", employeeId: "emp-1" };

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// IDOR closure
// ─────────────────────────────────────────────

describe("visa IDOR closure", () => {
  it("EMPLOYEE scope embeds visa case-ownership filter", async () => {
    prismaMock.visaApplication.findMany.mockResolvedValue([]);
    prismaMock.visaApplication.count.mockResolvedValue(0);
    await listVisaApplications(EMPLOYEE_SCOPE, {});
    const call = prismaMock.visaApplication.findMany.mock.calls[0][0];
    expect(call.where.application).toEqual({ student: { assignedEmployeeId: "emp-1" } });
  });

  it("ADMIN scope is empty — sees all visa applications", async () => {
    prismaMock.visaApplication.findMany.mockResolvedValue([]);
    prismaMock.visaApplication.count.mockResolvedValue(0);
    await listVisaApplications(ADMIN_SCOPE, {});
    const call = prismaMock.visaApplication.findMany.mock.calls[0][0];
    expect(call.where.application).toBeUndefined();
  });

  it("getVisaById returns null for foreign visa applications", async () => {
    prismaMock.visaApplication.findFirst.mockResolvedValue(null);
    const result = await getVisaById(EMPLOYEE_SCOPE, "visa-foreign");
    expect(result).toBeNull();
  });

  it("requireVisa throws 404 for missing/foreign", async () => {
    prismaMock.visaApplication.findFirst.mockResolvedValue(null);
    await expect(requireVisa(EMPLOYEE_SCOPE, "visa-missing")).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

// ─────────────────────────────────────────────
// List — filters
// ─────────────────────────────────────────────

describe("listVisaApplications — filters", () => {
  it("applies stage filter", async () => {
    prismaMock.visaApplication.findMany.mockResolvedValue([]);
    prismaMock.visaApplication.count.mockResolvedValue(0);
    await listVisaApplications(EMPLOYEE_SCOPE, { filters: { stage: "SUBMITTED" } });
    expect(prismaMock.visaApplication.findMany.mock.calls[0][0].where.stage).toBe("SUBMITTED");
  });

  it("applies decision=APPROVED filter (sets stage=APPROVED)", async () => {
    prismaMock.visaApplication.findMany.mockResolvedValue([]);
    prismaMock.visaApplication.count.mockResolvedValue(0);
    await listVisaApplications(EMPLOYEE_SCOPE, { filters: { decision: "APPROVED" } });
    expect(prismaMock.visaApplication.findMany.mock.calls[0][0].where.stage).toBe("APPROVED");
  });

  it("applies decision=pending filter (excludes terminal stages)", async () => {
    prismaMock.visaApplication.findMany.mockResolvedValue([]);
    prismaMock.visaApplication.count.mockResolvedValue(0);
    await listVisaApplications(EMPLOYEE_SCOPE, { filters: { decision: "pending" } });
    expect(prismaMock.visaApplication.findMany.mock.calls[0][0].where.stage).toEqual({ notIn: ["APPROVED", "REFUSED", "WITHDRAWN", "COMPLETED"] });
  });

  it("applies countryId filter via application relation", async () => {
    prismaMock.visaApplication.findMany.mockResolvedValue([]);
    prismaMock.visaApplication.count.mockResolvedValue(0);
    await listVisaApplications(EMPLOYEE_SCOPE, { filters: { countryId: "c1" } });
    expect(prismaMock.visaApplication.findMany.mock.calls[0][0].where.application).toEqual(expect.objectContaining({ countryId: "c1" }));
  });

  it("applies submitted date range", async () => {
    prismaMock.visaApplication.findMany.mockResolvedValue([]);
    prismaMock.visaApplication.count.mockResolvedValue(0);
    await listVisaApplications(EMPLOYEE_SCOPE, { filters: { submittedFrom: "2026-01-01", submittedTo: "2026-12-31" } });
    const call = prismaMock.visaApplication.findMany.mock.calls[0][0];
    expect(call.where.submittedAt.gte).toEqual(new Date("2026-01-01"));
    expect(call.where.submittedAt.lte).toEqual(new Date("2026-12-31"));
  });

  it("ignores invalid submitted dates", async () => {
    prismaMock.visaApplication.findMany.mockResolvedValue([]);
    prismaMock.visaApplication.count.mockResolvedValue(0);
    await listVisaApplications(EMPLOYEE_SCOPE, { filters: { submittedFrom: "bad", submittedTo: "also-bad" } });
    expect(prismaMock.visaApplication.findMany.mock.calls[0][0].where.submittedAt).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// List — pagination
// ─────────────────────────────────────────────

describe("listVisaApplications — pagination", () => {
  it("defaults to page 1, pageSize 20", async () => {
    prismaMock.visaApplication.findMany.mockResolvedValue([]);
    prismaMock.visaApplication.count.mockResolvedValue(0);
    const result = await listVisaApplications(EMPLOYEE_SCOPE, {});
    expect(prismaMock.visaApplication.findMany.mock.calls[0][0].skip).toBe(0);
    expect(prismaMock.visaApplication.findMany.mock.calls[0][0].take).toBe(20);
    expect(result.totalPages).toBe(1);
  });

  it("clamps pageSize to 100", async () => {
    prismaMock.visaApplication.findMany.mockResolvedValue([]);
    prismaMock.visaApplication.count.mockResolvedValue(0);
    await listVisaApplications(EMPLOYEE_SCOPE, { pageSize: 5000 });
    expect(prismaMock.visaApplication.findMany.mock.calls[0][0].take).toBe(100);
  });
});

// ─────────────────────────────────────────────
// Detail — relationship loading
// ─────────────────────────────────────────────

describe("getVisaById — relationship loading", () => {
  it("loads application + student + country + documents + stageHistory", async () => {
    prismaMock.visaApplication.findFirst.mockResolvedValue({
      id: "v1", visaType: "Student Visa", stage: "SUBMITTED",
      submittedAt: new Date(), biometricsAt: null, interviewAt: null,
      decisionAt: null, decisionReason: null, notes: null,
      createdAt: new Date(), updatedAt: new Date(),
      application: {
        id: "a1", applicationNumber: "APP-001", stageKey: "VISA_SUBMITTED", status: "NEW",
        student: { id: "s1", firstName: "Karim", lastName: "Ahmed", studentId: "STD-1", email: "k@x.com" },
        country: { id: "c1", name: "Germany", flag: "🇩🇪" },
        university: { name: "TU Munich" },
        documents: [{ id: "d1", name: "Passport", status: "APPROVED", documentType: "PASSPORT", uploadedAt: new Date(), reviewedAt: new Date() }],
      },
      assignedEmployee: { id: "emp-1", user: { name: "Counselor" } },
      stageHistory: [{ id: "h1", fromStage: "PREPARATION", toStage: "SUBMITTED", note: "Submitted", changedById: "u-emp", createdAt: new Date() }],
    });
    prismaMock.user.findMany.mockResolvedValue([{ id: "u-emp", name: "Counselor" }]);
    prismaMock.appointment.findMany.mockResolvedValue([]);
    prismaMock.visaRequirement.findMany.mockResolvedValue([{ id: "r1", name: "Passport", description: "Valid passport", required: true }]);

    const result = await getVisaById(EMPLOYEE_SCOPE, "v1");
    expect(result).not.toBeNull();
    expect(result?.application.student.firstName).toBe("Karim");
    expect(result?.documents).toHaveLength(1);
    expect(result?.stageHistory[0].changedByName).toBe("Counselor");
    expect(result?.requirements).toHaveLength(1);
    expect(result?.assignedEmployee?.name).toBe("Counselor");
  });
});

// ─────────────────────────────────────────────
// Status change — validation + history + notifications + audit
// ─────────────────────────────────────────────

describe("changeVisaStage", () => {
  it("rejects an invalid stage with 400", async () => {
    await expect(changeVisaStage(EMPLOYEE_SCOPE, "v1", "INVALID", { id: "u-1" })).rejects.toMatchObject({ status: 400, code: "BAD_REQUEST" });
  });

  it("returns a no-op when the stage is the same", async () => {
    prismaMock.visaApplication.findFirst.mockResolvedValue({ id: "v1", stage: "PREPARATION", applicationId: "a1" });
    const result = await changeVisaStage(EMPLOYEE_SCOPE, "v1", "PREPARATION", { id: "u-1" });
    expect(result.fromStage).toBe("PREPARATION");
    expect(result.toStage).toBe("PREPARATION");
    expect(result.historyId).toBe("");
  });

  it("blocks a forward skip (PREPARATION → APPROVED) with 422", async () => {
    prismaMock.visaApplication.findFirst.mockResolvedValue({ id: "v1", stage: "PREPARATION", applicationId: "a1" });
    await expect(changeVisaStage(EMPLOYEE_SCOPE, "v1", "APPROVED", { id: "u-1" })).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("blocks a transition from a terminal stage (APPROVED → REFUSED) with 422", async () => {
    prismaMock.visaApplication.findFirst.mockResolvedValue({ id: "v1", stage: "APPROVED", applicationId: "a1" });
    await expect(changeVisaStage(EMPLOYEE_SCOPE, "v1", "REFUSED", { id: "u-1" })).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });

  it("updates + creates history row on valid transition", async () => {
    prismaMock.visaApplication.findFirst.mockResolvedValue({ id: "v1", stage: "PREPARATION", applicationId: "a1" });
    prismaMock.$transaction.mockResolvedValue([{}, { id: "hist-1" }]);
    prismaMock.application.findFirst.mockResolvedValue({ student: { userId: "u-stu", firstName: "K", lastName: "A" } });
    const result = await changeVisaStage(EMPLOYEE_SCOPE, "v1", "SUBMITTED", { id: "u-emp" }, "Submitted to embassy");
    expect(result.fromStage).toBe("PREPARATION");
    expect(result.toStage).toBe("SUBMITTED");
    expect(result.historyId).toBe("hist-1");
  });

  it("emits a notification to the student", async () => {
    prismaMock.visaApplication.findFirst.mockResolvedValue({ id: "v1", stage: "PREPARATION", applicationId: "a1" });
    prismaMock.$transaction.mockResolvedValue([{}, { id: "hist-1" }]);
    prismaMock.application.findFirst.mockResolvedValue({ student: { userId: "u-stu", firstName: "K", lastName: "A" } });
    await changeVisaStage(EMPLOYEE_SCOPE, "v1", "SUBMITTED", { id: "u-emp" });
    expect(prismaMock.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: "u-stu", type: "VISA_STAGE_CHANGED" }),
    }));
  });

  it("emits an audit log for decision stages (APPROVED)", async () => {
    prismaMock.visaApplication.findFirst.mockResolvedValue({ id: "v1", stage: "PROCESSING", applicationId: "a1" });
    prismaMock.$transaction.mockResolvedValue([{}, { id: "hist-1" }]);
    prismaMock.application.findFirst.mockResolvedValue({ student: { userId: "u-stu", firstName: "K", lastName: "A" } });
    await changeVisaStage(EMPLOYEE_SCOPE, "v1", "APPROVED", { id: "u-emp" }, "Visa approved!");
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: "u-emp", action: "visa.stage_changed", entity: "VisaApplication",
        oldValue: { stage: "PROCESSING" }, newValue: { stage: "APPROVED", note: "Visa approved!" },
      }),
    }));
  });

  it("skips audit log for non-decision transitions (PREPARATION → SUBMITTED)", async () => {
    prismaMock.visaApplication.findFirst.mockResolvedValue({ id: "v1", stage: "PREPARATION", applicationId: "a1" });
    prismaMock.$transaction.mockResolvedValue([{}, { id: "hist-1" }]);
    prismaMock.application.findFirst.mockResolvedValue({ student: { userId: "u-stu", firstName: "K", lastName: "A" } });
    await changeVisaStage(EMPLOYEE_SCOPE, "v1", "SUBMITTED", { id: "u-emp" });
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it("IDOR: foreign visa application returns 404", async () => {
    prismaMock.visaApplication.findFirst.mockResolvedValue(null);
    await expect(changeVisaStage(EMPLOYEE_SCOPE, "visa-foreign", "SUBMITTED", { id: "u-1" })).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

// ─────────────────────────────────────────────
// Transition previews
// ─────────────────────────────────────────────

describe("getVisaTransitionPreviews", () => {
  it("returns previews for every non-current stage", async () => {
    prismaMock.visaApplication.findFirst.mockResolvedValue({ id: "v1", stage: "PREPARATION" });
    const result = await getVisaTransitionPreviews(EMPLOYEE_SCOPE, "v1");
    expect(result.currentStage).toBe("PREPARATION");
    expect(result.previews).toHaveLength(8); // 9 - 1 current
    const submitted = result.previews.find((p) => p.toStage === "SUBMITTED");
    expect(submitted?.allowed).toBe(true);
    const approved = result.previews.find((p) => p.toStage === "APPROVED");
    expect(approved?.allowed).toBe(false);
  });

  it("throws 404 for foreign visa application (IDOR)", async () => {
    prismaMock.visaApplication.findFirst.mockResolvedValue(null);
    await expect(getVisaTransitionPreviews(EMPLOYEE_SCOPE, "visa-foreign")).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});

// ─────────────────────────────────────────────
// Error propagation
// ─────────────────────────────────────────────

describe("error propagation", () => {
  it("listVisaApplications lets prisma errors bubble", async () => {
    prismaMock.visaApplication.findMany.mockRejectedValue(new Error("DB lost"));
    prismaMock.visaApplication.count.mockResolvedValue(0);
    await expect(listVisaApplications(EMPLOYEE_SCOPE, {})).rejects.toThrow("DB lost");
  });

  it("getVisaById lets prisma errors bubble", async () => {
    prismaMock.visaApplication.findFirst.mockRejectedValue(new Error("findFirst failed"));
    await expect(getVisaById(EMPLOYEE_SCOPE, "v1")).rejects.toThrow("findFirst failed");
  });
});
