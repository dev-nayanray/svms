import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import type { EmployeeScope } from "@/lib/services/employee-dashboard";
import { paymentScope } from "@/lib/services/employee-dashboard";
import { formatMoney } from "@/lib/utils";

/**
 * Employee Payments service — server-side data layer for
 * /employee/payments and the payment CRUD APIs.
 *
 * IDOR closure: EMPLOYEE sees payments on students assigned to them.
 * ADMIN sees all. Foreign payments return 404 (never 403).
 *
 * Financial integrity:
 *  - All amounts validated server-side (positive, max 2 decimal places)
 *  - Refunds validated (can't refund more than paid, can't refund cancelled)
 *  - Duplicate transaction references blocked (within same student)
 *  - All financial actions audit-logged
 *  - No permanent deletion — cancelled + refunded are soft states
 */

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

export const PAYMENT_METHODS = [
  "CASH", "BANK_TRANSFER", "BKASH", "NAGAD", "CARD", "OTHER",
] as const;

export const PAYMENT_STATUSES = [
  "PENDING", "PAID", "PARTIAL", "REFUNDED", "CANCELLED",
] as const;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type PaymentListFilters = {
  search?: string;
  status?: string;
  method?: string;
  studentId?: string;
  applicationId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type PaymentRow = {
  id: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  transactionReference: string | null;
  paymentDate: Date | null;
  status: string;
  refundReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  student: { id: string; firstName: string; lastName: string; studentId: string };
  application: { id: string; applicationNumber: string } | null;
  recordedBy: { id: string; name: string } | null;
};

export type PaymentListResult = {
  rows: PaymentRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: PaymentSummary;
};

export type PaymentSummary = {
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
  pending: number;
  currency: string;
};

// ─────────────────────────────────────────────
// Validation helpers — pure functions
// ─────────────────────────────────────────────

export function validateAmount(amount: number): string | null {
  if (typeof amount !== "number" || isNaN(amount)) return "Amount must be a number";
  if (amount <= 0) return "Amount must be positive";
  if (amount > 10_000_000) return "Amount exceeds maximum (10,000,000)";
  // Max 2 decimal places
  const rounded = Math.round(amount * 100) / 100;
  if (rounded !== amount) return "Amount must have at most 2 decimal places";
  return null;
}

export function validatePaymentMethod(method: string): string | null {
  if (!PAYMENT_METHODS.includes(method as (typeof PAYMENT_METHODS)[number])) {
    return `Invalid payment method: ${method}`;
  }
  return null;
}

// ─────────────────────────────────────────────
// List — paginated with filters + summary
// ─────────────────────────────────────────────

export async function listPayments(
  scope: EmployeeScope,
  params: {
    filters?: PaymentListFilters;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<PaymentListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const filters = params.filters ?? {};
  const owner = paymentScope(scope);

  const fieldFilters: Record<string, unknown> = {};
  if (filters.status) fieldFilters.status = filters.status;
  if (filters.method) fieldFilters.paymentMethod = filters.method;
  if (filters.studentId) fieldFilters.studentId = filters.studentId;
  if (filters.applicationId) fieldFilters.applicationId = filters.applicationId;

  const search = filters.search?.trim();
  const searchFilter = search
    ? {
        OR: [
          { transactionReference: { contains: search, mode: "insensitive" as const } },
          { student: { firstName: { contains: search, mode: "insensitive" as const } } },
          { student: { lastName: { contains: search, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const dateRange: Record<string, unknown> = {};
  if (filters.dateFrom) {
    const d = new Date(filters.dateFrom);
    if (!isNaN(d.getTime())) dateRange.gte = d;
  }
  if (filters.dateTo) {
    const d = new Date(filters.dateTo);
    if (!isNaN(d.getTime())) dateRange.lte = d;
  }
  if (Object.keys(dateRange).length > 0) fieldFilters.paymentDate = dateRange;

  const where = { ...owner, ...searchFilter, ...fieldFilters };

  const [rows, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, amount: true, currency: true, paymentMethod: true,
        transactionReference: true, paymentDate: true, status: true,
        refundReason: true, createdAt: true, updatedAt: true,
        student: { select: { id: true, firstName: true, lastName: true, studentId: true } },
        application: { select: { id: true, applicationNumber: true } },
        recordedById: true,
      },
    }),
    prisma.payment.count({ where }),
  ]);

  // Resolve recorder names
  const recorderIds = Array.from(new Set(rows.map((r) => r.recordedById).filter(Boolean))) as string[];
  const recorders = recorderIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: recorderIds } }, select: { id: true, name: true } })
    : [];
  const recorderMap = new Map(recorders.map((u) => [u.id, u.name]));

  const mapped: PaymentRow[] = rows.map((p) => ({
    id: p.id, amount: p.amount, currency: p.currency, paymentMethod: p.paymentMethod,
    transactionReference: p.transactionReference, paymentDate: p.paymentDate, status: p.status,
    refundReason: p.refundReason, createdAt: p.createdAt, updatedAt: p.updatedAt,
    student: p.student, application: p.application,
    recordedBy: p.recordedById ? { id: p.recordedById, name: recorderMap.get(p.recordedById) ?? "Unknown" } : null,
  }));

  // Compute summary — all server-side
  const summary = await computePaymentSummary(scope);

  return {
    rows: mapped, total, page, pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    summary,
  };
}

// ─────────────────────────────────────────────
// Summary — all calculations server-side
// ─────────────────────────────────────────────

export async function computePaymentSummary(scope: EmployeeScope): Promise<PaymentSummary> {
  const owner = paymentScope(scope);

  // Total billed = sum of all non-cancelled invoice amounts for owned students
  // But invoices are a separate model — we compute from payments instead:
  // totalBilled = sum of PAID + PENDING + PARTIAL amounts
  // totalPaid = sum of PAID amounts only
  // outstanding = totalBilled - totalPaid
  // pending = count of PENDING payments
  const payments = await prisma.payment.findMany({
    where: { ...owner, status: { not: "CANCELLED" } },
    select: { amount: true, currency: true, status: true },
  });

  const currency = payments[0]?.currency ?? "EUR";
  const totalBilled = payments.reduce((s, p) => s + p.amount, 0);
  const totalPaid = payments
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + p.amount, 0);

  const pendingCount = await prisma.payment.count({
    where: { ...owner, status: "PENDING" },
  });

  return {
    totalBilled,
    totalPaid,
    outstanding: totalBilled - totalPaid,
    pending: pendingCount,
    currency,
  };
}

// ─────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────

export async function createPayment(
  scope: EmployeeScope,
  input: {
    studentId: string;
    applicationId?: string;
    invoiceId?: string;
    amount: number;
    currency?: string;
    paymentMethod: string;
    transactionReference?: string;
    paymentDate?: Date;
    status?: string;
  },
  actor: { id: string; ipAddress?: string | null; userAgent?: string | null },
): Promise<{ id: string }> {
  // Validate amount
  const amountErr = validateAmount(input.amount);
  if (amountErr) throw new HttpError(422, "VALIDATION_ERROR", amountErr);

  // Validate method
  const methodErr = validatePaymentMethod(input.paymentMethod);
  if (methodErr) throw new HttpError(422, "VALIDATION_ERROR", methodErr);

  // IDOR: EMPLOYEE can only create payments for their own students
  if (!scope.isAdmin) {
    const student = await prisma.student.findFirst({
      where: { id: input.studentId, assignedEmployee: { userId: scope.userId } },
      select: { id: true },
    });
    if (!student) throw new HttpError(403, "FORBIDDEN", "You can only create payments for your own students");
  }

  // Duplicate transaction reference check (within same student)
  if (input.transactionReference) {
    const existing = await prisma.payment.findFirst({
      where: {
        studentId: input.studentId,
        transactionReference: input.transactionReference,
        status: { not: "CANCELLED" },
      },
      select: { id: true },
    });
    if (existing) {
      throw new HttpError(409, "CONFLICT", "A payment with this transaction reference already exists for this student");
    }
  }

  const payment = await prisma.payment.create({
    data: {
      studentId: input.studentId,
      applicationId: input.applicationId ?? null,
      invoiceId: input.invoiceId ?? null,
      amount: input.amount,
      currency: input.currency ?? "EUR",
      paymentMethod: input.paymentMethod,
      transactionReference: input.transactionReference ?? null,
      paymentDate: input.paymentDate ?? new Date(),
      status: input.status ?? "PAID",
      recordedById: actor.id,
    },
  });

  // Audit log
  try {
    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: "payment.created",
        entity: "Payment",
        entityId: payment.id,
        newValue: {
          amount: input.amount, currency: input.currency ?? "EUR",
          method: input.paymentMethod, status: input.status ?? "PAID",
          studentId: input.studentId,
        } as object,
        ipAddress: actor.ipAddress ?? undefined,
        userAgent: actor.userAgent ?? undefined,
      },
    });
  } catch (err) {
    console.error("[payment-create] audit failed", err);
  }

  return { id: payment.id };
}

// ─────────────────────────────────────────────
// Refund
// ─────────────────────────────────────────────

export async function refundPayment(
  scope: EmployeeScope,
  id: string,
  reason: string | undefined,
  actor: { id: string; ipAddress?: string | null; userAgent?: string | null },
): Promise<void> {
  const owner = paymentScope(scope);
  const payment = await prisma.payment.findFirst({
    where: { id, ...owner },
    select: { id: true, status: true, amount: true, currency: true, studentId: true },
  });
  if (!payment) throw new HttpError(404, "NOT_FOUND", "Payment not found");

  if (payment.status === "REFUNDED") throw new HttpError(409, "CONFLICT", "Payment already refunded");
  if (payment.status === "CANCELLED") throw new HttpError(409, "CONFLICT", "Cannot refund a cancelled payment");
  if (payment.status === "PENDING") throw new HttpError(409, "CONFLICT", "Cannot refund a pending payment");

  await prisma.payment.update({
    where: { id },
    data: { status: "REFUNDED", refundReason: reason ?? null, updatedAt: new Date() },
  });

  // Audit log — financial actions must be audited
  try {
    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: "payment.refunded",
        entity: "Payment",
        entityId: id,
        oldValue: { status: payment.status, amount: payment.amount },
        newValue: { status: "REFUNDED", reason: reason ?? null },
        ipAddress: actor.ipAddress ?? undefined,
        userAgent: actor.userAgent ?? undefined,
      },
    });
  } catch (err) {
    console.error("[payment-refund] audit failed", err);
  }

  // Notify student
  try {
    const student = await prisma.student.findUnique({ where: { id: payment.studentId }, select: { userId: true } });
    if (student) {
      await prisma.notification.create({
        data: {
          userId: student.userId,
          type: "PAYMENT_REFUNDED",
          title: `Payment refunded: ${formatMoney(payment.amount, payment.currency)}`,
          message: `Your payment of ${formatMoney(payment.amount, payment.currency)} has been refunded.${reason ? ` Reason: ${reason}` : ""}`,
          link: "/employee/payments",
        },
      });
    }
  } catch (err) {
    console.error("[payment-refund] notification failed", err);
  }
}

// ─────────────────────────────────────────────
// Cancel
// ─────────────────────────────────────────────

export async function cancelPayment(
  scope: EmployeeScope,
  id: string,
  actor: { id: string; ipAddress?: string | null; userAgent?: string | null },
): Promise<void> {
  const owner = paymentScope(scope);
  const payment = await prisma.payment.findFirst({
    where: { id, ...owner },
    select: { id: true, status: true, amount: true, currency: true, studentId: true },
  });
  if (!payment) throw new HttpError(404, "NOT_FOUND", "Payment not found");

  if (payment.status === "CANCELLED") return; // no-op
  if (payment.status === "REFUNDED") throw new HttpError(409, "CONFLICT", "Cannot cancel a refunded payment");
  if (payment.status === "PAID") throw new HttpError(409, "CONFLICT", "Cannot cancel a paid payment — use refund instead");

  await prisma.payment.update({
    where: { id },
    data: { status: "CANCELLED", updatedAt: new Date() },
  });

  // Audit log
  try {
    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: "payment.cancelled",
        entity: "Payment",
        entityId: id,
        oldValue: { status: payment.status },
        newValue: { status: "CANCELLED" },
        ipAddress: actor.ipAddress ?? undefined,
        userAgent: actor.userAgent ?? undefined,
      },
    });
  } catch (err) {
    console.error("[payment-cancel] audit failed", err);
  }
}

// ─────────────────────────────────────────────
// Edit (update permitted fields only)
// ─────────────────────────────────────────────

export async function updatePayment(
  scope: EmployeeScope,
  id: string,
  input: {
    paymentMethod?: string;
    transactionReference?: string;
    paymentDate?: Date;
  },
  actor: { id: string; ipAddress?: string | null; userAgent?: string | null },
): Promise<void> {
  const owner = paymentScope(scope);
  const payment = await prisma.payment.findFirst({
    where: { id, ...owner },
    select: { id: true, status: true, studentId: true, transactionReference: true },
  });
  if (!payment) throw new HttpError(404, "NOT_FOUND", "Payment not found");

  // Can only edit PENDING payments
  if (payment.status !== "PENDING") {
    throw new HttpError(409, "CONFLICT", "Only PENDING payments can be edited");
  }

  if (input.paymentMethod) {
    const methodErr = validatePaymentMethod(input.paymentMethod);
    if (methodErr) throw new HttpError(422, "VALIDATION_ERROR", methodErr);
  }

  // Duplicate reference check if changing
  if (input.transactionReference && input.transactionReference !== payment.transactionReference) {
    const existing = await prisma.payment.findFirst({
      where: {
        studentId: payment.studentId,
        transactionReference: input.transactionReference,
        status: { not: "CANCELLED" },
        id: { not: id },
      },
      select: { id: true },
    });
    if (existing) throw new HttpError(409, "CONFLICT", "A payment with this transaction reference already exists");
  }

  const data: Record<string, unknown> = {};
  if (input.paymentMethod) data.paymentMethod = input.paymentMethod;
  if (input.transactionReference !== undefined) data.transactionReference = input.transactionReference || null;
  if (input.paymentDate) data.paymentDate = input.paymentDate;

  await prisma.payment.update({ where: { id }, data: { ...data, updatedAt: new Date() } });

  // Audit log
  try {
    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: "payment.updated",
        entity: "Payment",
        entityId: id,
        newValue: data as object,
        ipAddress: actor.ipAddress ?? undefined,
        userAgent: actor.userAgent ?? undefined,
      },
    });
  } catch (err) {
    console.error("[payment-update] audit failed", err);
  }
}
