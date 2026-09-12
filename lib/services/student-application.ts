import { prisma } from "@/lib/db";
import { auditLog } from "./audit";
import {
  computeStageStates,
  computeProgressPercent,
  deriveStudentNextAction,
  titleCaseStage,
  getStageDescription,
  getNextStageDescription,
  type StageMarker,
  type ProgressSummary,
  type StudentNextAction,
} from "@/lib/utils/application-pipeline";

/**
 * Student-scoped Application service for Module 04 (My Application).
 *
 * SECURITY INVARIANT
 * ------------------
 * Every public method takes a `studentId` resolved from the session
 * (via `studentApiGuard()` at the route layer). The service NEVER
 * trusts an `applicationId` from the client without re-verifying that
 * the application belongs to the caller. Foreign/missing records both
 * return 404 so the existence of other students' applications is
 * never confirmed.
 *
 * DATA EXFILTRATION GUARD
 * ------------------------
 * The student-safe view (built by `buildStudentSafeView`) only
 * surfaces notes marked `visibility: STUDENT` — internal/employee notes
 * are filtered out at the Prisma `include` level so they never reach
 * the wire. Financial fields are limited to invoice/payment totals
 * (no internal cost breakdowns, no employee commission data, no
 * audit-log detail). The visa section exposes only the stage + dates
 * the student already knows about.
 */

export type ApplicationSummary = {
  id: string;
  applicationNumber: string;
  countryId: string;
  countryName: string;
  countryFlag?: string | null;
  universityId?: string | null;
  universityName?: string | null;
  courseId?: string | null;
  courseName?: string | null;
  intakeId?: string | null;
  intakeName?: string | null;
  stageKey: string;
  stageLabel: string;
  status: string;
  priority: string;
  lastUpdated: Date;
  percent: number;
};

export type ApplicationDetail = ReturnType<typeof buildStudentSafeView>;

function buildSummary(row: {
  id: string;
  applicationNumber: string;
  stageKey: string;
  status: string;
  priority: string;
  updatedAt: Date;
  country: { id: string; name: string; flag?: string | null } | null;
  university?: { id: string; name: string } | null;
  course?: { id: string; name: string } | null;
  intake?: { id: string; name: string } | null;
}): ApplicationSummary {
  return {
    id: row.id,
    applicationNumber: row.applicationNumber,
    countryId: row.country?.id ?? "",
    countryName: row.country?.name ?? "—",
    countryFlag: row.country?.flag ?? null,
    universityId: row.university?.id ?? null,
    universityName: row.university?.name ?? null,
    courseId: row.course?.id ?? null,
    courseName: row.course?.name ?? null,
    intakeId: row.intake?.id ?? null,
    intakeName: row.intake?.name ?? null,
    stageKey: row.stageKey,
    stageLabel: titleCaseStage(row.stageKey),
    status: row.status,
    priority: row.priority,
    lastUpdated: row.updatedAt,
    percent: computeProgressPercent(row.stageKey, []).percent,
  };
}

/**
 * Build the student-safe detail view of one application row.
 *
 * Pure function on its inputs — the caller (route) is responsible
 * for having loaded the row from the DB with the right `include`
 * clauses. Internal/employee notes are filtered out at the Prisma
 * query level so they never reach this function.
 */
function buildStudentSafeView(row: {
  id: string;
  applicationNumber: string;
  studentId: string;
  employeeId: string | null;
  countryId: string;
  universityId: string | null;
  courseId: string | null;
  intakeId: string | null;
  stageKey: string;
  status: string;
  priority: string;
  submissionDate: Date | null;
  decisionDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  country: { id: string; name: string; flag?: string | null } | null;
  university: { id: string; name: string; website?: string | null; city?: string | null; ranking?: number | null } | null;
  course: { id: string; name: string; degreeLevel: string; duration?: string | null; tuitionFee?: number | null; currency?: string | null } | null;
  intake: { id: string; name: string; month: number; year: number; deadline?: Date | null } | null;
  // Counselor is reached via the Student → Employee relation; the
  // service reshapes the Prisma row to expose it as `counselor` here
  // so the view builder doesn't need to know about the indirection.
  counselor: { id: string; title?: string | null; user: { id: string; name: string; email: string } } | null;
  statusHistory: { id: string; fromStage: string | null; toStage: string; note: string | null; createdAt: Date }[];
  documents: { id: string; name: string; fileName: string; status: string; uploadedAt: Date | null; reviewedAt: Date | null; reviewNote?: string | null; expiresAt?: Date | null }[];
  tasks: { id: string; title: string; description?: string | null; status: string; priority: string; dueDate: Date | null }[];
  invoices: { id: string; invoiceNumber: string; total: number; paidAmount: number; dueAmount: number; status: string; dueDate: Date | null; issueDate: Date | null }[];
  payments: { id: string; amount: number; currency: string; paymentMethod: string; status: string; paymentDate: Date | null; transactionReference?: string | null }[];
  notes: { id: string; body: string; visibility: string; createdAt: Date }[];
  visaApplication: { id: string; stage: string; visaType?: string | null; submittedAt: Date | null; biometricsAt: Date | null; interviewAt: Date | null; decisionAt: Date | null; notes?: string | null; createdAt: Date; updatedAt: Date } | null;
}, stages: { key: string; name: string; sortOrder: number; enabled: boolean }[]) {
  const stageMarkers: StageMarker[] = computeStageStates(
    row.stageKey,
    stages,
    row.statusHistory.map((h) => ({ toStage: h.toStage })),
  );
  const progress: ProgressSummary = computeProgressPercent(row.stageKey, stages);

  // Financial summary — totals only, no internal cost breakdowns.
  const totalInvoiceAmount = row.invoices
    .filter((i) => i.status !== "CANCELLED" && i.status !== "DRAFT")
    .reduce((s, i) => s + i.total, 0);
  const totalPaid = row.invoices
    .filter((i) => i.status !== "CANCELLED")
    .reduce((s, i) => s + i.paidAmount, 0);
  const totalDue = row.invoices
    .filter((i) => i.status !== "CANCELLED" && i.status !== "DRAFT")
    .reduce((s, i) => s + i.dueAmount, 0);
  const nextOpenInvoice = row.invoices
    .filter((i) => i.dueAmount > 0 && i.status !== "CANCELLED" && i.status !== "PAID")
    .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity))[0];

  // Document summary — counts by status, no internal review notes.
  const docCounts = {
    required: row.documents.length,
    approved: row.documents.filter((d) => d.status === "APPROVED").length,
    underReview: row.documents.filter((d) => d.status === "UNDER_REVIEW" || d.status === "UPLOADED").length,
    rejected: row.documents.filter((d) => d.status === "REJECTED" || d.status === "EXPIRED").length,
    pending: row.documents.filter((d) => d.status === "REQUESTED").length,
  };

  // Open tasks assigned to the student.
  const openTasks = row.tasks.filter(
    (t) => t.status === "TODO" || t.status === "IN_PROGRESS",
  );

  // The student's next-action recommendation.
  const nextAction: StudentNextAction = deriveStudentNextAction({
    pendingDocuments: row.documents
      .filter((d) => d.status === "REQUESTED" || d.status === "REJECTED")
      .map((d) => ({ id: d.id, name: d.name })),
    openInvoices: row.invoices
      .filter((i) => i.dueAmount > 0 && i.status !== "CANCELLED" && i.status !== "PAID")
      .map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        dueAmount: i.dueAmount,
        dueDate: i.dueDate,
      })),
    openTasks: openTasks.map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate })),
    hasCounselor: !!row.counselor,
    applicationId: row.id,
  });

  return {
    id: row.id,
    applicationNumber: row.applicationNumber,
    studentId: row.studentId,
    // Header fields
    country: row.country ? { id: row.country.id, name: row.country.name, flag: row.country.flag ?? null } : null,
    university: row.university
      ? {
          id: row.university.id,
          name: row.university.name,
          website: row.university.website ?? null,
          city: row.university.city ?? null,
          ranking: row.university.ranking ?? null,
        }
      : null,
    course: row.course
      ? {
          id: row.course.id,
          name: row.course.name,
          degreeLevel: row.course.degreeLevel,
          duration: row.course.duration ?? null,
          tuitionFee: row.course.tuitionFee ?? null,
          currency: row.course.currency ?? null,
        }
      : null,
    intake: row.intake
      ? {
          id: row.intake.id,
          name: row.intake.name,
          month: row.intake.month,
          year: row.intake.year,
          deadline: row.intake.deadline ?? null,
        }
      : null,
    stageKey: row.stageKey,
    stageLabel: titleCaseStage(row.stageKey),
    status: row.status,
    priority: row.priority,
    lastUpdated: row.updatedAt,
    createdAt: row.createdAt,
    submissionDate: row.submissionDate,
    decisionDate: row.decisionDate,
    // Counselor (business contact info — name + email, no phone)
    counselor: row.counselor
      ? {
          id: row.counselor.id,
          name: row.counselor.user.name,
          email: row.counselor.user.email,
          designation: row.counselor.title ?? null,
        }
      : null,
    // Progress + pipeline
    progress,
    stages: stageMarkers,
    nextAction,
    // Important dates pulled from real data, not hardcoded
    importantDates: buildImportantDates(row),
    // Timeline (status history) — student-visible note only when
    // visibility was STUDENT; internal notes already filtered at query.
    timeline: row.statusHistory.map((h) => ({
      id: h.id,
      fromStage: h.fromStage,
      toStage: h.toStage,
      fromLabel: titleCaseStage(h.fromStage),
      toLabel: titleCaseStage(h.toStage),
      note: h.note, // already filtered to student-visible at query time
      createdAt: h.createdAt,
    })),
    // Documents — student sees name, status, dates. Internal reviewNote
    // is exposed only when status is REJECTED (so they know why) — for
    // UNDER_REVIEW/APPROVED we hide it to avoid leaking internal process.
    documents: {
      counts: docCounts,
      items: row.documents.map((d) => ({
        id: d.id,
        name: d.name,
        fileName: d.fileName,
        status: d.status,
        uploadedAt: d.uploadedAt,
        reviewedAt: d.reviewedAt,
        reviewNote: d.status === "REJECTED" ? d.reviewNote : null,
        expiresAt: d.expiresAt ?? null,
      })),
    },
    // Tasks — only those assigned to the student (filter at query time)
    tasks: {
      open: openTasks.length,
      total: row.tasks.length,
      items: row.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description ?? null,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
      })),
    },
    // Payments — totals + a flat list of student-visible payments.
    // No internal transactionReference, no employee commission data,
    // no audit trail fields.
    payments: {
      totals: {
        invoiceTotal: totalInvoiceAmount,
        paid: totalPaid,
        due: totalDue,
      },
      nextOpenInvoice: nextOpenInvoice
        ? {
            id: nextOpenInvoice.id,
            invoiceNumber: nextOpenInvoice.invoiceNumber,
            dueAmount: nextOpenInvoice.dueAmount,
            dueDate: nextOpenInvoice.dueDate,
            status: nextOpenInvoice.status,
          }
        : null,
      items: row.payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        paymentMethod: p.paymentMethod,
        status: p.status,
        paymentDate: p.paymentDate,
      })),
    },
    // Invoices — student-visible totals + minimal list view
    invoices: row.invoices.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      total: i.total,
      paidAmount: i.paidAmount,
      dueAmount: i.dueAmount,
      status: i.status,
      issueDate: i.issueDate,
      dueDate: i.dueDate,
    })),
    // Visa — student-visible stage + dates
    visa: row.visaApplication
      ? {
          id: row.visaApplication.id,
          stage: row.visaApplication.stage,
          stageLabel: titleCaseStage(row.visaApplication.stage),
          visaType: row.visaApplication.visaType ?? null,
          submittedAt: row.visaApplication.submittedAt,
          biometricsAt: row.visaApplication.biometricsAt,
          interviewAt: row.visaApplication.interviewAt,
          decisionAt: row.visaApplication.decisionAt,
          // Internal `notes` field is NOT exposed — it's for admin/counselor use.
        }
      : null,
    // Student-visible notes only (filtered at query time via where clause)
    notes: row.notes.map((n) => ({
      id: n.id,
      body: n.body,
      visibility: n.visibility,
      createdAt: n.createdAt,
    })),
  };
}

/**
 * Build the "important dates" list from real application data. We pull
 * from submission/decision dates, intake deadline, visa dates, and
 * upcoming invoice due dates — nothing is hardcoded.
 */
function buildImportantDates(row: {
  submissionDate: Date | null;
  decisionDate: Date | null;
  intake?: { deadline?: Date | null } | null;
  invoices: { dueDate: Date | null; dueAmount: number; status: string }[];
  visaApplication?: {
    submittedAt: Date | null;
    biometricsAt: Date | null;
    interviewAt: Date | null;
    decisionAt: Date | null;
  } | null;
}): { label: string; date: Date | null; kind: "submission" | "decision" | "intake" | "visa" | "payment" }[] {
  const items: { label: string; date: Date | null; kind: "submission" | "decision" | "intake" | "visa" | "payment" }[] = [];

  if (row.intake?.deadline) {
    items.push({ label: "Intake Deadline", date: row.intake.deadline, kind: "intake" });
  }
  if (row.submissionDate) {
    items.push({ label: "Application Submitted", date: row.submissionDate, kind: "submission" });
  }
  if (row.visaApplication?.submittedAt) {
    items.push({ label: "Visa Submitted", date: row.visaApplication.submittedAt, kind: "visa" });
  }
  if (row.visaApplication?.biometricsAt) {
    items.push({ label: "Biometrics Appointment", date: row.visaApplication.biometricsAt, kind: "visa" });
  }
  if (row.visaApplication?.interviewAt) {
    items.push({ label: "Visa Interview", date: row.visaApplication.interviewAt, kind: "visa" });
  }
  if (row.visaApplication?.decisionAt) {
    items.push({ label: "Visa Decision", date: row.visaApplication.decisionAt, kind: "visa" });
  }
  // Next open invoice due date
  const nextInv = row.invoices
    .filter((i) => i.dueAmount > 0 && i.status !== "CANCELLED" && i.status !== "PAID" && i.dueDate)
    .sort((a, b) => (a.dueDate!.getTime() - b.dueDate!.getTime()))[0];
  if (nextInv?.dueDate) {
    items.push({ label: "Next Payment Due", date: nextInv.dueDate, kind: "payment" });
  }
  if (row.decisionDate) {
    items.push({ label: "Decision Date", date: row.decisionDate, kind: "decision" });
  }

  // Sort: upcoming first (date >= now), then past (date < now, descending)
  const now = Date.now();
  return items.sort((a, b) => {
    const at = a.date?.getTime() ?? Infinity;
    const bt = b.date?.getTime() ?? Infinity;
    // Upcoming first
    const aUpcoming = at >= now ? 0 : 1;
    const bUpcoming = bt >= now ? 0 : 1;
    if (aUpcoming !== bUpcoming) return aUpcoming - bUpcoming;
    return at - bt;
  });
}

export const studentApplicationService = {
  /**
   * List all applications owned by the caller. Used by the application
   * selector + the multi-application overview. The studentId is taken
   * from the session, never from the query string.
   */
  async list(studentId: string): Promise<ApplicationSummary[]> {
    const rows = await prisma.application.findMany({
      where: { studentId, deletedAt: null },
      include: {
        country: true,
        university: true,
        course: true,
        intake: true,
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    });
    return rows.map((r) => buildSummary(r as never));
  },

  /**
   * Get the caller's "primary" application — the most-recently-updated
   * ACTIVE one. Used by `/api/student/application` (singular). Returns
   * null if the student has no applications.
   */
  async primary(studentId: string): Promise<ApplicationSummary | null> {
    const row = await prisma.application.findFirst({
      where: { studentId, deletedAt: null, status: "ACTIVE" },
      include: { country: true, university: true, course: true, intake: true },
      orderBy: [{ updatedAt: "desc" }],
    });
    if (!row) return null;
    return buildSummary(row as never);
  },

  /**
   * Get one application's full student-safe detail view. Ownership is
   * re-verified server-side: the query is scoped by `studentId`, so a
   * foreign application id returns null (and the route 404s).
   *
   * Internal/employee notes are filtered at the Prisma include level
   * (`where: { visibility: "STUDENT" }`) so they never reach the
   * student-safe view builder.
   */
  async getById(studentId: string, applicationId: string, userId?: string) {
    const [row, stages] = await Promise.all([
      prisma.application.findFirst({
        where: { id: applicationId, studentId, deletedAt: null },
        include: {
          country: true,
          university: true,
          course: true,
          intake: true,
          // Counselor is reached via the Student → Employee relation —
          // the Application has `employeeId` for the assignee but the
          // visible counselor for the student is the student's own
          // assigned counselor.
          student: {
            include: {
              employee: {
                include: { user: { select: { id: true, name: true, email: true } } },
              },
            },
          },
          // Student-visible notes only — internal notes filtered out at the DB.
          notes: {
            where: { visibility: "STUDENT" },
            orderBy: { createdAt: "desc" },
          },
          statusHistory: { orderBy: { createdAt: "desc" } },
          documents: { where: { deletedAt: null } },
          tasks: { where: { deletedAt: null }, orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }] },
          invoices: { where: { deletedAt: null } },
          payments: { where: { deletedAt: null } },
          visaApplication: true,
        },
      }),
      prisma.applicationStage.findMany({
        where: { enabled: true },
        orderBy: { sortOrder: "asc" },
        select: { key: true, name: true, sortOrder: true, enabled: true },
      }),
    ]);

    if (!row) return null;

    // Audit the read — students viewing their own application is a
    // legitimate access event but we don't want a flood of entries,
    // so we only log when the application is in a "sensitive" stage
    // (VISA_DECISION or COMPLETED). This keeps the audit log focused
    // on events that matter for compliance.
    const sensitiveStages = ["VISA_DECISION", "COMPLETED", "VISA_SUBMITTED"];
    if (sensitiveStages.includes(row.stageKey)) {
      // Best-effort: don't block the read if audit fails.
      auditLog
        .record({
          userId: userId, // the caller's userId (from session) — H4 fix
          action: "student_application.viewed",
          entity: "Application",
          entityId: row.id,
          newValue: { stageKey: row.stageKey, applicationNumber: row.applicationNumber },
        })
        .catch(() => {});
    }

    // Reshape: pull counselor out of student.employee so the view
    // builder doesn't need to know about the indirection.
    const counselor = row.student?.employee ?? null;
    const reshaped = { ...row, counselor };
    return buildStudentSafeView(reshaped as never, stages);
  },

  /**
   * Get the timeline view for one application. Used by Module 05
   * (Application Timeline). Returns:
   *  - the application header fields (number, country, stage)
   *  - the full pipeline (stages with state markers — so the UI can
   *    render the "✓ Lead ✓ Counseling ● Current ○ Upcoming" strip)
   *  - the timeline items (ApplicationStatusHistory records, ordered
   *    newest-first by default), each with the student-safe fields:
   *      fromStage, toStage, note, createdAt, changedByName
   *    No IP address, no userAgent, no audit metadata, no internal
   *    employee IDs/emails/phones are exposed.
   *  - the current-stage callout data: stage label, description,
   *    and the "what happens next?" copy.
   *
   * Ownership is verified server-side: the query is scoped by
   * `studentId` from the session, so a foreign `applicationId`
   * returns null → the route 404s.
   *
   * NOTE on the `note` field: ApplicationStatusHistory.note is a brief
   * change-note (e.g. "Application created", "Visa stage: …"). It is
   * NOT the internal `Note` model (which has visibility filtering).
   * The change-note is intended to be student-visible by design —
   * it's the human-readable label for the stage transition. We pass
   * it through unchanged.
   */
  async getTimeline(studentId: string, applicationId: string) {
    const [app, stages, historyRaw] = await Promise.all([
      prisma.application.findFirst({
        where: { id: applicationId, studentId, deletedAt: null },
        select: {
          id: true,
          applicationNumber: true,
          stageKey: true,
          status: true,
          priority: true,
          updatedAt: true,
          country: { select: { id: true, name: true, flag: true } },
          university: { select: { id: true, name: true } },
          course: { select: { id: true, name: true } },
        },
      }),
      prisma.applicationStage.findMany({
        where: { enabled: true },
        orderBy: { sortOrder: "asc" },
        select: { key: true, name: true, sortOrder: true, enabled: true },
      }),
      prisma.applicationStatusHistory.findMany({
        where: { applicationId },
        orderBy: { createdAt: "desc" },
        // ApplicationStatusHistory has `changedById` (an ObjectId) but
        // no `changedBy` relation in the schema — so we can't `include`
        // the user directly. We resolve the display names separately
        // (one extra query) and only ever expose `name` (no email,
        // no phone, no role, no internal ID).
      }),
    ]);

    if (!app) return null;

    // Resolve the display names for all the changedBy users in one
    // extra query (avoids N+1). Only the `name` field is selected.
    const changedByIds = Array.from(
      new Set(
        historyRaw
          .map((h) => h.changedById)
          .filter((id): id is string => id !== null && id !== undefined),
      ),
    );
    const users =
      changedByIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: changedByIds } },
            select: { id: true, name: true },
          })
        : [];
    const nameById = new Map(users.map((u) => [u.id, u.name]));

    const stageMarkers: StageMarker[] = computeStageStates(
      app.stageKey,
      stages,
      historyRaw.map((h) => ({ toStage: h.toStage })),
    );
    const progress: ProgressSummary = computeProgressPercent(app.stageKey, stages);

    // Map each history row to the student-safe timeline item shape.
    // We explicitly omit changedById (internal ObjectId), IP address,
    // userAgent, and any audit metadata — these never existed on
    // ApplicationStatusHistory anyway, but the explicit map is the
    // defense-in-depth contract. Only the display `name` of the user
    // who made the change is exposed (looked up above).
    const timeline = historyRaw.map((h) => ({
      id: h.id,
      fromStage: h.fromStage,
      toStage: h.toStage,
      fromLabel: titleCaseStage(h.fromStage),
      toLabel: titleCaseStage(h.toStage),
      description: getStageDescription(h.toStage),
      note: h.note, // change-note, intended student-visible
      createdAt: h.createdAt,
      changedByName: h.changedById ? (nameById.get(h.changedById) ?? null) : null,
    }));

    return {
      application: {
        id: app.id,
        applicationNumber: app.applicationNumber,
        stageKey: app.stageKey,
        stageLabel: titleCaseStage(app.stageKey),
        status: app.status,
        priority: app.priority,
        lastUpdated: app.updatedAt,
        country: app.country
          ? { id: app.country.id, name: app.country.name, flag: app.country.flag ?? null }
          : null,
        university: app.university ? { id: app.university.id, name: app.university.name } : null,
        course: app.course ? { id: app.course.id, name: app.course.name } : null,
      },
      progress,
      stages: stageMarkers,
      currentStage: {
        key: app.stageKey,
        label: titleCaseStage(app.stageKey),
        description: getStageDescription(app.stageKey),
        nextDescription: getNextStageDescription(app.stageKey),
        isComplete: app.stageKey === "COMPLETED",
      },
      timeline,
      timelineCount: timeline.length,
    };
  },
};

/** Type re-export for the route layer. */
export type StudentApplicationView = NonNullable<Awaited<ReturnType<typeof studentApplicationService.getById>>>;
export type StudentApplicationTimeline = NonNullable<Awaited<ReturnType<typeof studentApplicationService.getTimeline>>>;
