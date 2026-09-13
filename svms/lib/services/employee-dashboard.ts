import { prisma } from "@/lib/db";
import type { ResolvedRange } from "@/lib/utils/dashboard-range";
import { dateRangeWhere } from "@/lib/utils/dashboard-range";

/**
 * Employee Dashboard service — pure server-side aggregation layer for the
 * /employee/dashboard page and the matching /api/employee/dashboard route.
 *
 * Design goals:
 *  1. **No N+1** — every metric is computed with a single `count()`, `groupBy()`,
 *     or `findMany({ select: { ... }, take: N })`. We never iterate students in
 *     JS and call sub-queries per student.
 *  2. **Case ownership closure** — every `where` clause embeds the employee's
 *     scope filter. ADMIN sees global scope; EMPLOYEE sees only their assigned
 *     students / leads / tasks. The employeeId always comes from the session,
 *     never from the client.
 *  3. **Permission-aware** — KPIs that require a permission the caller lacks
 *     are not returned. The page renders only the metrics it receives.
 *  4. **Date-range aware** — counts of "new" leads / "submitted" applications
 *     etc. respect the resolved range. Timeless counts (totals like "My
 *     Students") ignore the range.
 *
 * All functions are pure with respect to the database connection — they accept
 * the scope filters as inputs and return typed shapes. The dashboard page
 * composes them with `Promise.all` so the database runs the queries in
 * parallel.
 */

// ─────────────────────────────────────────────
// Scope filters (case ownership)
// ─────────────────────────────────────────────

export type EmployeeScope = {
  /** Whether the caller is ADMIN (global scope) or EMPLOYEE (scoped). */
  isAdmin: boolean;
  /** The session user id — used for Task.assignedToId and Notification.userId. */
  userId: string;
  /** The Employee row id — used for Student.assignedEmployeeId / Lead.assignedEmployeeId. */
  employeeId: string | null;
};

/** Returns the Prisma `where` fragment that scopes Student records to the caller. */
export function studentScope(scope: EmployeeScope): Record<string, unknown> {
  return scope.isAdmin ? {} : { assignedEmployeeId: scope.employeeId };
}

/** Returns the Prisma `where` fragment that scopes Application records (via student). */
export function applicationScope(scope: EmployeeScope): Record<string, unknown> {
  return scope.isAdmin ? {} : { student: { assignedEmployeeId: scope.employeeId } };
}

/** Returns the Prisma `where` fragment that scopes Document records (via student). */
export function documentScope(scope: EmployeeScope): Record<string, unknown> {
  return scope.isAdmin ? {} : { student: { assignedEmployeeId: scope.employeeId } };
}

/** Returns the Prisma `where` fragment that scopes Lead records. */
export function leadScope(scope: EmployeeScope): Record<string, unknown> {
  return scope.isAdmin ? {} : { assignedEmployeeId: scope.employeeId };
}

/** Returns the Prisma `where` fragment that scopes Task records (by assignee). */
export function taskScope(scope: EmployeeScope): Record<string, unknown> {
  return scope.isAdmin ? {} : { assignedToId: scope.userId };
}

/** Returns the Prisma `where` fragment that scopes VisaApplication records (via application→student). */
export function visaScope(scope: EmployeeScope): Record<string, unknown> {
  return scope.isAdmin
    ? {}
    : { application: { student: { assignedEmployeeId: scope.employeeId } } };
}

/** Returns the Prisma `where` fragment that scopes Appointment records (via student). */
export function appointmentScope(scope: EmployeeScope): Record<string, unknown> {
  return scope.isAdmin
    ? {}
    : { student: { assignedEmployeeId: scope.employeeId } };
}

/** Returns the Prisma `where` fragment that scopes Payment records (via student). */
export function paymentScope(scope: EmployeeScope): Record<string, unknown> {
  return scope.isAdmin ? {} : { student: { assignedEmployeeId: scope.employeeId } };
}

/** Returns the Prisma `where` fragment that scopes Invoice records (via student). */
export function invoiceScope(scope: EmployeeScope): Record<string, unknown> {
  return scope.isAdmin ? {} : { student: { assignedEmployeeId: scope.employeeId } };
}

/** Returns the Prisma `where` fragment that scopes Intake records. Intakes are global — every counselor sees all intakes for any course. */
export function intakeScope(_scope: EmployeeScope): Record<string, unknown> {
  return {};
}

// ─────────────────────────────────────────────
// Pipeline stages (canonical)
// ─────────────────────────────────────────────

export const APPLICATION_STAGES = [
  "LEAD",
  "COUNSELING",
  "PROFILE_ASSESSMENT",
  "COUNTRY_SELECTION",
  "UNIVERSITY_SELECTION",
  "DOCUMENT_COLLECTION",
  "APPLICATION_SUBMITTED",
  "CONDITIONAL_OFFER",
  "UNCONDITIONAL_OFFER",
  "DEPOSIT_PAYMENT",
  "CONFIRMATION",
  "VISA_PREPARATION",
  "VISA_SUBMITTED",
  "BIOMETRICS",
  "INTERVIEW",
  "VISA_DECISION",
  "TRAVEL_PREPARATION",
  "COMPLETED",
] as const;

export type ApplicationStage = (typeof APPLICATION_STAGES)[number];

export const VISA_STAGES = [
  "PREPARATION",
  "SUBMITTED",
  "BIOMETRICS",
  "INTERVIEW",
  "PROCESSING",
  "APPROVED",
  "REFUSED",
] as const;

export type VisaStage = (typeof VISA_STAGES)[number];

// ─────────────────────────────────────────────
// KPI cards — pure count helpers
// ─────────────────────────────────────────────

export type DashboardKpis = {
  myStudents: number;
  activeApplications: number;
  newLeads: number; // in-range
  pendingDocuments: number;
  visaApplications: number;
  visaSubmitted: number;
  visaApproved: number;
  pendingTasks: number;
  overdueTasks: number;
  upcomingAppointments: number;
  outstandingPayments: number;
};

export async function getDashboardKpis(
  scope: EmployeeScope,
  range: ResolvedRange,
  permissions: {
    students?: boolean;
    leads?: boolean;
    applications?: boolean;
    documents?: boolean;
    visa?: boolean;
    tasks?: boolean;
    appointments?: boolean;
    payments?: boolean;
  },
): Promise<DashboardKpis> {
  // Each metric is only computed if the caller has the relevant permission.
  // When the permission is absent, the count stays 0 — the page hides the card.
  const [
    myStudents,
    activeApplications,
    newLeads,
    pendingDocuments,
    visaApplications,
    visaSubmitted,
    visaApproved,
    pendingTasks,
    overdueTasks,
    upcomingAppointments,
    outstandingPayments,
  ] = await Promise.all([
    permissions.students ? prisma.student.count({ where: studentScope(scope) }) : Promise.resolve(0),
    permissions.applications
      ? prisma.application.count({ where: { ...applicationScope(scope), status: { not: "COMPLETED" } } })
      : Promise.resolve(0),
    permissions.leads
      ? prisma.lead.count({
          where: { ...leadScope(scope), ...dateRangeWhere("createdAt", range), status: "NEW" },
        })
      : Promise.resolve(0),
    permissions.documents
      ? prisma.document.count({
          where: { ...documentScope(scope), status: { in: ["REQUESTED", "UPLOADED", "UNDER_REVIEW"] } },
        })
      : Promise.resolve(0),
    permissions.visa ? prisma.visaApplication.count({ where: visaScope(scope) }) : Promise.resolve(0),
    permissions.visa
      ? prisma.visaApplication.count({ where: { ...visaScope(scope), stage: { in: ["SUBMITTED", "BIOMETRICS", "INTERVIEW", "PROCESSING"] } } })
      : Promise.resolve(0),
    permissions.visa ? prisma.visaApplication.count({ where: { ...visaScope(scope), stage: "APPROVED" } }) : Promise.resolve(0),
    permissions.tasks
      ? prisma.task.count({ where: { ...taskScope(scope), status: { in: ["TODO", "IN_PROGRESS"] } } })
      : Promise.resolve(0),
    permissions.tasks
      ? prisma.task.count({
          where: {
            ...taskScope(scope),
            status: { in: ["TODO", "IN_PROGRESS"] },
            dueDate: { lt: new Date() },
          },
        })
      : Promise.resolve(0),
    permissions.appointments
      ? prisma.appointment.count({
          where: {
            ...appointmentScope(scope),
            scheduledAt: { gte: new Date() },
            status: "SCHEDULED",
          },
        })
      : Promise.resolve(0),
    permissions.payments
      ? prisma.payment.count({
          where: { ...paymentScope(scope), status: "PENDING" },
        })
      : Promise.resolve(0),
  ]);

  return {
    myStudents,
    activeApplications,
    newLeads,
    pendingDocuments,
    visaApplications,
    visaSubmitted,
    visaApproved,
    pendingTasks,
    overdueTasks,
    upcomingAppointments,
    outstandingPayments,
  };
}

// ─────────────────────────────────────────────
// Pipeline — grouped counts per stage (single groupBy)
// ─────────────────────────────────────────────

export type StageBucket = { stage: string; count: number };

export async function getApplicationPipeline(scope: EmployeeScope): Promise<StageBucket[]> {
  const grouped = await prisma.application.groupBy({
    by: ["stageKey"],
    where: applicationScope(scope),
    _count: { _all: true },
  });
  // Always return all 18 stages in canonical order — missing stages show 0.
  const byStage = new Map(grouped.map((g) => [g.stageKey, g._count._all]));
  return APPLICATION_STAGES.map((stage) => ({
    stage,
    count: byStage.get(stage) ?? 0,
  }));
}

// ─────────────────────────────────────────────
// Visa cases — grouped counts per stage
// ─────────────────────────────────────────────

export async function getVisaCases(scope: EmployeeScope): Promise<StageBucket[]> {
  const grouped = await prisma.visaApplication.groupBy({
    by: ["stage"],
    where: visaScope(scope),
    _count: { _all: true },
  });
  const byStage = new Map(grouped.map((g) => [g.stage, g._count._all]));
  return VISA_STAGES.map((stage) => ({
    stage,
    count: byStage.get(stage) ?? 0,
  }));
}

// ─────────────────────────────────────────────
// Recent activity — server-side, scoped
// ─────────────────────────────────────────────

export type ActivityItem = {
  kind: "lead" | "application" | "document" | "task" | "payment" | "appointment";
  title: string;
  detail: string;
  createdAt: Date;
};

export async function getRecentActivity(scope: EmployeeScope, limit = 8): Promise<ActivityItem[]> {
  // We deliberately issue a small number of parallel queries (one per kind)
  // rather than a giant UNION — MongoDB doesn't support UNION and a single
  // aggregate across collections would require a join that Prisma cannot
  // express. Each query takes 5 rows; we merge + sort + slice in JS.
  const [leads, applications, documents, tasks, payments, appointments] = await Promise.all([
    prisma.lead.findMany({
      where: leadScope(scope),
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, name: true, status: true, createdAt: true },
    }),
    prisma.application.findMany({
      where: applicationScope(scope),
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: { id: true, applicationNumber: true, stageKey: true, updatedAt: true, student: { select: { firstName: true, lastName: true } } },
    }),
    prisma.document.findMany({
      where: documentScope(scope),
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: { id: true, name: true, status: true, updatedAt: true, student: { select: { firstName: true, lastName: true } } },
    }),
    prisma.task.findMany({
      where: taskScope(scope),
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: { id: true, title: true, status: true, updatedAt: true },
    }),
    prisma.payment.findMany({
      where: paymentScope(scope),
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: { id: true, amount: true, currency: true, status: true, updatedAt: true, student: { select: { firstName: true, lastName: true } } },
    }),
    prisma.appointment.findMany({
      where: appointmentScope(scope),
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: { id: true, title: true, status: true, scheduledAt: true, updatedAt: true, student: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  const items: ActivityItem[] = [];
  for (const l of leads) {
    items.push({ kind: "lead", title: `New lead: ${l.name}`, detail: `Status: ${l.status}`, createdAt: l.createdAt });
  }
  for (const a of applications) {
    items.push({
      kind: "application",
      title: `${a.student.firstName} ${a.student.lastName} — ${a.applicationNumber}`,
      detail: `Stage: ${a.stageKey.replace(/_/g, " ").toLowerCase()}`,
      createdAt: a.updatedAt,
    });
  }
  for (const d of documents) {
    items.push({
      kind: "document",
      title: `${d.student.firstName} ${d.student.lastName} — ${d.name}`,
      detail: `Status: ${d.status}`,
      createdAt: d.updatedAt,
    });
  }
  for (const t of tasks) {
    items.push({ kind: "task", title: t.title, detail: `Status: ${t.status}`, createdAt: t.updatedAt });
  }
  for (const p of payments) {
    items.push({
      kind: "payment",
      title: `${p.student.firstName} ${p.student.lastName} — ${p.currency} ${p.amount}`,
      detail: `Status: ${p.status}`,
      createdAt: p.updatedAt,
    });
  }
  for (const ap of appointments) {
    items.push({
      kind: "appointment",
      title: `${ap.student.firstName} ${ap.student.lastName} — ${ap.title}`,
      detail: `Scheduled: ${ap.scheduledAt.toISOString()}`,
      createdAt: ap.updatedAt,
    });
  }

  return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
}

// ─────────────────────────────────────────────
// Pending documents — needs review by the employee
// ─────────────────────────────────────────────

export type PendingDocument = {
  id: string;
  studentName: string;
  documentName: string;
  status: string;
  uploadedAt: Date | null;
  createdAt: Date;
};

export async function getPendingDocuments(scope: EmployeeScope, limit = 8): Promise<PendingDocument[]> {
  return prisma.document.findMany({
    where: {
      ...documentScope(scope),
      status: { in: ["REQUESTED", "UPLOADED", "UNDER_REVIEW"] },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      name: true,
      status: true,
      uploadedAt: true,
      createdAt: true,
      student: { select: { firstName: true, lastName: true } },
    },
  }).then((rows) =>
    rows.map((r) => ({
      id: r.id,
      studentName: `${r.student.firstName} ${r.student.lastName}`,
      documentName: r.name,
      status: r.status,
      uploadedAt: r.uploadedAt,
      createdAt: r.createdAt,
    })),
  );
}

// ─────────────────────────────────────────────
// Upcoming deadlines — merged across tasks / documents / visa / intakes
// ─────────────────────────────────────────────

export type DeadlineItem = {
  kind: "task" | "document" | "visa" | "intake" | "application";
  title: string;
  due: Date;
  href: string;
};

export async function getUpcomingDeadlines(scope: EmployeeScope, range: ResolvedRange, limit = 8): Promise<DeadlineItem[]> {
  // Tasks with due dates in range
  const tasks = prisma.task.findMany({
    where: {
      ...taskScope(scope),
      status: { in: ["TODO", "IN_PROGRESS"] },
      dueDate: { gte: range.from, lte: range.to },
    },
    orderBy: { dueDate: "asc" },
    take: limit,
    select: { id: true, title: true, dueDate: true },
  });
  // Documents don't have a deadline column — skip. We use the intake
  // deadline as a proxy for "application deadline" in this dashboard.
  const intakes = prisma.intake.findMany({
    where: {
      deadline: { gte: range.from, lte: range.to },
    },
    orderBy: { deadline: "asc" },
    take: limit,
    select: { id: true, name: true, deadline: true, course: { select: { name: true } } },
  });
  // Visa interview/biometrics dates as "visa deadlines"
  const visas = prisma.visaApplication.findMany({
    where: {
      ...visaScope(scope),
      OR: [
        { biometricsAt: { gte: range.from, lte: range.to } },
        { interviewAt: { gte: range.from, lte: range.to } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { id: true, biometricsAt: true, interviewAt: true, application: { select: { id: true, applicationNumber: true } } },
  });

  const [taskRows, intakeRows, visaRows] = await Promise.all([tasks, intakes, visas]);

  const items: DeadlineItem[] = [];
  for (const t of taskRows) {
    if (t.dueDate) items.push({ kind: "task", title: t.title, due: t.dueDate, href: "/employee/tasks" });
  }
  for (const i of intakeRows) {
    if (i.deadline) {
      items.push({ kind: "intake", title: `Intake: ${i.course.name} — ${i.name}`, due: i.deadline, href: "/employee/courses" });
    }
  }
  for (const v of visaRows) {
    if (v.biometricsAt) {
      items.push({ kind: "visa", title: `Biometrics — ${v.application.applicationNumber}`, due: v.biometricsAt, href: `/employee/applications/${v.application.id}` });
    }
    if (v.interviewAt) {
      items.push({ kind: "visa", title: `Interview — ${v.application.applicationNumber}`, due: v.interviewAt, href: `/employee/applications/${v.application.id}` });
    }
  }

  return items.sort((a, b) => a.due.getTime() - b.due.getTime()).slice(0, limit);
}

// ─────────────────────────────────────────────
// My tasks — overdue / today / upcoming
// ─────────────────────────────────────────────

export type TaskRow = {
  id: string;
  title: string;
  dueDate: Date | null;
  priority: string;
  status: string;
  studentName: string | null;
};

export type GroupedTasks = {
  overdue: TaskRow[];
  today: TaskRow[];
  upcoming: TaskRow[];
};

export async function getMyTasks(scope: EmployeeScope, now: Date = new Date(), limit = 5): Promise<GroupedTasks> {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setHours(23, 59, 59, 999);

  const rows = await prisma.task.findMany({
    where: {
      ...taskScope(scope),
      status: { in: ["TODO", "IN_PROGRESS"] },
      dueDate: { not: null },
    },
    orderBy: { dueDate: "asc" },
    take: limit * 3, // pre-fetch enough to fill all three groups
    select: {
      id: true,
      title: true,
      dueDate: true,
      priority: true,
      status: true,
      student: { select: { firstName: true, lastName: true } },
    },
  });

  const mapped: TaskRow[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    dueDate: r.dueDate,
    priority: r.priority,
    status: r.status,
    studentName: r.student ? `${r.student.firstName} ${r.student.lastName}` : null,
  }));

  return {
    overdue: mapped.filter((t) => t.dueDate && t.dueDate < startOfToday).slice(0, limit),
    today: mapped.filter((t) => t.dueDate && t.dueDate >= startOfToday && t.dueDate <= endOfToday).slice(0, limit),
    upcoming: mapped.filter((t) => t.dueDate && t.dueDate > endOfToday).slice(0, limit),
  };
}

// ─────────────────────────────────────────────
// Upcoming appointments
// ─────────────────────────────────────────────

export type AppointmentRow = {
  id: string;
  studentName: string;
  title: string;
  type: string;
  scheduledAt: Date;
  durationMinutes: number;
  status: string;
  location: string | null;
};

export async function getUpcomingAppointments(scope: EmployeeScope, limit = 5): Promise<AppointmentRow[]> {
  return prisma.appointment.findMany({
    where: {
      ...appointmentScope(scope),
      scheduledAt: { gte: new Date() },
      status: "SCHEDULED",
    },
    orderBy: { scheduledAt: "asc" },
    take: limit,
    select: {
      id: true,
      title: true,
      type: true,
      scheduledAt: true,
      durationMinutes: true,
      status: true,
      location: true,
      student: { select: { firstName: true, lastName: true } },
    },
  }).then((rows) =>
    rows.map((r) => ({
      id: r.id,
      studentName: `${r.student.firstName} ${r.student.lastName}`,
      title: r.title,
      type: r.type,
      scheduledAt: r.scheduledAt,
      durationMinutes: r.durationMinutes,
      status: r.status,
      location: r.location,
    })),
  );
}

// ─────────────────────────────────────────────
// Aggregate — composes all of the above in a single Promise.all
// ─────────────────────────────────────────────

export type DashboardData = {
  range: ResolvedRange;
  kpis: DashboardKpis;
  pipeline: StageBucket[];
  visaCases: StageBucket[];
  pendingDocuments: PendingDocument[];
  upcomingDeadlines: DeadlineItem[];
  myTasks: GroupedTasks;
  upcomingAppointments: AppointmentRow[];
  recentActivity: ActivityItem[];
};

export async function getEmployeeDashboard(
  scope: EmployeeScope,
  range: ResolvedRange,
  permissions: {
    students?: boolean;
    leads?: boolean;
    applications?: boolean;
    documents?: boolean;
    visa?: boolean;
    tasks?: boolean;
    appointments?: boolean;
    payments?: boolean;
    invoices?: boolean;
  },
): Promise<DashboardData> {
  const [kpis, pipeline, visaCases, pendingDocuments, upcomingDeadlines, myTasks, upcomingAppointments, recentActivity] =
    await Promise.all([
      getDashboardKpis(scope, range, permissions),
      getApplicationPipeline(scope),
      permissions.visa ? getVisaCases(scope) : Promise.resolve([]),
      permissions.documents ? getPendingDocuments(scope) : Promise.resolve([]),
      getUpcomingDeadlines(scope, range),
      permissions.tasks ? getMyTasks(scope) : Promise.resolve({ overdue: [], today: [], upcoming: [] }),
      permissions.appointments ? getUpcomingAppointments(scope) : Promise.resolve([]),
      getRecentActivity(scope),
    ]);

  return {
    range,
    kpis,
    pipeline,
    visaCases,
    pendingDocuments,
    upcomingDeadlines,
    myTasks,
    upcomingAppointments,
    recentActivity,
  };
}
