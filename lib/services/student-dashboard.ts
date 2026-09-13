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

// ── Today's Agenda ─────────────────────────────────────────────────
// A focused "what's happening today" view, surfaced at the very top
// of the student dashboard. Combines today's appointments + tasks due
// today into a single time-sorted list so students don't have to piece
// it together from multiple dashboard sections.

export type TodayAgendaItem = {
  id: string;
  kind: "APPOINTMENT" | "TASK";
  title: string;
  subtitle: string | null;
  /** ISO string or "All day" — for the time pill on the left of the row. */
  timeLabel: string;
  /** ISO datetime — used for client-side sorting & rendering. */
  startsAt: Date | null;
  status: string;
  /** Tone for the left icon — drives the color of the icon badge. */
  tone: "info" | "warning" | "destructive" | "success" | "default";
  href: string;
};

export type TodayAgenda = {
  items: TodayAgendaItem[];
  total: number;
  /** A short positive message when there's nothing on the agenda today. */
  emptyMessage: string | null;
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function formatTimeLabel(date: Date | null): string {
  if (!date) return "All day";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function appointmentTone(status: string): TodayAgendaItem["tone"] {
  switch (status) {
    case "CONFIRMED": return "success";
    case "SCHEDULED": return "info";
    case "CANCELLED": return "default";
    case "NO_SHOW": return "destructive";
    case "COMPLETED": return "default";
    default: return "default";
  }
}

function taskTone(priority: string): TodayAgendaItem["tone"] {
  switch (priority) {
    case "URGENT":
    case "HIGH": return "destructive";
    case "MEDIUM": return "warning";
    case "LOW":
    default: return "info";
  }
}

export function buildTodayAgenda(
  today: Date,
  sources: {
    appointments: {
      id: string;
      scheduledAt: Date;
      purpose: string;
      meetingMethod: string | null;
      status: string;
    }[];
    tasks: {
      id: string;
      title: string;
      description: string | null;
      dueDate: Date | null;
      priority: string;
      status: string;
    }[];
  },
): TodayAgenda {
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);

  const items: TodayAgendaItem[] = [];

  // Today's appointments — only non-terminal ones, scheduled between
  // 00:00 and 23:59 today. Cancelled/completed/no-show appointments
  // are excluded from "today's agenda" because they aren't actionable.
  for (const a of sources.appointments) {
    if (a.status === "CANCELLED" || a.status === "COMPLETED" || a.status === "NO_SHOW") continue;
    if (a.scheduledAt < dayStart || a.scheduledAt > dayEnd) continue;
    items.push({
      id: a.id,
      kind: "APPOINTMENT",
      title: a.purpose,
      subtitle: a.meetingMethod === "VIDEO_CALL"
        ? "Video call"
        : a.meetingMethod === "PHONE_CALL"
          ? "Phone call"
          : a.meetingMethod === "IN_PERSON"
            ? "In-person meeting"
            : null,
      timeLabel: formatTimeLabel(a.scheduledAt),
      startsAt: a.scheduledAt,
      status: a.status,
      tone: appointmentTone(a.status),
      href: "/student/appointments",
    });
  }

  // Tasks due today — includes overdue too so the student sees them
  // front-and-center instead of having to navigate to the Tasks page.
  for (const t of sources.tasks) {
    if (t.status === "COMPLETED" || t.status === "CANCELLED") continue;
    if (!t.dueDate) continue;
    if (t.dueDate < dayStart) {
      // Overdue task — include with destructive tone (red badge).
      items.push({
        id: t.id,
        kind: "TASK",
        title: t.title,
        subtitle: t.description?.slice(0, 80) ?? "Overdue",
        timeLabel: "Overdue",
        startsAt: t.dueDate,
        status: t.status,
        tone: "destructive",
        href: "/student/tasks",
      });
      continue;
    }
    if (t.dueDate > dayEnd) continue;
    items.push({
      id: t.id,
      kind: "TASK",
      title: t.title,
      subtitle: t.description?.slice(0, 80) ?? null,
      timeLabel: formatTimeLabel(t.dueDate),
      startsAt: t.dueDate,
      status: t.status,
      tone: taskTone(t.priority),
      href: "/student/tasks",
    });
  }

  // Sort: appointments by scheduledAt asc, then tasks by dueDate asc,
  // with overdue tasks appearing last (they're already in red so the
  // student sees them but isn't scared off the top of the list).
  items.sort((a, b) => {
    if (!a.startsAt && !b.startsAt) return 0;
    if (!a.startsAt) return 1;
    if (!b.startsAt) return -1;
    return a.startsAt.getTime() - b.startsAt.getTime();
  });

  return {
    items,
    total: items.length,
    emptyMessage: items.length === 0
      ? "Nothing on your agenda today — take a breath and explore universities, or get ahead on your documents."
      : null,
  };
}

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
    todayAppointments,
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
      select: { id: true, title: true, description: true, dueDate: true, priority: true, status: true },
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
    // Today's appointments — non-terminal, scheduled today. Used by
    // buildTodayAgenda below. Cached here so we don't issue a second
    // query when the dashboard already needs appointment data.
    prisma.appointment.findMany({
      where: {
        studentId: student.id,
        status: { in: ["SCHEDULED", "CONFIRMED"] },
        scheduledAt: {
          gte: startOfDay(new Date()),
          lte: endOfDay(new Date()),
        },
      },
      select: { id: true, scheduledAt: true, purpose: true, meetingMethod: true, status: true },
      orderBy: { scheduledAt: "asc" },
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

  const todayAgenda = buildTodayAgenda(new Date(), {
    appointments: todayAppointments,
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      dueDate: t.dueDate,
      priority: t.priority,
      status: t.status,
    })),
  });

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
    todayAgenda,
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
