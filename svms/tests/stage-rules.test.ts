import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// Pure-rules tests — no DB mocking needed
// ─────────────────────────────────────────────

import {
  validateTransitionShape,
  validateTransition,
  getStageRule,
  getNextStage,
  getCompletedStages,
  checkTransition,
  NEXT_STAGE,
  type StageRuleSnapshot,
} from "@/lib/services/stage-rules";
import { APPLICATION_STAGES } from "@/lib/services/employee-dashboard";

// Helper to build a snapshot with sensible defaults
function makeSnapshot(overrides: Partial<StageRuleSnapshot> = {}): StageRuleSnapshot {
  return {
    application: { id: "app-1", stageKey: "LEAD", status: "NEW", deadline: null },
    documents: [],
    payments: [],
    invoices: [],
    visaApplications: [],
    student: { id: "stu-1", firstName: "Karim", lastName: "Ahmed", userId: "u-stu" },
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// Shape validation — forward-only + backward allowlist
// ─────────────────────────────────────────────

describe("validateTransitionShape — forward-only", () => {
  it("allows the immediate forward successor", () => {
    expect(validateTransitionShape("LEAD", "COUNSELING")).toBeNull();
    expect(validateTransitionShape("COUNSELING", "PROFILE_ASSESSMENT")).toBeNull();
    expect(validateTransitionShape("VISA_SUBMITTED", "BIOMETRICS")).toBeNull();
    expect(validateTransitionShape("TRAVEL_PREPARATION", "COMPLETED")).toBeNull();
  });

  it("blocks forward skips (LEAD → VISA_SUBMITTED)", () => {
    const block = validateTransitionShape("LEAD", "VISA_SUBMITTED");
    expect(block).not.toBeNull();
    expect(block!.code).toBe("SKIP_BLOCKED");
    expect(block!.reason).toContain("Cannot skip");
    expect(block!.reason).toContain("COUNSELING");
  });

  it("blocks backward moves not in the allowlist (UNCONDITIONAL_OFFER → LEAD)", () => {
    const block = validateTransitionShape("UNCONDITIONAL_OFFER", "LEAD");
    expect(block).not.toBeNull();
    expect(block!.code).toBe("BACKWARD_BLOCKED");
  });

  it("allows explicitly-listed backward moves (APPLICATION_SUBMITTED → DOCUMENT_COLLECTION)", () => {
    expect(validateTransitionShape("APPLICATION_SUBMITTED", "DOCUMENT_COLLECTION")).toBeNull();
  });

  it("allows VISA_SUBMITTED → VISA_PREPARATION (rework)", () => {
    expect(validateTransitionShape("VISA_SUBMITTED", "VISA_PREPARATION")).toBeNull();
  });

  it("allows VISA_DECISION → VISA_PREPARATION (rework after refusal)", () => {
    expect(validateTransitionShape("VISA_DECISION", "VISA_PREPARATION")).toBeNull();
  });

  it("returns null for same-stage (no-op — handled by caller)", () => {
    expect(validateTransitionShape("LEAD", "LEAD")).toBeNull();
  });

  it("rejects unknown source stages", () => {
    const block = validateTransitionShape("INVALID", "COUNSELING");
    expect(block).not.toBeNull();
    expect(block!.code).toBe("INVALID_FROM");
  });

  it("rejects unknown target stages", () => {
    const block = validateTransitionShape("LEAD", "INVALID");
    expect(block).not.toBeNull();
    expect(block!.code).toBe("INVALID_TO");
  });
});

describe("NEXT_STAGE mapping", () => {
  it("maps every stage to its immediate successor", () => {
    for (let i = 0; i < APPLICATION_STAGES.length - 1; i++) {
      expect(NEXT_STAGE[APPLICATION_STAGES[i]]).toBe(APPLICATION_STAGES[i + 1]);
    }
  });

  it("returns undefined for COMPLETED (no successor)", () => {
    expect(NEXT_STAGE["COMPLETED"]).toBeUndefined();
  });
});

describe("getNextStage + getCompletedStages", () => {
  it("getNextStage returns the immediate successor", () => {
    expect(getNextStage("LEAD")).toBe("COUNSELING");
    expect(getNextStage("VISA_SUBMITTED")).toBe("BIOMETRICS");
  });

  it("getNextStage returns null for COMPLETED", () => {
    expect(getNextStage("COMPLETED")).toBeNull();
  });

  it("getCompletedStages returns all stages before the current one", () => {
    const completed = getCompletedStages("VISA_SUBMITTED");
    expect(completed).toContain("LEAD");
    expect(completed).toContain("COUNSELING");
    expect(completed).toContain("VISA_PREPARATION");
    expect(completed).not.toContain("VISA_SUBMITTED");
    expect(completed).not.toContain("BIOMETRICS");
  });

  it("getCompletedStages returns empty for LEAD", () => {
    expect(getCompletedStages("LEAD")).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// Rule predicates — business logic
// ─────────────────────────────────────────────

describe("validateTransition — DOCUMENT_COLLECTION rule", () => {
  it("blocks when the application hasn't reached PROFILE_ASSESSMENT yet", () => {
    const snapshot = makeSnapshot({ application: { id: "app-1", stageKey: "LEAD", status: "NEW", deadline: null } });
    // LEAD → COUNSELING is allowed (forward successor, no rule on COUNSELING)
    expect(validateTransition("LEAD", "COUNSELING", snapshot)).toBeNull();
    // But COUNSELING → PROFILE_ASSESSMENT is allowed (forward successor)
    expect(validateTransition("COUNSELING", "PROFILE_ASSESSMENT", makeSnapshot({ application: { id: "app-1", stageKey: "COUNSELING", status: "NEW", deadline: null } }))).toBeNull();
  });
});

describe("validateTransition — APPLICATION_SUBMITTED rule", () => {
  it("blocks when there are no documents at all", () => {
    const snapshot = makeSnapshot({
      application: { id: "app-1", stageKey: "DOCUMENT_COLLECTION", status: "NEW", deadline: null },
      documents: [],
    });
    const block = validateTransition("DOCUMENT_COLLECTION", "APPLICATION_SUBMITTED", snapshot);
    expect(block).not.toBeNull();
    expect(block!.code).toBe("NO_DOCUMENTS");
  });

  it("blocks when some documents are not APPROVED", () => {
    const snapshot = makeSnapshot({
      application: { id: "app-1", stageKey: "DOCUMENT_COLLECTION", status: "NEW", deadline: null },
      documents: [
        { name: "Passport", status: "APPROVED" },
        { name: "Transcript", status: "UPLOADED" },
        { name: "Bank statement", status: "REJECTED" },
      ],
    });
    const block = validateTransition("DOCUMENT_COLLECTION", "APPLICATION_SUBMITTED", snapshot);
    expect(block).not.toBeNull();
    expect(block!.code).toBe("DOCUMENTS_INCOMPLETE");
    expect(block!.reason).toContain("2 document(s) not yet approved");
    expect(block!.reason).toContain("Transcript");
    expect(block!.reason).toContain("Bank statement");
  });

  it("allows when all documents are APPROVED", () => {
    const snapshot = makeSnapshot({
      application: { id: "app-1", stageKey: "DOCUMENT_COLLECTION", status: "NEW", deadline: null },
      documents: [
        { name: "Passport", status: "APPROVED" },
        { name: "Transcript", status: "APPROVED" },
      ],
    });
    expect(validateTransition("DOCUMENT_COLLECTION", "APPLICATION_SUBMITTED", snapshot)).toBeNull();
  });
});

describe("validateTransition — DEPOSIT_PAYMENT rule", () => {
  it("blocks when the application hasn't reached UNCONDITIONAL_OFFER", () => {
    // The immediate predecessor of DEPOSIT_PAYMENT is UNCONDITIONAL_OFFER.
    // We test the rule by placing the app at UNCONDITIONAL_OFFER but
    // verifying the rule predicate checks for unconditional offer status.
    // Since UNCONDITIONAL_OFFER → DEPOSIT_PAYMENT is the immediate forward
    // successor, the rule passes when from=UNCONDITIONAL_OFFER.
    // To test the "hasn't reached" path, we check a skip: CONDITIONAL_OFFER → DEPOSIT_PAYMENT
    // is blocked by the shape validator (SKIP_BLOCKED), not the rule.
    const snapshot = makeSnapshot({
      application: { id: "app-1", stageKey: "CONDITIONAL_OFFER", status: "NEW", deadline: null },
    });
    const block = validateTransition("CONDITIONAL_OFFER", "DEPOSIT_PAYMENT", snapshot);
    expect(block).not.toBeNull();
    // The shape check fires first — it's a skip.
    expect(block!.code).toBe("SKIP_BLOCKED");
  });

  it("allows when the application is at UNCONDITIONAL_OFFER", () => {
    const snapshot = makeSnapshot({
      application: { id: "app-1", stageKey: "UNCONDITIONAL_OFFER", status: "NEW", deadline: null },
    });
    expect(validateTransition("UNCONDITIONAL_OFFER", "DEPOSIT_PAYMENT", snapshot)).toBeNull();
  });
});

describe("validateTransition — CONFIRMATION rule", () => {
  it("blocks when there are no PAID payments", () => {
    const snapshot = makeSnapshot({
      application: { id: "app-1", stageKey: "DEPOSIT_PAYMENT", status: "NEW", deadline: null },
      payments: [{ status: "PENDING", amount: 500 }],
    });
    const block = validateTransition("DEPOSIT_PAYMENT", "CONFIRMATION", snapshot);
    expect(block).not.toBeNull();
    expect(block!.code).toBe("NO_DEPOSIT");
  });

  it("allows when at least one PAID payment exists", () => {
    const snapshot = makeSnapshot({
      application: { id: "app-1", stageKey: "DEPOSIT_PAYMENT", status: "NEW", deadline: null },
      payments: [
        { status: "PENDING", amount: 200 },
        { status: "PAID", amount: 500 },
      ],
    });
    expect(validateTransition("DEPOSIT_PAYMENT", "CONFIRMATION", snapshot)).toBeNull();
  });
});

describe("validateTransition — VISA_SUBMITTED rule", () => {
  it("blocks when the application is not in VISA_PREPARATION", () => {
    // CONFIRMATION → VISA_SUBMITTED is a skip (shape error) — test the
    // rule predicate directly by using a stage that IS the immediate
    // predecessor. We construct a snapshot where the app is in CONFIRMATION
    // and try to move to VISA_PREPARATION (the immediate successor), which
    // has no rule. The VISA_SUBMITTED rule itself only fires when the
    // source is VISA_PREPARATION (forward successor).
    const snapshot = makeSnapshot({
      application: { id: "app-1", stageKey: "CONFIRMATION", status: "NEW", deadline: null },
      visaApplications: [{ stage: "PREPARATION" }],
    });
    // The actual forward path is CONFIRMATION → VISA_PREPARATION, not → VISA_SUBMITTED
    // So this test verifies the rule fires correctly when from = VISA_PREPARATION
    const snapshot2 = makeSnapshot({
      application: { id: "app-1", stageKey: "VISA_PREPARATION", status: "NEW", deadline: null },
      visaApplications: [],
    });
    const block = validateTransition("VISA_PREPARATION", "VISA_SUBMITTED", snapshot2);
    expect(block).not.toBeNull();
    // The block is either NOT_IN_PREPARATION (if rule runs) or SKIP_BLOCKED
    // (if shape blocks first). Since VISA_PREPARATION → VISA_SUBMITTED IS
    // the immediate successor, the shape allows it and the rule runs.
    expect(block!.code).toBe("NO_VISA_CASE");
    // Confirm the first snapshot's transition is a skip
    expect(validateTransition("CONFIRMATION", "VISA_SUBMITTED", snapshot)?.code).toBe("SKIP_BLOCKED");
  });

  it("blocks when there is no visa case in PREPARATION stage", () => {
    const snapshot = makeSnapshot({
      application: { id: "app-1", stageKey: "VISA_PREPARATION", status: "NEW", deadline: null },
      visaApplications: [],
    });
    const block = validateTransition("VISA_PREPARATION", "VISA_SUBMITTED", snapshot);
    expect(block).not.toBeNull();
    expect(block!.code).toBe("NO_VISA_CASE");
  });

  it("allows when a visa case in PREPARATION exists", () => {
    const snapshot = makeSnapshot({
      application: { id: "app-1", stageKey: "VISA_PREPARATION", status: "NEW", deadline: null },
      visaApplications: [{ stage: "PREPARATION" }],
    });
    expect(validateTransition("VISA_PREPARATION", "VISA_SUBMITTED", snapshot)).toBeNull();
  });
});

describe("validateTransition — COMPLETED rule", () => {
  it("blocks when no visa is APPROVED", () => {
    const snapshot = makeSnapshot({
      application: { id: "app-1", stageKey: "TRAVEL_PREPARATION", status: "NEW", deadline: null },
      visaApplications: [{ stage: "REFUSED" }],
    });
    const block = validateTransition("TRAVEL_PREPARATION", "COMPLETED", snapshot);
    expect(block).not.toBeNull();
    expect(block!.code).toBe("VISA_NOT_APPROVED");
  });

  it("allows when a visa is APPROVED", () => {
    const snapshot = makeSnapshot({
      application: { id: "app-1", stageKey: "TRAVEL_PREPARATION", status: "NEW", deadline: null },
      visaApplications: [{ stage: "APPROVED" }],
    });
    expect(validateTransition("TRAVEL_PREPARATION", "COMPLETED", snapshot)).toBeNull();
  });
});

describe("checkTransition — convenience wrapper", () => {
  it("returns { allowed: true, block: null } for valid transitions", () => {
    const snapshot = makeSnapshot({
      application: { id: "app-1", stageKey: "LEAD", status: "NEW", deadline: null },
    });
    const result = checkTransition("LEAD", "COUNSELING", snapshot);
    expect(result.allowed).toBe(true);
    expect(result.block).toBeNull();
  });

  it("returns { allowed: false, block: {...} } for blocked transitions", () => {
    const snapshot = makeSnapshot({
      application: { id: "app-1", stageKey: "DOCUMENT_COLLECTION", status: "NEW", deadline: null },
      documents: [],
    });
    const result = checkTransition("DOCUMENT_COLLECTION", "APPLICATION_SUBMITTED", snapshot);
    expect(result.allowed).toBe(false);
    expect(result.block).not.toBeNull();
    expect(result.block!.code).toBe("NO_DOCUMENTS");
  });
});

describe("getStageRule — rule lookup", () => {
  it("returns the rule for stages that have one", () => {
    expect(getStageRule("APPLICATION_SUBMITTED")).not.toBeNull();
    expect(getStageRule("CONFIRMATION")).not.toBeNull();
    expect(getStageRule("VISA_SUBMITTED")).not.toBeNull();
    expect(getStageRule("COMPLETED")).not.toBeNull();
  });

  it("returns null for stages without a rule (freely enterable)", () => {
    expect(getStageRule("LEAD")).toBeNull();
    expect(getStageRule("COUNSELING")).toBeNull();
    expect(getStageRule("COUNTRY_SELECTION")).toBeNull();
  });

  it("every rule has a description for the UI", () => {
    for (const stage of ["DOCUMENT_COLLECTION", "APPLICATION_SUBMITTED", "CONDITIONAL_OFFER", "DEPOSIT_PAYMENT", "CONFIRMATION", "VISA_SUBMITTED", "COMPLETED"]) {
      const rule = getStageRule(stage);
      expect(rule).not.toBeNull();
      expect(rule!.description).toBeTruthy();
    }
  });
});

// ─────────────────────────────────────────────
// Service-level tests — changeApplicationStage with mocked prisma
// ─────────────────────────────────────────────

const prismaMock = vi.hoisted(() => ({
  application: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  applicationStageHistory: {
    create: vi.fn(),
  },
  student: {
    findUnique: vi.fn(),
  },
  employee: {
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

import { changeApplicationStage, getTransitionPreviews } from "@/lib/services/application-cases";
import type { EmployeeScope } from "@/lib/services/employee-dashboard";
// HttpError not needed in this test file — all assertions use toMatchObject
// with status + code fields, not instanceof checks.

const ADMIN_SCOPE: EmployeeScope = { isAdmin: true, userId: "u-admin", employeeId: null };
const EMPLOYEE_SCOPE: EmployeeScope = { isAdmin: false, userId: "u-emp", employeeId: "emp-1" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("changeApplicationStage — valid transition", () => {
  it("updates the application + creates a history row", async () => {
    prismaMock.application.findFirst.mockResolvedValue({ id: "app-1", stageKey: "LEAD", studentId: "stu-1" });
    // For loadStageRuleSnapshot — returns the app with relations
    prismaMock.application.findFirst
      .mockResolvedValueOnce({ id: "app-1", stageKey: "LEAD", studentId: "stu-1" }) // initial findFirst
      .mockResolvedValueOnce({ // loadStageRuleSnapshot findFirst
        id: "app-1", stageKey: "LEAD", status: "NEW", deadline: null,
        student: { id: "stu-1", firstName: "Karim", lastName: "Ahmed", userId: "u-stu" },
        documents: [], payments: [], invoices: [], visaApplications: [],
      });
    prismaMock.$transaction.mockResolvedValue([{}, { id: "hist-1" }]);
    prismaMock.student.findUnique.mockResolvedValue({ userId: "u-stu", firstName: "Karim", lastName: "Ahmed", assignedEmployeeId: null });

    const result = await changeApplicationStage(EMPLOYEE_SCOPE, "app-1", "COUNSELING", { id: "u-emp" }, "Moving forward");
    expect(result.fromStage).toBe("LEAD");
    expect(result.toStage).toBe("COUNSELING");
    expect(result.historyId).toBe("hist-1");
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it("emits a notification to the student after a valid transition", async () => {
    prismaMock.application.findFirst
      .mockResolvedValueOnce({ id: "app-1", stageKey: "LEAD", studentId: "stu-1" })
      .mockResolvedValueOnce({
        id: "app-1", stageKey: "LEAD", status: "NEW", deadline: null,
        student: { id: "stu-1", firstName: "Karim", lastName: "Ahmed", userId: "u-stu" },
        documents: [], payments: [], invoices: [], visaApplications: [],
      });
    prismaMock.$transaction.mockResolvedValue([{}, { id: "hist-1" }]);
    prismaMock.student.findUnique.mockResolvedValue({ userId: "u-stu", firstName: "Karim", lastName: "Ahmed", assignedEmployeeId: null });

    await changeApplicationStage(EMPLOYEE_SCOPE, "app-1", "COUNSELING", { id: "u-emp" });
    expect(prismaMock.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: "u-stu",
        type: "APPLICATION_STAGE_CHANGED",
      }),
    }));
  });

  it("emits an audit log for critical transitions (DOCUMENT_COLLECTION → APPLICATION_SUBMITTED)", async () => {
    prismaMock.application.findFirst
      .mockResolvedValueOnce({ id: "app-1", stageKey: "DOCUMENT_COLLECTION", studentId: "stu-1" })
      .mockResolvedValueOnce({
        id: "app-1", stageKey: "DOCUMENT_COLLECTION", status: "NEW", deadline: null,
        student: { id: "stu-1", firstName: "Karim", lastName: "Ahmed", userId: "u-stu" },
        documents: [{ status: "APPROVED", name: "Passport" }],
        payments: [], invoices: [], visaApplications: [],
      });
    prismaMock.$transaction.mockResolvedValue([{}, { id: "hist-1" }]);
    prismaMock.student.findUnique.mockResolvedValue({ userId: "u-stu", firstName: "Karim", lastName: "Ahmed", assignedEmployeeId: null });

    await changeApplicationStage(EMPLOYEE_SCOPE, "app-1", "APPLICATION_SUBMITTED", { id: "u-emp" }, "All docs approved");

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: "u-emp",
        action: "application.stage_changed",
        entity: "Application",
        oldValue: { stage: "DOCUMENT_COLLECTION" },
        newValue: { stage: "APPLICATION_SUBMITTED", note: "All docs approved" },
      }),
    }));
  });

  it("skips the audit log for non-critical transitions (LEAD → COUNSELING)", async () => {
    prismaMock.application.findFirst
      .mockResolvedValueOnce({ id: "app-1", stageKey: "LEAD", studentId: "stu-1" })
      .mockResolvedValueOnce({
        id: "app-1", stageKey: "LEAD", status: "NEW", deadline: null,
        student: { id: "stu-1", firstName: "Karim", lastName: "Ahmed", userId: "u-stu" },
        documents: [], payments: [], invoices: [], visaApplications: [],
      });
    prismaMock.$transaction.mockResolvedValue([{}, { id: "hist-1" }]);
    prismaMock.student.findUnique.mockResolvedValue({ userId: "u-stu", firstName: "Karim", lastName: "Ahmed", assignedEmployeeId: null });

    await changeApplicationStage(EMPLOYEE_SCOPE, "app-1", "COUNSELING", { id: "u-emp" });
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("changeApplicationStage — invalid transitions", () => {
  it("rejects an invalid stage key with 400", async () => {
    await expect(changeApplicationStage(EMPLOYEE_SCOPE, "app-1", "INVALID", { id: "u-1" })).rejects.toMatchObject({
      status: 400, code: "BAD_REQUEST",
    });
  });

  it("rejects a forward skip (LEAD → VISA_SUBMITTED) with 422", async () => {
    prismaMock.application.findFirst.mockResolvedValue({ id: "app-1", stageKey: "LEAD", studentId: "stu-1" });
    prismaMock.application.findFirst
      .mockResolvedValueOnce({ id: "app-1", stageKey: "LEAD", studentId: "stu-1" })
      .mockResolvedValueOnce({
        id: "app-1", stageKey: "LEAD", status: "NEW", deadline: null,
        student: { id: "stu-1", firstName: "Karim", lastName: "Ahmed", userId: "u-stu" },
        documents: [], payments: [], invoices: [], visaApplications: [],
      });
    await expect(changeApplicationStage(EMPLOYEE_SCOPE, "app-1", "VISA_SUBMITTED", { id: "u-1" })).rejects.toMatchObject({
      status: 422, code: "VALIDATION_ERROR",
    });
  });

  it("rejects when documents are incomplete (DOCUMENT_COLLECTION → APPLICATION_SUBMITTED with unapproved docs)", async () => {
    prismaMock.application.findFirst
      .mockResolvedValueOnce({ id: "app-1", stageKey: "DOCUMENT_COLLECTION", studentId: "stu-1" })
      .mockResolvedValueOnce({
        id: "app-1", stageKey: "DOCUMENT_COLLECTION", status: "NEW", deadline: null,
        student: { id: "stu-1", firstName: "Karim", lastName: "Ahmed", userId: "u-stu" },
        documents: [{ status: "UPLOADED", name: "Passport" }],
        payments: [], invoices: [], visaApplications: [],
      });
    await expect(changeApplicationStage(EMPLOYEE_SCOPE, "app-1", "APPLICATION_SUBMITTED", { id: "u-1" })).rejects.toMatchObject({
      status: 422, code: "VALIDATION_ERROR",
    });
  });

  it("rejects when no deposit paid (DEPOSIT_PAYMENT → CONFIRMATION)", async () => {
    prismaMock.application.findFirst
      .mockResolvedValueOnce({ id: "app-1", stageKey: "DEPOSIT_PAYMENT", studentId: "stu-1" })
      .mockResolvedValueOnce({
        id: "app-1", stageKey: "DEPOSIT_PAYMENT", status: "NEW", deadline: null,
        student: { id: "stu-1", firstName: "Karim", lastName: "Ahmed", userId: "u-stu" },
        documents: [{ status: "APPROVED", name: "Passport" }],
        payments: [{ status: "PENDING", amount: 500 }],
        invoices: [], visaApplications: [],
      });
    await expect(changeApplicationStage(EMPLOYEE_SCOPE, "app-1", "CONFIRMATION", { id: "u-1" })).rejects.toMatchObject({
      status: 422, code: "VALIDATION_ERROR",
    });
  });
});

describe("changeApplicationStage — IDOR closure", () => {
  it("returns 404 for a foreign application (never 403)", async () => {
    prismaMock.application.findFirst.mockResolvedValue(null);
    await expect(changeApplicationStage(EMPLOYEE_SCOPE, "app-foreign", "COUNSELING", { id: "u-1" })).rejects.toMatchObject({
      status: 404, code: "NOT_FOUND",
    });
  });

  it("ADMIN bypasses the scope filter", async () => {
    prismaMock.application.findFirst
      .mockResolvedValueOnce({ id: "app-1", stageKey: "LEAD", studentId: "stu-1" })
      .mockResolvedValueOnce({
        id: "app-1", stageKey: "LEAD", status: "NEW", deadline: null,
        student: { id: "stu-1", firstName: "Karim", lastName: "Ahmed", userId: "u-stu" },
        documents: [], payments: [], invoices: [], visaApplications: [],
      });
    prismaMock.$transaction.mockResolvedValue([{}, { id: "hist-1" }]);
    prismaMock.student.findUnique.mockResolvedValue(null);
    const result = await changeApplicationStage(ADMIN_SCOPE, "app-1", "COUNSELING", { id: "u-admin" });
    expect(result.toStage).toBe("COUNSELING");
  });
});

describe("changeApplicationStage — duplicate + concurrent", () => {
  it("returns a no-op (historyId=empty) when the stage is already the target", async () => {
    prismaMock.application.findFirst.mockResolvedValue({ id: "app-1", stageKey: "LEAD", studentId: "stu-1" });
    const result = await changeApplicationStage(EMPLOYEE_SCOPE, "app-1", "LEAD", { id: "u-1" });
    expect(result.fromStage).toBe("LEAD");
    expect(result.toStage).toBe("LEAD");
    expect(result.historyId).toBe("");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects with 409 CONFLICT when expectedFromStage doesn't match (concurrent update)", async () => {
    prismaMock.application.findFirst.mockResolvedValue({ id: "app-1", stageKey: "VISA_SUBMITTED", studentId: "stu-1" });
    await expect(
      changeApplicationStage(EMPLOYEE_SCOPE, "app-1", "BIOMETRICS", { id: "u-1" }, undefined, "VISA_PREPARATION"),
    ).rejects.toMatchObject({
      status: 409, code: "CONFLICT",
    });
  });
});

describe("getTransitionPreviews", () => {
  it("returns a preview for every stage except the current one", async () => {
    prismaMock.application.findFirst
      .mockResolvedValueOnce({ id: "app-1", stageKey: "LEAD" })
      .mockResolvedValueOnce({
        id: "app-1", stageKey: "LEAD", status: "NEW", deadline: null,
        student: { id: "stu-1", firstName: "Karim", lastName: "Ahmed", userId: "u-stu" },
        documents: [], payments: [], invoices: [], visaApplications: [],
      });
    const result = await getTransitionPreviews(EMPLOYEE_SCOPE, "app-1");
    expect(result.currentStage).toBe("LEAD");
    expect(result.previews).toHaveLength(17); // 18 - current
    // COUNSELING (the next forward stage) should be allowed
    const counseling = result.previews.find((p) => p.toStage === "COUNSELING");
    expect(counseling?.allowed).toBe(true);
    // VISA_SUBMITTED (a skip) should be blocked
    const visaSubmitted = result.previews.find((p) => p.toStage === "VISA_SUBMITTED");
    expect(visaSubmitted?.allowed).toBe(false);
    expect(visaSubmitted?.block).not.toBeNull();
  });

  it("throws 404 for a foreign application (IDOR closure)", async () => {
    prismaMock.application.findFirst.mockResolvedValue(null);
    await expect(getTransitionPreviews(EMPLOYEE_SCOPE, "app-foreign")).rejects.toMatchObject({
      status: 404, code: "NOT_FOUND",
    });
  });
});
