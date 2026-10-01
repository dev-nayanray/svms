import { prisma } from "@/lib/db";
import type { EmployeeScope } from "@/lib/services/employee-dashboard";
import {
  studentScope, applicationScope, documentScope, leadScope,
  taskScope, visaScope, appointmentScope, paymentScope,
  APPLICATION_STAGES, VISA_STAGES,
} from "@/lib/services/employee-dashboard";
import type { ResolvedRange } from "@/lib/utils/dashboard-range";
import { dateRangeWhere } from "@/lib/utils/dashboard-range";
import { titleCase } from "@/lib/utils";

/**
 * Employee Reports service — server-side aggregations for /employee/reports.
 *
 * ── IDOR closure ──────────────────────────────────────────────────────
 * Every aggregation embeds the caller's scope filter (studentScope,
 * applicationScope, etc.) so an EMPLOYEE only ever sees data for the
 * students / leads / tasks assigned to them. ADMIN sees global scope.
 * The scope is derived from the session, never from the client.
 *
 * ── Date-range awareness ──────────────────────────────────────────────
 * "Range-aware" metrics (new leads, applications submitted, payments
 * recorded, documents reviewed, tasks completed, appointments scheduled)
 * respect the resolved range. "Timeless" totals (my students, total
 * applications, all pending documents) ignore the range — the same way
 * the dashboard does.
 *
 * ── Filters ───────────────────────────────────────────────────────────
 * country / status / stage filters are applied where the underlying
 * entity has a matching column. Country filters through the country
 * relation on Application; status / stage filter directly.
 *
 * ── CSV export ────────────────────────────────────────────────────────
 * Each report has a `*ForCsv` variant that returns a flat array of
 * rows + a column descriptor. The API route converts these to CSV text.
 * We deliberately do not include PII beyond what the employee is
 * authorized to see — the same scope filter is applied.
 */

// ─── Constants ────────────────────────────────────────────────────────

export const REPORT_KINDS = [
  "students", "applications", "pipeline", "documents",
  "visa", "tasks", "appointments", "payments", "leads",
] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

// ─── Types ────────────────────────────────────────────────────────────

export type ReportFilters = {
  countryId?: string;
  status?: string;
  stage?: string;
  employeeId?: string;
};

export type ReportResult = {
  kind: ReportKind;
  total: number;
  rows: Record<string, unknown>[];
  buckets?: { label: string; count: number }[];
  summary?: Record<string, number | string>;
};

// ─── Scope helper ─────────────────────────────────────────────────────

/**
 * Returns the scope filter to apply for the given report kind. The
 * filter is built from the session-derived employeeId — never from the
 * client.
 */
export function reportScope(
  scope: EmployeeScope,
  kind: ReportKind,
): Record<string, unknown> {
  switch (kind) {
    case "students": return studentScope(scope);
    case "applications":
    case "pipeline": return applicationScope(scope);
    case "documents": return documentScope(scope);
    case "visa": return visaScope(scope);
    case "tasks": return taskScope(scope);
    case "appointments": return appointmentScope(scope);
    case "payments": return paymentScope(scope);
    case "leads": return leadScope(scope);
    default: return {};
  }
}

// ─── Report dispatcher ────────────────────────────────────────────────

export async function getReport(
  scope: EmployeeScope,
  kind: ReportKind,
  range: ResolvedRange,
  filters: ReportFilters = {},
  limit = 100,
): Promise<ReportResult> {
  switch (kind) {
    case "students": return getStudentsReport(scope, range, filters, limit);
    case "applications": return getApplicationsReport(scope, range, filters, limit);
    case "pipeline": return getPipelineReport(scope, range, filters);
    case "documents": return getDocumentsReport(scope, range, filters, limit);
    case "visa": return getVisaReport(scope, range, filters, limit);
    case "tasks": return getTasksReport(scope, range, filters, limit);
    case "appointments": return getAppointmentsReport(scope, range, filters, limit);
    case "payments": return getPaymentsReport(scope, range, filters, limit);
    case "leads": return getLeadsReport(scope, range, filters, limit);
    default: throw new Error(`Unknown report kind: ${kind}`);
  }
}

// ─── Students ─────────────────────────────────────────────────────────

async function getStudentsReport(
  scope: EmployeeScope,
  _range: ResolvedRange,
  filters: ReportFilters,
  limit: number,
): Promise<ReportResult> {
  const owner = studentScope(scope);
  const where: Record<string, unknown> = { ...owner };
  if (filters.status) where.status = filters.status;

  const [rows, total, statusBuckets] = await Promise.all([
    prisma.student.findMany({
      where, orderBy: { createdAt: "desc" }, take: limit,
      select: {
        id: true, studentId: true, firstName: true, lastName: true, email: true,
        phone: true, country: true, city: true, status: true,
        assignedEmployee: { select: { id: true, user: { select: { name: true } } } },
        createdAt: true,
      },
    }),
    prisma.student.count({ where }),
    prisma.student.groupBy({
      by: ["status"], where: owner, _count: { _all: true },
    }),
  ]);

  return {
    kind: "students",
    total,
    rows: rows.map((s) => ({
      id: s.id, studentId: s.studentId,
      name: `${s.firstName} ${s.lastName}`,
      email: s.email, phone: s.phone ?? "",
      country: s.country ?? "", city: s.city ?? "",
      status: s.status,
      assignedEmployee: s.assignedEmployee?.user.name ?? "—",
      createdAt: s.createdAt,
    })),
    buckets: statusBuckets.map((b) => ({ label: titleCase(b.status), count: b._count._all })),
    summary: {
      total,
      active: statusBuckets.filter((b) => b.status === "ACTIVE").reduce((s, b) => s + b._count._all, 0),
    },
  };
}

// ─── Applications ────────────────────────────────────────────────────

async function getApplicationsReport(
  scope: EmployeeScope,
  range: ResolvedRange,
  filters: ReportFilters,
  limit: number,
): Promise<ReportResult> {
  const owner = applicationScope(scope);
  const where: Record<string, unknown> = { ...owner };
  if (filters.countryId) where.countryId = filters.countryId;
  if (filters.status) where.status = filters.status;
  if (filters.stage) where.stageKey = filters.stage;

  const [rows, total, stageBuckets, statusBuckets] = await Promise.all([
    prisma.application.findMany({
      where, orderBy: { updatedAt: "desc" }, take: limit,
      select: {
        id: true, applicationNumber: true, stageKey: true, status: true, priority: true,
        createdAt: true, updatedAt: true,
        student: { select: { firstName: true, lastName: true } },
        country: { select: { name: true } },
        university: { select: { name: true } },
        assignedEmployee: { select: { id: true, user: { select: { name: true } } } },
      },
    }),
    prisma.application.count({ where }),
    prisma.application.groupBy({
      by: ["stageKey"], where: owner, _count: { _all: true },
    }),
    prisma.application.groupBy({
      by: ["status"], where: owner, _count: { _all: true },
    }),
  ]);

  const byStage = new Map(stageBuckets.map((b) => [b.stageKey, b._count._all]));
  return {
    kind: "applications",
    total,
    rows: rows.map((a) => ({
      id: a.id, applicationNumber: a.applicationNumber,
      student: `${a.student.firstName} ${a.student.lastName}`,
      country: a.country?.name ?? "—",
      university: a.university?.name ?? "—",
      stage: titleCase(a.stageKey),
      status: a.status, priority: a.priority,
      assignedEmployee: a.assignedEmployee?.user.name ?? "—",
      updatedAt: a.updatedAt,
    })),
    buckets: APPLICATION_STAGES.map((stage) => ({
      label: titleCase(stage),
      count: byStage.get(stage) ?? 0,
    })),
    summary: {
      total,
      active: statusBuckets.filter((b) => b.status !== "COMPLETED").reduce((s, b) => s + b._count._all, 0),
      completed: statusBuckets.filter((b) => b.status === "COMPLETED").reduce((s, b) => s + b._count._all, 0),
      // Range-aware: applications submitted in the window
      submittedInRange: await prisma.application.count({
        where: { ...owner, ...dateRangeWhere("createdAt", range) },
      }),
    },
  };
}

// ─── Pipeline (stage breakdown only — no rows) ────────────────────────

async function getPipelineReport(
  scope: EmployeeScope,
  _range: ResolvedRange,
  filters: ReportFilters,
): Promise<ReportResult> {
  const owner = applicationScope(scope);
  const where: Record<string, unknown> = { ...owner };
  if (filters.countryId) where.countryId = filters.countryId;
  if (filters.status) where.status = filters.status;

  const grouped = await prisma.application.groupBy({
    by: ["stageKey"], where, _count: { _all: true },
  });
  const byStage = new Map(grouped.map((g) => [g.stageKey, g._count._all]));
  const buckets = APPLICATION_STAGES.map((stage) => ({
    label: titleCase(stage),
    count: byStage.get(stage) ?? 0,
  }));
  return {
    kind: "pipeline",
    total: buckets.reduce((s, b) => s + b.count, 0),
    rows: [],
    buckets,
    summary: { total: buckets.reduce((s, b) => s + b.count, 0) },
  };
}

// ─── Documents ────────────────────────────────────────────────────────

async function getDocumentsReport(
  scope: EmployeeScope,
  range: ResolvedRange,
  filters: ReportFilters,
  limit: number,
): Promise<ReportResult> {
  const owner = documentScope(scope);
  const where: Record<string, unknown> = { ...owner };
  if (filters.status) where.status = filters.status;

  const [rows, total, statusBuckets] = await Promise.all([
    prisma.document.findMany({
      where, orderBy: { updatedAt: "desc" }, take: limit,
      select: {
        id: true, name: true, documentType: true, status: true,
        uploadedAt: true, reviewedAt: true, createdAt: true,
        student: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.document.count({ where }),
    prisma.document.groupBy({
      by: ["status"], where: owner, _count: { _all: true },
    }),
  ]);

  return {
    kind: "documents",
    total,
    rows: rows.map((d) => ({
      id: d.id, name: d.name,
      student: `${d.student.firstName} ${d.student.lastName}`,
      type: d.documentType ?? "—",
      status: d.status,
      uploadedAt: d.uploadedAt,
      reviewedAt: d.reviewedAt,
      createdAt: d.createdAt,
    })),
    buckets: statusBuckets.map((b) => ({ label: titleCase(b.status), count: b._count._all })),
    summary: {
      total,
      pending: statusBuckets.filter((b) => ["REQUESTED", "UPLOADED", "UNDER_REVIEW"].includes(b.status))
        .reduce((s, b) => s + b._count._all, 0),
      approved: statusBuckets.filter((b) => b.status === "APPROVED").reduce((s, b) => s + b._count._all, 0),
      rejected: statusBuckets.filter((b) => b.status === "REJECTED").reduce((s, b) => s + b._count._all, 0),
      reviewedInRange: await prisma.document.count({
        where: { ...owner, ...dateRangeWhere("reviewedAt", range) },
      }),
    },
  };
}

// ─── Visa Cases ──────────────────────────────────────────────────────

async function getVisaReport(
  scope: EmployeeScope,
  range: ResolvedRange,
  filters: ReportFilters,
  limit: number,
): Promise<ReportResult> {
  const owner = visaScope(scope);
  const where: Record<string, unknown> = { ...owner };
  if (filters.stage) where.stage = filters.stage;

  const [rows, total, stageBuckets] = await Promise.all([
    prisma.visaApplication.findMany({
      where, orderBy: { updatedAt: "desc" }, take: limit,
      select: {
        id: true, stage: true, visaType: true,
        submittedAt: true, decisionAt: true, createdAt: true,
        application: {
          select: {
            id: true, applicationNumber: true,
            student: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    prisma.visaApplication.count({ where }),
    prisma.visaApplication.groupBy({
      by: ["stage"], where: owner, _count: { _all: true },
    }),
  ]);

  const byStage = new Map(stageBuckets.map((b) => [b.stage, b._count._all]));
  return {
    kind: "visa",
    total,
    rows: rows.map((v) => ({
      id: v.id,
      applicationNumber: v.application.applicationNumber,
      student: `${v.application.student.firstName} ${v.application.student.lastName}`,
      stage: titleCase(v.stage),
      visaType: v.visaType ?? "—",
      submittedAt: v.submittedAt,
      decisionAt: v.decisionAt,
      createdAt: v.createdAt,
    })),
    buckets: VISA_STAGES.map((stage) => ({
      label: titleCase(stage),
      count: byStage.get(stage) ?? 0,
    })),
    summary: {
      total,
      submitted: byStage.get("SUBMITTED") ?? 0,
      approved: byStage.get("APPROVED") ?? 0,
      refused: byStage.get("REFUSED") ?? 0,
      submittedInRange: await prisma.visaApplication.count({
        where: { ...owner, ...dateRangeWhere("submittedAt", range) },
      }),
    },
  };
}

// ─── Tasks ───────────────────────────────────────────────────────────

async function getTasksReport(
  scope: EmployeeScope,
  range: ResolvedRange,
  filters: ReportFilters,
  limit: number,
): Promise<ReportResult> {
  const owner = taskScope(scope);
  const where: Record<string, unknown> = { ...owner };
  if (filters.status) where.status = filters.status;

  const [rows, total, statusBuckets] = await Promise.all([
    prisma.task.findMany({
      where, orderBy: { updatedAt: "desc" }, take: limit,
      select: {
        id: true, title: true, status: true, priority: true,
        dueDate: true, createdAt: true, updatedAt: true,
        student: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.task.count({ where }),
    prisma.task.groupBy({ by: ["status"], where: owner, _count: { _all: true } }),
    prisma.task.groupBy({ by: ["priority"], where: owner, _count: { _all: true } }),
  ]);

  return {
    kind: "tasks",
    total,
    rows: rows.map((t) => ({
      id: t.id, title: t.title,
      student: t.student ? `${t.student.firstName} ${t.student.lastName}` : "—",
      status: titleCase(t.status),
      priority: titleCase(t.priority),
      dueDate: t.dueDate,
      createdAt: t.createdAt,
    })),
    buckets: statusBuckets.map((b) => ({ label: titleCase(b.status), count: b._count._all })),
    summary: {
      total,
      open: statusBuckets.filter((b) => ["TODO", "IN_PROGRESS"].includes(b.status)).reduce((s, b) => s + b._count._all, 0),
      completed: statusBuckets.filter((b) => b.status === "COMPLETED").reduce((s, b) => s + b._count._all, 0),
      cancelled: statusBuckets.filter((b) => b.status === "CANCELLED").reduce((s, b) => s + b._count._all, 0),
      completedInRange: await prisma.task.count({
        where: { ...owner, status: "COMPLETED", ...dateRangeWhere("updatedAt", range) },
      }),
      overdue: await prisma.task.count({
        where: {
          ...owner, status: { in: ["TODO", "IN_PROGRESS"] },
          dueDate: { lt: new Date() },
        },
      }),
    },
  };
}

// ─── Appointments ────────────────────────────────────────────────────

async function getAppointmentsReport(
  scope: EmployeeScope,
  range: ResolvedRange,
  filters: ReportFilters,
  limit: number,
): Promise<ReportResult> {
  const owner = appointmentScope(scope);
  const where: Record<string, unknown> = { ...owner };
  if (filters.status) where.status = filters.status;

  const [rows, total, statusBuckets] = await Promise.all([
    prisma.appointment.findMany({
      where, orderBy: { scheduledAt: "desc" }, take: limit,
      select: {
        id: true, title: true, type: true, status: true,
        scheduledAt: true, durationMinutes: true, location: true,
        student: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.appointment.count({ where }),
    prisma.appointment.groupBy({ by: ["status"], where: owner, _count: { _all: true } }),
    prisma.appointment.groupBy({ by: ["type"], where: owner, _count: { _all: true } }),
  ]);

  return {
    kind: "appointments",
    total,
    rows: rows.map((a) => ({
      id: a.id, title: a.title,
      student: `${a.student.firstName} ${a.student.lastName}`,
      type: titleCase(a.type),
      status: titleCase(a.status),
      scheduledAt: a.scheduledAt,
      duration: a.durationMinutes,
      location: a.location ?? "",
    })),
    buckets: statusBuckets.map((b) => ({ label: titleCase(b.status), count: b._count._all })),
    summary: {
      total,
      scheduled: statusBuckets.filter((b) => b.status === "SCHEDULED").reduce((s, b) => s + b._count._all, 0),
      completed: statusBuckets.filter((b) => b.status === "COMPLETED").reduce((s, b) => s + b._count._all, 0),
      cancelled: statusBuckets.filter((b) => b.status === "CANCELLED").reduce((s, b) => s + b._count._all, 0),
      scheduledInRange: await prisma.appointment.count({
        where: { ...owner, ...dateRangeWhere("scheduledAt", range) },
      }),
    },
  };
}

// ─── Payments ────────────────────────────────────────────────────────

async function getPaymentsReport(
  scope: EmployeeScope,
  range: ResolvedRange,
  filters: ReportFilters,
  limit: number,
): Promise<ReportResult> {
  const owner = paymentScope(scope);
  const where: Record<string, unknown> = { ...owner };
  if (filters.status) where.status = filters.status;

  const [rows, total, statusBuckets, methodBuckets, totalPaid] = await Promise.all([
    prisma.payment.findMany({
      where, orderBy: { updatedAt: "desc" }, take: limit,
      select: {
        id: true, amount: true, currency: true, paymentMethod: true,
        status: true, transactionReference: true, paymentDate: true,
        student: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.payment.count({ where }),
    prisma.payment.groupBy({ by: ["status"], where: owner, _count: { _all: true } }),
    prisma.payment.groupBy({ by: ["paymentMethod"], where: owner, _count: { _all: true } }),
    prisma.payment.aggregate({
      where: { ...owner, status: "PAID" },
      _sum: { amount: true },
    }),
  ]);

  return {
    kind: "payments",
    total,
    rows: rows.map((p) => ({
      id: p.id,
      student: `${p.student.firstName} ${p.student.lastName}`,
      amount: p.amount, currency: p.currency,
      method: titleCase(p.paymentMethod),
      status: titleCase(p.status),
      reference: p.transactionReference ?? "",
      paymentDate: p.paymentDate,
    })),
    buckets: statusBuckets.map((b) => ({ label: titleCase(b.status), count: b._count._all })),
    summary: {
      total,
      paid: statusBuckets.filter((b) => b.status === "PAID").reduce((s, b) => s + b._count._all, 0),
      pending: statusBuckets.filter((b) => b.status === "PENDING").reduce((s, b) => s + b._count._all, 0),
      refunded: statusBuckets.filter((b) => b.status === "REFUNDED").reduce((s, b) => s + b._count._all, 0),
      totalPaidAmount: totalPaid._sum.amount ?? 0,
      paidInRange: await prisma.payment.count({
        where: { ...owner, status: "PAID", ...dateRangeWhere("paymentDate", range) },
      }),
    },
    // methodBuckets attached as an extra for the UI
    ...({ methodBuckets: methodBuckets.map((b) => ({ label: titleCase(b.paymentMethod), count: b._count._all })) } as Record<string, unknown>),
  } as ReportResult;
}

// ─── Leads ───────────────────────────────────────────────────────────

async function getLeadsReport(
  scope: EmployeeScope,
  range: ResolvedRange,
  filters: ReportFilters,
  limit: number,
): Promise<ReportResult> {
  const owner = leadScope(scope);
  const where: Record<string, unknown> = { ...owner };
  if (filters.status) where.status = filters.status;

  const [rows, total, statusBuckets] = await Promise.all([
    prisma.lead.findMany({
      where, orderBy: { updatedAt: "desc" }, take: limit,
      select: {
        id: true, name: true, phone: true, email: true,
        interestedCountry: true, status: true, source: true,
        nextFollowUp: true, createdAt: true,
        assignedEmployee: { select: { id: true, user: { select: { name: true } } } },
      },
    }),
    prisma.lead.count({ where }),
    prisma.lead.groupBy({ by: ["status"], where: owner, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["source"], where: owner, _count: { _all: true } }),
  ]);

  return {
    kind: "leads",
    total,
    rows: rows.map((l) => ({
      id: l.id, name: l.name,
      phone: l.phone ?? "", email: l.email ?? "",
      interestedCountry: l.interestedCountry ?? "",
      status: titleCase(l.status),
      source: l.source ? titleCase(l.source.replace(/_/g, " ")) : "—",
      nextFollowUp: l.nextFollowUp,
      assignedEmployee: l.assignedEmployee?.user.name ?? "—",
      createdAt: l.createdAt,
    })),
    buckets: statusBuckets.map((b) => ({ label: titleCase(b.status), count: b._count._all })),
    summary: {
      total,
      new: statusBuckets.filter((b) => b.status === "NEW").reduce((s, b) => s + b._count._all, 0),
      qualified: statusBuckets.filter((b) => b.status === "QUALIFIED").reduce((s, b) => s + b._count._all, 0),
      converted: statusBuckets.filter((b) => b.status === "CONVERTED").reduce((s, b) => s + b._count._all, 0),
      lost: statusBuckets.filter((b) => b.status === "LOST").reduce((s, b) => s + b._count._all, 0),
      newInRange: await prisma.lead.count({
        where: { ...owner, status: "NEW", ...dateRangeWhere("createdAt", range) },
      }),
    },
  };
}

// ─── CSV export ───────────────────────────────────────────────────────

/**
 * Convert a ReportResult to a CSV string. Columns are derived from the
 * first row's keys; if there are no rows, only the header is emitted.
 *
 * Cells are RFC 4180-escaped: any cell containing a comma, double-quote,
 * or newline is wrapped in double-quotes and inner quotes are doubled.
 */
export function reportToCsv(report: ReportResult): string {
  const rows = report.rows;
  if (rows.length === 0) {
    // Always emit at least the header row + summary
    const summaryKeys = Object.keys(report.summary ?? {});
    if (summaryKeys.length === 0) return `# ${report.kind} report — no rows\n`;
    const summaryLine = summaryKeys.map((k) => `${k}: ${escapeCsv((report.summary as Record<string, unknown>)[k] ?? "")}`).join(", ");
    return `# ${report.kind} report\n# ${summaryLine}\n`;
  }

  // Stable column order: pull from first row, then preserve insertion order.
  const columns = Object.keys(rows[0]);
  const header = columns.map(escapeCsv).join(",");
  const body = rows.map((r) => columns.map((c) => escapeCsv(r[c])).join(",")).join("\n");

  // Append summary as comment lines at the end
  const summary = report.summary ?? {};
  const summaryKeys = Object.keys(summary);
  const summaryLines = summaryKeys.length > 0
    ? "\n# Summary\n" + summaryKeys.map((k) => `${k},${escapeCsv(summary[k])}`).join("\n")
    : "";

  return `${header}\n${body}${summaryLines}\n`;
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s: string;
  if (value instanceof Date) {
    s = value.toISOString();
  } else if (typeof value === "number" || typeof value === "boolean") {
    s = String(value);
  } else {
    s = String(value);
  }
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
