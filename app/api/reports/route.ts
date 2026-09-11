import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import {
  type ReportType,
  type ReportFilters,
  parseReportFilters,
  isSensitiveReport,
  type ChartDataPoint,
} from "@/lib/constants/reports";

/**
 * Admin Reports endpoint — returns server-side aggregated analytics
 * for the requested report type. All aggregation is done in MongoDB
 * via Prisma's `aggregate` / `groupBy` — the browser never receives
 * raw records, only computed summaries.
 *
 * Report types:
 *  - students: counts by country, branch, status; monthly registrations
 *  - leads: counts by status, source; conversion rate
 *  - applications: counts by country, stage, employee, intake; pipeline
 *  - visa: approval rate, refusal rate, by stage
 *  - employees: task stats (pending, overdue, completed); revenue generated
 *  - finance: monthly revenue, outstanding payments, by method
 *  - documents: completion rate, by status
 *
 * Filters: dateFrom, dateTo, branchId, employeeId, countryId,
 * universityId, courseId, intakeId, status. Applied to the base `where`
 * clause for each aggregation.
 *
 * Sensitive reports (finance, employees) require `finance.read` in
 * addition to `reports.read`. This is enforced server-side.
 */
export async function GET(req: NextRequest) {
  try {
    const g = await guard("reports.read");
    if (g.error) return g.error;

    const sp = req.nextUrl.searchParams;
    const reportType = (sp.get("type") ?? "applications") as ReportType;
    const filters = parseReportFilters({
      dateFrom: sp.get("dateFrom") ?? undefined,
      dateTo: sp.get("dateTo") ?? undefined,
      branchId: sp.get("branchId") ?? undefined,
      employeeId: sp.get("employeeId") ?? undefined,
      countryId: sp.get("countryId") ?? undefined,
      universityId: sp.get("universityId") ?? undefined,
      courseId: sp.get("courseId") ?? undefined,
      intakeId: sp.get("intakeId") ?? undefined,
      status: sp.get("status") ?? undefined,
    });

    // Sensitive reports require finance.read
    if (isSensitiveReport(reportType)) {
      const fg = await guard("finance.read");
      if (fg.error) return fg.error;
    }

    const data = await runReport(reportType, filters);
    return ok(data);
  } catch (err) {
    return handleApiError(err);
  }
}

async function runReport(type: ReportType, filters: ReportFilters) {
  switch (type) {
    case "students":
      return runStudentReport(filters);
    case "leads":
      return runLeadReport(filters);
    case "applications":
      return runApplicationReport(filters);
    case "visa":
      return runVisaReport(filters);
    case "employees":
      return runEmployeeReport(filters);
    case "finance":
      return runFinanceReport(filters);
    case "documents":
      return runDocumentReport(filters);
    default:
      return { error: "Unknown report type" };
  }
}

// ─────────────────────────────────────────────
// Base where-clause builders per filter set
// ─────────────────────────────────────────────

function buildDateWhere(filters: ReportFilters, field: string = "createdAt") {
  const range: Record<string, unknown> = {};
  if (filters.dateFrom) {
    const d = new Date(filters.dateFrom);
    if (!Number.isNaN(d.getTime())) range.gte = d;
  }
  if (filters.dateTo) {
    const d = new Date(filters.dateTo);
    if (!Number.isNaN(d.getTime())) range.lte = d;
  }
  return Object.keys(range).length ? { [field]: range } : {};
}

// ─────────────────────────────────────────────
// Student Report
// ─────────────────────────────────────────────

async function runStudentReport(filters: ReportFilters) {
  const where = {
    deletedAt: null,
    ...buildDateWhere(filters),
    ...(filters.branchId ? { branchId: filters.branchId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.employeeId ? { assignedEmployeeId: filters.employeeId } : {}),
  };

  const [total, byCountry, byStatus, monthly] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.groupBy({
      by: ["country"],
      where,
      _count: true,
      orderBy: { country: "desc" },
      take: 20,
    }),
    prisma.student.groupBy({
      by: ["status"],
      where,
      _count: true,
    }),
    prisma.student.findMany({
      where,
      select: { createdAt: true, country: true },
    }),
  ]);

  // Monthly registrations (last 12 months)
  const monthlyMap = new Map<string, number>();
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthlyMap.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, 0);
  }
  for (const s of monthly) {
    const d = new Date(s.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (monthlyMap.has(key)) {
      monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + 1);
    }
  }

  return {
    kpis: { totalStudents: total },
    charts: {
      byCountry: byCountry
        .filter((r) => r.country)
        .map((r) => ({ name: r.country as string, value: r._count as number }))
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0)) as ChartDataPoint[],
      byStatus: byStatus.map((r) => ({
        name: (r.status as string).replace(/_/g, " "),
        value: r._count as number,
      })) as ChartDataPoint[],
      monthlyRegistrations: [...monthlyMap.entries()].map(([name, value]) => ({
        name,
        value,
      })) as ChartDataPoint[],
    },
    table: {
      headers: ["Country", "Count"],
      rows: byCountry
        .filter((r) => r.country)
        .map((r) => ({ Country: r.country, Count: r._count as number })),
    },
  };
}

// ─────────────────────────────────────────────
// Lead Report
// ─────────────────────────────────────────────

async function runLeadReport(filters: ReportFilters) {
  const where = {
    deletedAt: null,
    ...buildDateWhere(filters),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.employeeId ? { assignedEmployeeId: filters.employeeId } : {}),
    ...(filters.countryId ? { interestedCountry: filters.countryId } : {}),
  };

  const [total, converted, byStatus, bySource] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.count({ where: { ...where, status: "CONVERTED" } }),
    prisma.lead.groupBy({
      by: ["status"],
      where,
      _count: true,
    }),
    prisma.lead.groupBy({
      by: ["source"],
      where,
      _count: true,
    }),
  ]);

  const conversionRate = total > 0 ? Math.round((converted / total) * 1000) / 10 : 0;

  return {
    kpis: { totalLeads: total, converted, conversionRate: `${conversionRate}%` },
    charts: {
      byStatus: byStatus.map((r) => ({
        name: (r.status as string).replace(/_/g, " "),
        value: r._count as number,
      })) as ChartDataPoint[],
      bySource: bySource
        .filter((r) => r.source)
        .map((r) => ({ name: r.source as string, value: r._count })) as ChartDataPoint[],
    },
    table: {
      headers: ["Status", "Count"],
      rows: byStatus.map((r) => ({ Status: r.status, Count: r._count as number })),
    },
  };
}

// ─────────────────────────────────────────────
// Application Report
// ─────────────────────────────────────────────

async function runApplicationReport(filters: ReportFilters) {
  const where = {
    deletedAt: null,
    ...buildDateWhere(filters),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.countryId ? { countryId: filters.countryId } : {}),
    ...(filters.universityId ? { universityId: filters.universityId } : {}),
    ...(filters.courseId ? { courseId: filters.courseId } : {}),
    ...(filters.intakeId ? { intakeId: filters.intakeId } : {}),
    ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
    ...(filters.branchId ? { student: { branchId: filters.branchId } } : {}),
  };

  const [total, byCountry, byStage, byEmployee] = await Promise.all([
    prisma.application.count({ where }),
    prisma.application.groupBy({
      by: ["countryId"],
      where,
      _count: true,
      orderBy: { countryId: "desc" },
      take: 20,
    }),
    prisma.application.groupBy({
      by: ["stageKey"],
      where,
      _count: true,
    }),
    prisma.application.groupBy({
      by: ["employeeId"],
      where,
      _count: true,
      orderBy: { employeeId: "desc" },
      take: 20,
    }),
  ]);

  // Resolve country names
  const countryIds = byCountry.map((r) => r.countryId);
  const countries = countryIds.length
    ? await prisma.country.findMany({
        where: { id: { in: countryIds } },
        select: { id: true, name: true, flag: true },
      })
    : [];
  const countryMap = new Map(countries.map((c) => [c.id, c.name]));

  // Resolve employee names
  const employeeIds = byEmployee.map((r) => r.employeeId).filter(Boolean) as string[];
  const employees = employeeIds.length
    ? await prisma.employee.findMany({
        where: { id: { in: employeeIds } },
        select: { id: true, user: { select: { name: true } } },
      })
    : [];
  const employeeMap = new Map(employees.map((e) => [e.id, e.user.name]));

  return {
    kpis: { totalApplications: total },
    charts: {
      byCountry: byCountry.map((r) => ({
        name: countryMap.get(r.countryId) ?? "Unknown",
        value: r._count as number,
      })) as ChartDataPoint[],
      byStage: byStage.map((r) => ({
        name: (r.stageKey as string).replace(/_/g, " "),
        value: r._count as number,
      })) as ChartDataPoint[],
      byEmployee: byEmployee
        .filter((r) => r.employeeId)
        .map((r) => ({
          name: employeeMap.get(r.employeeId as string) ?? "Unknown",
          value: r._count as number,
        })) as ChartDataPoint[],
    },
    table: {
      headers: ["Country", "Stage", "Count"],
      rows: byStage.map((r) => ({
        Country: "All",
        Stage: r.stageKey,
        Count: r._count as number,
      })),
    },
  };
}

// ─────────────────────────────────────────────
// Visa Report
// ─────────────────────────────────────────────

async function runVisaReport(filters: ReportFilters) {
  const where = {
    deletedAt: null,
    ...buildDateWhere(filters, "createdAt"),
    ...(filters.status ? { stage: filters.status } : {}),
    ...(filters.countryId ? { application: { countryId: filters.countryId } } : {}),
    ...(filters.universityId ? { application: { universityId: filters.universityId } } : {}),
  };

  const [total, approved, refused, byStage] = await Promise.all([
    prisma.visaApplication.count({ where }),
    prisma.visaApplication.count({ where: { ...where, stage: "APPROVED" } }),
    prisma.visaApplication.count({ where: { ...where, stage: "REFUSED" } }),
    prisma.visaApplication.groupBy({
      by: ["stage"],
      where,
      _count: true,
    }),
  ]);

  const approvalRate = total > 0 ? Math.round((approved / total) * 1000) / 10 : 0;
  const refusalRate = total > 0 ? Math.round((refused / total) * 1000) / 10 : 0;

  return {
    kpis: {
      totalVisaApplications: total,
      approved,
      refused,
      approvalRate: `${approvalRate}%`,
      refusalRate: `${refusalRate}%`,
    },
    charts: {
      byStage: byStage.map((r) => ({
        name: (r.stage as string).replace(/_/g, " "),
        value: r._count as number,
      })) as ChartDataPoint[],
      approvalVsRefusal: [
        { name: "Approved", value: approved },
        { name: "Refused", value: refused },
        { name: "Pending", value: total - approved - refused },
      ] as ChartDataPoint[],
    },
    table: {
      headers: ["Stage", "Count"],
      rows: byStage.map((r) => ({ Stage: r.stage, Count: r._count as number })),
    },
  };
}

// ─────────────────────────────────────────────
// Employee Report
// ─────────────────────────────────────────────

async function runEmployeeReport(filters: ReportFilters) {
  const where = {
    deletedAt: null,
    ...(filters.branchId ? { branchId: filters.branchId } : {}),
  };

  const employees = await prisma.employee.findMany({
    where,
    include: {
      user: { select: { name: true } },
      _count: {
        select: {
          students: { where: { deletedAt: null } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  // Get task stats per employee
  const employeeStats = await Promise.all(
    employees.map(async (emp) => {
      const [pending, overdue, completed] = await Promise.all([
        prisma.task.count({
          where: {
            assignedToId: emp.userId,
            deletedAt: null,
            status: { in: ["TODO", "IN_PROGRESS"] },
          },
        }),
        prisma.task.count({
          where: {
            assignedToId: emp.userId,
            deletedAt: null,
            status: { in: ["TODO", "IN_PROGRESS"] },
            dueDate: { lt: new Date() },
          },
        }),
        prisma.task.count({
          where: {
            assignedToId: emp.userId,
            deletedAt: null,
            status: "COMPLETED",
          },
        }),
      ]);
      return {
        name: emp.user.name,
        students: emp._count.students,
        pending,
        overdue,
        completed,
      };
    }),
  );

  // Sort by overdue desc, pending desc
  employeeStats.sort((a, b) => {
    if (b.overdue !== a.overdue) return b.overdue - a.overdue;
    return b.pending - a.pending;
  });

  return {
    kpis: {
      totalEmployees: employees.length,
      totalPending: employeeStats.reduce((s, e) => s + e.pending, 0),
      totalOverdue: employeeStats.reduce((s, e) => s + e.overdue, 0),
      totalCompleted: employeeStats.reduce((s, e) => s + e.completed, 0),
    },
    charts: {
      taskPerformance: employeeStats.slice(0, 10).map((e) => ({
        name: e.name,
        value: e.completed,
      })) as ChartDataPoint[],
      overdueByEmployee: employeeStats
        .filter((e) => e.overdue > 0)
        .slice(0, 10)
        .map((e) => ({ name: e.name, value: e.overdue })) as ChartDataPoint[],
    },
    table: {
      headers: ["Employee", "Students", "Pending", "Overdue", "Completed"],
      rows: employeeStats.map((e) => ({
        Employee: e.name,
        Students: e.students,
        Pending: e.pending,
        Overdue: e.overdue,
        Completed: e.completed,
      })),
    },
  };
}

// ─────────────────────────────────────────────
// Finance Report
// ─────────────────────────────────────────────

async function runFinanceReport(filters: ReportFilters) {
  const paymentWhere = {
    deletedAt: null,
    status: "PAID",
    ...buildDateWhere(filters, "paymentDate"),
  };

  const invoiceWhere = {
    deletedAt: null,
    ...buildDateWhere(filters, "issueDate"),
  };

  const [totalRevenue, totalOutstanding, byMethod, monthlyPayments] = await Promise.all([
    prisma.payment.aggregate({
      where: paymentWhere,
      _sum: { amount: true },
    }),
    prisma.invoice.aggregate({
      where: { ...invoiceWhere, status: { in: ["ISSUED", "PARTIAL", "OVERDUE"] } },
      _sum: { dueAmount: true },
    }),
    prisma.payment.groupBy({
      by: ["paymentMethod"],
      where: paymentWhere,
      _count: true,
      _sum: { amount: true },
    }),
    prisma.payment.findMany({
      where: paymentWhere,
      select: { amount: true, paymentDate: true },
    }),
  ]);

  // Monthly revenue (last 12 months)
  const monthlyMap = new Map<string, number>();
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthlyMap.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, 0);
  }
  for (const p of monthlyPayments) {
    if (!p.paymentDate) continue;
    const d = new Date(p.paymentDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (monthlyMap.has(key)) {
      monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + p.amount);
    }
  }

  return {
    kpis: {
      totalRevenue: totalRevenue._sum.amount ?? 0,
      outstandingPayments: totalOutstanding._sum.dueAmount ?? 0,
    },
    charts: {
      monthlyRevenue: [...monthlyMap.entries()].map(([name, value]) => ({
        name,
        value: Math.round(value * 100) / 100,
      })) as ChartDataPoint[],
      byMethod: byMethod.map((r) => ({
        name: (r.paymentMethod as string).replace(/_/g, " "),
        value: r._sum.amount ?? 0,
      })) as ChartDataPoint[],
    },
    table: {
      headers: ["Method", "Count", "Amount"],
      rows: byMethod.map((r) => ({
        Method: r.paymentMethod,
        Count: r._count as number,
        Amount: r._sum.amount ?? 0,
      })),
    },
  };
}

// ─────────────────────────────────────────────
// Document Report
// ─────────────────────────────────────────────

async function runDocumentReport(filters: ReportFilters) {
  const where = {
    deletedAt: null,
    ...buildDateWhere(filters),
    ...(filters.status ? { status: filters.status } : {}),
  };

  const [total, approved, rejected, pending, byStatus] = await Promise.all([
    prisma.document.count({ where }),
    prisma.document.count({ where: { ...where, status: "APPROVED" } }),
    prisma.document.count({ where: { ...where, status: "REJECTED" } }),
    prisma.document.count({
      where: { ...where, status: { in: ["REQUESTED", "UPLOADED", "UNDER_REVIEW"] } },
    }),
    prisma.document.groupBy({
      by: ["status"],
      where,
      _count: true,
    }),
  ]);

  const completionRate = total > 0 ? Math.round((approved / total) * 1000) / 10 : 0;

  return {
    kpis: {
      totalDocuments: total,
      approved,
      rejected,
      pending,
      completionRate: `${completionRate}%`,
    },
    charts: {
      byStatus: byStatus.map((r) => ({
        name: (r.status as string).replace(/_/g, " "),
        value: r._count as number,
      })) as ChartDataPoint[],
      completion: [
        { name: "Approved", value: approved },
        { name: "Rejected", value: rejected },
        { name: "Pending", value: pending },
      ] as ChartDataPoint[],
    },
    table: {
      headers: ["Status", "Count"],
      rows: byStatus.map((r) => ({ Status: r.status, Count: r._count as number })),
    },
  };
}
