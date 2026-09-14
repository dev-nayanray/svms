import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Prisma ───────────────────────────────────────────────────────

const prismaMock = vi.hoisted(() => ({
  student: { count: vi.fn() },
  application: { count: vi.fn() },
  document: { count: vi.fn() },
  visaApplication: { count: vi.fn() },
  task: { count: vi.fn() },
  appointment: { count: vi.fn() },
  lead: { count: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  getPerformanceKpis,
  getPerformanceTrend,
  kpisToCsv,
  trendToCsv,
} from "@/lib/services/performance-cases";
import type { EmployeeScope } from "@/lib/services/employee-dashboard";
import { resolveDashboardRange } from "@/lib/utils/dashboard-range";

const ADMIN_SCOPE: EmployeeScope = { isAdmin: true, userId: "u-admin", employeeId: null };
const EMPLOYEE_SCOPE: EmployeeScope = { isAdmin: false, userId: "u-emp", employeeId: "emp-1" };
const OTHER_EMPLOYEE_SCOPE: EmployeeScope = { isAdmin: false, userId: "u-emp2", employeeId: "emp-2" };

const RANGE = resolveDashboardRange({ preset: "30d" });
const TODAY_RANGE = resolveDashboardRange({ preset: "today" });
const YEAR_RANGE = resolveDashboardRange({ preset: "year", now: new Date("2026-06-15T12:00:00Z") });

const ALL_PERMS = {
  students: true, applications: true, documents: true, visa: true,
  tasks: true, appointments: true, leads: true, payments: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: all counts return 0
  prismaMock.student.count.mockResolvedValue(0);
  prismaMock.application.count.mockResolvedValue(0);
  prismaMock.document.count.mockResolvedValue(0);
  prismaMock.visaApplication.count.mockResolvedValue(0);
  prismaMock.task.count.mockResolvedValue(0);
  prismaMock.appointment.count.mockResolvedValue(0);
  prismaMock.lead.count.mockResolvedValue(0);
});

// ── KPI computation ───────────────────────────────────────────────────

describe("getPerformanceKpis — basic shape", () => {
  it("returns 12 KPIs (all zero when no data)", async () => {
    const kpis = await getPerformanceKpis(EMPLOYEE_SCOPE, RANGE, ALL_PERMS);
    expect(kpis).toMatchObject({
      assignedStudents: 0, activeCases: 0, completedCases: 0,
      applicationsSubmitted: 0, visaSubmissions: 0, visaApprovals: 0,
      pendingDocuments: 0, documentsReviewed: 0,
      completedTasks: 0, overdueTasks: 0,
      appointments: 0, convertedLeads: 0,
    });
    expect(Object.keys(kpis)).toHaveLength(12);
  });

  it("computes assignedStudents count (stock metric)", async () => {
    prismaMock.student.count.mockResolvedValue(7);
    const kpis = await getPerformanceKpis(EMPLOYEE_SCOPE, RANGE, ALL_PERMS);
    expect(kpis.assignedStudents).toBe(7);
    // Stock metric: ignores the range — no createdAt filter
    expect(prismaMock.student.count.mock.calls[0][0].where).toEqual({ assignedEmployeeId: "emp-1" });
  });

  it("computes activeCases (status != COMPLETED)", async () => {
    prismaMock.application.count.mockResolvedValue(5);
    const kpis = await getPerformanceKpis(EMPLOYEE_SCOPE, RANGE, ALL_PERMS);
    expect(kpis.activeCases).toBe(5);
    expect(prismaMock.application.count.mock.calls[0][0].where).toMatchObject({
      status: { not: "COMPLETED" },
      student: { assignedEmployeeId: "emp-1" },
    });
  });

  it("computes completedCases (status = COMPLETED)", async () => {
    prismaMock.application.count.mockResolvedValue(3);
    const kpis = await getPerformanceKpis(EMPLOYEE_SCOPE, RANGE, ALL_PERMS);
    expect(kpis.completedCases).toBe(3);
  });

  it("applicationsSubmitted is range-aware (createdAt gte/lte)", async () => {
    prismaMock.application.count.mockResolvedValue(12);
    const kpis = await getPerformanceKpis(EMPLOYEE_SCOPE, RANGE, ALL_PERMS);
    expect(kpis.applicationsSubmitted).toBe(12);
    // Find the count call that has createdAt range
    const rangeCall = prismaMock.application.count.mock.calls.find(
      (c) => c[0].where && c[0].where.createdAt,
    );
    expect(rangeCall).toBeDefined();
    expect(rangeCall![0].where.createdAt).toMatchObject({
      gte: expect.any(Date), lte: expect.any(Date),
    });
  });

  it("visaSubmissions uses submittedAt range", async () => {
    prismaMock.visaApplication.count.mockResolvedValue(8);
    const kpis = await getPerformanceKpis(EMPLOYEE_SCOPE, RANGE, ALL_PERMS);
    expect(kpis.visaSubmissions).toBe(8);
    const call = prismaMock.visaApplication.count.mock.calls[0][0].where;
    expect(call.submittedAt).toMatchObject({ gte: expect.any(Date), lte: expect.any(Date) });
  });

  it("visaApprovals filters stage=APPROVED + decisionAt range", async () => {
    prismaMock.visaApplication.count.mockResolvedValue(4);
    const kpis = await getPerformanceKpis(EMPLOYEE_SCOPE, RANGE, ALL_PERMS);
    expect(kpis.visaApprovals).toBe(4);
    const call = prismaMock.visaApplication.count.mock.calls[1][0].where;
    expect(call.stage).toBe("APPROVED");
    expect(call.decisionAt).toMatchObject({ gte: expect.any(Date), lte: expect.any(Date) });
  });

  it("pendingDocuments is stock (no range filter)", async () => {
    prismaMock.document.count.mockResolvedValue(9);
    const kpis = await getPerformanceKpis(EMPLOYEE_SCOPE, RANGE, ALL_PERMS);
    expect(kpis.pendingDocuments).toBe(9);
    const call = prismaMock.document.count.mock.calls[0][0].where;
    expect(call.status).toEqual({ in: ["REQUESTED", "UPLOADED", "UNDER_REVIEW"] });
    // No date filter on the pending count
    expect(call.reviewedAt).toBeUndefined();
    expect(call.createdAt).toBeUndefined();
  });

  it("documentsReviewed uses reviewedAt range + status in APPROVED/REJECTED", async () => {
    prismaMock.document.count.mockResolvedValue(15);
    const kpis = await getPerformanceKpis(EMPLOYEE_SCOPE, RANGE, ALL_PERMS);
    expect(kpis.documentsReviewed).toBe(15);
    const call = prismaMock.document.count.mock.calls[1][0].where;
    expect(call.status).toEqual({ in: ["APPROVED", "REJECTED"] });
    expect(call.reviewedAt).toMatchObject({ gte: expect.any(Date), lte: expect.any(Date) });
  });

  it("completedTasks uses updatedAt range + status=COMPLETED", async () => {
    prismaMock.task.count.mockResolvedValue(20);
    const kpis = await getPerformanceKpis(EMPLOYEE_SCOPE, RANGE, ALL_PERMS);
    expect(kpis.completedTasks).toBe(20);
    const completedCall = prismaMock.task.count.mock.calls[0][0].where;
    expect(completedCall.status).toBe("COMPLETED");
    expect(completedCall.updatedAt).toMatchObject({ gte: expect.any(Date), lte: expect.any(Date) });
  });

  it("overdueTasks filters dueDate < now + open status", async () => {
    prismaMock.task.count.mockResolvedValue(2);
    const kpis = await getPerformanceKpis(EMPLOYEE_SCOPE, RANGE, ALL_PERMS);
    expect(kpis.overdueTasks).toBe(2);
    const overdueCall = prismaMock.task.count.mock.calls[1][0].where;
    expect(overdueCall.status).toEqual({ in: ["TODO", "IN_PROGRESS"] });
    expect(overdueCall.dueDate).toMatchObject({ lt: expect.any(Date) });
  });

  it("appointments is range-aware (scheduledAt)", async () => {
    prismaMock.appointment.count.mockResolvedValue(11);
    const kpis = await getPerformanceKpis(EMPLOYEE_SCOPE, RANGE, ALL_PERMS);
    expect(kpis.appointments).toBe(11);
    const call = prismaMock.appointment.count.mock.calls[0][0].where;
    expect(call.scheduledAt).toMatchObject({ gte: expect.any(Date), lte: expect.any(Date) });
  });

  it("convertedLeads filters status=CONVERTED + updatedAt range", async () => {
    prismaMock.lead.count.mockResolvedValue(6);
    const kpis = await getPerformanceKpis(EMPLOYEE_SCOPE, RANGE, ALL_PERMS);
    expect(kpis.convertedLeads).toBe(6);
    const call = prismaMock.lead.count.mock.calls[0][0].where;
    expect(call.status).toBe("CONVERTED");
    expect(call.updatedAt).toMatchObject({ gte: expect.any(Date), lte: expect.any(Date) });
  });
});

// ── Permission gating ────────────────────────────────────────────────

describe("getPerformanceKpis — permission gating", () => {
  it("returns 0 for students KPI when permission is missing", async () => {
    prismaMock.student.count.mockResolvedValue(99);
    const kpis = await getPerformanceKpis(EMPLOYEE_SCOPE, RANGE, { ...ALL_PERMS, students: false });
    expect(kpis.assignedStudents).toBe(0);
    // prisma.student.count should NOT have been called
    expect(prismaMock.student.count).not.toHaveBeenCalled();
  });

  it("returns 0 for visa KPIs when visa permission is missing", async () => {
    prismaMock.visaApplication.count.mockResolvedValue(99);
    const kpis = await getPerformanceKpis(EMPLOYEE_SCOPE, RANGE, { ...ALL_PERMS, visa: false });
    expect(kpis.visaSubmissions).toBe(0);
    expect(kpis.visaApprovals).toBe(0);
    expect(prismaMock.visaApplication.count).not.toHaveBeenCalled();
  });

  it("returns 0 for leads KPI when leads permission is missing", async () => {
    prismaMock.lead.count.mockResolvedValue(99);
    const kpis = await getPerformanceKpis(EMPLOYEE_SCOPE, RANGE, { ...ALL_PERMS, leads: false });
    expect(kpis.convertedLeads).toBe(0);
    expect(prismaMock.lead.count).not.toHaveBeenCalled();
  });

  it("with no perms, all KPIs are 0 and no DB calls are made", async () => {
    const kpis = await getPerformanceKpis(EMPLOYEE_SCOPE, RANGE, {});
    expect(Object.values(kpis).every((v) => v === 0)).toBe(true);
    expect(prismaMock.student.count).not.toHaveBeenCalled();
    expect(prismaMock.application.count).not.toHaveBeenCalled();
    expect(prismaMock.task.count).not.toHaveBeenCalled();
    expect(prismaMock.lead.count).not.toHaveBeenCalled();
  });
});

// ── IDOR closure ─────────────────────────────────────────────────────

describe("getPerformanceKpis — IDOR closure", () => {
  it("EMPLOYEE student count scopes by assignedEmployeeId", async () => {
    await getPerformanceKpis(EMPLOYEE_SCOPE, RANGE, ALL_PERMS);
    expect(prismaMock.student.count.mock.calls[0][0].where).toEqual({
      assignedEmployeeId: "emp-1",
    });
  });

  it("ADMIN student count has empty scope", async () => {
    await getPerformanceKpis(ADMIN_SCOPE, RANGE, ALL_PERMS);
    expect(prismaMock.student.count.mock.calls[0][0].where).toEqual({});
  });

  it("EMPLOYEE tasks count scopes by assignedToId (user, not employee)", async () => {
    await getPerformanceKpis(EMPLOYEE_SCOPE, RANGE, ALL_PERMS);
    expect(prismaMock.task.count.mock.calls[0][0].where.assignedToId).toBe("u-emp");
  });

  it("ADMIN tasks count does NOT scope by assignedToId", async () => {
    await getPerformanceKpis(ADMIN_SCOPE, RANGE, ALL_PERMS);
    expect(prismaMock.task.count.mock.calls[0][0].where.assignedToId).toBeUndefined();
  });

  it("two employees produce disjoint scope filters", async () => {
    await getPerformanceKpis(EMPLOYEE_SCOPE, RANGE, ALL_PERMS);
    const empAFilter = prismaMock.student.count.mock.calls[0][0].where;
    vi.clearAllMocks();
    prismaMock.student.count.mockResolvedValue(0);
    await getPerformanceKpis(OTHER_EMPLOYEE_SCOPE, RANGE, ALL_PERMS);
    const empBFilter = prismaMock.student.count.mock.calls[0][0].where;
    expect(empAFilter.assignedEmployeeId).toBe("emp-1");
    expect(empBFilter.assignedEmployeeId).toBe("emp-2");
  });

  it("application counts embed student.assignedEmployeeId for EMPLOYEE", async () => {
    await getPerformanceKpis(EMPLOYEE_SCOPE, RANGE, ALL_PERMS);
    for (const call of prismaMock.application.count.mock.calls) {
      expect(call[0].where).toMatchObject({
        student: { assignedEmployeeId: "emp-1" },
      });
    }
  });
});

// ── Range awareness ──────────────────────────────────────────────────

describe("getPerformanceKpis — range awareness", () => {
  it("stock metrics (assignedStudents, pendingDocuments) ignore the range", async () => {
    await getPerformanceKpis(EMPLOYEE_SCOPE, TODAY_RANGE, ALL_PERMS);
    // assignedStudents — no date filter
    expect(prismaMock.student.count.mock.calls[0][0].where).toEqual({
      assignedEmployeeId: "emp-1",
    });
    // pendingDocuments — no date filter
    const pendingCall = prismaMock.document.count.mock.calls[0][0].where;
    expect(pendingCall.reviewedAt).toBeUndefined();
    expect(pendingCall.createdAt).toBeUndefined();
  });

  it("flow metrics embed the resolved range", async () => {
    await getPerformanceKpis(EMPLOYEE_SCOPE, TODAY_RANGE, ALL_PERMS);
    // applicationsSubmitted — createdAt range
    const appCall = prismaMock.application.count.mock.calls.find(
      (c) => c[0].where && c[0].where.createdAt,
    );
    expect(appCall).toBeDefined();
    expect(appCall![0].where.createdAt.gte).toEqual(TODAY_RANGE.from);
    expect(appCall![0].where.createdAt.lte).toEqual(TODAY_RANGE.to);
  });

  it("different ranges produce different date filters", async () => {
    await getPerformanceKpis(EMPLOYEE_SCOPE, RANGE, ALL_PERMS);
    const range30AppCall = prismaMock.application.count.mock.calls.find(
      (c) => c[0].where && c[0].where.createdAt,
    )!;
    vi.clearAllMocks();
    prismaMock.application.count.mockResolvedValue(0);
    await getPerformanceKpis(EMPLOYEE_SCOPE, YEAR_RANGE, ALL_PERMS);
    const yearAppCall = prismaMock.application.count.mock.calls.find(
      (c) => c[0].where && c[0].where.createdAt,
    )!;
    expect(range30AppCall[0].where.createdAt.gte).not.toEqual(yearAppCall[0].where.createdAt.gte);
  });
});

// ── Trend ─────────────────────────────────────────────────────────────

describe("getPerformanceTrend", () => {
  it("returns buckets with all-zero values when all perms are missing", async () => {
    const trend = await getPerformanceTrend(EMPLOYEE_SCOPE, RANGE, {});
    // Buckets are still built, but every series value is 0
    expect(trend.length).toBeGreaterThan(0);
    for (const p of trend) {
      expect(p.applications).toBe(0);
      expect(p.documents).toBe(0);
      expect(p.tasks).toBe(0);
      expect(p.leads).toBe(0);
    }
    // No DB calls were made
    expect(prismaMock.application.count).not.toHaveBeenCalled();
    expect(prismaMock.document.count).not.toHaveBeenCalled();
    expect(prismaMock.task.count).not.toHaveBeenCalled();
    expect(prismaMock.lead.count).not.toHaveBeenCalled();
  });

  it("returns one TrendPoint per bucket", async () => {
    const trend = await getPerformanceTrend(EMPLOYEE_SCOPE, RANGE, ALL_PERMS);
    // 30d range → 10 buckets
    expect(trend).toHaveLength(10);
    expect(trend[0]).toMatchObject({
      date: expect.any(String), // ISO
      label: expect.any(String),
      applications: 0, documents: 0, tasks: 0, leads: 0,
    });
  });

  it("today preset produces 24 hourly buckets", async () => {
    const trend = await getPerformanceTrend(EMPLOYEE_SCOPE, TODAY_RANGE, ALL_PERMS);
    expect(trend).toHaveLength(24);
    expect(trend[0].label).toBe("0:00");
    expect(trend[23].label).toBe("23:00");
  });

  it("year preset produces 12 monthly buckets", async () => {
    const trend = await getPerformanceTrend(EMPLOYEE_SCOPE, YEAR_RANGE, ALL_PERMS);
    expect(trend).toHaveLength(12);
    expect(trend[0].label).toBe("Jan");
    expect(trend[11].label).toBe("Dec");
  });

  it("7d preset produces 7 daily buckets", async () => {
    const RANGE_7D = resolveDashboardRange({ preset: "7d" });
    const trend = await getPerformanceTrend(EMPLOYEE_SCOPE, RANGE_7D, ALL_PERMS);
    expect(trend).toHaveLength(7);
  });

  it("aggregates counts per bucket across all 4 series", async () => {
    prismaMock.application.count.mockResolvedValue(2);
    prismaMock.document.count.mockResolvedValue(3);
    prismaMock.task.count.mockResolvedValue(1);
    prismaMock.lead.count.mockResolvedValue(0);
    const trend = await getPerformanceTrend(EMPLOYEE_SCOPE, RANGE, ALL_PERMS);
    expect(trend[0].applications).toBe(2);
    expect(trend[0].documents).toBe(3);
    expect(trend[0].tasks).toBe(1);
    expect(trend[0].leads).toBe(0);
  });

  it("skips series when permission is missing (returns 0 for that series)", async () => {
    const trend = await getPerformanceTrend(EMPLOYEE_SCOPE, RANGE, { ...ALL_PERMS, leads: false });
    expect(trend).toHaveLength(10);
    expect(trend[0].leads).toBe(0);
    expect(prismaMock.lead.count).not.toHaveBeenCalled();
  });

  it("IDOR: trend queries embed the scope filter", async () => {
    await getPerformanceTrend(EMPLOYEE_SCOPE, RANGE, ALL_PERMS);
    expect(prismaMock.application.count.mock.calls[0][0].where).toMatchObject({
      student: { assignedEmployeeId: "emp-1" },
    });
    expect(prismaMock.task.count.mock.calls[0][0].where.assignedToId).toBe("u-emp");
  });
});

// ── CSV export ────────────────────────────────────────────────────────

describe("kpisToCsv", () => {
  it("emits a header + 13 metric rows", () => {
    const kpis = {
      assignedStudents: 10, activeCases: 5, completedCases: 3,
      applicationsSubmitted: 12, visaSubmissions: 8, visaApprovals: 4,
      pendingDocuments: 9, documentsReviewed: 15,
      completedTasks: 20, overdueTasks: 2,
      appointments: 11, convertedLeads: 6,
    };
    const csv = kpisToCsv(kpis, "Last 30 days");
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("Metric,Value");
    // First data row is the range label
    expect(lines[1]).toContain("Range");
    expect(lines[1]).toContain("Last 30 days");
    // Subsequent rows are the 12 KPIs
    expect(lines.length).toBe(14); // header + range + 12 KPIs
    expect(csv).toContain("Assigned Students,10");
    expect(csv).toContain("Active Cases,5");
    expect(csv).toContain("Completed Cases,3");
    expect(csv).toContain("Applications Submitted,12");
    expect(csv).toContain("Visa Submissions,8");
    expect(csv).toContain("Visa Approvals,4");
    expect(csv).toContain("Pending Documents,9");
    expect(csv).toContain("Documents Reviewed,15");
    expect(csv).toContain("Completed Tasks,20");
    expect(csv).toContain("Overdue Tasks,2");
    expect(csv).toContain("Appointments,11");
    expect(csv).toContain("Converted Leads,6");
  });

  it("escapes the range label if it contains a comma", () => {
    const kpis = {
      assignedStudents: 0, activeCases: 0, completedCases: 0,
      applicationsSubmitted: 0, visaSubmissions: 0, visaApprovals: 0,
      pendingDocuments: 0, documentsReviewed: 0,
      completedTasks: 0, overdueTasks: 0,
      appointments: 0, convertedLeads: 0,
    };
    const csv = kpisToCsv(kpis, "Sep 1, 2026 – Sep 30, 2026");
    expect(csv).toContain('"Sep 1, 2026 – Sep 30, 2026"');
  });
});

describe("trendToCsv", () => {
  it("emits header only when trend is empty", () => {
    const csv = trendToCsv([]);
    expect(csv).toBe("date,applications,documents,tasks,leads\n");
  });

  it("emits one row per TrendPoint", () => {
    const trend = [
      { date: "2026-09-01T00:00:00.000Z", label: "Sep 1", applications: 2, documents: 3, tasks: 1, leads: 0 },
      { date: "2026-09-02T00:00:00.000Z", label: "Sep 2", applications: 4, documents: 1, tasks: 2, leads: 1 },
    ];
    const csv = trendToCsv(trend);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("date,applications,documents,tasks,leads");
    expect(lines[1]).toBe("2026-09-01T00:00:00.000Z,2,3,1,0");
    expect(lines[2]).toBe("2026-09-02T00:00:00.000Z,4,1,2,1");
  });
});

// ── Network failure propagation ──────────────────────────────────────

describe("network failure propagation", () => {
  it("getPerformanceKpis lets prisma errors bubble", async () => {
    prismaMock.student.count.mockRejectedValue(new Error("DB lost"));
    await expect(getPerformanceKpis(EMPLOYEE_SCOPE, RANGE, ALL_PERMS)).rejects.toThrow("DB lost");
  });

  it("getPerformanceTrend lets prisma errors bubble", async () => {
    prismaMock.application.count.mockRejectedValue(new Error("trend fail"));
    await expect(getPerformanceTrend(EMPLOYEE_SCOPE, RANGE, ALL_PERMS)).rejects.toThrow("trend fail");
  });
});

// ── Report values vs DB (sanity checks) ──────────────────────────────

describe("report values vs DB", () => {
  it("assignedStudents reflects the actual count from the DB", async () => {
    prismaMock.student.count.mockResolvedValue(42);
    const kpis = await getPerformanceKpis(EMPLOYEE_SCOPE, RANGE, ALL_PERMS);
    expect(kpis.assignedStudents).toBe(42);
  });

  it("completedTasks reflects the DB count (not a derived value)", async () => {
    prismaMock.task.count.mockResolvedValue(17);
    const kpis = await getPerformanceKpis(EMPLOYEE_SCOPE, RANGE, ALL_PERMS);
    expect(kpis.completedTasks).toBe(17);
    // The completedTasks query filters status=COMPLETED
    const call = prismaMock.task.count.mock.calls[0][0].where;
    expect(call.status).toBe("COMPLETED");
  });

  it("visaApprovals is a subset of visaSubmissions (different filter)", async () => {
    prismaMock.visaApplication.count
      .mockResolvedValueOnce(10)  // visaSubmissions (submittedAt range)
      .mockResolvedValueOnce(3);  // visaApprovals (stage=APPROVED + decisionAt range)
    const kpis = await getPerformanceKpis(EMPLOYEE_SCOPE, RANGE, ALL_PERMS);
    expect(kpis.visaSubmissions).toBe(10);
    expect(kpis.visaApprovals).toBe(3);
    // Sanity: approvals ≤ submissions
    expect(kpis.visaApprovals).toBeLessThanOrEqual(kpis.visaSubmissions);
  });
});
