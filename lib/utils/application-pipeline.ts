/**
 * Pure pipeline helpers — single source of truth for "where is this
 * application in its journey?" and "what should the student do next?".
 *
 * Used by both the service (server-side, returns the pipeline in the
 * API payload) and the UI (client-side, so the bar animates without a
 * round-trip). Pure → unit-tested in isolation.
 */

export type StageRow = {
  key: string;
  name: string;
  sortOrder: number;
  enabled: boolean;
};

export type StageState = "completed" | "current" | "upcoming" | "skipped";

export type StageMarker = {
  key: string;
  name: string;
  sortOrder: number;
  state: StageState;
};

export type ProgressSummary = {
  /** 0..100, rounded down — share of completed stages (current counts). */
  percent: number;
  /** Index of the current stage among the enabled stages, -1 if unknown. */
  currentIndex: number;
  /** Total number of enabled stages (the denominator). */
  total: number;
  /** How many stages are before the current one (completed or skipped). */
  passed: number;
  /** Whether the current stage is the terminal "COMPLETED" stage. */
  isComplete: boolean;
};

/**
 * The canonical pipeline — mirrors `DEFAULT_STAGES` in
 * `lib/services/application.ts` and `DEFAULT_PIPELINE` in
 * `lib/constants/applications.ts`. The live source of truth is the
 * `ApplicationStage` table, but this constant is the fallback when
 * the table is empty (e.g. fresh install before seed).
 */
export const CANONICAL_PIPELINE: StageRow[] = [
  { key: "LEAD", name: "Lead", sortOrder: 1, enabled: true },
  { key: "COUNSELING", name: "Counseling", sortOrder: 2, enabled: true },
  { key: "PROFILE_ASSESSMENT", name: "Profile Assessment", sortOrder: 3, enabled: true },
  { key: "COUNTRY_SELECTION", name: "Country Selection", sortOrder: 4, enabled: true },
  { key: "UNIVERSITY_SELECTION", name: "University Selection", sortOrder: 5, enabled: true },
  { key: "DOCUMENT_COLLECTION", name: "Document Collection", sortOrder: 6, enabled: true },
  { key: "APPLICATION_SUBMITTED", name: "Application Submitted", sortOrder: 7, enabled: true },
  { key: "CONDITIONAL_OFFER", name: "Conditional Offer", sortOrder: 8, enabled: true },
  { key: "UNCONDITIONAL_OFFER", name: "Unconditional Offer", sortOrder: 9, enabled: true },
  { key: "DEPOSIT_PAYMENT", name: "Deposit Payment", sortOrder: 10, enabled: true },
  { key: "CONFIRMATION", name: "Confirmation", sortOrder: 11, enabled: true },
  { key: "VISA_PREPARATION", name: "Visa Preparation", sortOrder: 12, enabled: true },
  { key: "VISA_SUBMITTED", name: "Visa Submitted", sortOrder: 13, enabled: true },
  { key: "BIOMETRICS", name: "Biometrics", sortOrder: 14, enabled: true },
  { key: "INTERVIEW", name: "Interview", sortOrder: 15, enabled: true },
  { key: "VISA_DECISION", name: "Visa Decision", sortOrder: 16, enabled: true },
  { key: "TRAVEL_PREPARATION", name: "Travel Preparation", sortOrder: 17, enabled: true },
  { key: "COMPLETED", name: "Completed", sortOrder: 18, enabled: true },
];

/**
 * Compute the per-stage state markers for the pipeline UI.
 *
 * A stage is:
 *  - "completed"  if its sortOrder is strictly less than the current stage
 *                  AND the application has actually passed through it
 *                  (per statusHistory). Without history, we infer from
 *                  sortOrder alone — the optimistic case where the app
 *                  went straight through.
 *  - "current"    if its key matches the application's current stageKey.
 *  - "skipped"    if its sortOrder is less than the current stage's
 *                  sortOrder AND it's not in the statusHistory — i.e.
 *                  the application jumped over it (e.g. no biometrics
 *                  required for this country).
 *  - "upcoming"   if its sortOrder is greater than the current stage's
 *                  sortOrder.
 *
 * `history.toStage` is the set of stages the app has been recorded in.
 * The current stage is always in history (inserted on creation), so
 * history membership is a reliable signal for "this stage was reached".
 */
export function computeStageStates(
  currentStageKey: string | null | undefined,
  stages: StageRow[],
  history: { toStage: string }[] = [],
): StageMarker[] {
  const enabled = (stages.length > 0 ? stages : CANONICAL_PIPELINE)
    .filter((s) => s.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (!currentStageKey) {
    return enabled.map((s) => ({ ...s, state: "upcoming" as const }));
  }

  const currentIdx = enabled.findIndex((s) => s.key === currentStageKey);
  if (currentIdx < 0) {
    // Unknown stage key — treat everything as upcoming so the UI doesn't crash.
    return enabled.map((s) => ({ ...s, state: "upcoming" as const }));
  }

  // The current stage is always "reached" even if history is missing.
  // When no history is provided, we optimistically assume the app went
  // straight through (every prior stage was reached → completed).
  // When history IS provided, only stages actually in history count
  // as reached — unreached prior stages are "skipped".
  const hasHistory = history.length > 0;
  const reachedKeys = new Set(history.map((h) => h.toStage));
  reachedKeys.add(currentStageKey);

  return enabled.map((s, i) => {
    if (s.key === currentStageKey) return { ...s, state: "current" as const };
    if (i < currentIdx) {
      // Before the current stage — was it reached? If history is empty
      // we assume yes (optimistic); otherwise we trust the history
      // and mark unreached stages as skipped.
      if (!hasHistory || reachedKeys.has(s.key)) {
        return { ...s, state: "completed" as const };
      }
      return { ...s, state: "skipped" as const };
    }
    return { ...s, state: "upcoming" as const };
  });
}

/**
 * Compute the percent of the pipeline the application has traversed.
 * The current stage counts as "done" (it's where the student is now);
 * skipped stages before the current also count as done.
 */
export function computeProgressPercent(
  currentStageKey: string | null | undefined,
  stages: StageRow[],
): ProgressSummary {
  const enabled = (stages.length > 0 ? stages : CANONICAL_PIPELINE)
    .filter((s) => s.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const total = enabled.length;
  if (!currentStageKey || total === 0) {
    return { percent: 0, currentIndex: -1, total, passed: 0, isComplete: false };
  }

  const currentIndex = enabled.findIndex((s) => s.key === currentStageKey);
  if (currentIndex < 0) {
    return { percent: 0, currentIndex: -1, total, passed: 0, isComplete: false };
  }

  const passed = currentIndex; // stages strictly before the current one
  const percent = Math.round(((currentIndex + 1) / total) * 100);
  const isComplete = currentStageKey === "COMPLETED";
  return { percent, currentIndex, total, passed, isComplete };
}

/**
 * The student's next-action recommendation — application-scoped.
 *
 * Order of priority:
 *  1. Upload a pending/required document (the application can't move
 *     forward until the document is provided).
 *  2. Pay an outstanding invoice (deposit/university fee).
 *  3. Complete an open task assigned to the student.
 *  4. Send a message to the counselor (when no concrete blocker but
 *     the application is at a stage where a counselor reply is expected).
 *  5. Just "view application details" — the default CTA.
 */
export type StudentNextAction = {
  title: string;
  reason: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  ctaLabel: string;
  ctaHref: string;
};

export function deriveStudentNextAction(input: {
  pendingDocuments: { id: string; name: string }[];
  openInvoices: { id: string; invoiceNumber: string; dueAmount: number; dueDate: Date | null }[];
  openTasks: { id: string; title: string; dueDate: Date | null }[];
  hasCounselor: boolean;
  applicationId: string;
}): StudentNextAction {
  if (input.pendingDocuments.length > 0) {
    const d = input.pendingDocuments[0];
    return {
      title: `Upload: ${d.name}`,
      reason: "This document is required before your application can move forward.",
      priority: "HIGH",
      ctaLabel: "Upload Document",
      ctaHref: "/student/documents",
    };
  }
  if (input.openInvoices.length > 0) {
    const inv = [...input.openInvoices].sort(
      (a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity),
    )[0];
    return {
      title: `Pay ${inv.invoiceNumber}`,
      reason: inv.dueDate
        ? inv.dueDate < new Date()
          ? "Payment is overdue — please pay as soon as possible."
          : "Payment is due soon."
        : "An outstanding payment is required to continue.",
      priority: inv.dueDate && inv.dueDate < new Date() ? "HIGH" : "MEDIUM",
      ctaLabel: "Make Payment",
      ctaHref: "/student/payments",
    };
  }
  if (input.openTasks.length > 0) {
    const t = [...input.openTasks].sort(
      (a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity),
    )[0];
    return {
      title: t.title,
      reason: "Assigned by your counselor — complete this task to move forward.",
      priority: t.dueDate && t.dueDate < new Date() ? "HIGH" : "MEDIUM",
      ctaLabel: "View Task",
      ctaHref: "/student/tasks",
    };
  }
  if (input.hasCounselor) {
    return {
      title: "Message your counselor",
      reason: "Ask about your application's next steps or share an update.",
      priority: "LOW",
      ctaLabel: "Message Counselor",
      ctaHref: "/student/messages",
    };
  }
  return {
    title: "View application details",
    reason: "Review your application progress and documents.",
    priority: "LOW",
    ctaLabel: "View Details",
    ctaHref: `/student/application`,
  };
}

/** Title-case a stage key: "VISA_DECISION" → "Visa Decision". */
export function titleCaseStage(key: string | null | undefined): string {
  if (!key) return "—";
  return key
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ───────────────────────────────────────────────────────────────────
// Stage descriptions (Module 05 — Application Timeline)
// ───────────────────────────────────────────────────────────────────
//
// Pure lookup tables — student-facing copy for "what happened at this
// stage?" and "what happens next?". These are intentionally written
// from the student's perspective and contain no internal process
// detail (no employee assignments, no audit metadata, no internal
// note references). Unknown stages fall back to a generic copy.

/**
 * Student-facing description of what happened at each stage. Used in
 * the timeline list to give a one-line summary the student can scan.
 */
export const STAGE_DESCRIPTIONS: Record<string, string> = {
  LEAD: "Your application journey started.",
  COUNSELING: "You had your first counseling session with your assigned counselor.",
  PROFILE_ASSESSMENT: "Your academic profile was assessed for eligibility.",
  COUNTRY_SELECTION: "Your destination country was selected.",
  UNIVERSITY_SELECTION: "Your target university was selected.",
  DOCUMENT_COLLECTION: "Required documents were collected and verified.",
  APPLICATION_SUBMITTED: "Your application was submitted to the university.",
  CONDITIONAL_OFFER: "You received a conditional offer from the university.",
  UNCONDITIONAL_OFFER: "Your offer was confirmed — unconditional offer received.",
  DEPOSIT_PAYMENT: "Your deposit payment was confirmed.",
  CONFIRMATION: "Your enrollment was confirmed by the university.",
  VISA_PREPARATION: "Visa documents are being prepared by your counselor.",
  VISA_SUBMITTED: "Your visa application was submitted to the embassy.",
  BIOMETRICS: "Your biometrics appointment was completed.",
  INTERVIEW: "Your visa interview was conducted.",
  VISA_DECISION: "A visa decision was received from the embassy.",
  TRAVEL_PREPARATION: "Travel arrangements are being finalized.",
  COMPLETED: "Your application journey is complete. Safe travels!",
};

/**
 * Student-facing "what happens next" copy for the current stage. Used
 * in the current-stage callout so the student always knows what to
 * expect, even when there's no concrete next-action CTA.
 */
export const NEXT_STAGE_DESCRIPTIONS: Record<string, string> = {
  LEAD: "Your counselor will reach out to schedule your first counseling session.",
  COUNSELING: "Your counselor is assessing your profile and recommending next steps.",
  PROFILE_ASSESSMENT: "We're helping you select the right destination country and university.",
  COUNTRY_SELECTION: "We're shortlisting universities in your chosen country.",
  UNIVERSITY_SELECTION: "We're collecting the required documents for your application.",
  DOCUMENT_COLLECTION: "We're preparing to submit your application to the university.",
  APPLICATION_SUBMITTED: "We're waiting for the university's decision on your application.",
  CONDITIONAL_OFFER: "Please pay the deposit to confirm your enrollment.",
  UNCONDITIONAL_OFFER: "Your enrollment is confirmed. Visa preparation is starting.",
  DEPOSIT_PAYMENT: "We're confirming your enrollment with the university.",
  CONFIRMATION: "We're preparing your visa application documents.",
  VISA_PREPARATION: "Your counselor is preparing the required visa documents.",
  VISA_SUBMITTED: "We're waiting for the embassy to process your visa.",
  BIOMETRICS: "Your biometrics have been recorded. An interview may be scheduled next.",
  INTERVIEW: "We're waiting for the visa decision from the embassy.",
  VISA_DECISION: "Your visa has been decided. Travel preparation is starting.",
  TRAVEL_PREPARATION: "Final travel arrangements are being made.",
  COMPLETED: "Your journey is complete. Safe travels!",
};

/** Get the student-facing description for a stage key. */
export function getStageDescription(key: string | null | undefined): string {
  if (!key) return "Stage details unavailable.";
  return STAGE_DESCRIPTIONS[key] ?? titleCaseStage(key);
}

/** Get the "what happens next" copy for a stage key (current stage). */
export function getNextStageDescription(key: string | null | undefined): string {
  if (!key) return "Your application is being processed.";
  return NEXT_STAGE_DESCRIPTIONS[key] ?? "We're moving your application forward.";
}
