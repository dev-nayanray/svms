import { prisma } from "@/lib/db";
import { APPLICATION_STAGES } from "@/lib/services/employee-dashboard";

/**
 * Controlled application stage transitions.
 *
 * Each canonical stage MAY declare a `requires` predicate that runs before
 * the transition is allowed. The predicate receives a snapshot of the
 * application's related data (documents, payments, visa records) and
 * returns either `null` (transition allowed) or a `{ code, reason }`
 * object explaining why the transition is blocked.
 *
 * The predicates are intentionally pure — no side effects, no DB writes.
 * They take a typed snapshot so they're trivially unit-testable.
 *
 * Design choices:
 *  - Forward-only: every stage may only advance to its immediate successor.
 *    Skipping stages (LEAD → VISA_SUBMITTED) is blocked. Backward moves
 *    are allowed only for explicit rework transitions (declared in
 *    `ALLOWED_BACKWARD`).
 *  - Same-stage transitions are no-ops (handled in changeApplicationStage).
 *  - The predicate's `reason` is surfaced to the UI so the employee sees
 *    exactly what's missing.
 */

export type StageRuleSnapshot = {
  application: {
    id: string;
    stageKey: string;
    status: string;
    deadline: Date | null;
  };
  documents: { status: string; name: string }[];
  payments: { status: string; amount: number }[];
  invoices: { status: string; amount: number; dueDate: Date | null }[];
  visaApplications: { stage: string }[];
  student: { id: string; firstName: string; lastName: string; userId: string };
};

export type TransitionBlock = {
  code: string;
  reason: string;
};

export type TransitionRule = {
  /** The stage this rule guards entry INTO. */
  toStage: string;
  /**
   * Predicate returning null when the transition is allowed, or a block
   * reason when it is not. Pure — no side effects.
   */
  requires?: (snapshot: StageRuleSnapshot) => TransitionBlock | null;
  /** Human-readable description of what this rule checks. Shown in the UI. */
  description: string;
};

// ─────────────────────────────────────────────
// Canonical stage order (re-exported from the dashboard service for
// consistency). The 18 stages:
//   LEAD → COUNSELING → PROFILE_ASSESSMENT → COUNTRY_SELECTION →
//   UNIVERSITY_SELECTION → DOCUMENT_COLLECTION → APPLICATION_SUBMITTED →
//   CONDITIONAL_OFFER → UNCONDITIONAL_OFFER → DEPOSIT_PAYMENT →
//   CONFIRMATION → VISA_PREPARATION → VISA_SUBMITTED → BIOMETRICS →
//   INTERVIEW → VISA_DECISION → TRAVEL_PREPARATION → COMPLETED
// ─────────────────────────────────────────────

/** The immediate successor of each stage — forward-only by default. */
export const NEXT_STAGE: Record<string, string | undefined> = Object.fromEntries(
  APPLICATION_STAGES.map((stage, i) => [stage, APPLICATION_STAGES[i + 1]]),
);

/**
 * Explicitly-allowed backward transitions (rework). Each entry maps a
 * (from, to) pair that is permitted even though `to` is earlier than
 * `from` in the canonical order. Anything not listed here is blocked.
 */
export const ALLOWED_BACKWARD: Record<string, string[]> = {
  // Re-collect documents after submission if a new doc is required
  APPLICATION_SUBMITTED: ["DOCUMENT_COLLECTION"],
  // Re-prepare visa if a submission was rejected and needs rework
  VISA_SUBMITTED: ["VISA_PREPARATION"],
  VISA_DECISION: ["VISA_PREPARATION"],
};

// ─────────────────────────────────────────────
// Per-stage entry rules
// ─────────────────────────────────────────────

const RULES: Record<string, TransitionRule> = {
  DOCUMENT_COLLECTION: {
    toStage: "DOCUMENT_COLLECTION",
    description: "Student profile must be assessed before collecting documents",
    requires: (s) => {
      // Pragmatic check: the application must have advanced past PROFILE_ASSESSMENT
      // (we trust the forward-only rule to enforce this, but double-check)
      const idx = APPLICATION_STAGES.indexOf(s.application.stageKey as (typeof APPLICATION_STAGES)[number]);
      const targetIdx = APPLICATION_STAGES.indexOf("PROFILE_ASSESSMENT");
      if (idx < targetIdx) {
        return { code: "PROFILE_NOT_ASSESSED", reason: "Profile assessment must be completed before document collection" };
      }
      return null;
    },
  },
  APPLICATION_SUBMITTED: {
    toStage: "APPLICATION_SUBMITTED",
    description: "All required documents must be approved before submitting the application",
    requires: (s) => {
      // If there are any documents in REQUESTED / UPLOADED / UNDER_REVIEW / REJECTED
      // state, the application cannot be submitted — every required document
      // must be APPROVED first.
      const incomplete = s.documents.filter(
        (d) => d.status !== "APPROVED",
      );
      if (incomplete.length > 0) {
        const names = incomplete.slice(0, 3).map((d) => d.name).join(", ");
        const extra = incomplete.length > 3 ? ` (+${incomplete.length - 3} more)` : "";
        return {
          code: "DOCUMENTS_INCOMPLETE",
          reason: `${incomplete.length} document(s) not yet approved: ${names}${extra}`,
        };
      }
      // If no documents exist at all, treat as missing — block.
      if (s.documents.length === 0) {
        return {
          code: "NO_DOCUMENTS",
          reason: "At least one approved document is required before submission",
        };
      }
      return null;
    },
  },
  CONDITIONAL_OFFER: {
    toStage: "CONDITIONAL_OFFER",
    description: "Application must be submitted before a conditional offer can be issued",
    requires: (s) => {
      const idx = APPLICATION_STAGES.indexOf(s.application.stageKey as (typeof APPLICATION_STAGES)[number]);
      const submittedIdx = APPLICATION_STAGES.indexOf("APPLICATION_SUBMITTED");
      if (idx < submittedIdx) {
        return { code: "NOT_SUBMITTED", reason: "Application must be submitted before an offer can be issued" };
      }
      return null;
    },
  },
  DEPOSIT_PAYMENT: {
    toStage: "DEPOSIT_PAYMENT",
    description: "Unconditional offer must be in hand before deposit",
    requires: (s) => {
      const idx = APPLICATION_STAGES.indexOf(s.application.stageKey as (typeof APPLICATION_STAGES)[number]);
      const unconditionalIdx = APPLICATION_STAGES.indexOf("UNCONDITIONAL_OFFER");
      if (idx < unconditionalIdx) {
        return { code: "NO_UNCONDITIONAL_OFFER", reason: "Unconditional offer required before deposit payment" };
      }
      return null;
    },
  },
  CONFIRMATION: {
    toStage: "CONFIRMATION",
    description: "Deposit must be paid before confirmation",
    requires: (s) => {
      // At least one PAID payment record must exist. We don't enforce an
      // amount because the deposit size varies by university.
      const paid = s.payments.filter((p) => p.status === "PAID");
      if (paid.length === 0) {
        return { code: "NO_DEPOSIT", reason: "At least one PAID payment is required before confirmation" };
      }
      return null;
    },
  },
  VISA_SUBMITTED: {
    toStage: "VISA_SUBMITTED",
    description: "Visa preparation must be complete before submission",
    requires: (s) => {
      // The application must currently be in VISA_PREPARATION (forward-only
      // already enforces this, but we double-check for clarity).
      if (s.application.stageKey !== "VISA_PREPARATION") {
        return { code: "NOT_IN_PREPARATION", reason: "Application must be in VISA_PREPARATION stage before visa submission" };
      }
      // No visa_application record in PREPARATION stage means the visa case
      // hasn't been opened yet.
      const prepVisa = s.visaApplications.filter((v) => v.stage === "PREPARATION");
      if (prepVisa.length === 0) {
        return { code: "NO_VISA_CASE", reason: "A visa case must be created in PREPARATION stage before submission" };
      }
      return null;
    },
  },
  COMPLETED: {
    toStage: "COMPLETED",
    description: "Visa must be approved before completion",
    requires: (s) => {
      const approved = s.visaApplications.filter((v) => v.stage === "APPROVED");
      if (approved.length === 0) {
        return { code: "VISA_NOT_APPROVED", reason: "Visa must be APPROVED before the application can be completed" };
      }
      return null;
    },
  },
};

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Returns the rule for entering `toStage`, or null when no rule is declared.
 * Stages without a rule are freely enterable (subject to forward-only logic).
 */
export function getStageRule(toStage: string): TransitionRule | null {
  return RULES[toStage] ?? null;
}

/**
 * Validate that a transition from `fromStage` to `toStage` is structurally
 * allowed (forward-only or explicitly-allowed backward). Returns a block
 * reason if the move is not permitted.
 *
 * Pure function — does not look at the application's data, only at the
 * canonical stage graph.
 */
export function validateTransitionShape(fromStage: string, toStage: string): TransitionBlock | null {
  if (!APPLICATION_STAGES.includes(fromStage as (typeof APPLICATION_STAGES)[number])) {
    return { code: "INVALID_FROM", reason: `Unknown source stage: ${fromStage}` };
  }
  if (!APPLICATION_STAGES.includes(toStage as (typeof APPLICATION_STAGES)[number])) {
    return { code: "INVALID_TO", reason: `Unknown target stage: ${toStage}` };
  }
  if (fromStage === toStage) return null; // no-op handled by caller

  const fromIdx = APPLICATION_STAGES.indexOf(fromStage as (typeof APPLICATION_STAGES)[number]);
  const toIdx = APPLICATION_STAGES.indexOf(toStage as (typeof APPLICATION_STAGES)[number]);

  // Forward move — always allowed (subject to rule predicates).
  if (toIdx === fromIdx + 1) return null;

  // Backward move — only if explicitly listed.
  if (toIdx < fromIdx) {
    const allowed = ALLOWED_BACKWARD[fromStage] ?? [];
    if (allowed.includes(toStage)) return null;
    return {
      code: "BACKWARD_BLOCKED",
      reason: `Cannot move backward from ${fromStage} to ${toStage}. Allowed backward targets: ${allowed.length > 0 ? allowed.join(", ") : "none"}`,
    };
  }

  // Forward skip (e.g. LEAD → VISA_SUBMITTED) — blocked.
  return {
    code: "SKIP_BLOCKED",
    reason: `Cannot skip from ${fromStage} to ${toStage}. Move to ${NEXT_STAGE[fromStage]} first.`,
  };
}

/**
 * Full transition validation — shape + business rule predicate. Returns
 * null when the transition is allowed, or a block reason.
 *
 * Pure with respect to the snapshot — the caller is responsible for
 * assembling the snapshot from the database.
 */
export function validateTransition(
  fromStage: string,
  toStage: string,
  snapshot: StageRuleSnapshot,
): TransitionBlock | null {
  const shapeError = validateTransitionShape(fromStage, toStage);
  if (shapeError) return shapeError;

  const rule = getStageRule(toStage);
  if (!rule?.requires) return null;
  return rule.requires(snapshot);
}

/**
 * Load the snapshot needed by the rule predicates. Single batched query —
 * documents + payments + invoices + visaApplications + student are fetched
 * in parallel. No N+1.
 */
export async function loadStageRuleSnapshot(applicationId: string): Promise<StageRuleSnapshot> {
  const app = await prisma.application.findFirst({
    where: { id: applicationId },
    select: {
      id: true,
      stageKey: true,
      status: true,
      deadline: true,
      student: { select: { id: true, firstName: true, lastName: true, userId: true } },
      documents: { select: { status: true, name: true } },
      payments: { select: { status: true, amount: true } },
      invoices: { select: { status: true, amount: true, dueDate: true } },
      visaApplications: { select: { stage: true } },
    },
  });
  if (!app) throw new Error(`Application ${applicationId} not found`);
  return {
    application: {
      id: app.id,
      stageKey: app.stageKey,
      status: app.status,
      deadline: app.deadline,
    },
    documents: app.documents,
    payments: app.payments,
    invoices: app.invoices,
    visaApplications: app.visaApplications,
    student: app.student,
  };
}

/**
 * Returns the next allowed stage for the application (the immediate
 * successor in the canonical order). Used by the UI to highlight the
 * "Next stage" card. Returns null when the application is COMPLETED.
 */
export function getNextStage(currentStage: string): string | null {
  return NEXT_STAGE[currentStage] ?? null;
}

/**
 * Returns all stages the application has passed (canonical index < current).
 * Used by the UI to mark completed stages in the timeline.
 */
export function getCompletedStages(currentStage: string): string[] {
  const idx = APPLICATION_STAGES.indexOf(currentStage as (typeof APPLICATION_STAGES)[number]);
  if (idx < 0) return [];
  return APPLICATION_STAGES.slice(0, idx);
}

/**
 * Returns whether a transition would be blocked, along with the reason.
 * Convenience wrapper for the UI — single call returns { allowed, reason }.
 */
export function checkTransition(
  fromStage: string,
  toStage: string,
  snapshot: StageRuleSnapshot,
): { allowed: boolean; block: TransitionBlock | null } {
  const block = validateTransition(fromStage, toStage, snapshot);
  return { allowed: block === null, block };
}
