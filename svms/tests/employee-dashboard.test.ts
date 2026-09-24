import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────
// Mocks — prisma is stubbed so the dashboard service queries return
// controlled counts/lists without touching a real database.
// ─────────────────────────────────────────────

const prismaMock = vi.hoisted(() => ({
  student: { count: vi.fn() },
  lead: { count: vi.fn(), findMany: vi.fn() },
  application: { count: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
  document: { count: vi.fn(), findMany: vi.fn() },
  task: { count: vi.fn(), findMany: vi.fn() },
  visaApplication: { count: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
  appointment: { count: vi.fn(), findMany: vi.fn() },
  payment: { count: vi.fn(), findMany: vi.fn() },
  invoice: { count: vi.fn() },
  intake: { findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  getDashboardKpis,
  getApplicationPipeline,
  getVisaCases,
  getRecentActivity,
  getPendingDocuments,
  getMyTasks,
  getUpcomingAppointments,
  getUpcomingDeadlines,
  getEmployeeDashboard,
  studentScope,
  applicationScope,
  visaScope,
  taskScope,
  leadScope,
  documentScope,
  appointmentScope,
  paymentScope,
  type EmployeeScope,
  APPLICATION_STAGES,
  VISA_STAGES,
} from "@/lib/services/employee-dashboard";
import { resolveDashboardRange } from "@/lib/utils/dashboard-range";

const ADMIN_SCOPE: EmployeeScope = { isAdmin: true, userId: "u-admin", employeeId: null };
const EMPLOYEE_SCOPE: EmployeeScope = { isAdmin: false, userId: "u-emp", employeeId: "emp-1" };

const range = resolveDashboardRange({ preset: "30d", now: new Date("2026-08-15T10:00:00Z") });

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────
// Scope filters — IDOR closure
// ─────────────────────────────────────────────

describe("scope filters (case ownership)", () => {
  it("ADMIN scope is empty — sees all records", () => {
    expect(studentScope(ADMIN_SCOPE)).toEqual({});
    expect(applicationScope(ADMIN_SCOPE)).toEqual({});
    expect(visaScope(ADMIN_SCOPE)).toEqual({});
    expect(taskScope(ADMIN_SCOPE)).toEqual({});
    expect(leadScope(ADMIN_SCOPE)).toEqual({});
    expect(documentScope(ADMIN_SCOPE)).toEqual({});
    expect(appointmentScope(ADMIN_SCOPE)).toEqual({});
    expect(paymentScope(ADMIN_SCOPE)).toEqual({});
  });

  it("EMPLOYEE scope embeds assignedEmployeeId — never a client-supplied id", () => {
    expect(studentScope(EMPLOYEE_SCOPE)).toEqual({ assignedEmployeeId: "emp-1" });
    expect(applicationScope(EMPLOYEE_SCOPE)).toEqual({ student: { assignedEmployeeId: "emp-1" } });
    expect(documentScope(EMPLOYEE_SCOPE)).toEqual({ student: { assignedEmployeeId: "emp-1" } });
    expect(leadScope(EMPLOYEE_SCOPE)).toEqual({ assignedEmployeeId: "emp-1" });
    expect(visaScope(EMPLOYEE_SCOPE)).toEqual({
      application: { student: { assignedEmployeeId: "emp-1" } },
    });
    expect(appointmentScope(EMPLOYEE_SCOPE)).toEqual({ student: { assignedEmployeeId: "emp-1" } });
    expect(paymentScope(EMPLOYEE_SCOPE)).toEqual({ student: { assignedEmployeeId: "emp-1" } });
  });

  it("taskScope uses the session userId (not employeeId) because tasks are assigned by user, not employee row", () => {
    // Task.assignedToId stores the user id (not the Employee row id), matching
    // the original SVMS schema. So the scope filter must use userId.
    expect(taskScope(EMPLOYEE_SCOPE)).toEqual({ assignedToId: "u-emp" });
    expect(taskScope(EMPLOYEE_SCOPE)).not.toHaveProperty("employeeId");
  });
});

// ─────────────────────────────────────────────
// KPIs — empty data
// ─────────────────────────────────────────────

describe("getDashboardKpis — empty database", () => {
  it("returns zeros for every metric when the database is empty", async () => {
    prismaMock.student.count.mockResolvedValue(0);
    prismaMock.application.count.mockResolvedValue(0);
    prismaMock.lead.count.mockResolvedValue(0);
    prismaMock.document.count.mockResolvedValue(0);
    prismaMock.visaApplication.count.mockResolvedValue(0);
    prismaMock.task.count.mockResolvedValue(0);
    prismaMock.appointment.count.mockResolvedValue(0);
    prismaMock.payment.count.mockResolvedValue(0);

    const kpis = await getDashboardKpis(EMPLOYEE_SCOPE, range, {
      students: true,
      leads: true,
      applications: true,
      documents: true,
      visa: true,
      tasks: true,
      appointments: true,
      payments: true,
    });

    expect(kpis).toEqual({
      myStudents: 0,
      activeApplications: 0,
      newLeads: 0,
      pendingDocuments: 0,
      visaApplications: 0,
      visaSubmitted: 0,
      visaApproved: 0,
      pendingTasks: 0,
      overdueTasks: 0,
      upcomingAppointments: 0,
      outstandingPayments: 0,
    });
  });
});

// ─────────────────────────────────────────────
// KPIs — large dataset
// ─────────────────────────────────────────────

describe("getDashboardKpis — populated database", () => {
  it("aggregates counts across all metric types", async () => {
    prismaMock.student.count.mockResolvedValue(42);
    prismaMock.application.count.mockResolvedValue(18);
    prismaMock.lead.count.mockResolvedValue(7);
    prismaMock.document.count.mockResolvedValue(12);
    prismaMock.visaApplication.count
      .mockResolvedValueOnce(9) // visaApplications total
      .mockResolvedValueOnce(4) // visaSubmitted (in-process)
      .mockResolvedValueOnce(3); // visaApproved
    prismaMock.task.count
      .mockResolvedValueOnce(15) // pendingTasks
      .mockResolvedValueOnce(3); // overdueTasks
    prismaMock.appointment.count.mockResolvedValue(6);
    prismaMock.payment.count.mockResolvedValue(2);

    const kpis = await getDashboardKpis(EMPLOYEE_SCOPE, range, {
      students: true,
      leads: true,
      applications: true,
      documents: true,
      visa: true,
      tasks: true,
      appointments: true,
      payments: true,
    });

    expect(kpis.myStudents).toBe(42);
    expect(kpis.activeApplications).toBe(18);
    expect(kpis.newLeads).toBe(7);
    expect(kpis.pendingDocuments).toBe(12);
    expect(kpis.visaApplications).toBe(9);
    expect(kpis.visaSubmitted).toBe(4);
    expect(kpis.visaApproved).toBe(3);
    expect(kpis.pendingTasks).toBe(15);
    expect(kpis.overdueTasks).toBe(3);
    expect(kpis.upcomingAppointments).toBe(6);
    expect(kpis.outstandingPayments).toBe(2);
  });
});

// ─────────────────────────────────────────────
// KPIs — permission-aware (zero counts when perm is false)
// ─────────────────────────────────────────────

describe("getDashboardKpis — permission gating", () => {
  it("returns 0 for every metric the caller lacks permission to see", async () => {
    // A role with NO permissions (e.g. STUDENT) → every metric is 0 and
    // prisma.count is never called.
    const kpis = await getDashboardKpis(EMPLOYEE_SCOPE, range, {});

    expect(kpis.myStudents).toBe(0);
    expect(kpis.activeApplications).toBe(0);
    expect(kpis.visaApproved).toBe(0);
    expect(prismaMock.student.count).not.toHaveBeenCalled();
    expect(prismaMock.application.count).not.toHaveBeenCalled();
    expect(prismaMock.visaApplication.count).not.toHaveBeenCalled();
  });

  it("only fires the queries for permissions the caller actually has", async () => {
    prismaMock.task.count.mockResolvedValue(5);
    prismaMock.appointment.count.mockResolvedValue(2);

    const kpis = await getDashboardKpis(EMPLOYEE_SCOPE, range, {
      tasks: true,
      appointments: true,
    });

    expect(kpis.pendingTasks).toBe(5);
    expect(kpis.upcomingAppointments).toBe(2);
    expect(kpis.myStudents).toBe(0); // students perm not granted
    expect(prismaMock.student.count).not.toHaveBeenCalled();
    expect(prismaMock.lead.count).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
// Pipeline — single groupBy, all 18 stages always present
// ─────────────────────────────────────────────

describe("getApplicationPipeline", () => {
  it("returns all 18 canonical stages even when the database has none", async () => {
    prismaMock.application.groupBy.mockResolvedValue([]);
    const pipeline = await getApplicationPipeline(EMPLOYEE_SCOPE);
    expect(pipeline).toHaveLength(APPLICATION_STAGES.length);
    expect(pipeline.every((b) => b.count === 0)).toBe(true);
    expect(pipeline[0].stage).toBe("LEAD");
    expect(pipeline[pipeline.length - 1].stage).toBe("COMPLETED");
  });

  it("merges the database counts with the canonical stage list", async () => {
    prismaMock.application.groupBy.mockResolvedValue([
      { stageKey: "LEAD", _count: { _all: 5 } },
      { stageKey: "VISA_SUBMITTED", _count: { _all: 3 } },
      { stageKey: "COMPLETED", _count: { _all: 2 } },
    ]);
    const pipeline = await getApplicationPipeline(EMPLOYEE_SCOPE);
    const byStage = new Map(pipeline.map((b) => [b.stage, b.count]));
    expect(byStage.get("LEAD")).toBe(5);
    expect(byStage.get("VISA_SUBMITTED")).toBe(3);
    expect(byStage.get("COMPLETED")).toBe(2);
    expect(byStage.get("COUNSELING")).toBe(0); // missing → 0
  });
});

// ─────────────────────────────────────────────
// Visa cases — grouped by stage
// ─────────────────────────────────────────────

describe("getVisaCases", () => {
  it("returns all 7 visa stages with counts", async () => {
    prismaMock.visaApplication.groupBy.mockResolvedValue([
      { stage: "APPROVED", _count: { _all: 4 } },
      { stage: "REFUSED", _count: { _all: 1 } },
    ]);
    const cases = await getVisaCases(EMPLOYEE_SCOPE);
    expect(cases).toHaveLength(VISA_STAGES.length);
    const byStage = new Map(cases.map((b) => [b.stage, b.count]));
    expect(byStage.get("APPROVED")).toBe(4);
    expect(byStage.get("REFUSED")).toBe(1);
    expect(byStage.get("PREPARATION")).toBe(0);
  });
});

// ─────────────────────────────────────────────
// Recent activity — merged across 6 entity kinds, sorted by date desc
// ─────────────────────────────────────────────

describe("getRecentActivity", () => {
  it("merges leads, applications, documents, tasks, payments, appointments and sorts by date desc", async () => {
    prismaMock.lead.findMany.mockResolvedValue([
      { id: "l1", name: "Lead A", status: "NEW", createdAt: new Date("2026-08-10T10:00:00Z") },
    ]);
    prismaMock.application.findMany.mockResolvedValue([
      { id: "a1", applicationNumber: "APP-1", stageKey: "VISA_SUBMITTED", updatedAt: new Date("2026-08-12T10:00:00Z"), student: { firstName: "Karim", lastName: "Ahmed" } },
    ]);
    prismaMock.document.findMany.mockResolvedValue([
      { id: "d1", name: "Passport", status: "APPROVED", updatedAt: new Date("2026-08-11T10:00:00Z"), student: { firstName: "Karim", lastName: "Ahmed" } },
    ]);
    prismaMock.task.findMany.mockResolvedValue([]);
    prismaMock.payment.findMany.mockResolvedValue([]);
    prismaMock.appointment.findMany.mockResolvedValue([]);

    const items = await getRecentActivity(EMPLOYEE_SCOPE, 8);
    expect(items).toHaveLength(3);
    // Most recent first — APP-1 on Aug 12
    expect(items[0].title).toContain("APP-1");
    expect(items[items.length - 1].title).toContain("Lead A");
  });

  it("returns an empty array when no activity exists", async () => {
    prismaMock.lead.findMany.mockResolvedValue([]);
    prismaMock.application.findMany.mockResolvedValue([]);
    prismaMock.document.findMany.mockResolvedValue([]);
    prismaMock.task.findMany.mockResolvedValue([]);
    prismaMock.payment.findMany.mockResolvedValue([]);
    prismaMock.appointment.findMany.mockResolvedValue([]);
    const items = await getRecentActivity(EMPLOYEE_SCOPE, 8);
    expect(items).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// Pending documents
// ─────────────────────────────────────────────

describe("getPendingDocuments", () => {
  it("queries for REQUESTED / UPLOADED / UNDER_REVIEW documents only", async () => {
    prismaMock.document.findMany.mockResolvedValue([]);
    await getPendingDocuments(EMPLOYEE_SCOPE);
    const call = prismaMock.document.findMany.mock.calls[0][0];
    expect(call.where.status).toEqual({ in: ["REQUESTED", "UPLOADED", "UNDER_REVIEW"] });
    // IDOR closure: scope filter present
    expect(call.where.student).toEqual({ assignedEmployeeId: "emp-1" });
  });
});

// ─────────────────────────────────────────────
// My tasks — grouped overdue / today / upcoming
// ─────────────────────────────────────────────

describe("getMyTasks", () => {
  it("groups tasks by dueDate relative to today", async () => {
    const now = new Date("2026-08-15T12:00:00Z");
    prismaMock.task.findMany.mockResolvedValue([
      { id: "t1", title: "Overdue task", dueDate: new Date("2026-08-10T10:00:00Z"), priority: "HIGH", status: "TODO", student: { firstName: "Karim", lastName: "Ahmed" } },
      { id: "t2", title: "Today task", dueDate: new Date("2026-08-15T15:00:00Z"), priority: "MEDIUM", status: "IN_PROGRESS", student: null },
      { id: "t3", title: "Upcoming task", dueDate: new Date("2026-08-20T10:00:00Z"), priority: "LOW", status: "TODO", student: { firstName: "Rina", lastName: "Ahmed" } },
    ]);

    const grouped = await getMyTasks(EMPLOYEE_SCOPE, now);
    expect(grouped.overdue).toHaveLength(1);
    expect(grouped.overdue[0].title).toBe("Overdue task");
    expect(grouped.today).toHaveLength(1);
    expect(grouped.today[0].title).toBe("Today task");
    expect(grouped.upcoming).toHaveLength(1);
    expect(grouped.upcoming[0].title).toBe("Upcoming task");
    expect(grouped.upcoming[0].studentName).toBe("Rina Ahmed");
  });
});

// ─────────────────────────────────────────────
// Upcoming appointments
// ─────────────────────────────────────────────

describe("getUpcomingAppointments", () => {
  it("queries appointments scheduledAt >= now with status SCHEDULED, ordered asc", async () => {
    prismaMock.appointment.findMany.mockResolvedValue([]);
    await getUpcomingAppointments(EMPLOYEE_SCOPE);
    const call = prismaMock.appointment.findMany.mock.calls[0][0];
    expect(call.where.status).toBe("SCHEDULED");
    expect(call.where.scheduledAt.gte).toBeInstanceOf(Date);
    expect(call.orderBy.scheduledAt).toBe("asc");
  });
});

// ─────────────────────────────────────────────
// Upcoming deadlines — merged across tasks / intakes / visa
// ─────────────────────────────────────────────

describe("getUpcomingDeadlines", () => {
  it("merges task dueDates, intake deadlines, and visa biometrics/interview dates", async () => {
    prismaMock.task.findMany.mockResolvedValue([
      { id: "t1", title: "Task A", dueDate: new Date("2026-08-20T10:00:00Z") },
    ]);
    prismaMock.intake.findMany.mockResolvedValue([
      { id: "i1", name: "Fall 2026", deadline: new Date("2026-08-25T10:00:00Z"), course: { name: "B.Sc. CS" } },
    ]);
    prismaMock.visaApplication.findMany.mockResolvedValue([
      { id: "v1", biometricsAt: new Date("2026-08-22T10:00:00Z"), interviewAt: null, application: { id: "a1", applicationNumber: "APP-1" } },
    ]);

    const deadlines = await getUpcomingDeadlines(EMPLOYEE_SCOPE, range, 8);
    expect(deadlines).toHaveLength(3);
    // Sorted by due date asc — task (20th) < biometrics (22nd) < intake (25th)
    expect(deadlines[0].kind).toBe("task");
    expect(deadlines[1].kind).toBe("visa");
    expect(deadlines[2].kind).toBe("intake");
  });
});

// ─────────────────────────────────────────────
// Aggregate dashboard — composes everything in parallel
// ─────────────────────────────────────────────

describe("getEmployeeDashboard — aggregate composition", () => {
  it("runs every widget query in parallel via Promise.all", async () => {
    prismaMock.student.count.mockResolvedValue(10);
    prismaMock.application.count.mockResolvedValue(5);
    prismaMock.lead.count.mockResolvedValue(3);
    prismaMock.document.count.mockResolvedValue(2);
    prismaMock.visaApplication.count.mockResolvedValue(1);
    prismaMock.task.count.mockResolvedValue(4);
    prismaMock.appointment.count.mockResolvedValue(2);
    prismaMock.payment.count.mockResolvedValue(1);
    prismaMock.application.groupBy.mockResolvedValue([]);
    prismaMock.visaApplication.groupBy.mockResolvedValue([]);
    prismaMock.document.findMany.mockResolvedValue([]);
    prismaMock.intake.findMany.mockResolvedValue([]);
    prismaMock.visaApplication.findMany.mockResolvedValue([]);
    prismaMock.task.findMany.mockResolvedValue([]);
    prismaMock.appointment.findMany.mockResolvedValue([]);
    prismaMock.lead.findMany.mockResolvedValue([]);

    const data = await getEmployeeDashboard(EMPLOYEE_SCOPE, range, {
      students: true,
      leads: true,
      applications: true,
      documents: true,
      visa: true,
      tasks: true,
      appointments: true,
      payments: true,
    });

    expect(data.range).toBe(range);
    expect(data.kpis.myStudents).toBe(10);
    expect(data.pipeline).toHaveLength(APPLICATION_STAGES.length);
    expect(data.visaCases).toHaveLength(VISA_STAGES.length);
    expect(Array.isArray(data.pendingDocuments)).toBe(true);
    expect(Array.isArray(data.upcomingDeadlines)).toBe(true);
    expect(Array.isArray(data.recentActivity)).toBe(true);
    expect(data.myTasks).toHaveProperty("overdue");
    expect(data.myTasks).toHaveProperty("today");
    expect(data.myTasks).toHaveProperty("upcoming");
  });

  it("skips visa cases, pending documents, my tasks, appointments when permissions are absent", async () => {
    prismaMock.student.count.mockResolvedValue(10);
    prismaMock.application.count.mockResolvedValue(5);
    prismaMock.lead.count.mockResolvedValue(3);
    prismaMock.application.groupBy.mockResolvedValue([]);
    prismaMock.intake.findMany.mockResolvedValue([]);
    prismaMock.lead.findMany.mockResolvedValue([]);

    const data = await getEmployeeDashboard(EMPLOYEE_SCOPE, range, {
      students: true,
      leads: true,
      applications: true,
      // visa, documents, tasks, appointments, payments all absent
    });

    expect(data.visaCases).toEqual([]);
    expect(data.pendingDocuments).toEqual([]);
    expect(data.myTasks).toEqual({ overdue: [], today: [], upcoming: [] });
    expect(data.upcomingAppointments).toEqual([]);
    expect(prismaMock.visaApplication.count).not.toHaveBeenCalled();
    // Recent activity always runs (no permission gate), so document.findMany
    // IS called there — but the dedicated getPendingDocuments should NOT run.
    expect(prismaMock.visaApplication.groupBy).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
// Error propagation — service lets exceptions bubble to handleApiError
// ─────────────────────────────────────────────

describe("error propagation", () => {
  it("does NOT swallow prisma errors — bubbles up to the route's handleApiError", async () => {
    prismaMock.student.count.mockRejectedValue(new Error("DB connection lost"));
    await expect(
      getDashboardKpis(EMPLOYEE_SCOPE, range, { students: true }),
    ).rejects.toThrow("DB connection lost");
  });

  it("getApplicationPipeline lets groupBy errors bubble", async () => {
    prismaMock.application.groupBy.mockRejectedValue(new Error("groupBy failed"));
    await expect(getApplicationPipeline(EMPLOYEE_SCOPE)).rejects.toThrow("groupBy failed");
  });
});
