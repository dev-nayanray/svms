import { prisma } from "@/lib/db";
import type { EmployeeScope } from "@/lib/services/employee-dashboard";
import {
  studentScope, applicationScope, documentScope, leadScope,
  taskScope, visaScope, appointmentScope,
} from "@/lib/services/employee-dashboard";
import type { ResolvedRange } from "@/lib/utils/dashboard-range";
import { dateRangeWhere } from "@/lib/utils/dashboard-range";

/**
 * Employee Performance Dashboard service — 12 KPIs + a 30-day trend.
 *
 * ── IDOR closure ──────────────────────────────────────────────────────
 * Every count embeds the caller's scope filter. An EMPLOYEE only ever
 * sees metrics derived from the students / leads / tasks assigned to
 * them. ADMIN sees global scope.
 *
 * ── Range awareness ──────────────────────────────────────────────────
 * "Stock" KPIs (Assigned Students, Active Cases) ignore the range —
 * they reflect current state. "Flow" KPIs (Applications Submitted,
 * Visa Submissions, Completed Tasks, Documents Reviewed, Appointments,
 * Converted Leads) respect the resolved range — they answer "how much
 * did I do in this window?"
 *
 * ── Trend ────────────────────────────────────────────────────────────
 * The trend endpoint buckets key flow events (applications submitted,
 * documents reviewed, tasks completed, leads converted) into N-day
 * buckets across the range. Useful for the simple line chart on the
 * performance page.
 */

// ─── Types ────────────────────────────────────────────────────────────

export type PerformanceKpis = {
  // Stock metrics (range-independent)
  assignedStudents: number;
  activeCases: number;
  completedCases: number;
  // Flow metrics (range-aware)
  applicationsSubmitted: number;
  visaSubmissions: number;
  visaApprovals: number;
  pendingDocuments: number;
  documentsReviewed: number;
  completedTasks: number;
  overdueTasks: number;
  appointments: number;
  convertedLeads: number;
};

export type TrendPoint = {
  /** ISO date for the start of the bucket. */
  date: string;
  /** Bucket label for the chart axis (e.g. "Sep 1", "Week 36"). */
  label: string;
  applications: number;
  documents: number;
  tasks: number;
  leads: number;
};

export type PerformanceData = {
  range: { preset: string; from: string; to: string; label: string };
  kpis: PerformanceKpis;
  trend: TrendPoint[];
};

export type PerformancePermissions = {
  students?: boolean;
  applications?: boolean;
  documents?: boolean;
  visa?: boolean;
  tasks?: boolean;
  appointments?: boolean;
  leads?: boolean;
  payments?: boolean;
};

// ─── KPI computation ───────────────────────────────────────────────────

/**
 * Compute the 12 KPIs in a single batched Promise.all. Each KPI is
 * guarded by a permission flag — when the caller lacks the permission,
 * the count stays 0 (and the UI hides the card).
 */
export async function getPerformanceKpis(
  scope: EmployeeScope,
  range: ResolvedRange,
  perms: PerformancePermissions,
): Promise<PerformanceKpis> {
  const [
    assignedStudents,
    activeCases,
    completedCases,
    applicationsSubmitted,
    visaSubmissions,
    visaApprovals,
    pendingDocuments,
    documentsReviewed,
    completedTasks,
    overdueTasks,
    appointments,
    convertedLeads,
  ] = await Promise.all([
    // Stock
    perms.students ? prisma.student.count({ where: studentScope(scope) }) : Promise.resolve(0),
    perms.applications
      ? prisma.application.count({
          where: { ...applicationScope(scope), status: { not: "COMPLETED" } },
        })
      : Promise.resolve(0),
    perms.applications
      ? prisma.application.count({
          where: { ...applicationScope(scope), status: "COMPLETED" },
        })
      : Promise.resolve(0),
    // Flow — applications submitted in range
    perms.applications
      ? prisma.application.count({
          where: {
            ...applicationScope(scope),
            ...dateRangeWhere("createdAt", range),
          },
        })
      : Promise.resolve(0),
    // Visa submissions in range
    perms.visa
      ? prisma.visaApplication.count({
          where: {
            ...visaScope(scope),
            submittedAt: { gte: range.from, lte: range.to },
          },
        })
      : Promise.resolve(0),
    // Visa approvals in range
    perms.visa
      ? prisma.visaApplication.count({
          where: {
            ...visaScope(scope),
            stage: "APPROVED",
            decisionAt: { gte: range.from, lte: range.to },
          },
        })
      : Promise.resolve(0),
    // Pending documents (stock)
    perms.documents
      ? prisma.document.count({
          where: {
            ...documentScope(scope),
            status: { in: ["REQUESTED", "UPLOADED", "UNDER_REVIEW"] },
          },
        })
      : Promise.resolve(0),
    // Documents reviewed in range
    perms.documents
      ? prisma.document.count({
          where: {
            ...documentScope(scope),
            status: { in: ["APPROVED", "REJECTED"] },
            reviewedAt: { gte: range.from, lte: range.to },
          },
        })
      : Promise.resolve(0),
    // Tasks completed in range
    perms.tasks
      ? prisma.task.count({
          where: {
            ...taskScope(scope),
            status: "COMPLETED",
            ...dateRangeWhere("updatedAt", range),
          },
        })
      : Promise.resolve(0),
    // Overdue tasks (stock — past dueDate + open)
    perms.tasks
      ? prisma.task.count({
          where: {
            ...taskScope(scope),
            status: { in: ["TODO", "IN_PROGRESS"] },
            dueDate: { lt: new Date() },
          },
        })
      : Promise.resolve(0),
    // Appointments scheduled in range
    perms.appointments
      ? prisma.appointment.count({
          where: {
            ...appointmentScope(scope),
            ...dateRangeWhere("scheduledAt", range),
          },
        })
      : Promise.resolve(0),
    // Leads converted in range
    perms.leads
      ? prisma.lead.count({
          where: {
            ...leadScope(scope),
            status: "CONVERTED",
            ...dateRangeWhere("updatedAt", range),
          },
        })
      : Promise.resolve(0),
  ]);

  return {
    assignedStudents,
    activeCases,
    completedCases,
    applicationsSubmitted,
    visaSubmissions,
    visaApprovals,
    pendingDocuments,
    documentsReviewed,
    completedTasks,
    overdueTasks,
    appointments,
    convertedLeads,
  };
}

// ─── Trend (bucketed) ────────────────────────────────────────────────

/**
 * Bucket the range into N evenly-spaced intervals and count flow events
 * per bucket. Used by the simple line chart on the performance page.
 *
 * Buckets are sized to give roughly 7-14 data points:
 *  - today → 24 hourly buckets
 *  - 7d → 7 daily buckets
 *  - 30d → 10 buckets of 3 days each
 *  - 90d → 13 buckets of 7 days each
 *  - year → 12 monthly buckets
 *  - custom → up to 12 evenly-spaced buckets
 */
export async function getPerformanceTrend(
  scope: EmployeeScope,
  range: ResolvedRange,
  perms: PerformancePermissions,
): Promise<TrendPoint[]> {
  const buckets = buildBuckets(range);
  if (buckets.length === 0) return [];

  // Run all 4 series in parallel — each is a single groupBy with a
  // date-range filter.
  const [appPoints, docPoints, taskPoints, leadPoints] = await Promise.all([
    perms.applications
      ? bucketCounts(
          (from, to) => prisma.application.count({
            where: {
              ...applicationScope(scope),
              createdAt: { gte: from, lte: to },
            },
          }),
          buckets,
        )
      : Promise.resolve(buckets.map(() => 0)),
    perms.documents
      ? bucketCounts(
          (from, to) => prisma.document.count({
            where: {
              ...documentScope(scope),
              status: { in: ["APPROVED", "REJECTED"] },
              reviewedAt: { gte: from, lte: to },
            },
          }),
          buckets,
        )
      : Promise.resolve(buckets.map(() => 0)),
    perms.tasks
      ? bucketCounts(
          (from, to) => prisma.task.count({
            where: {
              ...taskScope(scope),
              status: "COMPLETED",
              updatedAt: { gte: from, lte: to },
            },
          }),
          buckets,
        )
      : Promise.resolve(buckets.map(() => 0)),
    perms.leads
      ? bucketCounts(
          (from, to) => prisma.lead.count({
            where: {
              ...leadScope(scope),
              status: "CONVERTED",
              updatedAt: { gte: from, lte: to },
            },
          }),
          buckets,
        )
      : Promise.resolve(buckets.map(() => 0)),
  ]);

  return buckets.map((b, i) => ({
    date: b.from.toISOString(),
    label: b.label,
    applications: appPoints[i] ?? 0,
    documents: docPoints[i] ?? 0,
    tasks: taskPoints[i] ?? 0,
    leads: leadPoints[i] ?? 0,
  }));
}

// ─── Bucket helpers ──────────────────────────────────────────────────

type Bucket = { from: Date; to: Date; label: string };

function buildBuckets(range: ResolvedRange): Bucket[] {
  const { preset, from, to } = range;
  const totalMs = to.getTime() - from.getTime();
  if (totalMs <= 0) return [];

  if (preset === "today") {
    // 24 hourly buckets
    const out: Bucket[] = [];
    for (let h = 0; h < 24; h++) {
      const start = new Date(from.getTime() + h * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 60 * 60 * 1000 - 1);
      out.push({ from: start, to: end, label: `${h}:00` });
    }
    return out;
  }

  if (preset === "year") {
    // 12 monthly buckets
    const out: Bucket[] = [];
    const year = from.getUTCFullYear();
    for (let m = 0; m < 12; m++) {
      const start = new Date(Date.UTC(year, m, 1));
      const end = new Date(Date.UTC(year, m + 1, 1) - 1);
      out.push({
        from: start,
        to: end,
        label: start.toLocaleDateString("en-GB", { month: "short" }),
      });
    }
    return out;
  }

  // For 7d / 30d / 90d / custom — pick a bucket count that gives
  // 7-14 points.
  let bucketCount: number;
  if (preset === "7d") bucketCount = 7;
  else if (preset === "30d") bucketCount = 10;
  else if (preset === "90d") bucketCount = 13;
  else bucketCount = Math.min(12, Math.max(4, Math.round(totalMs / (7 * 24 * 60 * 60 * 1000))));

  const bucketMs = totalMs / bucketCount;
  const out: Bucket[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const start = new Date(from.getTime() + i * bucketMs);
    const end = i === bucketCount - 1 ? to : new Date(start.getTime() + bucketMs - 1);
    out.push({
      from: start,
      to: end,
      label: start.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    });
  }
  return out;
}

async function bucketCounts(
  query: (from: Date, to: Date) => Promise<number>,
  buckets: Bucket[],
): Promise<number[]> {
  // Run all bucket queries in parallel — each is a single count().
  return Promise.all(buckets.map((b) => query(b.from, b.to)));
}

// ─── CSV export ───────────────────────────────────────────────────────

/**
 * Convert the performance KPIs to a flat CSV row. Suitable for Excel
 * / Numbers / Google Sheets import.
 */
export function kpisToCsv(kpis: PerformanceKpis, rangeLabel: string): string {
  const rows: [string, number][] = [
    ["Range", kpis.assignedStudents], // placeholder for the range label
    ["Assigned Students", kpis.assignedStudents],
    ["Active Cases", kpis.activeCases],
    ["Completed Cases", kpis.completedCases],
    ["Applications Submitted", kpis.applicationsSubmitted],
    ["Visa Submissions", kpis.visaSubmissions],
    ["Visa Approvals", kpis.visaApprovals],
    ["Pending Documents", kpis.pendingDocuments],
    ["Documents Reviewed", kpis.documentsReviewed],
    ["Completed Tasks", kpis.completedTasks],
    ["Overdue Tasks", kpis.overdueTasks],
    ["Appointments", kpis.appointments],
    ["Converted Leads", kpis.convertedLeads],
  ];
  // Replace the first row's value with the actual range label
  rows[0][1] = rangeLabel as unknown as number;
  const header = "Metric,Value";
  const body = rows.map(([k, v]) => `${escapeCsv(k)},${escapeCsv(v)}`).join("\n");
  return `${header}\n${body}\n`;
}

/**
 * Convert the trend series to CSV. Columns: date, applications,
 * documents, tasks, leads.
 */
export function trendToCsv(trend: TrendPoint[]): string {
  if (trend.length === 0) return "date,applications,documents,tasks,leads\n";
  const header = "date,applications,documents,tasks,leads";
  const body = trend.map((p) =>
    [p.date, p.applications, p.documents, p.tasks, p.leads].map(escapeCsv).join(","),
  ).join("\n");
  return `${header}\n${body}\n`;
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
