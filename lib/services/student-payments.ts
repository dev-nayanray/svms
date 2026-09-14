import { prisma } from "@/lib/db";
import { STUDENT_LIST_MAX_ROWS } from "@/lib/constants/pagination";
import type { Payment as PrismaPayment } from "@prisma/client";

/**
 * Student-scoped Payment service for Module 11 (Student Payments).
 *
 * SECURITY INVARIANT
 * ------------------
 * Every public method takes a `studentId` resolved from the session
 * (via `studentApiGuard()` at the route layer). The service NEVER
 * trusts a `paymentId` from the client without re-verifying that the
 * payment's `studentId` matches the caller. Foreign/missing records
 * both return null → the route 404s (NOT_FOUND, never 403 — the
 * existence of another student's payment is never confirmed).
 *
 * DATA EXFILTRATION GUARD
 * ------------------------
 * The `transactionReference` field is shown for PAID/PARTIAL/REFUNDED
 * payments but masked (set to null) for PENDING (no reference yet)
 * and CANCELLED payments. Internal fields (`createdById`, `deletedAt`,
 * `deletedBy`) are never exposed.
 *
 * READ-ONLY
 * ---------
 * Students can ONLY view their financial records. They CANNOT create,
 * update, delete, or refund payments. All routes are GET-only. Payment
 * management goes through the admin `/api/payments` routes (guarded by
 * `finance.manage` permission — ADMIN only).
 *
 * SERVER-SIDE CALCULATIONS
 * -------------------------
 * All financial totals (total, paid, outstanding, pending) are
 * computed server-side from the Invoice + Payment tables. The client
 * NEVER sends totals — they're always derived from DB state.
 */

export type PaymentSummary = {
  id: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentMethodLabel: string;
  status: string;
  statusLabel: string;
  transactionReference: string | null;
  paymentDate: Date | null;
  applicationId: string | null;
  application: { id: string; applicationNumber: string } | null;
  invoiceId: string | null;
  invoice: { id: string; invoiceNumber: string; total: number; paidAmount: number; dueAmount: number; status: string } | null;
  createdAt: Date;
};

export type PaymentDetailView = ReturnType<typeof buildStudentSafeView>;

export type FinancialSummary = {
  totalAmount: number;
  paid: number;
  outstanding: number;
  pending: number;
  currency: string;
  invoiceCount: number;
  paymentCount: number;
  nextOpenInvoice: {
    id: string;
    invoiceNumber: string;
    dueAmount: number;
    dueDate: Date | null;
    status: string;
  } | null;
};

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  BKASH: "bKash",
  NAGAD: "Nagad",
  CARD: "Card",
  OTHER: "Other",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  PARTIAL: "Partial",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
};

function buildStudentSafeView(row: PrismaPayment & {
  application: { id: string; applicationNumber: string } | null;
  invoice: { id: string; invoiceNumber: string; total: number; paidAmount: number; dueAmount: number; status: string } | null;
}) {
  // Mask transactionReference for PENDING and CANCELLED payments.
  // For PAID/PARTIAL/REFUNDED, the reference is safe to show — it's
  // the student's own transaction confirmation number.
  const showReference = row.status === "PAID" || row.status === "PARTIAL" || row.status === "REFUNDED";

  return {
    id: row.id,
    amount: row.amount,
    currency: row.currency,
    paymentMethod: row.paymentMethod,
    paymentMethodLabel: METHOD_LABELS[row.paymentMethod] ?? row.paymentMethod,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] ?? row.status,
    transactionReference: showReference ? row.transactionReference : null,
    paymentDate: row.paymentDate,
    applicationId: row.applicationId,
    application: row.application,
    invoiceId: row.invoiceId,
    invoice: row.invoice,
    createdAt: row.createdAt,
    // NOTE: createdById, deletedAt, deletedBy are intentionally omitted.
  };
}

function buildSummary(row: PrismaPayment & {
  application: { id: string; applicationNumber: string } | null;
  invoice: { id: string; invoiceNumber: string; total: number; paidAmount: number; dueAmount: number; status: string } | null;
}): PaymentSummary {
  const view = buildStudentSafeView(row);
  return {
    ...view,
  };
}

export const studentPaymentService = {
  /**
   * List all payments for the caller. Scoped by `studentId` from the
   * session. Returns payments newest-first (by paymentDate, then by
   * createdAt). Each payment includes the linked application + invoice
   * summary (no internal fields).
   */
  async list(studentId: string): Promise<PaymentSummary[]> {
    const rows = await prisma.payment.findMany({
      where: { studentId, deletedAt: null },
      include: {
        application: { select: { id: true, applicationNumber: true } },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            paidAmount: true,
            dueAmount: true,
            status: true,
          },
        },
      },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
      take: STUDENT_LIST_MAX_ROWS,
    });
    return rows.map((r) => buildSummary(r as never));
  },

  /**
   * Get one payment's full detail view. Ownership is verified
   * server-side: the query is scoped by `studentId`, so a foreign
   * `paymentId` returns null → the route 404s.
   */
  async getById(studentId: string, paymentId: string) {
    const row = await prisma.payment.findFirst({
      where: { id: paymentId, studentId, deletedAt: null },
      include: {
        application: { select: { id: true, applicationNumber: true } },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            paidAmount: true,
            dueAmount: true,
            status: true,
            issueDate: true,
            dueDate: true,
            items: true,
          },
        },
      },
    });
    if (!row) return null;
    return buildStudentSafeView(row as never);
  },

  /**
   * Compute the financial summary for the caller. All totals are
   * computed server-side from the Invoice + Payment tables — the
   * client NEVER sends totals.
   *
   * - totalAmount: sum of all non-CANCELLED, non-DRAFT invoice totals
   * - paid: sum of all non-CANCELLED invoice paidAmounts
   * - outstanding: sum of all non-CANCELLED, non-DRAFT invoice dueAmounts
   * - pending: sum of PENDING payments (not yet confirmed)
   */
  async getSummary(studentId: string): Promise<FinancialSummary> {
    const [invoices, payments] = await Promise.all([
      prisma.invoice.findMany({
        where: { studentId, deletedAt: null },
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          paidAmount: true,
          dueAmount: true,
          status: true,
          dueDate: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.payment.findMany({
        where: { studentId, deletedAt: null },
        select: { amount: true, currency: true, status: true },
      }),
    ]);

    // Filter out DRAFT and CANCELLED invoices — they don't count
    // toward the student's financial obligations.
    const liveInvoices = invoices.filter(
      (i) => i.status !== "DRAFT" && i.status !== "CANCELLED",
    );

    const totalAmount = liveInvoices.reduce((s, i) => s + i.total, 0);
    const paid = liveInvoices.reduce((s, i) => s + i.paidAmount, 0);
    const outstanding = liveInvoices.reduce((s, i) => s + i.dueAmount, 0);
    const pending = payments
      .filter((p) => p.status === "PENDING")
      .reduce((s, p) => s + p.amount, 0);

    // Find the next open invoice (smallest due date with dueAmount > 0).
    const openInvoices = liveInvoices
      .filter((i) => i.dueAmount > 0 && i.status !== "PAID")
      .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity));

    const currency = payments[0]?.currency ?? "BDT";

    return {
      totalAmount,
      paid,
      outstanding,
      pending,
      currency,
      invoiceCount: liveInvoices.length,
      paymentCount: payments.length,
      nextOpenInvoice: openInvoices[0]
        ? {
            id: openInvoices[0].id,
            invoiceNumber: openInvoices[0].invoiceNumber,
            dueAmount: openInvoices[0].dueAmount,
            dueDate: openInvoices[0].dueDate,
            status: openInvoices[0].status,
          }
        : null,
    };
  },
};

/** Re-export for the route layer. */
export type StudentPaymentView = NonNullable<Awaited<ReturnType<typeof studentPaymentService.getById>>>;
