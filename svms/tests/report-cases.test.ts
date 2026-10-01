import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Prisma ───────────────────────────────────────────────────────

const prismaMock = vi.hoisted(() => ({
  student: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
  application: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
  document: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
  visaApplication: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
  task: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
  appointment: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
  payment: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn(), aggregate: vi.fn() },
  lead: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  getReport,
  reportScope,
  reportToCsv,
  REPORT_KINDS,
  type ReportKind,
} from "@/lib/services/report-cases";
import type { EmployeeScope } from "@/lib/services/employee-dashboard";
import { resolveDashboardRange } from "@/lib/utils/dashboard-range";

const ADMIN_SCOPE: EmployeeScope = { isAdmin: true, userId: "u-admin", employeeId: null };
const EMPLOYEE_SCOPE: EmployeeScope = { isAdmin: false, userId: "u-emp", employeeId: "emp-1" };
const OTHER_EMPLOYEE_SCOPE: EmployeeScope = { isAdmin: false, userId: "u-emp2", employeeId: "emp-2" };

const RANGE = resolveDashboardRange({ preset: "30d" });

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Constants ────────────────────────────────────────────────────────

describe("report constants", () => {
  it("has 9 report kinds", () => {
    expect(REPORT_KINDS).toHaveLength(9);
    expect(REPORT_KINDS).toContain("students");
    expect(REPORT_KINDS).toContain("applications");
    expect(REPORT_KINDS).toContain("pipeline");
    expect(REPORT_KINDS).toContain("documents");
    expect(REPORT_KINDS).toContain("visa");
    expect(REPORT_KINDS).toContain("tasks");
    expect(REPORT_KINDS).toContain("appointments");
    expect(REPORT_KINDS).toContain("payments");
    expect(REPORT_KINDS).toContain("leads");
  });
});

// ── IDOR closure (scope filters) ─────────────────────────────────────

describe("reportScope — IDOR closure", () => {
  it("students report scopes by assignedEmployeeId for EMPLOYEE", () => {
    expect(reportScope(EMPLOYEE_SCOPE, "students")).toEqual({ assignedEmployeeId: "emp-1" });
  });
  it("students report is empty scope for ADMIN", () => {
    expect(reportScope(ADMIN_SCOPE, "students")).toEqual({});
  });
  it("applications report scopes via student relation", () => {
    expect(reportScope(EMPLOYEE_SCOPE, "applications")).toEqual({ student: { assignedEmployeeId: "emp-1" } });
  });
  it("tasks report scopes by assignedToId (user, not employee)", () => {
    expect(reportScope(EMPLOYEE_SCOPE, "tasks")).toEqual({ assignedToId: "u-emp" });
  });
  it("leads report scopes by assignedEmployeeId", () => {
    expect(reportScope(EMPLOYEE_SCOPE, "leads")).toEqual({ assignedEmployeeId: "emp-1" });
  });
  it("two employees get independent scopes", () => {
    expect(reportScope(EMPLOYEE_SCOPE, "students")).toEqual({ assignedEmployeeId: "emp-1" });
    expect(reportScope(OTHER_EMPLOYEE_SCOPE, "students")).toEqual({ assignedEmployeeId: "emp-2" });
  });
});

// ── Students report ───────────────────────────────────────────────────

describe("students report", () => {
  it("returns rows + total + status buckets", async () => {
    const rows = [
      {
        id: "s1", studentId: "STD-2026-000001", firstName: "Karim", lastName: "Ahmed",
        email: "k@x.com", phone: "+88", country: "Bangladesh", city: "Dhaka", status: "ACTIVE",
        assignedEmployee: { id: "e1", user: { name: "Counselor A" } },
        createdAt: new Date("2026-01-01"),
      },
    ];
    prismaMock.student.findMany.mockResolvedValue(rows);
    prismaMock.student.count.mockResolvedValue(1);
    prismaMock.student.groupBy.mockResolvedValue([{ status: "ACTIVE", _count: { _all: 1 } }]);

    const r = await getReport(EMPLOYEE_SCOPE, "students", RANGE, {}, 50);
    expect(r.kind).toBe("students");
    expect(r.total).toBe(1);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].name).toBe("Karim Ahmed");
    expect(r.rows[0].assignedEmployee).toBe("Counselor A");
    expect(r.buckets).toEqual([{ label: "Active", count: 1 }]);
    expect(r.summary?.total).toBe(1);
    expect(r.summary?.active).toBe(1);
  });

  it("embeds the EMPLOYEE scope filter (IDOR)", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    prismaMock.student.groupBy.mockResolvedValue([]);
    await getReport(EMPLOYEE_SCOPE, "students", RANGE, {}, 50);
    expect(prismaMock.student.findMany.mock.calls[0][0].where.assignedEmployeeId).toBe("emp-1");
    expect(prismaMock.student.count.mock.calls[0][0].where.assignedEmployeeId).toBe("emp-1");
  });

  it("ADMIN scope does not filter by assignedEmployeeId", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    prismaMock.student.groupBy.mockResolvedValue([]);
    await getReport(ADMIN_SCOPE, "students", RANGE, {}, 50);
    expect(prismaMock.student.findMany.mock.calls[0][0].where.assignedEmployeeId).toBeUndefined();
  });

  it("applies status filter to rows + count (not to buckets)", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    prismaMock.student.groupBy.mockResolvedValue([]);
    await getReport(EMPLOYEE_SCOPE, "students", RANGE, { status: "ACTIVE" }, 50);
    expect(prismaMock.student.findMany.mock.calls[0][0].where.status).toBe("ACTIVE");
    expect(prismaMock.student.count.mock.calls[0][0].where.status).toBe("ACTIVE");
    // Buckets use the unfiltered owner scope (no status filter)
    expect(prismaMock.student.groupBy.mock.calls[0][0].where.status).toBeUndefined();
  });
});

// ── Applications report ───────────────────────────────────────────────

describe("applications report", () => {
  it("returns rows with student + country + stage buckets", async () => {
    const rows = [
      {
        id: "a1", applicationNumber: "APP-001", stageKey: "LEAD", status: "NEW", priority: "MEDIUM",
        createdAt: new Date(), updatedAt: new Date(),
        student: { firstName: "Karim", lastName: "Ahmed" },
        country: { name: "Germany" },
        university: { name: "TU Munich" },
        assignedEmployee: { id: "e1", user: { name: "Counselor" } },
      },
    ];
    prismaMock.application.findMany.mockResolvedValue(rows);
    prismaMock.application.count.mockResolvedValue(1);
    prismaMock.application.groupBy
      .mockResolvedValueOnce([{ stageKey: "LEAD", _count: { _all: 1 } }])
      .mockResolvedValueOnce([{ status: "NEW", _count: { _all: 1 } }]);
    // The second count call (submittedInRange) — Promise.all
    prismaMock.application.count
      .mockResolvedValueOnce(1) // total
      .mockResolvedValueOnce(1); // submittedInRange

    const r = await getReport(EMPLOYEE_SCOPE, "applications", RANGE, {}, 50);
    expect(r.kind).toBe("applications");
    expect(r.rows[0].student).toBe("Karim Ahmed");
    expect(r.rows[0].country).toBe("Germany");
    expect(r.rows[0].stage).toBe("Lead");
    expect(r.buckets).toHaveLength(18); // APPLICATION_STAGES has 18 entries
    expect(r.summary?.total).toBe(1);
    expect(r.summary?.submittedInRange).toBe(1);
  });

  it("applies countryId + status + stage filters", async () => {
    prismaMock.application.findMany.mockResolvedValue([]);
    prismaMock.application.count.mockResolvedValue(0);
    prismaMock.application.groupBy.mockResolvedValue([]);
    await getReport(EMPLOYEE_SCOPE, "applications", RANGE, {
      countryId: "c1", status: "NEW", stage: "LEAD",
    }, 50);
    const where = prismaMock.application.findMany.mock.calls[0][0].where;
    expect(where.countryId).toBe("c1");
    expect(where.status).toBe("NEW");
    expect(where.stageKey).toBe("LEAD");
  });
});

// ── Pipeline report ───────────────────────────────────────────────────

describe("pipeline report", () => {
  it("returns 18 stage buckets with no rows", async () => {
    prismaMock.application.groupBy.mockResolvedValue([
      { stageKey: "LEAD", _count: { _all: 5 } },
      { stageKey: "COMPLETED", _count: { _all: 3 } },
    ]);
    const r = await getReport(EMPLOYEE_SCOPE, "pipeline", RANGE, {});
    expect(r.kind).toBe("pipeline");
    expect(r.rows).toEqual([]);
    expect(r.buckets).toHaveLength(18);
    const lead = r.buckets!.find((b) => b.label === "Lead");
    expect(lead?.count).toBe(5);
    const completed = r.buckets!.find((b) => b.label === "Completed");
    expect(completed?.count).toBe(3);
    expect(r.total).toBe(8);
  });

  it("IDOR: embeds scope in the groupBy", async () => {
    prismaMock.application.groupBy.mockResolvedValue([]);
    await getReport(EMPLOYEE_SCOPE, "pipeline", RANGE, {});
    expect(prismaMock.application.groupBy.mock.calls[0][0].where).toMatchObject({
      student: { assignedEmployeeId: "emp-1" },
    });
  });
});

// ─── Documents report ────────────────────────────────────────────────

describe("documents report", () => {
  it("returns rows + status buckets + reviewedInRange summary", async () => {
    const rows = [
      {
        id: "d1", name: "Passport", documentType: "PASSPORT", status: "APPROVED",
        uploadedAt: new Date(), reviewedAt: new Date(), createdAt: new Date(),
        student: { firstName: "Karim", lastName: "Ahmed" },
      },
    ];
    prismaMock.document.findMany.mockResolvedValue(rows);
    prismaMock.document.count.mockResolvedValueOnce(1); // total
    prismaMock.document.groupBy.mockResolvedValue([{ status: "APPROVED", _count: { _all: 1 } }]);
    prismaMock.document.count.mockResolvedValueOnce(1); // reviewedInRange

    const r = await getReport(EMPLOYEE_SCOPE, "documents", RANGE, {}, 50);
    expect(r.kind).toBe("documents");
    expect(r.rows[0].student).toBe("Karim Ahmed");
    expect(r.rows[0].status).toBe("APPROVED");
    expect(r.summary?.total).toBe(1);
    expect(r.summary?.approved).toBe(1);
    expect(r.summary?.reviewedInRange).toBe(1);
  });
});

// ── Visa report ───────────────────────────────────────────────────────

describe("visa report", () => {
  it("returns 7 stage buckets + submittedInRange", async () => {
    const rows = [
      {
        id: "v1", stage: "APPROVED", visaType: "Student",
        submittedAt: new Date(), decisionAt: new Date(), createdAt: new Date(),
        application: {
          id: "a1", applicationNumber: "APP-001",
          student: { firstName: "Karim", lastName: "Ahmed" },
        },
      },
    ];
    prismaMock.visaApplication.findMany.mockResolvedValue(rows);
    prismaMock.visaApplication.count.mockResolvedValueOnce(1); // total
    prismaMock.visaApplication.groupBy.mockResolvedValue([{ stage: "APPROVED", _count: { _all: 1 } }]);
    prismaMock.visaApplication.count.mockResolvedValueOnce(1); // submittedInRange

    const r = await getReport(EMPLOYEE_SCOPE, "visa", RANGE, {}, 50);
    expect(r.kind).toBe("visa");
    expect(r.buckets).toHaveLength(7); // VISA_STAGES has 7 entries
    expect(r.summary?.approved).toBe(1);
    expect(r.summary?.submittedInRange).toBe(1);
  });
});

// ── Tasks report ───────────────────────────────────────────────────────

describe("tasks report", () => {
  it("returns rows + status buckets + overdue + completedInRange", async () => {
    const rows = [
      {
        id: "t1", title: "Review passport", status: "COMPLETED", priority: "HIGH",
        dueDate: new Date(), createdAt: new Date(), updatedAt: new Date(),
        student: { firstName: "Karim", lastName: "Ahmed" },
      },
    ];
    prismaMock.task.findMany.mockResolvedValue(rows);
    prismaMock.task.count.mockResolvedValueOnce(1); // total
    prismaMock.task.groupBy
      .mockResolvedValueOnce([{ status: "COMPLETED", _count: { _all: 1 } }]) // statusBuckets
      .mockResolvedValueOnce([{ priority: "HIGH", _count: { _all: 1 } }]); // priorityBuckets
    prismaMock.task.count.mockResolvedValueOnce(1); // completedInRange
    prismaMock.task.count.mockResolvedValueOnce(0); // overdue

    const r = await getReport(EMPLOYEE_SCOPE, "tasks", RANGE, {}, 50);
    expect(r.kind).toBe("tasks");
    expect(r.rows[0].student).toBe("Karim Ahmed");
    expect(r.summary?.completed).toBe(1);
    expect(r.summary?.overdue).toBe(0);
    expect(r.summary?.completedInRange).toBe(1);
  });

  it("IDOR: scopes by assignedToId (user, not employee)", async () => {
    prismaMock.task.findMany.mockResolvedValue([]);
    prismaMock.task.count.mockResolvedValue(0);
    prismaMock.task.groupBy.mockResolvedValue([]);
    await getReport(EMPLOYEE_SCOPE, "tasks", RANGE, {}, 50);
    expect(prismaMock.task.findMany.mock.calls[0][0].where.assignedToId).toBe("u-emp");
  });
});

// ── Appointments report ───────────────────────────────────────────────

describe("appointments report", () => {
  it("returns rows + status buckets + scheduledInRange", async () => {
    const rows = [
      {
        id: "ap1", title: "Initial counseling", type: "COUNSELING", status: "SCHEDULED",
        scheduledAt: new Date(), durationMinutes: 30, location: "Office",
        student: { firstName: "Karim", lastName: "Ahmed" },
      },
    ];
    prismaMock.appointment.findMany.mockResolvedValue(rows);
    prismaMock.appointment.count.mockResolvedValueOnce(1); // total
    prismaMock.appointment.groupBy
      .mockResolvedValueOnce([{ status: "SCHEDULED", _count: { _all: 1 } }])
      .mockResolvedValueOnce([{ type: "COUNSELING", _count: { _all: 1 } }]);
    prismaMock.appointment.count.mockResolvedValueOnce(1); // scheduledInRange

    const r = await getReport(EMPLOYEE_SCOPE, "appointments", RANGE, {}, 50);
    expect(r.kind).toBe("appointments");
    expect(r.rows[0].student).toBe("Karim Ahmed");
    expect(r.summary?.scheduled).toBe(1);
    expect(r.summary?.scheduledInRange).toBe(1);
  });
});

// ── Payments report ──────────────────────────────────────────────────

describe("payments report", () => {
  it("returns rows + status buckets + totalPaidAmount", async () => {
    const rows = [
      {
        id: "p1", amount: 500, currency: "EUR", paymentMethod: "BANK_TRANSFER",
        status: "PAID", transactionReference: "TX123", paymentDate: new Date(),
        student: { firstName: "Karim", lastName: "Ahmed" },
      },
    ];
    prismaMock.payment.findMany.mockResolvedValue(rows);
    prismaMock.payment.count.mockResolvedValueOnce(1); // total
    prismaMock.payment.groupBy
      .mockResolvedValueOnce([{ status: "PAID", _count: { _all: 1 } }])
      .mockResolvedValueOnce([{ paymentMethod: "BANK_TRANSFER", _count: { _all: 1 } }]);
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amount: 500 } });
    prismaMock.payment.count.mockResolvedValueOnce(1); // paidInRange

    const r = await getReport(EMPLOYEE_SCOPE, "payments", RANGE, {}, 50);
    expect(r.kind).toBe("payments");
    expect(r.rows[0].amount).toBe(500);
    expect(r.summary?.paid).toBe(1);
    expect(r.summary?.totalPaidAmount).toBe(500);
    expect(r.summary?.paidInRange).toBe(1);
  });
});

// ── Leads report ──────────────────────────────────────────────────────

describe("leads report", () => {
  it("returns rows + status buckets + newInRange", async () => {
    const rows = [
      {
        id: "l1", name: "Karim Ahmed", phone: "+88", email: "k@x.com",
        interestedCountry: "Germany", status: "NEW", source: "WEBSITE",
        nextFollowUp: new Date(), createdAt: new Date(),
        assignedEmployee: { id: "e1", user: { name: "Counselor A" } },
      },
    ];
    prismaMock.lead.findMany.mockResolvedValue(rows);
    prismaMock.lead.count.mockResolvedValueOnce(1); // total
    prismaMock.lead.groupBy
      .mockResolvedValueOnce([{ status: "NEW", _count: { _all: 1 } }])
      .mockResolvedValueOnce([{ source: "WEBSITE", _count: { _all: 1 } }]);
    prismaMock.lead.count.mockResolvedValueOnce(1); // newInRange

    const r = await getReport(EMPLOYEE_SCOPE, "leads", RANGE, {}, 50);
    expect(r.kind).toBe("leads");
    expect(r.rows[0].name).toBe("Karim Ahmed");
    expect(r.summary?.new).toBe(1);
    expect(r.summary?.newInRange).toBe(1);
  });
});

// ── Date-range filter (range-aware metrics) ──────────────────────────

describe("date-range filter (range-aware metrics)", () => {
  it("applications submittedInRange uses createdAt gte/lte", async () => {
    prismaMock.application.findMany.mockResolvedValue([]);
    prismaMock.application.count.mockResolvedValue(0);
    prismaMock.application.groupBy.mockResolvedValue([]);
    await getReport(EMPLOYEE_SCOPE, "applications", RANGE, {}, 50);
    // The third count call is submittedInRange — check its where clause
    const submittedInRangeCall = prismaMock.application.count.mock.calls.find(
      (c) => c[0].where && c[0].where.createdAt,
    );
    expect(submittedInRangeCall).toBeDefined();
    expect(submittedInRangeCall![0].where.createdAt).toMatchObject({
      gte: expect.any(Date), lte: expect.any(Date),
    });
  });

  it("documents reviewedInRange uses reviewedAt", async () => {
    prismaMock.document.findMany.mockResolvedValue([]);
    prismaMock.document.count.mockResolvedValue(0);
    prismaMock.document.groupBy.mockResolvedValue([]);
    await getReport(EMPLOYEE_SCOPE, "documents", RANGE, {}, 50);
    const reviewedCall = prismaMock.document.count.mock.calls.find(
      (c) => c[0].where && c[0].where.reviewedAt,
    );
    expect(reviewedCall).toBeDefined();
  });

  it("tasks completedInRange uses updatedAt + status=COMPLETED", async () => {
    prismaMock.task.findMany.mockResolvedValue([]);
    prismaMock.task.count.mockResolvedValue(0);
    prismaMock.task.groupBy.mockResolvedValue([]);
    await getReport(EMPLOYEE_SCOPE, "tasks", RANGE, {}, 50);
    const completedCall = prismaMock.task.count.mock.calls.find(
      (c) => c[0].where && c[0].where.status === "COMPLETED" && c[0].where.updatedAt,
    );
    expect(completedCall).toBeDefined();
  });

  it("leads newInRange uses createdAt + status=NEW", async () => {
    prismaMock.lead.findMany.mockResolvedValue([]);
    prismaMock.lead.count.mockResolvedValue(0);
    prismaMock.lead.groupBy.mockResolvedValue([]);
    await getReport(EMPLOYEE_SCOPE, "leads", RANGE, {}, 50);
    const newCall = prismaMock.lead.count.mock.calls.find(
      (c) => c[0].where && c[0].where.status === "NEW" && c[0].where.createdAt,
    );
    expect(newCall).toBeDefined();
  });
});

// ── CSV export ────────────────────────────────────────────────────────

describe("reportToCsv", () => {
  it("emits header + rows + summary footer", () => {
    const report = {
      kind: "students" as ReportKind,
      total: 2,
      rows: [
        { id: "s1", name: "Karim Ahmed", status: "ACTIVE" },
        { id: "s2", name: "Sara Khan", status: "ACTIVE" },
      ],
      summary: { total: 2, active: 2 },
    };
    const csv = reportToCsv(report);
    expect(csv).toContain("id,name,status");
    expect(csv).toContain("s1,Karim Ahmed,ACTIVE");
    expect(csv).toContain("s2,Sara Khan,ACTIVE");
    expect(csv).toContain("# Summary");
    expect(csv).toContain("total,2");
    expect(csv).toContain("active,2");
  });

  it("escapes cells containing commas (RFC 4180)", () => {
    const report = {
      kind: "students" as ReportKind,
      total: 1,
      rows: [{ id: "s1", name: "Ahmed, Karim", status: "ACTIVE" }],
    };
    const csv = reportToCsv(report);
    expect(csv).toContain('"Ahmed, Karim"');
  });

  it("escapes cells containing double-quotes by doubling them", () => {
    const report = {
      kind: "students" as ReportKind,
      total: 1,
      rows: [{ id: "s1", note: 'He said "hi"', status: "ACTIVE" }],
    };
    const csv = reportToCsv(report);
    expect(csv).toContain('"He said ""hi"""');
  });

  it("escapes cells containing newlines", () => {
    const report = {
      kind: "students" as ReportKind,
      total: 1,
      rows: [{ id: "s1", note: "line1\nline2", status: "ACTIVE" }],
    };
    const csv = reportToCsv(report);
    expect(csv).toContain('"line1\nline2"');
  });

  it("handles empty rows (only header + summary)", () => {
    const report = {
      kind: "pipeline" as ReportKind,
      total: 0,
      rows: [],
      summary: { total: 0 },
    };
    const csv = reportToCsv(report);
    expect(csv).toContain("# pipeline report");
    // Empty-rows branch formats summary as "key: value" pairs
    expect(csv).toContain("total: 0");
  });

  it("handles completely empty report (no summary)", () => {
    const report = {
      kind: "pipeline" as ReportKind,
      total: 0,
      rows: [],
    };
    const csv = reportToCsv(report);
    expect(csv).toContain("no rows");
  });

  it("formats Date values as ISO strings", () => {
    const d = new Date("2026-09-14T12:00:00Z");
    const report = {
      kind: "students" as ReportKind,
      total: 1,
      rows: [{ id: "s1", createdAt: d }],
    };
    const csv = reportToCsv(report);
    expect(csv).toContain(d.toISOString());
  });

  it("formats numbers without quotes", () => {
    const report = {
      kind: "payments" as ReportKind,
      total: 1,
      rows: [{ id: "p1", amount: 500, currency: "EUR" }],
    };
    const csv = reportToCsv(report);
    expect(csv).toContain("amount,currency");
    expect(csv).toContain("p1,500,EUR");
  });
});

// ── Network failure propagation ──────────────────────────────────────

describe("network failure propagation", () => {
  it("students report lets prisma errors bubble", async () => {
    prismaMock.student.findMany.mockRejectedValue(new Error("DB lost"));
    prismaMock.student.count.mockResolvedValue(0);
    prismaMock.student.groupBy.mockResolvedValue([]);
    await expect(getReport(EMPLOYEE_SCOPE, "students", RANGE, {}, 50)).rejects.toThrow("DB lost");
  });

  it("pipeline report lets groupBy errors bubble", async () => {
    prismaMock.application.groupBy.mockRejectedValue(new Error("groupBy fail"));
    await expect(getReport(EMPLOYEE_SCOPE, "pipeline", RANGE, {})).rejects.toThrow("groupBy fail");
  });

  it("applications report lets count errors bubble", async () => {
    prismaMock.application.findMany.mockResolvedValue([]);
    prismaMock.application.count.mockRejectedValue(new Error("count fail"));
    prismaMock.application.groupBy.mockResolvedValue([]);
    await expect(getReport(EMPLOYEE_SCOPE, "applications", RANGE, {}, 50)).rejects.toThrow("count fail");
  });
});

// ── Permission boundaries (EMPLOYEE vs ADMIN) ───────────────────────

describe("permission boundaries", () => {
  it("EMPLOYEE scope always carries the employeeId filter (never trusts client)", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    prismaMock.student.groupBy.mockResolvedValue([]);
    // Even with a client-supplied employeeId filter, the scope filter is still applied
    await getReport(EMPLOYEE_SCOPE, "students", RANGE, { employeeId: "emp-from-client" }, 50);
    expect(prismaMock.student.findMany.mock.calls[0][0].where.assignedEmployeeId).toBe("emp-1");
  });

  it("ADMIN sees global scope (no assignedEmployeeId filter)", async () => {
    prismaMock.application.findMany.mockResolvedValue([]);
    prismaMock.application.count.mockResolvedValue(0);
    prismaMock.application.groupBy.mockResolvedValue([]);
    await getReport(ADMIN_SCOPE, "applications", RANGE, {}, 50);
    expect(prismaMock.application.findMany.mock.calls[0][0].where.student).toBeUndefined();
  });

  it("two employees see disjoint data sets", async () => {
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    prismaMock.student.groupBy.mockResolvedValue([]);
    await getReport(EMPLOYEE_SCOPE, "students", RANGE, {}, 50);
    const empAWhere = prismaMock.student.findMany.mock.calls[0][0].where;
    expect(empAWhere.assignedEmployeeId).toBe("emp-1");

    vi.clearAllMocks();
    prismaMock.student.findMany.mockResolvedValue([]);
    prismaMock.student.count.mockResolvedValue(0);
    prismaMock.student.groupBy.mockResolvedValue([]);
    await getReport(OTHER_EMPLOYEE_SCOPE, "students", RANGE, {}, 50);
    const empBWhere = prismaMock.student.findMany.mock.calls[0][0].where;
    expect(empBWhere.assignedEmployeeId).toBe("emp-2");
    expect(empAWhere.assignedEmployeeId).not.toBe(empBWhere.assignedEmployeeId);
  });
});
