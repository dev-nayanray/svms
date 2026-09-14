import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import type { EmployeeScope } from "@/lib/services/employee-dashboard";

/**
 * Employee "My Students" service — server-side data layer for the
 * /employee/students list page and the /employee/students/[id] detail page.
 *
 * Reuses the dashboard's `EmployeeScope` type so case ownership stays
 * consistent across modules. Every query embeds the caller's scope filter —
 * the employeeId / userId always come from the session, never from the
 * client. Foreign students return 404 (never 403) so ownership is never
 * confirmed — IDOR closure.
 *
 * The list query is a single findMany with a select that joins Application
 * (most-recent), Country, University, and VisaApplication so the table can
 * surface the brief's columns without an N+1.
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type StudentSortKey =
  | "name"
  | "studentId"
  | "email"
  | "phone"
  | "country"
  | "createdAt"
  | "updatedAt";

export type StudentListFilters = {
  search?: string;
  status?: string; // ACTIVE | INACTIVE | SUSPENDED | PENDING
  stage?: string; // application stageKey
  country?: string; // country name (Student.country is a free-text field)
  universityId?: string;
  visaStage?: string; // visa stage (PREPARATION | SUBMITTED | APPROVED | REFUSED …)
  priority?: string; // task priority proxy (HIGH | MEDIUM | LOW)
  branchId?: string; // not implemented — Student has no branchId; left for future
  createdFrom?: string; // ISO date
  createdTo?: string; // ISO date
  archived?: boolean; // when true, show only archived (status=INACTIVE). default: false.
};

export type StudentRow = {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  country: string | null;
  city: string | null;
  status: string;
  createdAt: Date;
  /** Primary application — most recent one. May be null for new students. */
  primaryApplication: {
    id: string;
    applicationNumber: string;
    stageKey: string;
    status: string;
    countryName: string | null;
    universityName: string | null;
  } | null;
  /** Visa stage for the primary application — null when no visa record. */
  visaStage: string | null;
  /** Next deadline: earliest future task/intake/visa date for this student. */
  nextDeadline: Date | null;
  /** Highest task priority currently open — null when no open tasks. */
  priority: string | null;
};

export type StudentListResult = {
  rows: StudentRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

// ─────────────────────────────────────────────
// List query — single findMany with select, joined relations, no N+1
// ─────────────────────────────────────────────

const SORT_ALLOWLIST: Record<StudentSortKey, Record<string, "asc" | "desc">> = {
  name: { firstName: "asc" },
  studentId: { studentId: "asc" },
  email: { email: "asc" },
  phone: { phone: "asc" },
  country: { country: "asc" },
  createdAt: { createdAt: "desc" },
  updatedAt: { updatedAt: "desc" },
};

export async function listStudents(
  scope: EmployeeScope,
  params: {
    filters?: StudentListFilters;
    page?: number;
    pageSize?: number;
    sortBy?: StudentSortKey;
    sortOrder?: "asc" | "desc";
  } = {},
): Promise<StudentListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const filters = params.filters ?? {};
  const sortBy = params.sortBy ?? "createdAt";
  const sortOrder = params.sortOrder ?? "desc";

  // Build the where clause from the caller's scope + filters.
  const owner = scope.isAdmin ? {} : { assignedEmployeeId: scope.employeeId };
  const status = filters.archived
    ? { status: "INACTIVE" }
    : filters.status
      ? { status: filters.status }
      : { status: { not: "INACTIVE" } }; // default: active only

  const search = filters.search?.trim();
  const searchFilter = search
    ? {
        OR: [
          { firstName: { contains: search, mode: "insensitive" as const } },
          { lastName: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { studentId: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const countryFilter = filters.country ? { country: filters.country } : {};

  // Date range on createdAt
  const createdRange: Record<string, unknown> = {};
  if (filters.createdFrom) {
    const d = new Date(filters.createdFrom);
    if (!isNaN(d.getTime())) createdRange.gte = d;
  }
  if (filters.createdTo) {
    const d = new Date(filters.createdTo);
    if (!isNaN(d.getTime())) createdRange.lte = d;
  }
  const dateFilter = Object.keys(createdRange).length > 0 ? { createdAt: createdRange } : {};

  // Application-related filters (stage, university, visa) — apply via the
  // `applications` relation so we don't need a separate query.
  const appFilter: Record<string, unknown> = {};
  if (filters.stage) appFilter.stageKey = filters.stage;
  if (filters.universityId) appFilter.universityId = filters.universityId;

  const visaFilter: Record<string, unknown> = {};
  if (filters.visaStage) visaFilter.stage = filters.visaStage;
  if (Object.keys(visaFilter).length > 0) {
    appFilter.visaApplications = { some: visaFilter };
  }

  const applicationsFilter = Object.keys(appFilter).length > 0 ? { applications: { some: appFilter } } : {};

  const where = {
    ...owner,
    ...status,
    ...searchFilter,
    ...countryFilter,
    ...dateFilter,
    ...applicationsFilter,
  };

  // Sort — use the allowlist to avoid Prisma's union-type narrowing issues.
  const sortKey = sortBy in SORT_ALLOWLIST ? sortBy : "createdAt";
  const sortClause = { ...SORT_ALLOWLIST[sortKey] };
  if (sortOrder === "desc" && sortKey !== "createdAt" && sortKey !== "updatedAt") {
    // createdAt / updatedAt default to desc in the allowlist above.
    // For other columns, flip to desc when requested.
    const key = Object.keys(sortClause)[0];
    sortClause[key] = "desc";
  }

  const [rows, total] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: [sortClause],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        studentId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        country: true,
        city: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        applications: {
          orderBy: { updatedAt: "desc" },
          take: 1, // primary application = most-recent
          select: {
            id: true,
            applicationNumber: true,
            stageKey: true,
            status: true,
            country: { select: { name: true } },
            university: { select: { name: true } },
            visaApplications: {
              orderBy: { updatedAt: "desc" },
              take: 1,
              select: { stage: true },
            },
            tasks: {
              where: { status: { in: ["TODO", "IN_PROGRESS"] }, dueDate: { not: null } },
              orderBy: { dueDate: "asc" },
              take: 1,
              select: { dueDate: true, priority: true },
            },
          },
        },
        tasks: {
          where: { status: { in: ["TODO", "IN_PROGRESS"] } },
          orderBy: { priority: "desc" },
          take: 1,
          select: { priority: true },
        },
      },
    }),
    prisma.student.count({ where }),
  ]);

  const mapped: StudentRow[] = rows.map((r) => {
    const app = r.applications[0] ?? null;
    return {
      id: r.id,
      studentId: r.studentId,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      phone: r.phone,
      country: r.country,
      city: r.city,
      status: r.status,
      createdAt: r.createdAt,
      primaryApplication: app
        ? {
            id: app.id,
            applicationNumber: app.applicationNumber,
            stageKey: app.stageKey,
            status: app.status,
            countryName: app.country?.name ?? null,
            universityName: app.university?.name ?? null,
          }
        : null,
      visaStage: app?.visaApplications[0]?.stage ?? null,
      nextDeadline: app?.tasks[0]?.dueDate ?? null,
      priority: r.tasks[0]?.priority ?? null,
    };
  });

  return {
    rows: mapped,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// ─────────────────────────────────────────────
// Detail (Student 360) — single student + all related records
// ─────────────────────────────────────────────

export type StudentDetail = NonNullable<Awaited<ReturnType<typeof getStudentById>>>;

export async function getStudentById(
  scope: EmployeeScope,
  id: string,
): Promise<{
  id: string;
  userId: string;
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  nationality: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  postalCode: string | null;
  passportNumber: string | null;
  passportIssueDate: Date | null;
  passportExpiryDate: Date | null;
  passportIssuingCountry: string | null;
  avatar: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  assignedEmployeeId: string | null;
  assignedEmployee: { id: string; title: string | null; user: { name: string; email: string } } | null;
  applications: {
    id: string;
    applicationNumber: string;
    stageKey: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    country: { name: string } | null;
    university: { name: string } | null;
    course: { name: string } | null;
  }[];
  documents: {
    id: string;
    name: string;
    status: string;
    fileName: string | null;
    mimeType: string | null;
    fileSize: number | null;
    uploadedAt: Date | null;
    reviewedAt: Date | null;
    reviewNote: string | null;
    createdAt: Date;
  }[];
  payments: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    paymentMethod: string;
    paymentDate: Date | null;
    createdAt: Date;
  }[];
  invoices: {
    id: string;
    invoiceNumber: string;
    total: number;
    currency: string;
    status: string;
    issueDate: Date;
    dueDate: Date | null;
  }[];
  tasks: {
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: Date | null;
    createdAt: Date;
  }[];
  conversations: {
    id: string;
    subject: string | null;
    createdAt: Date;
    updatedAt: Date;
    messages: {
      id: string;
      body: string;
      senderId: string;
      readAt: Date | null;
      createdAt: Date;
    }[];
  }[];
  visaApplications: {
    id: string;
    stage: string;
    visaType: string | null;
    submittedAt: Date | null;
    biometricsAt: Date | null;
    interviewAt: Date | null;
    decisionAt: Date | null;
    createdAt: Date;
    application: { id: string; applicationNumber: string };
  }[];
  appointments: {
    id: string;
    title: string;
    type: string;
    scheduledAt: Date;
    status: string;
    durationMinutes: number;
    location: string | null;
  }[];
  academicRecords: {
    id: string;
    level: string;
    institution: string;
    group: string | null;
    subject: string | null;
    passingYear: number | null;
    result: string | null;
    certificateUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  englishProficiencies: {
    id: string;
    testType: string;
    overallScore: number | null;
    readingScore: number | null;
    writingScore: number | null;
    listeningScore: number | null;
    speakingScore: number | null;
    testDate: Date | null;
    expiryDate: Date | null;
    certificateUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  notes: {
    id: string;
    body: string;
    visibility: string;
    pinned: boolean;
    authorId: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
} | null> {
  // IDOR closure: the scope filter is always present, even for ADMIN
  // (where it's `{}`). For EMPLOYEE it's `{ assignedEmployeeId: <emp-id> }`
  // so a foreign student id returns null → caller renders 404.
  const ownerFilter = scope.isAdmin ? {} : { assignedEmployee: { userId: scope.userId } };

  const student = await prisma.student.findFirst({
    where: { id, ...ownerFilter },
    select: {
      id: true,
      userId: true,
      studentId: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      dateOfBirth: true,
      gender: true,
      nationality: true,
      country: true,
      city: true,
      address: true,
      postalCode: true,
      passportNumber: true,
      passportIssueDate: true,
      passportExpiryDate: true,
      passportIssuingCountry: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      assignedEmployeeId: true,
      assignedEmployee: {
        select: { id: true, title: true, user: { select: { name: true, email: true } } },
      },
      user: { select: { avatar: true } },
      applications: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          applicationNumber: true,
          stageKey: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          country: { select: { name: true } },
          university: { select: { name: true } },
          course: { select: { name: true } },
        },
      },
      documents: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          status: true,
          fileName: true,
          mimeType: true,
          fileSize: true,
          uploadedAt: true,
          reviewedAt: true,
          reviewNote: true,
          createdAt: true,
        },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          paymentMethod: true,
          paymentDate: true,
          createdAt: true,
        },
      },
      invoices: {
        orderBy: { issueDate: "desc" },
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          currency: true,
          status: true,
          issueDate: true,
          dueDate: true,
        },
      },
      tasks: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          createdAt: true,
        },
      },
      conversations: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          subject: true,
          createdAt: true,
          updatedAt: true,
          messages: {
            orderBy: { createdAt: "desc" },
            take: 20,
            select: { id: true, body: true, senderId: true, readAt: true, createdAt: true },
          },
        },
      },
      appointments: {
        orderBy: { scheduledAt: "desc" },
        take: 10,
        select: {
          id: true,
          title: true,
          type: true,
          scheduledAt: true,
          status: true,
          durationMinutes: true,
          location: true,
        },
      },
      academicRecords: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          level: true,
          institution: true,
          group: true,
          subject: true,
          passingYear: true,
          result: true,
          certificateUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      englishProficiencies: {
        orderBy: { testDate: "desc" },
        select: {
          id: true,
          testType: true,
          overallScore: true,
          readingScore: true,
          writingScore: true,
          listeningScore: true,
          speakingScore: true,
          testDate: true,
          expiryDate: true,
          certificateUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      notes: {
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          body: true,
          visibility: true,
          pinned: true,
          authorId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!student) return null;

  // Visa applications are joined via Application — fetch separately so we can
  // surface them in the Timeline + Visa tab without a second page-load.
  const visaApplications = await prisma.visaApplication.findMany({
    where: { application: { studentId: student.id } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      stage: true,
      visaType: true,
      submittedAt: true,
      biometricsAt: true,
      interviewAt: true,
      decisionAt: true,
      createdAt: true,
      application: { select: { id: true, applicationNumber: true } },
    },
  });

  const { user: _userRow, ...rest } = student;
  return { ...rest, avatar: _userRow?.avatar ?? null, visaApplications };
}

// ─────────────────────────────────────────────
// Convenience: resolve student or 404 — used by the detail page
// ─────────────────────────────────────────────

export async function requireStudent(scope: EmployeeScope, id: string) {
  const student = await getStudentById(scope, id);
  if (!student) throw new HttpError(404, "NOT_FOUND", "Student not found");
  return student;
}

// ─────────────────────────────────────────────
// Timeline — merged activity across all related entities
// ─────────────────────────────────────────────

export type TimelineItem = {
  kind:
    | "application_created"
    | "application_stage_changed"
    | "document_uploaded"
    | "document_reviewed"
    | "task_created"
    | "task_completed"
    | "payment_recorded"
    | "invoice_issued"
    | "visa_submitted"
    | "visa_decided"
    | "appointment_scheduled"
    | "message_received"
    | "academic_added"
    | "english_added"
    | "note_added"
    | "profile_updated";
  title: string;
  detail: string;
  at: Date;
  /** When true, this item is only visible to employees with audit.read. */
  internal?: boolean;
};

export function buildStudentTimeline(student: StudentDetail): TimelineItem[] {
  const items: TimelineItem[] = [];

  for (const app of student.applications) {
    items.push({
      kind: "application_created",
      title: `Application ${app.applicationNumber} created`,
      detail: `${app.country?.name ?? "—"}${app.university ? ` · ${app.university.name}` : ""}`,
      at: app.createdAt,
    });
    items.push({
      kind: "application_stage_changed",
      title: `Stage: ${app.stageKey.replace(/_/g, " ").toLowerCase()}`,
      detail: `Status: ${app.status}`,
      at: app.updatedAt,
    });
  }

  for (const d of student.documents) {
    if (d.uploadedAt) {
      items.push({
        kind: "document_uploaded",
        title: `Document uploaded: ${d.name}`,
        detail: `Status: ${d.status}`,
        at: d.uploadedAt,
      });
    }
    if (d.reviewedAt) {
      items.push({
        kind: "document_reviewed",
        title: `Document reviewed: ${d.name}`,
        detail: `Decision: ${d.status}${d.reviewNote ? ` · ${d.reviewNote}` : ""}`,
        at: d.reviewedAt,
      });
    }
  }

  for (const t of student.tasks) {
    items.push({
      kind: t.status === "COMPLETED" ? "task_completed" : "task_created",
      title: t.title,
      detail: `Priority: ${t.priority} · Status: ${t.status}`,
      at: t.createdAt,
    });
  }

  for (const p of student.payments) {
    items.push({
      kind: "payment_recorded",
      title: `Payment: ${p.currency} ${p.amount}`,
      detail: `Method: ${p.paymentMethod} · Status: ${p.status}`,
      at: p.paymentDate ?? p.createdAt,
    });
  }

  for (const inv of student.invoices) {
    items.push({
      kind: "invoice_issued",
      title: `Invoice ${inv.invoiceNumber}`,
      detail: `${inv.currency} ${inv.total} · Status: ${inv.status}`,
      at: inv.issueDate,
    });
  }

  for (const v of student.visaApplications) {
    if (v.submittedAt) {
      items.push({
        kind: "visa_submitted",
        title: `Visa submitted (${v.application.applicationNumber})`,
        detail: `Stage: ${v.stage}${v.visaType ? ` · ${v.visaType}` : ""}`,
        at: v.submittedAt,
      });
    }
    if (v.decisionAt) {
      items.push({
        kind: "visa_decided",
        title: `Visa decision: ${v.stage}`,
        detail: `Application ${v.application.applicationNumber}`,
        at: v.decisionAt,
      });
    }
  }

  for (const ap of student.appointments) {
    items.push({
      kind: "appointment_scheduled",
      title: `Appointment: ${ap.title}`,
      detail: `${ap.type} · ${ap.scheduledAt.toISOString()}`,
      at: ap.scheduledAt,
    });
  }

  for (const c of student.conversations) {
    for (const m of c.messages) {
      items.push({
        kind: "message_received",
        title: `Message in: ${c.subject ?? "Conversation"}`,
        detail: m.body.slice(0, 100),
        at: m.createdAt,
      });
    }
  }

  for (const a of student.academicRecords) {
    items.push({
      kind: "academic_added",
      title: `Academic record: ${a.level}`,
      detail: `${a.institution}${a.passingYear ? ` · ${a.passingYear}` : ""}${a.result ? ` · ${a.result}` : ""}`,
      at: a.createdAt,
    });
  }

  for (const e of student.englishProficiencies) {
    items.push({
      kind: "english_added",
      title: `English test: ${e.testType}`,
      detail: `Overall: ${e.overallScore ?? "—"}${e.testDate ? ` · ${e.testDate.toISOString().slice(0, 10)}` : ""}`,
      at: e.createdAt,
    });
  }

  for (const n of student.notes) {
    items.push({
      kind: "note_added",
      title: n.pinned ? "📌 Pinned note" : "Note added",
      detail: n.body.slice(0, 100),
      at: n.createdAt,
      // INTERNAL notes are private to staff — flagged so the page can hide
      // them from employees who lack audit.read (defense in depth).
      internal: n.visibility === "INTERNAL",
    });
  }

  // Profile update — surfaced from the updatedAt timestamp. This is the
  // only "synthetic" event (no dedicated audit row) so we mark it internal
  // and let the page filter based on the caller's permissions.
  items.push({
    kind: "profile_updated",
    title: "Profile updated",
    detail: `Last update: ${student.updatedAt.toISOString().slice(0, 10)}`,
    at: student.updatedAt,
    internal: true,
  });

  return items.sort((a, b) => b.at.getTime() - a.at.getTime());
}

/**
 * Permission-filtered timeline. INTERNAL items (notes marked INTERNAL, profile
 * update synthetic events) are stripped when the caller lacks `audit.read`.
 * This is the function the page should call — `buildStudentTimeline` is the
 * raw builder used for testing.
 */
export function buildStudentTimelineForUser(
  student: StudentDetail,
  canSeeInternal: boolean,
): TimelineItem[] {
  const all = buildStudentTimeline(student);
  return canSeeInternal ? all : all.filter((i) => !i.internal);
}
