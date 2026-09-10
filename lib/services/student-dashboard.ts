import { prisma } from "@/lib/db";
import type { StudentProfile } from "@/lib/student/guard";

/**
 * Student dashboard service — one optimized aggregate per concern, no N+1.
 * Every query is scoped by the authenticated student's own id, resolved
 * server-side from the session (see lib/student/guard.ts).
 */

export const DOC_STATUSES = ["REQUESTED", "UPLOADED", "UNDER_REVIEW", "APPROVED", "REJECTED", "EXPIRED"] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

/** Progress = position of the current stage among enabled stages. */
export function computeProgress(stageKey: string | undefined, stages: { key: string; enabled: boolean }[]): number {
  if (!stageKey) return 0;
  const enabled = stages.filter((s) => s.enabled);
  const idx = enabled.findIndex((s) => s.key === stageKey);
  if (idx < 0 || enabled.length === 0) return 0;
  return Math.round(((idx + 1) / enabled.length) * 100);
}

export type DocumentSummary = {
  required: number;
  approved: number;
  underReview: number;
  rejected: number;
  pending: number;
};

export function documentSummaryFromCounts(
  rows: { status: string; _count: { _all: number } }[]
): DocumentSummary {
  const by = new Map(rows.map((r) => [r.status, r._count._all]));
  const get = (s: string) => by.get(s) ?? 0;
  const requested = get("REQUESTED");
  const uploaded = get("UPLOADED");
  const underReview = get("UNDER_REVIEW");
  const approved = get("APPROVED");
  const rejected = get("REJECTED");
  const expired = get("EXPIRED");
  return {
    required: requested + uploaded + underReview + approved + rejected + expired,
    approved,
    underReview: underReview + uploaded,
    rejected: rejected + expired,
    pending: requested,
  };
}

export type PaymentSummary = {
  totalAmount: number;
  paid: number;
  remaining: number;
  nextPayment: { invoiceNumber: string; amount: number; dueDate: Date | null } | null;
};

/** Financial totals are always computed server-side from invoice records. */
export function paymentSummaryFromInvoices(
  invoices: { invoiceNumber: string; total: number; paidAmount: number; dueAmount: number; dueDate: Date | null; status: string }[]
): PaymentSummary {
  const live = invoices.filter((i) => i.status !== "CANCELLED" && i.status !== "DRAFT");
  const totalAmount = live.reduce((s, i) => s + i.total, 0);
  const paid = live.reduce((s, i) => s + i.paidAmount, 0);
  const remaining = live.reduce((s, i) => s + i.dueAmount, 0);
  const open = live
    .filter((i) => i.dueAmount > 0)
    .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity));
  return {
    totalAmount,
    paid,
    remaining,
    nextPayment: open[0]
      ? { invoiceNumber: open[0].invoiceNumber, amount: open[0].dueAmount, dueDate: open[0].dueDate }
      : null,
  };
}

export type DeadlineItem = {
  kind: "TASK" | "PAYMENT" | "DOCUMENT";
  title: string;
  dueDate: Date;
  overdue: boolean;
  href: string;
};

/** Merges + sorts deadlines by proximity; anything past due is flagged overdue. */
export function collectDeadlines(
  now: Date,
  sources: {
    tasks: { title: string; dueDate: Date | null; status: string }[];
    invoices: { invoiceNumber: string; dueAmount: number; dueDate: Date | null; status: string }[];
    documents: { name: string; expiresAt: Date | null; status: string }[];
  }
): DeadlineItem[] {
  const items: DeadlineItem[] = [];
  for (const t of sources.tasks) {
    if (!t.dueDate || t.status === "COMPLETED" || t.status === "CANCELLED") continue;
    items.push({ kind: "TASK", title: t.title, dueDate: t.dueDate, overdue: t.dueDate < now, href: "/student/tasks" });
  }
  for (const i of sources.invoices) {
    if (!i.dueDate || i.dueAmount <= 0 || i.status === "CANCELLED" || i.status === "PAID") continue;
    items.push({
      kind: "PAYMENT",
      title: `Payment due — ${i.invoiceNumber}`,
      dueDate: i.dueDate,
      overdue: i.dueDate < now,
      href: "/student/payments",
    });
  }
  for (const d of sources.documents) {
    if (!d.expiresAt || d.status === "APPROVED" || d.status === "REJECTED") continue;
    items.push({
      kind: "DOCUMENT",
      title: `Document expiring — ${d.name}`,
      dueDate: d.expiresAt,
      overdue: d.expiresAt < now,
      href: "/student/documents",
    });
  }
  return items.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

export type NextAction = {
  title: string;
  reason: string;
  deadline: Date | null;
  priority: "HIGH" | "MEDIUM" | "LOW";
  ctaLabel: string;
  ctaHref: string;
};

/**
 * Derives the single most important next action from real state, in priority
 * order: overdue/pending documents → open tasks → unpaid invoices → default
 * application follow-up.
 */
export function deriveNextAction(input: {
  pendingDocs: { name: string; createdAt: Date }[];
  openTasks: { title: string; dueDate: Date | null; priority: string }[];
  openInvoices: { invoiceNumber: string; dueAmount: number; dueDate: Date | null }[];
  application?: { stageKey: string } | null;
}): NextAction {
  if (input.pendingDocs.length > 0) {
    const doc = input.pendingDocs[0];
    return {
      title: `Upload: ${doc.name}`,
      reason: "Requested by your counselor — required before the next stage.",
      deadline: null,
      priority: "HIGH",
      ctaLabel: "Upload Document",
      ctaHref: "/student/documents",
    };
  }
  if (input.openTasks.length > 0) {
    const task = [...input.openTasks].sort(
      (a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity)
    )[0];
    const priority = task.priority === "URGENT" || task.priority === "HIGH" ? "HIGH" : task.priority === "LOW" ? "LOW" : "MEDIUM";
    return {
      title: task.title,
      reason: "Assigned by your counselor.",
      deadline: task.dueDate,
      priority,
      ctaLabel: "View Task",
      ctaHref: "/student/tasks",
    };
  }
  if (input.openInvoices.length > 0) {
    const inv = [...input.openInvoices].sort(
      (a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity)
    )[0];
    return {
      title: `Pay ${inv.invoiceNumber}`,
      reason: "Payment required to continue processing.",
      deadline: inv.dueDate,
      priority: inv.dueDate && inv.dueDate < new Date() ? "HIGH" : "MEDIUM",
      ctaLabel: "Make Payment",
      ctaHref: "/student/payments",
    };
  }
  if (input.application) {
    return {
      title: "Continue your application",
      reason: "Your counselor is moving your application forward — check the current stage.",
      deadline: null,
      priority: "LOW",
      ctaLabel: "View Application",
      ctaHref: "/student/applications",
    };
  }
  return {
    title: "Explore universities",
    reason: "No application yet — shortlist universities to get started.",
    deadline: null,
    priority: "LOW",
    ctaLabel: "Browse Universities",
    ctaHref: "/student/universities",
  };
}

export type ActivityItem = { title: string; detail: string; createdAt: Date };

/** Student-visible activity only — never internal admin/employee events. */
export function buildRecentActivity(input: {
  stageHistory: { toStage: string; createdAt: Date; note: string | null }[];
  documents: { name: string; status: string; reviewedAt: Date | null; uploadedAt: Date | null }[];
  payments: { amount: number; paymentDate: Date | null; createdAt: Date }[];
  messages: { body: string; createdAt: Date }[];
}): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const h of input.stageHistory.slice(0, 3)) {
    items.push({
      title: "Application stage changed",
      detail: (h.toStage ?? "").replace(/_/g, " ").toLowerCase(),
      createdAt: h.createdAt,
    });
  }
  for (const d of input.documents.slice(0, 4)) {
    if (d.status === "APPROVED" && d.reviewedAt) {
      items.push({ title: "Document approved", detail: d.name, createdAt: d.reviewedAt });
    } else if (d.status === "REJECTED" && d.reviewedAt) {
      items.push({ title: "Document rejected", detail: d.name, createdAt: d.reviewedAt });
    } else if (d.uploadedAt) {
      items.push({ title: "Document uploaded", detail: d.name, createdAt: d.uploadedAt });
    }
  }
  for (const p of input.payments.slice(0, 3)) {
    items.push({
      title: "Payment recorded",
      detail: `${p.amount.toLocaleString()}`,
      createdAt: p.paymentDate ?? p.createdAt,
    });
  }
  for (const m of input.messages.slice(0, 3)) {
    items.push({ title: "Message received", detail: m.body.slice(0, 60), createdAt: m.createdAt });
  }
  return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5);
}

/** The full dashboard aggregate. `student` must come from the session guard. */
export async function getStudentDashboard(student: StudentProfile, userId: string) {
  const [
    applications,
    stages,
    docCounts,
    pendingDocs,
    expiringDocs,
    tasks,
    invoices,
    payments,
    counselorRaw,
    notifications,
    stageHistory,
    recentDocs,
    recentMessages,
  ] = await Promise.all([
    prisma.application.findMany({
      where: { studentId: student.id, deletedAt: null },
      include: {
        country: true,
        university: true,
        course: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.applicationStage.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" }, select: { key: true, name: true, enabled: true } }),
    prisma.document.groupBy({ by: ["status"], where: { studentId: student.id, deletedAt: null }, _count: { _all: true } }),
    prisma.document.findMany({
      where: { studentId: student.id, deletedAt: null, status: { in: ["REQUESTED", "REJECTED"] } },
      orderBy: { createdAt: "asc" },
      select: { name: true, createdAt: true, expiresAt: true, status: true },
    }),
    prisma.document.findMany({
      where: { studentId: student.id, deletedAt: null, expiresAt: { not: null }, status: { in: ["REQUESTED", "UPLOADED", "UNDER_REVIEW"] } },
      select: { name: true, expiresAt: true, status: true },
    }),
    prisma.task.findMany({
      where: { studentId: student.id, deletedAt: null, status: { in: ["TODO", "IN_PROGRESS"] } },
      select: { title: true, dueDate: true, priority: true, status: true },
    }),
    prisma.invoice.findMany({
      where: { studentId: student.id, deletedAt: null },
      select: { invoiceNumber: true, total: true, paidAmount: true, dueAmount: true, dueDate: true, status: true },
    }),
    prisma.payment.findMany({
      where: { studentId: student.id, deletedAt: null, status: "PAID" },
      select: { amount: true, paymentDate: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    student.assignedEmployeeId
      ? prisma.employee.findFirst({
          where: { id: student.assignedEmployeeId, deletedAt: null },
          include: { user: { select: { name: true, email: true } } },
        })
      : Promise.resolve(null),
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.applicationStatusHistory.findMany({
      where: { application: { studentId: student.id } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { toStage: true, createdAt: true, note: true },
    }),
    prisma.document.findMany({
      where: { studentId: student.id, deletedAt: null },
      select: { name: true, status: true, reviewedAt: true, uploadedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 4,
    }),
    prisma.message.findMany({
      where: { conversation: { studentId: student.id }, senderId: { not: userId } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { body: true, createdAt: true },
    }),
  ]);

  const mainApp = applications[0] ?? null;
  const progress = computeProgress(mainApp?.stageKey, stages);

  const openInvoices = invoices.filter((i) => i.dueAmount > 0 && i.status !== "CANCELLED");
  const nextAction = deriveNextAction({
    pendingDocs: pendingDocs.map((d) => ({ name: d.name, createdAt: d.createdAt })),
    openTasks: tasks,
    openInvoices: openInvoices.map((i) => ({ invoiceNumber: i.invoiceNumber, dueAmount: i.dueAmount, dueDate: i.dueDate })),
    application: mainApp ? { stageKey: mainApp.stageKey } : null,
  });

  const deadlines = collectDeadlines(new Date(), {
    tasks,
    invoices: invoices.map((i) => ({ invoiceNumber: i.invoiceNumber, dueAmount: i.dueAmount, dueDate: i.dueDate, status: i.status })),
    documents: expiringDocs,
  }).slice(0, 5);

  return {
    student: {
      firstName: student.firstName,
      lastName: student.lastName,
      studentId: student.studentId,
    },
    application: mainApp
      ? {
          id: mainApp.id,
          number: mainApp.applicationNumber,
          country: mainApp.country.name,
          university: mainApp.university?.name ?? null,
          course: mainApp.course?.name ?? null,
          stageKey: mainApp.stageKey,
          status: mainApp.status,
          lastUpdated: mainApp.updatedAt,
          otherApplicationsCount: applications.length - 1,
        }
      : null,
    stages: stages.map((s) => ({ key: s.key, name: s.name })),
    progress,
    nextAction,
    documents: documentSummaryFromCounts(docCounts),
    deadlines,
    payments: paymentSummaryFromInvoices(invoices),
    counselor: counselorRaw
      ? {
          name: counselorRaw.user.name,
          designation: counselorRaw.title,
          email: counselorRaw.user.email, // business contact address, safe to share
        }
      : null,
    activities: buildRecentActivity({
      stageHistory,
      documents: recentDocs,
      payments,
      messages: recentMessages,
    }),
    notifications: notifications.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      link: n.link,
      readAt: n.readAt,
      createdAt: n.createdAt,
    })),
  };
}

export type StudentDashboardData = Awaited<ReturnType<typeof getStudentDashboard>>;
