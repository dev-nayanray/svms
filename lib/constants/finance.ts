/**
 * Pure helpers for the Admin Finance module.
 *
 * No DB access — these functions feed the API routes, UI components, and
 * tests. The payment/invoice statuses, methods, and where-builders are
 * the single source of truth for "which financial records can be
 * seen/edited/refunded?" and are enforced at the service level.
 *
 * Financial rules:
 *  - Totals are always computed server-side (computeInvoiceTotals).
 *  - Payments cannot exceed the invoice's due amount.
 *  - Financial records are never hard-deleted — only soft-deleted
 *    (archived) for audit trails.
 *  - Refunds reverse a payment and adjust the linked invoice's
 *    paid/due/status accordingly.
 */

export const PAYMENT_STATUSES = [
  "PENDING",
  "PAID",
  "PARTIAL",
  "REFUNDED",
  "CANCELLED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  PARTIAL: "Partial",
  REFUNDED: "Refunded",
  CANCELLED: "Cancelled",
};

export const PAYMENT_METHODS = [
  "CASH",
  "BANK_TRANSFER",
  "BKASH",
  "NAGAD",
  "CARD",
  "OTHER",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  BKASH: "bKash",
  NAGAD: "Nagad",
  CARD: "Card",
  OTHER: "Other",
};

export const INVOICE_STATUSES = [
  "DRAFT",
  "ISSUED",
  "PARTIAL",
  "PAID",
  "OVERDUE",
  "CANCELLED",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  PARTIAL: "Partial",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

/** Sort keys allowed for the admin payments list. */
export const PAYMENT_SORT_KEYS = [
  "amount",
  "paymentMethod",
  "paymentDate",
  "status",
  "createdAt",
] as const;

/** Sort keys allowed for the admin invoices list. */
export const INVOICE_SORT_KEYS = [
  "invoiceNumber",
  "total",
  "paidAmount",
  "dueAmount",
  "status",
  "issueDate",
  "dueDate",
  "createdAt",
] as const;

/**
 * Build a Prisma `where` fragment for the admin payments list. Enforces
 * the soft-delete filter (deletedAt null) and AND-combines the optional
 * discovery filters:
 *  - search (transaction reference)
 *  - status
 *  - studentId
 *  - applicationId
 *  - invoiceId
 *  - paymentMethod
 *  - paymentFrom / paymentTo (date range on paymentDate)
 */
export function buildAdminPaymentWhere(filters: {
  search?: string;
  status?: string;
  studentId?: string;
  applicationId?: string;
  invoiceId?: string;
  paymentMethod?: string;
  paymentFrom?: Date;
  paymentTo?: Date;
}): Record<string, unknown> {
  const search = filters.search?.trim();
  const andClauses: Record<string, unknown>[] = [{ deletedAt: null }];

  if (filters.status) {
    andClauses.push({ status: filters.status });
  }
  if (filters.studentId) {
    andClauses.push({ studentId: filters.studentId });
  }
  if (filters.applicationId) {
    andClauses.push({ applicationId: filters.applicationId });
  }
  if (filters.invoiceId) {
    andClauses.push({ invoiceId: filters.invoiceId });
  }
  if (filters.paymentMethod) {
    andClauses.push({ paymentMethod: filters.paymentMethod });
  }
  if (search) {
    andClauses.push({
      OR: [
        { transactionReference: { contains: search, mode: "insensitive" } },
      ],
    });
  }
  if (filters.paymentFrom || filters.paymentTo) {
    const range: Record<string, unknown> = {};
    if (filters.paymentFrom) range.gte = filters.paymentFrom;
    if (filters.paymentTo) range.lte = filters.paymentTo;
    andClauses.push({ paymentDate: range });
  }

  return { AND: andClauses };
}

/**
 * Build a Prisma `where` fragment for the admin invoices list. Enforces
 * the soft-delete filter and AND-combines the optional discovery
 * filters:
 *  - search (invoice number)
 *  - status
 *  - studentId
 *  - applicationId
 *  - issueFrom / issueTo (date range on issueDate)
 */
export function buildAdminInvoiceWhere(filters: {
  search?: string;
  status?: string;
  studentId?: string;
  applicationId?: string;
  issueFrom?: Date;
  issueTo?: Date;
}): Record<string, unknown> {
  const search = filters.search?.trim();
  const andClauses: Record<string, unknown>[] = [{ deletedAt: null }];

  if (filters.status) {
    andClauses.push({ status: filters.status });
  }
  if (filters.studentId) {
    andClauses.push({ studentId: filters.studentId });
  }
  if (filters.applicationId) {
    andClauses.push({ applicationId: filters.applicationId });
  }
  if (search) {
    andClauses.push({
      invoiceNumber: { contains: search, mode: "insensitive" },
    });
  }
  if (filters.issueFrom || filters.issueTo) {
    const range: Record<string, unknown> = {};
    if (filters.issueFrom) range.gte = filters.issueFrom;
    if (filters.issueTo) range.lte = filters.issueTo;
    andClauses.push({ issueDate: range });
  }

  return { AND: andClauses };
}

/**
 * Format a monetary amount with the given currency. Uses
 * Intl.NumberFormat with a safe fallback for invalid currency codes.
 */
export function formatMoney(
  amount: number | null | undefined,
  currency = "BDT",
): string {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }
}

/**
 * Compute the invoice's payment progress as a percentage (0-100).
 * Returns 0 for invoices with a total of 0 (edge case).
 */
export function paymentProgress(invoice: {
  paidAmount: number;
  total: number;
}): number {
  if (invoice.total <= 0) return 0;
  return Math.min(Math.round((invoice.paidAmount / invoice.total) * 100), 100);
}
