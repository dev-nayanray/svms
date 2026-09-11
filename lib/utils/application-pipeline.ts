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
