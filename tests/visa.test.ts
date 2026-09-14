import { describe, it, expect } from "vitest";
import {
  VISA_STATUSES,
  VISA_STATUS_LABELS,
  TERMINAL_VISA_STATUSES,
  POSITIVE_DECISION_STATUSES,
  NEGATIVE_DECISION_STATUSES,
  VISA_SORT_KEYS,
  COMMON_VISA_TYPES,
  allowedTransitions,
  canTransition,
  isDecisionStatus,
  isSubmissionStatus,
  isBiometricsStatus,
  isInterviewStatus,
  buildAdminVisaWhere,
} from "@/lib/constants/visa";
import {
  visaApplicationCreateSchema,
  visaApplicationUpdateSchema,
  visaStageChangeSchema,
} from "@/lib/validations";

describe("visa status enums", () => {
  it("exposes the canonical statuses", () => {
    expect(VISA_STATUSES).toEqual([
      "PREPARATION",
      "SUBMITTED",
      "BIOMETRICS",
      "INTERVIEW",
      "PROCESSING",
      "APPROVED",
      "REFUSED",
      "WITHDRAWN",
      "COMPLETED",
    ]);
  });

  it("labels every status", () => {
    expect(VISA_STATUS_LABELS.PREPARATION).toBe("Preparation");
    expect(VISA_STATUS_LABELS.SUBMITTED).toBe("Submitted");
    expect(VISA_STATUS_LABELS.BIOMETRICS).toBe("Biometrics");
    expect(VISA_STATUS_LABELS.INTERVIEW).toBe("Interview");
    expect(VISA_STATUS_LABELS.PROCESSING).toBe("Processing");
    expect(VISA_STATUS_LABELS.APPROVED).toBe("Approved");
    expect(VISA_STATUS_LABELS.REFUSED).toBe("Refused");
    expect(VISA_STATUS_LABELS.WITHDRAWN).toBe("Withdrawn");
    expect(VISA_STATUS_LABELS.COMPLETED).toBe("Completed");
  });

  it("identifies terminal statuses (APPROVED is NOT terminal — can move to COMPLETED)", () => {
    expect(TERMINAL_VISA_STATUSES).toEqual(["REFUSED", "WITHDRAWN", "COMPLETED"]);
  });

  it("identifies positive decision statuses", () => {
    expect(POSITIVE_DECISION_STATUSES).toEqual(["APPROVED", "COMPLETED"]);
  });

  it("identifies negative decision statuses", () => {
    expect(NEGATIVE_DECISION_STATUSES).toEqual(["REFUSED", "WITHDRAWN"]);
  });

  it("exposes a stable sort allow-list", () => {
    expect(VISA_SORT_KEYS).toEqual([
      "stage",
      "submittedAt",
      "biometricsAt",
      "interviewAt",
      "decisionAt",
      "createdAt",
      "updatedAt",
    ]);
  });

  it("exposes common visa types", () => {
    expect(COMMON_VISA_TYPES).toContain("Student Visa (Tier 4)");
    expect(COMMON_VISA_TYPES).toContain("Other");
  });
});

describe("canTransition", () => {
  it("allows forward transitions within the flow", () => {
    expect(canTransition("PREPARATION", "SUBMITTED")).toBe(true);
    expect(canTransition("SUBMITTED", "BIOMETRICS")).toBe(true);
    expect(canTransition("BIOMETRICS", "INTERVIEW")).toBe(true);
    expect(canTransition("INTERVIEW", "PROCESSING")).toBe(true);
    expect(canTransition("PROCESSING", "APPROVED")).toBe(true);
    expect(canTransition("PROCESSING", "REFUSED")).toBe(true);
    expect(canTransition("APPROVED", "COMPLETED")).toBe(true);
  });

  it("allows backward transitions (non-terminal)", () => {
    expect(canTransition("INTERVIEW", "BIOMETRICS")).toBe(true);
    expect(canTransition("PROCESSING", "SUBMITTED")).toBe(true);
  });

  it("allows transition to WITHDRAWN from any non-terminal status", () => {
    expect(canTransition("PREPARATION", "WITHDRAWN")).toBe(true);
    expect(canTransition("SUBMITTED", "WITHDRAWN")).toBe(true);
    expect(canTransition("BIOMETRICS", "WITHDRAWN")).toBe(true);
    expect(canTransition("INTERVIEW", "WITHDRAWN")).toBe(true);
    expect(canTransition("PROCESSING", "WITHDRAWN")).toBe(true);
  });

  it("rejects transitions from terminal statuses", () => {
    // APPROVED is NOT terminal — it can move to COMPLETED
    expect(canTransition("REFUSED", "PROCESSING")).toBe(false);
    expect(canTransition("WITHDRAWN", "PREPARATION")).toBe(false);
    expect(canTransition("COMPLETED", "APPROVED")).toBe(false);
  });

  it("rejects same-status transitions", () => {
    expect(canTransition("PREPARATION", "PREPARATION")).toBe(false);
    expect(canTransition("APPROVED", "APPROVED")).toBe(false);
  });

  it("rejects transitions to unknown statuses", () => {
    expect(canTransition("PREPARATION", "UNKNOWN")).toBe(false);
    expect(canTransition("PREPARATION", "PENDING")).toBe(false);
  });
});

describe("allowedTransitions", () => {
  it("returns an empty array for terminal statuses", () => {
    expect(allowedTransitions("REFUSED")).toEqual([]);
    expect(allowedTransitions("WITHDRAWN")).toEqual([]);
    expect(allowedTransitions("COMPLETED")).toEqual([]);
  });

  it("returns non-empty array for non-terminal statuses (incl. APPROVED)", () => {
    expect(allowedTransitions("PREPARATION").length).toBeGreaterThan(0);
    expect(allowedTransitions("SUBMITTED").length).toBeGreaterThan(0);
    expect(allowedTransitions("PROCESSING").length).toBeGreaterThan(0);
    // APPROVED can transition to COMPLETED — not terminal
    expect(allowedTransitions("APPROVED").length).toBeGreaterThan(0);
  });

  it("excludes the current status from the result", () => {
    const transitions = allowedTransitions("BIOMETRICS");
    expect(transitions).not.toContain("BIOMETRICS");
  });
});

describe("status type checks", () => {
  it("isDecisionStatus identifies decision-point statuses", () => {
    expect(isDecisionStatus("APPROVED")).toBe(true);
    expect(isDecisionStatus("REFUSED")).toBe(true);
    expect(isDecisionStatus("WITHDRAWN")).toBe(true);
    expect(isDecisionStatus("COMPLETED")).toBe(false);
    expect(isDecisionStatus("PREPARATION")).toBe(false);
    expect(isDecisionStatus("SUBMITTED")).toBe(false);
  });

  it("isSubmissionStatus identifies only SUBMITTED", () => {
    expect(isSubmissionStatus("SUBMITTED")).toBe(true);
    expect(isSubmissionStatus("PREPARATION")).toBe(false);
    expect(isSubmissionStatus("BIOMETRICS")).toBe(false);
  });

  it("isBiometricsStatus identifies only BIOMETRICS", () => {
    expect(isBiometricsStatus("BIOMETRICS")).toBe(true);
    expect(isBiometricsStatus("SUBMITTED")).toBe(false);
    expect(isBiometricsStatus("INTERVIEW")).toBe(false);
  });

  it("isInterviewStatus identifies only INTERVIEW", () => {
    expect(isInterviewStatus("INTERVIEW")).toBe(true);
    expect(isInterviewStatus("BIOMETRICS")).toBe(false);
    expect(isInterviewStatus("PROCESSING")).toBe(false);
  });
});

describe("buildAdminVisaWhere", () => {
  it("always filters by deletedAt null", () => {
    const where = buildAdminVisaWhere({});
    expect(where.AND).toContainEqual({ deletedAt: null });
  });

  it("applies stage filter", () => {
    const where = buildAdminVisaWhere({ stage: "APPROVED" });
    expect(where.AND).toContainEqual({ stage: "APPROVED" });
  });

  it("applies applicationId filter", () => {
    const where = buildAdminVisaWhere({ applicationId: "app-1" });
    expect(where.AND).toContainEqual({ applicationId: "app-1" });
  });

  it("applies countryId filter via nested application join", () => {
    const where = buildAdminVisaWhere({ countryId: "c1" });
    expect(where.AND).toContainEqual({ application: { countryId: "c1" } });
  });

  it("applies studentId filter via nested application join", () => {
    const where = buildAdminVisaWhere({ studentId: "s1" });
    expect(where.AND).toContainEqual({ application: { studentId: "s1" } });
  });

  it("applies universityId filter via nested application join", () => {
    const where = buildAdminVisaWhere({ universityId: "u1" });
    expect(where.AND).toContainEqual({ application: { universityId: "u1" } });
  });

  it("searches across application number and student name", () => {
    const where = buildAdminVisaWhere({ search: "SV-2026" });
    expect(where.AND).toContainEqual({
      OR: [
        {
          application: {
            applicationNumber: { contains: "SV-2026", mode: "insensitive" },
          },
        },
        {
          application: {
            student: {
              OR: [
                { firstName: { contains: "SV-2026", mode: "insensitive" } },
                { lastName: { contains: "SV-2026", mode: "insensitive" } },
              ],
            },
          },
        },
      ],
    });
  });

  it("trims whitespace from search", () => {
    const where = buildAdminVisaWhere({ search: "  John  " });
    expect(where.AND).toContainEqual({
      OR: [
        {
          application: {
            applicationNumber: { contains: "John", mode: "insensitive" },
          },
        },
        {
          application: {
            student: {
              OR: [
                { firstName: { contains: "John", mode: "insensitive" } },
                { lastName: { contains: "John", mode: "insensitive" } },
              ],
            },
          },
        },
      ],
    });
  });

  it("combines all filters into a single AND chain", () => {
    const where = buildAdminVisaWhere({
      stage: "APPROVED",
      countryId: "c1",
      studentId: "s1",
      applicationId: "a1",
      universityId: "u1",
      search: "test",
    });
    // 1 (deletedAt) + 1 (stage) + 1 (applicationId) + 1 (countryId) +
    // 1 (studentId) + 1 (universityId) + 1 (search)
    expect(where.AND).toHaveLength(7);
  });
});

describe("visaApplicationCreateSchema", () => {
  it("requires applicationId", () => {
    expect(visaApplicationCreateSchema.safeParse({}).success).toBe(false);
    expect(
      visaApplicationCreateSchema.safeParse({ applicationId: "a1" }).success,
    ).toBe(true);
  });

  it("accepts optional visaType and notes", () => {
    const out = visaApplicationCreateSchema.safeParse({
      applicationId: "a1",
      visaType: "Student Visa (Tier 4)",
      notes: "Some notes",
    });
    expect(out.success).toBe(true);
  });

  it("rejects visaType longer than 200 chars", () => {
    expect(
      visaApplicationCreateSchema.safeParse({
        applicationId: "a1",
        visaType: "a".repeat(201),
      }).success,
    ).toBe(false);
  });

  it("rejects notes longer than 5000 chars", () => {
    expect(
      visaApplicationCreateSchema.safeParse({
        applicationId: "a1",
        notes: "a".repeat(5001),
      }).success,
    ).toBe(false);
  });
});

describe("visaApplicationUpdateSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(visaApplicationUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("accepts partial updates", () => {
    expect(
      visaApplicationUpdateSchema.safeParse({ visaType: "Updated" }).success,
    ).toBe(true);
    expect(
      visaApplicationUpdateSchema.safeParse({ notes: "New note" }).success,
    ).toBe(true);
  });

  it("accepts nullable date fields", () => {
    expect(
      visaApplicationUpdateSchema.safeParse({
        submittedAt: "2026-06-30",
        biometricsAt: null,
      }).success,
    ).toBe(true);
  });

  it("rejects visaType longer than 200 chars", () => {
    expect(
      visaApplicationUpdateSchema.safeParse({ visaType: "a".repeat(201) }).success,
    ).toBe(false);
  });
});

describe("visaStageChangeSchema", () => {
  it("requires a valid stage", () => {
    expect(visaStageChangeSchema.safeParse({}).success).toBe(false);
    expect(
      visaStageChangeSchema.safeParse({ stage: "PREPARATION" }).success,
    ).toBe(true);
  });

  it("accepts all canonical visa statuses", () => {
    for (const status of VISA_STATUSES) {
      expect(
        visaStageChangeSchema.safeParse({ stage: status }).success,
      ).toBe(true);
    }
  });

  it("rejects unknown stages", () => {
    expect(
      visaStageChangeSchema.safeParse({ stage: "PENDING" }).success,
    ).toBe(false);
    expect(
      visaStageChangeSchema.safeParse({ stage: "VISA_PREPARATION" }).success,
    ).toBe(false);
  });

  it("accepts an optional note", () => {
    expect(
      visaStageChangeSchema.safeParse({
        stage: "APPROVED",
        note: "Visa granted",
      }).success,
    ).toBe(true);
  });

  it("rejects notes longer than 2000 chars", () => {
    expect(
      visaStageChangeSchema.safeParse({
        stage: "APPROVED",
        note: "a".repeat(2001),
      }).success,
    ).toBe(false);
  });
});
