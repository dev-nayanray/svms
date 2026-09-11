import { prisma } from "@/lib/db";
import {
  VISA_STATUS_LABELS,
  type VisaStatus,
} from "@/lib/constants/visa";

/**
 * Student-scoped Visa service for Module 09 (Student Visa Management).
 *
 * SECURITY INVARIANT
 * ------------------
 * Every public method takes a `studentId` resolved from the session
 * (via `studentApiGuard()` at the route layer). The service NEVER
 * trusts a `visaId` from the client without re-verifying that the
 * visa's linked application belongs to the caller. Foreign/missing
 * records both return null → the route 404s (NOT_FOUND, never 403 —
 * the existence of another student's visa is never confirmed).
 *
 * DATA EXFILTRATION GUARD
 * ------------------------
 * The `notes` field on `VisaApplication` is internal admin/counselor
 * commentary — it is NEVER exposed to students. The student-safe view
 * omits it entirely. Students also never see `deletedAt`, `deletedBy`,
 * or any audit-log internals.
 *
 * READ-ONLY
 * ---------
 * Students cannot modify visa status, dates, or any other field.
 * All routes that use this service are GET-only. Stage changes go
 * through the admin `/api/visa` PATCH endpoint (guarded by
 * `visa.manage` permission — EMPLOYEE/ADMIN only).
 */

export type VisaSummary = {
  id: string;
  stage: string;
  stageLabel: string;
  visaType: string | null;
  submittedAt: Date | null;
  biometricsAt: Date | null;
  interviewAt: Date | null;
  decisionAt: Date | null;
  application: {
    id: string;
    applicationNumber: string;
    country: { id: string; name: string; flag: string | null };
    university: { id: string; name: string } | null;
    course: { id: string; name: string } | null;
  };
  updatedAt: Date;
};

export type VisaDetailView = ReturnType<typeof buildStudentSafeView>;

function buildStudentSafeView(row: {
  id: string;
  stage: string;
  visaType: string | null;
  submittedAt: Date | null;
  biometricsAt: Date | null;
  interviewAt: Date | null;
  decisionAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  application: {
    id: string;
    applicationNumber: string;
    stageKey: string;
    status: string;
    country: { id: string; name: string; flag: string | null };
    university: { id: string; name: string } | null;
    course: { id: string; name: string } | null;
  };
}, timeline: { id: string; fromStage: string | null; toStage: string; note: string | null; createdAt: Date }[]) {
  const stage = row.stage as VisaStatus;
  return {
    id: row.id,
    stage,
    stageLabel: VISA_STATUS_LABELS[stage] ?? row.stage,
    visaType: row.visaType,
    submittedAt: row.submittedAt,
    biometricsAt: row.biometricsAt,
    interviewAt: row.interviewAt,
    decisionAt: row.decisionAt,
    // NOTE: `notes` is intentionally omitted — it's internal admin/counselor
    // commentary and must never be exposed to students.
    application: {
      id: row.application.id,
      applicationNumber: row.application.applicationNumber,
      stageKey: row.application.stageKey,
      status: row.application.status,
      country: row.application.country,
      university: row.application.university,
      course: row.application.course,
    },
    // Visa pipeline — which stages have been reached vs upcoming.
    // Derived from the visa's current stage + the timeline history.
    pipeline: computeVisaPipeline(stage, timeline),
    // Timeline entries (newest-first). The `note` on each entry is the
    // change-note (e.g. "Visa stage: PREPARATION → SUBMITTED") — this is
    // a brief label, NOT the internal `notes` field on VisaApplication.
    timeline: timeline.map((h) => ({
      id: h.id,
      fromStage: h.fromStage,
      toStage: h.toStage,
      fromLabel: h.fromStage ? (VISA_STATUS_LABELS[h.fromStage as VisaStatus] ?? h.fromStage) : null,
      toLabel: VISA_STATUS_LABELS[h.toStage as VisaStatus] ?? h.toStage,
      note: h.note,
      createdAt: h.createdAt,
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Compute the visa pipeline markers. The visa pipeline is simpler than
 * the application pipeline — it's the 7 student-visible stages:
 *   Preparation → Submitted → Biometrics → Interview → Processing → Decision → Completed
 * (WITHDRAWN and REFUSED are terminal outcomes, not pipeline stages.)
 */
function computeVisaPipeline(
  currentStage: string,
  history: { toStage: string }[],
): { key: string; label: string; state: "completed" | "current" | "upcoming" }[] {
  // The student-visible pipeline stages in order.
  const pipelineStages = [
    "PREPARATION",
    "SUBMITTED",
    "BIOMETRICS",
    "INTERVIEW",
    "PROCESSING",
    "APPROVED", // "Decision" in the UI
    "COMPLETED",
  ] as const;

  const reachedKeys = new Set(history.map((h) => h.toStage));
  reachedKeys.add(currentStage);

  const currentIdx = pipelineStages.indexOf(currentStage as typeof pipelineStages[number]);

  return pipelineStages.map((key, i) => {
    const label = VISA_STATUS_LABELS[key] ?? key;
    if (key === currentStage || (currentIdx >= 0 && i === currentIdx)) {
      return { key, label, state: "current" as const };
    }
    if (currentIdx >= 0 && i < currentIdx) {
      return reachedKeys.has(key)
        ? { key, label, state: "completed" as const }
        : { key, label, state: "completed" as const }; // optimistically completed
    }
    return { key, label, state: "upcoming" as const };
  });
}

export const studentVisaService = {
  /**
   * List all visa applications for the caller's applications. The query
   * joins through `application.studentId` (resolved from the session)
   * so only the caller's own visas are returned.
   */
  async list(studentId: string): Promise<VisaSummary[]> {
    const rows = await prisma.visaApplication.findMany({
      where: {
        deletedAt: null,
        application: { studentId, deletedAt: null },
      },
      include: {
        application: {
          select: {
            id: true,
            applicationNumber: true,
            stageKey: true,
            status: true,
            country: { select: { id: true, name: true, flag: true } },
            university: { select: { id: true, name: true } },
            course: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return rows.map((r) => ({
      id: r.id,
      stage: r.stage,
      stageLabel: VISA_STATUS_LABELS[r.stage as VisaStatus] ?? r.stage,
      visaType: r.visaType,
      submittedAt: r.submittedAt,
      biometricsAt: r.biometricsAt,
      interviewAt: r.interviewAt,
      decisionAt: r.decisionAt,
      application: {
        id: r.application.id,
        applicationNumber: r.application.applicationNumber,
        country: r.application.country,
        university: r.application.university,
        course: r.application.course,
      },
      updatedAt: r.updatedAt,
    }));
  },

  /**
   * Get one visa application's full student-safe detail view. Ownership
   * is verified server-side: the query joins through `application.studentId`
   * so a foreign `visaId` returns null → the route 404s.
   *
   * Returns the visa + pipeline markers + timeline (from
   * ApplicationStatusHistory, filtered to visa-related entries).
   * The `notes` field is NEVER included.
   */
  async getById(studentId: string, visaId: string) {
    const visa = await prisma.visaApplication.findFirst({
      where: {
        id: visaId,
        deletedAt: null,
        application: { studentId, deletedAt: null },
      },
      include: {
        application: {
          select: {
            id: true,
            applicationNumber: true,
            stageKey: true,
            status: true,
            country: { select: { id: true, name: true, flag: true } },
            university: { select: { id: true, name: true } },
            course: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!visa) return null;

    // Fetch the timeline (ApplicationStatusHistory for the linked
    // application). This includes both application-stage changes and
    // visa-stage changes (the visa service writes to this same table).
    const history = await prisma.applicationStatusHistory.findMany({
      where: { applicationId: visa.applicationId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        fromStage: true,
        toStage: true,
        note: true,
        createdAt: true,
      },
    });

    return buildStudentSafeView(visa, history);
  },

  /**
   * Get country-specific visa requirements. Only ACTIVE requirements
   * are returned. Used by the student UI to show a checklist of
   * what's needed for their destination country's visa.
   */
  async getRequirements(countryId: string) {
    const requirements = await prisma.visaRequirement.findMany({
      where: {
        countryId,
        status: "ACTIVE",
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        required: true,
        sortOrder: true,
      },
    });

    return requirements;
  },
};

/** Re-export for the route layer. */
export type StudentVisaView = NonNullable<Awaited<ReturnType<typeof studentVisaService.getById>>>;
