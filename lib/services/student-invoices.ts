import { prisma } from "@/lib/db";
import { STUDENT_LIST_MAX_ROWS } from "@/lib/constants/pagination";

/**
 * Student-scoped Invoice service for Module 12 (Student Invoices).
 *
 * SECURITY INVARIANT
 * ------------------
 * Every public method takes a `studentId` resolved from the session
 * (via `studentApiGuard()` at the route layer). The service NEVER
 * trusts an `invoiceId` from the client without re-verifying that the
 * invoice's `studentId` matches the caller. Foreign/missing records
 * both return null → the route 404s (NOT_FOUND, never 403).
 *
 * DATA EXFILTRATION GUARD
 * ------------------------
 * DRAFT invoices are NOT student-visible — they're internal drafts
 * the counselor hasn't finalized yet. Only ISSUED, PARTIAL, PAID,
 * OVERDUE, and CANCELLED invoices are returned.
 *
 * The `items` JSON field is passed through unchanged (it's the
 * line-item breakdown the student needs to see). Internal fields
 * (`deletedAt`, `deletedBy`) are never exposed.
 *
 * READ-ONLY
 * ---------
 * Students can ONLY view invoices. They CANNOT create, update, delete,
 * or modify invoices. All routes are GET-only. Invoice management goes
 * through the admin `/api/invoices` routes (ADMIN only,
 * `finance.manage`).
 *
 * SERVER-SIDE CALCULATIONS
 * -------------------------
 * All financial values (subtotal, discount, total, paidAmount,
 * dueAmount) come from the Invoice row in the DB — they were computed
 * server-side when the invoice was created/updated. The client NEVER
 * sends or recomputes totals.
 */

const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  PARTIAL: "Partial",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

/** Statuses that are student-visible (DRAFT is excluded). */
const STUDENT_VISIBLE_STATUSES = ["ISSUED", "PARTIAL", "PAID", "OVERDUE", "CANCELLED"];

export type InvoiceSummary = {
  id: string;
  invoiceNumber: string;
  status: string;
  statusLabel: string;
  total: number;
  paidAmount: number;
  dueAmount: number;
  discount: number;
  issueDate: Date | null;
  dueDate: Date | null;
  application: { id: string; applicationNumber: string } | null;
  createdAt: Date;
};

export type InvoiceItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type InvoiceDetailView = {
  id: string;
  invoiceNumber: string;
  status: string;
  statusLabel: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  dueAmount: number;
  issueDate: Date | null;
  dueDate: Date | null;
  createdAt: Date;
  application: { id: string; applicationNumber: string } | null;
  student: {
    firstName: string;
    lastName: string;
    email: string;
    studentId: string;
  };
  payments: {
    id: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    status: string;
    paymentDate: Date | null;
    transactionReference: string | null;
  }[];
};

function parseItems(itemsJson: unknown): InvoiceItem[] {
  if (!Array.isArray(itemsJson)) return [];
  return itemsJson.map((item: Record<string, unknown>) => {
    const quantity = Number(item.quantity ?? 1);
    const unitPrice = Number(item.unitPrice ?? 0);
    return {
      description: String(item.description ?? ""),
      quantity,
      unitPrice,
      lineTotal: quantity * unitPrice,
    };
  });
}

export const studentInvoiceService = {
  /**
   * List all student-visible invoices for the caller. DRAFT invoices
   * are excluded — they're internal drafts not yet finalized.
   * Scoped by `studentId` from the session.
   */
  async list(studentId: string): Promise<InvoiceSummary[]> {
    const rows = await prisma.invoice.findMany({
      where: {
        studentId,
        deletedAt: null,
        status: { in: STUDENT_VISIBLE_STATUSES },
      },
      include: {
        application: { select: { id: true, applicationNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: STUDENT_LIST_MAX_ROWS,
    });

    return rows.map((r) => ({
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      status: r.status,
      statusLabel: INVOICE_STATUS_LABELS[r.status] ?? r.status,
      total: r.total,
      paidAmount: r.paidAmount,
      dueAmount: r.dueAmount,
      discount: r.discount,
      issueDate: r.issueDate,
      dueDate: r.dueDate,
      application: r.application,
      createdAt: r.createdAt,
    }));
  },

  /**
   * Get one invoice's full detail view. Ownership is verified
   * server-side: the query is scoped by `studentId`, so a foreign
   * `invoiceId` returns null → the route 404s. DRAFT invoices are
   * excluded from the where clause.
   */
  async getById(studentId: string, invoiceId: string): Promise<InvoiceDetailView | null> {
    const row = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        studentId,
        deletedAt: null,
        status: { in: STUDENT_VISIBLE_STATUSES },
      },
      include: {
        application: { select: { id: true, applicationNumber: true } },
        student: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            studentId: true,
          },
        },
        payments: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            amount: true,
            currency: true,
            paymentMethod: true,
            status: true,
            paymentDate: true,
            transactionReference: true,
          },
        },
      },
    });

    if (!row) return null;

    return {
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      status: row.status,
      statusLabel: INVOICE_STATUS_LABELS[row.status] ?? row.status,
      items: parseItems(row.items),
      subtotal: row.subtotal,
      discount: row.discount,
      total: row.total,
      paidAmount: row.paidAmount,
      dueAmount: row.dueAmount,
      issueDate: row.issueDate,
      dueDate: row.dueDate,
      createdAt: row.createdAt,
      application: row.application,
      student: row.student,
      payments: row.payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        paymentMethod: p.paymentMethod,
        status: p.status,
        paymentDate: p.paymentDate,
        transactionReference: p.status === "PAID" || p.status === "PARTIAL" || p.status === "REFUNDED"
          ? p.transactionReference
          : null,
      })),
    };
  },
};

/** Re-export for the route layer. */
export type StudentInvoiceView = NonNullable<Awaited<ReturnType<typeof studentInvoiceService.getById>>>;
