/**
 * Pure helpers for the Admin Visa Management module.
 *
 * No DB access — these functions feed the API routes, UI components, and
 * tests. The status flow and transition rules are the single source of
 * truth for "which visa stages can transition to which?" and are
 * enforced at the service level in `lib/services/visa.ts`.
 *
 * Visa status flow:
 *   PREPARATION → SUBMITTED → BIOMETRICS → INTERVIEW → PROCESSING
 *                                                           ├→ APPROVED → COMPLETED
 *                                                           └→ REFUSED
 *   Any stage → WITHDRAWN (terminal)
 */

export const VISA_STATUSES = [
  "PREPARATION",
  "SUBMITTED",
  "BIOMETRICS",
  "INTERVIEW",
  "PROCESSING",
  "APPROVED",
  "REFUSED",
  "WITHDRAWN",
  "COMPLETED",
] as const;
export type VisaStatus = (typeof VISA_STATUSES)[number];

export const VISA_STATUS_LABELS: Record<VisaStatus, string> = {
  PREPARATION: "Preparation",
  SUBMITTED: "Submitted",
  BIOMETRICS: "Biometrics",
  INTERVIEW: "Interview",
  PROCESSING: "Processing",
  APPROVED: "Approved",
  REFUSED: "Refused",
  WITHDRAWN: "Withdrawn",
  COMPLETED: "Completed",
};

/**
 * Statuses that are terminal (no further transitions allowed).
 * APPROVED is intentionally NOT terminal — it can transition to COMPLETED
 * (the final "visa received, travel booked" step).
 */
export const TERMINAL_VISA_STATUSES = ["REFUSED", "WITHDRAWN", "COMPLETED"] as const;

/** Statuses that represent a positive decision. */
export const POSITIVE_DECISION_STATUSES = ["APPROVED", "COMPLETED"] as const;

/** Statuses that represent a negative decision. */
export const NEGATIVE_DECISION_STATUSES = ["REFUSED", "WITHDRAWN"] as const;

/**
 * Allowed transitions from each status. Returns the set of statuses the
 * visa can move to from the given current status. Terminal statuses
 * return an empty array.
 *
 * The rules are intentionally permissive within the forward flow — an
 * admin can move a visa backwards (e.g. from INTERVIEW back to
 * BIOMETRICS if the appointment was rescheduled) but cannot revive a
 * terminal status without an explicit "reopen" action.
 */
export function allowedTransitions(from: string): readonly VisaStatus[] {
  if ((TERMINAL_VISA_STATUSES as readonly string[]).includes(from)) {
    return [];
  }
  // Non-terminal statuses can transition to any non-terminal status
  // forward in the flow, plus the three terminal decision statuses.
  return VISA_STATUSES.filter(
    (s) => s !== from && !(TERMINAL_VISA_STATUSES as readonly string[]).includes(from),
  );
}

/**
 * Returns true if transitioning from `from` to `to` is allowed. Terminal
 * statuses cannot transition out. WITHDRAWN can be reached from any
 * non-terminal status.
 */
export function canTransition(from: string, to: string): boolean {
  if (from === to) return false;
  if ((TERMINAL_VISA_STATUSES as readonly string[]).includes(from)) return false;
  if (!(VISA_STATUSES as readonly string[]).includes(to as VisaStatus)) return false;
  return true;
}

/**
 * Returns true if the given status sets the `decisionAt` timestamp.
 * APPROVED, REFUSED, and WITHDRAWN all represent a decision point.
 */
export function isDecisionStatus(status: string): boolean {
  return (
    status === "APPROVED" ||
    status === "REFUSED" ||
    status === "WITHDRAWN"
  );
}

/**
 * Returns true if the given status sets the `submittedAt` timestamp
 * (only when transitioning to SUBMITTED for the first time).
 */
export function isSubmissionStatus(status: string): boolean {
  return status === "SUBMITTED";
}

/**
 * Returns true if the given status sets the `biometricsAt` timestamp.
 */
export function isBiometricsStatus(status: string): boolean {
  return status === "BIOMETRICS";
}

/**
 * Returns true if the given status sets the `interviewAt` timestamp.
 */
export function isInterviewStatus(status: string): boolean {
  return status === "INTERVIEW";
}

/** Sort keys allowed for the admin visa list. */
export const VISA_SORT_KEYS = [
  "stage",
  "submittedAt",
  "biometricsAt",
  "interviewAt",
  "decisionAt",
  "createdAt",
  "updatedAt",
] as const;
export type VisaSortKey = (typeof VISA_SORT_KEYS)[number];

/**
 * Build a Prisma `where` fragment for the admin visa list. Enforces the
 * soft-delete filter (deletedAt null) and AND-combines the optional
 * discovery filters:
 *  - search (application number OR student name)
 *  - stage
 *  - countryId (via application.country)
 *  - studentId (via application.student)
 *  - applicationId
 *  - universityId (via application.university)
 */
export function buildAdminVisaWhere(filters: {
  search?: string;
  stage?: string;
  countryId?: string;
  studentId?: string;
  applicationId?: string;
  universityId?: string;
}): Record<string, unknown> {
  const search = filters.search?.trim();
  const andClauses: Record<string, unknown>[] = [{ deletedAt: null }];

  if (filters.stage) {
    andClauses.push({ stage: filters.stage });
  }
  if (filters.applicationId) {
    andClauses.push({ applicationId: filters.applicationId });
  }
  if (filters.countryId) {
    andClauses.push({ application: { countryId: filters.countryId } });
  }
  if (filters.studentId) {
    andClauses.push({ application: { studentId: filters.studentId } });
  }
  if (filters.universityId) {
    andClauses.push({ application: { universityId: filters.universityId } });
  }
  if (search) {
    andClauses.push({
      OR: [
        {
          application: {
            applicationNumber: { contains: search, mode: "insensitive" },
          },
        },
        {
          application: {
            student: {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        },
      ],
    });
  }

  return { AND: andClauses };
}

/**
 * Common visa types for the dropdown. Stored as a free-text field on the
 * model so admins can enter a custom type not in this list.
 */
export const COMMON_VISA_TYPES = [
  "Student Visa (Tier 4)",
  "Short-term Study Visa",
  "Student Visa (Subclass 500)",
  "Study Permit",
  "F-1 Student Visa",
  "Other",
] as const;
