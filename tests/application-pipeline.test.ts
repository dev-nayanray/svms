import { describe, it, expect } from "vitest";
import {
  CANONICAL_PIPELINE,
  computeStageStates,
  computeProgressPercent,
  deriveStudentNextAction,
  titleCaseStage,
} from "@/lib/utils/application-pipeline";

// Use the canonical pipeline as the stages input for tests.
const stages = CANONICAL_PIPELINE.map((s) => ({ ...s }));
const n = stages.length; // 18

describe("computeStageStates", () => {
  it("marks everything as upcoming when the current stage is null", () => {
    const r = computeStageStates(null, stages);
    expect(r.length).toBe(n);
    for (const s of r) expect(s.state).toBe("upcoming");
  });

  it("marks everything as upcoming when the current stage is unknown", () => {
    const r = computeStageStates("UNKNOWN_STAGE", stages);
    for (const s of r) expect(s.state).toBe("upcoming");
  });

  it("marks the current stage as current and prior stages as completed (no history)", () => {
    // Without history, we optimistically assume the app went straight
    // through. So everything before the current stage is "completed".
    const r = computeStageStates("DEPOSIT_PAYMENT", stages);
    const currentIdx = r.findIndex((s) => s.key === "DEPOSIT_PAYMENT");
    expect(r[currentIdx].state).toBe("current");
    for (let i = 0; i < currentIdx; i++) {
      expect(r[i].state).toBe("completed");
    }
    for (let i = currentIdx + 1; i < r.length; i++) {
      expect(r[i].state).toBe("upcoming");
    }
  });

  it("marks skipped stages when history shows the app jumped over them", () => {
    // Application went LEAD → COUNSELING → APPLICATION_SUBMITTED (jumped
    // over PROFILE_ASSESSMENT, COUNTRY_SELECTION, etc.).
    const history = [
      { toStage: "LEAD" },
      { toStage: "COUNSELING" },
      { toStage: "APPLICATION_SUBMITTED" },
    ];
    const r = computeStageStates("APPLICATION_SUBMITTED", stages, history);
    expect(r.find((s) => s.key === "LEAD")?.state).toBe("completed");
    expect(r.find((s) => s.key === "COUNSELING")?.state).toBe("completed");
    expect(r.find((s) => s.key === "PROFILE_ASSESSMENT")?.state).toBe("skipped");
    expect(r.find((s) => s.key === "COUNTRY_SELECTION")?.state).toBe("skipped");
    expect(r.find((s) => s.key === "APPLICATION_SUBMITTED")?.state).toBe("current");
    expect(r.find((s) => s.key === "CONDITIONAL_OFFER")?.state).toBe("upcoming");
  });

  it("treats the current stage as always reached even if missing from history", () => {
    // History doesn't include the current stage — but the current is
    // always implicitly "reached" (otherwise how would we be here?).
    const r = computeStageStates("VISA_DECISION", stages, []);
    const currentIdx = r.findIndex((s) => s.key === "VISA_DECISION");
    expect(r[currentIdx].state).toBe("current");
    // Everything before is optimistically "completed" (no history).
    for (let i = 0; i < currentIdx; i++) {
      expect(r[i].state).toBe("completed");
    }
    // Everything after is "upcoming".
    for (let i = currentIdx + 1; i < r.length; i++) {
      expect(r[i].state).toBe("upcoming");
    }
  });

  it("marks COMPLETED as current and everything before as completed/skipped", () => {
    const history = stages.map((s) => ({ toStage: s.key }));
    const r = computeStageStates("COMPLETED", stages, history);
    expect(r[r.length - 1].state).toBe("current");
    for (let i = 0; i < r.length - 1; i++) {
      expect(r[i].state).toBe("completed");
    }
  });

  it("falls back to CANONICAL_PIPELINE when stages arg is empty", () => {
    const r = computeStageStates("LEAD", []);
    expect(r.length).toBe(n);
    expect(r[0].state).toBe("current");
  });

  it("respects the `enabled` filter — disabled stages don't appear", () => {
    const stagesWithDisabled = stages.map((s, i) =>
      i === 5 ? { ...s, enabled: false } : s, // disable DOCUMENT_COLLECTION
    );
    const r = computeStageStates("APPLICATION_SUBMITTED", stagesWithDisabled);
    expect(r.find((s) => s.key === "DOCUMENT_COLLECTION")).toBeUndefined();
    // Total length should be 17 (one disabled)
    expect(r.length).toBe(n - 1);
  });
});

describe("computeProgressPercent", () => {
  it("returns 0% when the current stage is null", () => {
    expect(computeProgressPercent(null, stages).percent).toBe(0);
  });

  it("returns 0% when the current stage is unknown", () => {
    expect(computeProgressPercent("UNKNOWN", stages).percent).toBe(0);
  });

  it("returns the right percent for the first stage (LEAD)", () => {
    // 1 of 18 → ~6%
    expect(computeProgressPercent("LEAD", stages).percent).toBe(Math.round((1 / n) * 100));
  });

  it("returns the right percent for the last stage (COMPLETED)", () => {
    // 18 of 18 → 100%
    expect(computeProgressPercent("COMPLETED", stages).percent).toBe(100);
    expect(computeProgressPercent("COMPLETED", stages).isComplete).toBe(true);
  });

  it("returns the right percent for a middle stage (DEPOSIT_PAYMENT)", () => {
    // 10 of 18
    expect(computeProgressPercent("DEPOSIT_PAYMENT", stages).percent).toBe(Math.round((10 / n) * 100));
  });

  it("returns -1 currentIndex when stages is empty AND no fallback", () => {
    // Note: empty array triggers CANONICAL_PIPELINE fallback, so this
    // tests passing `null` as currentStageKey with an empty array.
    expect(computeProgressPercent(null, []).currentIndex).toBe(-1);
  });

  it("isComplete is true only for COMPLETED", () => {
    expect(computeProgressPercent("VISA_DECISION", stages).isComplete).toBe(false);
    expect(computeProgressPercent("COMPLETED", stages).isComplete).toBe(true);
  });

  it("passed = currentIndex (stages strictly before the current one)", () => {
    const r = computeProgressPercent("DEPOSIT_PAYMENT", stages);
    const idx = stages.findIndex((s) => s.key === "DEPOSIT_PAYMENT");
    expect(r.passed).toBe(idx);
    expect(r.currentIndex).toBe(idx);
  });

  it("falls back to CANONICAL_PIPELINE when stages arg is empty", () => {
    const r = computeProgressPercent("LEAD", []);
    expect(r.total).toBe(n);
    expect(r.currentIndex).toBe(0);
    expect(r.percent).toBe(Math.round((1 / n) * 100));
  });
});

describe("deriveStudentNextAction", () => {
  const baseInput = {
    pendingDocuments: [],
    openInvoices: [],
    openTasks: [],
    hasCounselor: true,
    applicationId: "app-1",
  };

  it("prioritizes pending documents (HIGH)", () => {
    const a = deriveStudentNextAction({
      ...baseInput,
      pendingDocuments: [{ id: "d1", name: "Passport" }],
      openInvoices: [{ id: "i1", invoiceNumber: "INV-1", dueAmount: 100, dueDate: new Date() }],
      openTasks: [{ id: "t1", title: "Sign form", dueDate: null }],
    });
    expect(a.title).toBe("Upload: Passport");
    expect(a.priority).toBe("HIGH");
    expect(a.ctaHref).toBe("/student/documents");
  });

  it("prioritizes open invoices when no pending docs (HIGH if overdue)", () => {
    const past = new Date(Date.now() - 86400000); // yesterday
    const a = deriveStudentNextAction({
      ...baseInput,
      openInvoices: [{ id: "i1", invoiceNumber: "INV-1", dueAmount: 100, dueDate: past }],
      openTasks: [{ id: "t1", title: "Sign form", dueDate: null }],
    });
    expect(a.title).toBe("Pay INV-1");
    expect(a.priority).toBe("HIGH");
  });

  it("uses MEDIUM for non-overdue invoices", () => {
    const future = new Date(Date.now() + 86400000 * 7); // next week
    const a = deriveStudentNextAction({
      ...baseInput,
      openInvoices: [{ id: "i1", invoiceNumber: "INV-1", dueAmount: 100, dueDate: future }],
    });
    expect(a.priority).toBe("MEDIUM");
  });

  it("prioritizes open tasks when no docs/invoices (HIGH if overdue)", () => {
    const past = new Date(Date.now() - 1000);
    const a = deriveStudentNextAction({
      ...baseInput,
      openTasks: [{ id: "t1", title: "Submit form", dueDate: past }],
    });
    expect(a.title).toBe("Submit form");
    expect(a.priority).toBe("HIGH");
    expect(a.ctaHref).toBe("/student/tasks");
  });

  it("falls back to 'message your counselor' (LOW) when no blockers", () => {
    const a = deriveStudentNextAction(baseInput);
    expect(a.title).toBe("Message your counselor");
    expect(a.priority).toBe("LOW");
    expect(a.ctaHref).toBe("/student/messages");
  });

  it("falls back to 'view application details' (LOW) when no counselor", () => {
    const a = deriveStudentNextAction({ ...baseInput, hasCounselor: false });
    expect(a.title).toBe("View application details");
    expect(a.priority).toBe("LOW");
  });

  it("picks the most-overdue invoice when multiple are open", () => {
    const farPast = new Date(Date.now() - 86400000 * 10);
    const past = new Date(Date.now() - 86400000);
    const a = deriveStudentNextAction({
      ...baseInput,
      openInvoices: [
        { id: "i1", invoiceNumber: "INV-1", dueAmount: 100, dueDate: past },
        { id: "i2", invoiceNumber: "INV-2", dueAmount: 200, dueDate: farPast },
      ],
    });
    expect(a.title).toBe("Pay INV-2"); // older due date first
  });
});

describe("titleCaseStage", () => {
  it("title-cases underscored stage keys", () => {
    expect(titleCaseStage("VISA_DECISION")).toBe("Visa Decision");
    expect(titleCaseStage("APPLICATION_SUBMITTED")).toBe("Application Submitted");
    expect(titleCaseStage("LEAD")).toBe("Lead");
    expect(titleCaseStage("PROFILE_ASSESSMENT")).toBe("Profile Assessment");
  });

  it("returns '—' for null/undefined", () => {
    expect(titleCaseStage(null)).toBe("—");
    expect(titleCaseStage(undefined)).toBe("—");
    expect(titleCaseStage("")).toBe("—");
  });
});

describe("CANONICAL_PIPELINE", () => {
  it("has 18 stages in the right order", () => {
    expect(CANONICAL_PIPELINE.length).toBe(18);
    expect(CANONICAL_PIPELINE[0].key).toBe("LEAD");
    expect(CANONICAL_PIPELINE[17].key).toBe("COMPLETED");
  });

  it("has monotonically increasing sortOrder", () => {
    for (let i = 1; i < CANONICAL_PIPELINE.length; i++) {
      expect(CANONICAL_PIPELINE[i].sortOrder).toBeGreaterThan(CANONICAL_PIPELINE[i - 1].sortOrder);
    }
  });
});
