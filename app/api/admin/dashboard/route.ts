import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { resolveRange } from "@/lib/utils/dashboard-range";

/** Aggregated KPIs + chart series for the admin dashboard. Real data only. */
export async function GET(req: NextRequest) {
  try {
    const g = await guard("dashboard.read");
    if (g.error) return g.error;

    const sp = req.nextUrl.searchParams;
    const { from, label: rangeLabel } = resolveRange({
      range: sp.get("range"),
      from: sp.get("from"),
      to: sp.get("to"),
    });

    const since = (field: string) => ({ [field]: { gte: from } });

    const [
      totalStudents,
      activeStudents,
      newLeads,
      activeApplications,
      visaSubmitted,
      visaApproved,
      visaRefused,
      pendingDocuments,
      outstanding,
      monthlyRevenue,
      byCountryRaw,
      byStageRaw,
      byIntakeRaw,
      countries,
      intakes,
      recentApplications,
      recentPayments,
      recentActivities,
      todayTasks,
      overdueTasks,
      upcomingDeadlines,
      newStudentsByMonth,
      revenueByMonth,
    ] = await Promise.all([
      prisma.student.count({ where: { deletedAt: null } }),
      prisma.student.count({ where: { deletedAt: null, status: "ACTIVE" } }),
      prisma.lead.count({ where: { deletedAt: null, status: "NEW", ...since("createdAt") } }),
      prisma.application.count({ where: { deletedAt: null, status: "ACTIVE" } }),
      prisma.application.count({ where: { deletedAt: null, stageKey: { in: ["VISA_SUBMITTED", "BIOMETRICS", "INTERVIEW"] } } }),
      prisma.application.count({ where: { deletedAt: null, stageKey: "COMPLETED" } }),
      prisma.application.count({ where: { deletedAt: null, status: "CANCELLED", stageKey: "VISA_DECISION" } }),
      prisma.document.count({ where: { deletedAt: null, status: { in: ["REQUESTED", "UPLOADED", "UNDER_REVIEW"] } } }),
      prisma.invoice.aggregate({ where: { deletedAt: null, status: { in: ["ISSUED", "PARTIAL", "OVERDUE"] } }, _sum: { dueAmount: true } }),
      prisma.payment.aggregate({ where: { deletedAt: null, status: "PAID", ...since("paymentDate") }, _sum: { amount: true } }),
      prisma.application.groupBy({ by: ["countryId"], where: { deletedAt: null }, _count: { _all: true } }),
      prisma.application.groupBy({ by: ["stageKey"], where: { deletedAt: null }, _count: { _all: true } }),
      prisma.application.groupBy({ by: ["intakeId"], where: { deletedAt: null, intakeId: { not: null } }, _count: { _all: true } }),
      prisma.country.findMany(),
      prisma.intake.findMany({ include: { course: true } }),
      prisma.application.findMany({
        where: { deletedAt: null },
        include: { student: true, country: true },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.payment.findMany({
        where: { deletedAt: null },
        include: { student: true },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
      prisma.task.count({
        where: { status: { in: ["TODO", "IN_PROGRESS"] }, dueDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)), lt: new Date(new Date().setHours(23, 59, 59, 999)) } },
      }),
      prisma.task.count({ where: { status: { in: ["TODO", "IN_PROGRESS"] }, dueDate: { lt: new Date() } } }),
      prisma.task.findMany({
        where: { status: { in: ["TODO", "IN_PROGRESS"] }, dueDate: { gte: new Date() } },
        include: { student: true },
        orderBy: { dueDate: "asc" },
        take: 6,
      }),
      prisma.student.findMany({
        where: { deletedAt: null, createdAt: { gte: new Date(Date.now() - 365 * 86400_000) } },
        select: { createdAt: true },
      }),
      prisma.payment.findMany({
        where: { deletedAt: null, status: "PAID", paymentDate: { gte: new Date(Date.now() - 365 * 86400_000) } },
        select: { amount: true, paymentDate: true },
      }),
    ]);

    const countryName = (id: string) => countries.find((c) => c.id === id)?.name ?? "Other";
    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    const monthlyMap = new Map<string, { registrations: number; revenue: number }>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      monthlyMap.set(monthKey(d), { registrations: 0, revenue: 0 });
    }
    for (const s of newStudentsByMonth) {
      const k = monthKey(s.createdAt);
      if (monthlyMap.has(k)) monthlyMap.get(k)!.registrations++;
    }
    for (const p of revenueByMonth) {
      const k = monthKey(p.paymentDate ?? new Date(0));
      if (monthlyMap.has(k)) monthlyMap.get(k)!.revenue += p.amount;
    }

    // Employee performance: active + completed cases per counselor
    const [empPerfRaw, employees] = await Promise.all([
      prisma.application.groupBy({
        by: ["employeeId"],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      prisma.employee.findMany({ where: { deletedAt: null }, include: { user: true } }),
    ]);
    const employeePerformance = employees
      .map((e) => {
        const row = empPerfRaw.find((r) => r.employeeId === e.id);
        return { name: e.user.name, cases: row?._count._all ?? 0 };
      })
      .sort((a, b) => b.cases - a.cases)
      .slice(0, 10);

    const intakeName = (id: string | null) => {
      const i = intakes.find((x) => x.id === id);
      return i ? `${i.name} (${i.course.name.slice(0, 24)})` : "Unknown";
    };

    return ok({
      range: rangeLabel,
      kpis: {
        totalStudents,
        activeStudents,
        newLeads,
        activeApplications,
        visaSubmitted,
        visaApproved,
        visaRefused,
        pendingDocuments,
        outstandingPayments: outstanding._sum.dueAmount ?? 0,
        monthlyRevenue: monthlyRevenue._sum.amount ?? 0,
      },
      charts: {
        byCountry: byCountryRaw.map((r) => ({ name: countryName(r.countryId), value: r._count._all })),
        byStage: byStageRaw.map((r) => ({ name: r.stageKey.replace(/_/g, " "), value: r._count._all })),
        byIntake: byIntakeRaw
          .map((r) => ({ name: intakeName(r.intakeId), value: r._count._all }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10),
        monthly: Array.from(monthlyMap.entries()).map(([month, v]) => ({
          name: month.slice(5),
          registrations: v.registrations,
          revenue: v.revenue,
        })),
        employeePerformance,
      },
      widgets: {
        todayTasks,
        overdueTasks,
        pendingDocuments,
        upcomingDeadlines,
        recentApplications: recentApplications.map((a) => ({
          id: a.id,
          number: a.applicationNumber,
          student: `${a.student.firstName} ${a.student.lastName}`,
          country: a.country.name,
          stage: a.stageKey,
          createdAt: a.createdAt,
        })),
        recentPayments: recentPayments.map((p) => ({
          id: p.id,
          student: `${p.student.firstName} ${p.student.lastName}`,
          amount: p.amount,
          currency: p.currency,
          method: p.paymentMethod,
          date: p.paymentDate ?? p.createdAt,
        })),
        recentActivities: recentActivities.map((a) => ({
          id: a.id,
          action: a.action,
          entity: a.entity,
          createdAt: a.createdAt,
        })),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
