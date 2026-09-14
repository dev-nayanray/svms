import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import type { EmployeeScope } from "@/lib/services/employee-dashboard";
import { invoiceScope } from "@/lib/services/employee-dashboard";
import { formatMoney } from "@/lib/utils";

/**
 * Employee Invoice Management service — server-side data layer for
 * /employee/invoices and the invoice CRUD APIs.
 *
 * ALL financial calculations are server-side. The browser NEVER supplies
 * subtotal, discount, tax, total, paidAmount, or balance — these are
 * computed from line items + payments server-side.
 *
 * IDOR closure: EMPLOYEE sees invoices on students assigned to them.
 * ADMIN sees all. Foreign invoices return 404 (never 403).
 */

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

export const INVOICE_STATUSES = [
  "DRAFT", "ISSUED", "PARTIAL", "PAID", "OVERDUE", "CANCELLED",
] as const;

// ─────────────────────────────────────────────
// Calculation helpers — pure functions
// ─────────────────────────────────────────────

export type InvoiceTotals = {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
};

export function computeInvoiceTotals(
  items: { quantity: number; unitPrice: number }[],
  discount: number = 0,
  taxRate: number = 0, // percentage, e.g. 19 = 19%
): InvoiceTotals {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const tax = Math.round(discountedSubtotal * (taxRate / 100) * 100) / 100;
  const total = Math.round((discountedSubtotal + tax) * 100) / 100;
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.max(0, discount),
    tax,
    total,
  };
}

export function computeBalance(total: number, paidAmount: number): number {
  return Math.max(0, Math.round((total - paidAmount) * 100) / 100);
}

export function computeInvoiceStatus(
  total: number,
  paidAmount: number,
  dueDate: Date | null,
  currentStatus: string,
  now: Date = new Date(),
): string {
  if (currentStatus === "CANCELLED") return "CANCELLED";
  if (currentStatus === "DRAFT") return "DRAFT";
  if (paidAmount >= total && total > 0) return "PAID";
  if (paidAmount > 0 && paidAmount < total) return "PARTIAL";
  if (dueDate && dueDate < now && paidAmount < total) return "OVERDUE";
  return "ISSUED";
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type InvoiceListFilters = {
  search?: string;
  status?: string;
  studentId?: string;
  applicationId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  balance: number;
  currency: string;
  issueDate: Date;
  dueDate: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  student: { id: string; firstName: string; lastName: string; studentId: string };
  application: { id: string; applicationNumber: string } | null;
};

export type InvoiceListResult = {
  rows: InvoiceRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type InvoiceDetail = {
  id: string;
  invoiceNumber: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  balance: number;
  currency: string;
  issueDate: Date;
  dueDate: Date | null;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  student: { id: string; firstName: string; lastName: string; studentId: string; email: string; phone: string | null; country: string | null; city: string | null };
  application: { id: string; applicationNumber: string; country: { name: string } | null; university: { name: string } | null; course: { name: string } | null } | null;
  items: {
    id: string; description: string; quantity: number; unitPrice: number; total: number;
  }[];
  payments: {
    id: string; amount: number; currency: string; status: string; paymentMethod: string; paymentDate: Date | null;
  }[];
};

// ─────────────────────────────────────────────
// Invoice number generation — unique
// ─────────────────────────────────────────────

export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.invoice.count();
  const num = String(count + 1).padStart(5, "0");
  const candidate = `INV-${year}-${num}`;
  // Verify uniqueness — if collision, increment
  let final = candidate;
  let attempt = 0;
  while (attempt < 100) {
    const existing = await prisma.invoice.findFirst({ where: { invoiceNumber: final }, select: { id: true } });
    if (!existing) break;
    attempt++;
    final = `INV-${year}-${String(count + 1 + attempt).padStart(5, "0")}`;
  }
  return final;
}

// ─────────────────────────────────────────────
// List
// ─────────────────────────────────────────────

export async function listInvoices(
  scope: EmployeeScope,
  params: {
    filters?: InvoiceListFilters;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<InvoiceListResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const filters = params.filters ?? {};
  const owner = invoiceScope(scope);

  const fieldFilters: Record<string, unknown> = {};
  if (filters.status) fieldFilters.status = filters.status;
  if (filters.studentId) fieldFilters.studentId = filters.studentId;
  if (filters.applicationId) fieldFilters.applicationId = filters.applicationId;

  const search = filters.search?.trim();
  const searchFilter = search
    ? {
        OR: [
          { invoiceNumber: { contains: search, mode: "insensitive" as const } },
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
  if (Object.keys(dateRange).length > 0) fieldFilters.issueDate = dateRange;

  const where = { ...owner, ...searchFilter, ...fieldFilters };

  const [rows, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, invoiceNumber: true, subtotal: true, discount: true, tax: true,
        total: true, paidAmount: true, balance: true, currency: true,
        issueDate: true, dueDate: true, status: true, createdAt: true, updatedAt: true,
        student: { select: { id: true, firstName: true, lastName: true, studentId: true } },
        application: { select: { id: true, applicationNumber: true } },
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  const mapped: InvoiceRow[] = rows.map((inv) => ({
    ...inv,
    balance: computeBalance(inv.total, inv.paidAmount),
  }));

  return { rows: mapped, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

// ─────────────────────────────────────────────
// Detail
// ─────────────────────────────────────────────

export async function getInvoiceById(scope: EmployeeScope, id: string): Promise<InvoiceDetail | null> {
  const owner = invoiceScope(scope);
  const invoice = await prisma.invoice.findFirst({
    where: { id, ...owner },
    select: {
      id: true, invoiceNumber: true, subtotal: true, discount: true, tax: true,
      total: true, paidAmount: true, balance: true, currency: true,
      issueDate: true, dueDate: true, status: true, notes: true,
      createdAt: true, updatedAt: true,
      student: {
        select: { id: true, firstName: true, lastName: true, studentId: true, email: true, phone: true, country: true, city: true },
      },
      application: {
        select: {
          id: true, applicationNumber: true,
          country: { select: { name: true } },
          university: { select: { name: true } },
          course: { select: { name: true } },
        },
      },
      items: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, description: true, quantity: true, unitPrice: true, total: true },
      },
    },
  });

  if (!invoice) return null;

  // Query payments separately (Invoice has no direct relation to Payment — payments
  // link to invoices via the `invoiceId` field on the Payment model)
  const payments = await prisma.payment.findMany({
    where: { invoiceId: id, status: { not: "CANCELLED" } },
    orderBy: { createdAt: "desc" },
    select: { id: true, amount: true, currency: true, status: true, paymentMethod: true, paymentDate: true },
  });

  return {
    ...invoice,
    balance: computeBalance(invoice.total, invoice.paidAmount),
    payments,
  };
}

export async function requireInvoice(scope: EmployeeScope, id: string): Promise<InvoiceDetail> {
  const inv = await getInvoiceById(scope, id);
  if (!inv) throw new HttpError(404, "NOT_FOUND", "Invoice not found");
  return inv;
}

// ─────────────────────────────────────────────
// Create — server-side calculations only
// ─────────────────────────────────────────────

export async function createInvoice(
  scope: EmployeeScope,
  input: {
    studentId: string;
    applicationId?: string;
    items: { description: string; quantity: number; unitPrice: number }[];
    discount?: number;
    taxRate?: number;
    currency?: string;
    dueDate?: Date;
    notes?: string;
  },
  actor: { id: string; ipAddress?: string | null; userAgent?: string | null },
): Promise<{ id: string; invoiceNumber: string }> {
  // IDOR: EMPLOYEE can only create invoices for their own students
  if (!scope.isAdmin) {
    const student = await prisma.student.findFirst({
      where: { id: input.studentId, assignedEmployee: { userId: scope.userId } },
      select: { id: true },
    });
    if (!student) throw new HttpError(403, "FORBIDDEN", "You can only create invoices for your own students");
  }

  // Validate items
  if (!input.items || input.items.length === 0) {
    throw new HttpError(422, "VALIDATION_ERROR", "At least one line item is required");
  }
  for (const item of input.items) {
    if (!item.description?.trim()) throw new HttpError(422, "VALIDATION_ERROR", "Item description is required");
    if (item.quantity < 1) throw new HttpError(422, "VALIDATION_ERROR", "Quantity must be at least 1");
    if (item.unitPrice < 0) throw new HttpError(422, "VALIDATION_ERROR", "Unit price cannot be negative");
  }

  // Compute totals SERVER-SIDE — never trust browser-supplied totals
  const totals = computeInvoiceTotals(input.items, input.discount ?? 0, input.taxRate ?? 0);
  const invoiceNumber = await generateInvoiceNumber();

  // Create invoice + items in a transaction
  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        invoiceNumber,
        studentId: input.studentId,
        applicationId: input.applicationId ?? null,
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax: totals.tax,
        total: totals.total,
        paidAmount: 0,
        balance: totals.total,
        currency: input.currency ?? "EUR",
        issueDate: new Date(),
        dueDate: input.dueDate ?? null,
        status: "DRAFT",
        notes: input.notes ?? null,
      },
    });

    // Create items
    await tx.invoiceItem.createMany({
      data: input.items.map((item, i) => ({
        invoiceId: inv.id,
        description: item.description.trim(),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: Math.round(item.quantity * item.unitPrice * 100) / 100,
        sortOrder: i,
      })),
    });

    return inv;
  });

  // Audit log
  try {
    await prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: "invoice.created",
        entity: "Invoice",
        entityId: invoice.id,
        newValue: { invoiceNumber, total: totals.total, currency: input.currency ?? "EUR" } as object,
        ipAddress: actor.ipAddress ?? undefined,
        userAgent: actor.userAgent ?? undefined,
      },
    });
  } catch (err) {
    console.error("[invoice-create] audit failed", err);
  }

  return { id: invoice.id, invoiceNumber };
}

// ─────────────────────────────────────────────
// Issue — DRAFT → ISSUED
// ─────────────────────────────────────────────

export async function issueInvoice(
  scope: EmployeeScope,
  id: string,
  actor: { id: string; ipAddress?: string | null; userAgent?: string | null },
): Promise<void> {
  const owner = invoiceScope(scope);
  const invoice = await prisma.invoice.findFirst({
    where: { id, ...owner },
    select: { id: true, status: true, studentId: true, invoiceNumber: true },
  });
  if (!invoice) throw new HttpError(404, "NOT_FOUND", "Invoice not found");
  if (invoice.status !== "DRAFT") throw new HttpError(409, "CONFLICT", "Only DRAFT invoices can be issued");

  await prisma.invoice.update({ where: { id }, data: { status: "ISSUED", issueDate: new Date() } });

  // Notify student
  try {
    const student = await prisma.student.findUnique({ where: { id: invoice.studentId }, select: { userId: true } });
    if (student) {
      await prisma.notification.create({
        data: {
          userId: student.userId,
          type: "INVOICE_ISSUED",
          title: `Invoice issued: ${invoice.invoiceNumber}`,
          message: `A new invoice has been issued to you.`,
          link: "/employee/invoices",
        },
      });
    }
  } catch (err) {
    console.error("[invoice-issue] notification failed", err);
  }

  // Audit
  try {
    await prisma.auditLog.create({
      data: {
        userId: actor.id, action: "invoice.issued", entity: "Invoice", entityId: id,
        oldValue: { status: "DRAFT" } as object, newValue: { status: "ISSUED" } as object,
        ipAddress: actor.ipAddress ?? undefined, userAgent: actor.userAgent ?? undefined,
      },
    });
  } catch (err) {
    console.error("[invoice-issue] audit failed", err);
  }
}

// ─────────────────────────────────────────────
// Cancel
// ─────────────────────────────────────────────

export async function cancelInvoice(
  scope: EmployeeScope,
  id: string,
  actor: { id: string; ipAddress?: string | null; userAgent?: string | null },
): Promise<void> {
  const owner = invoiceScope(scope);
  const invoice = await prisma.invoice.findFirst({
    where: { id, ...owner },
    select: { id: true, status: true, paidAmount: true, total: true, invoiceNumber: true },
  });
  if (!invoice) throw new HttpError(404, "NOT_FOUND", "Invoice not found");
  if (invoice.status === "CANCELLED") return; // no-op
  if (invoice.status === "PAID") throw new HttpError(409, "CONFLICT", "Cannot cancel a paid invoice");
  if (invoice.paidAmount > 0) throw new HttpError(409, "CONFLICT", "Cannot cancel an invoice with partial payments — refund first");

  await prisma.invoice.update({ where: { id }, data: { status: "CANCELLED" } });

  // Audit
  try {
    await prisma.auditLog.create({
      data: {
        userId: actor.id, action: "invoice.cancelled", entity: "Invoice", entityId: id,
        oldValue: { status: invoice.status } as object, newValue: { status: "CANCELLED" } as object,
        ipAddress: actor.ipAddress ?? undefined, userAgent: actor.userAgent ?? undefined,
      },
    });
  } catch (err) {
    console.error("[invoice-cancel] audit failed", err);
  }
}

// ─────────────────────────────────────────────
// Recalculate paid amount + status from linked payments
// ─────────────────────────────────────────────

export async function recalculateInvoice(invoiceId: string): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, total: true, dueDate: true, status: true },
  });
  if (!invoice) return;

  const payments = await prisma.payment.findMany({
    where: { invoiceId, status: "PAID" },
    select: { amount: true },
  });
  const paidAmount = payments.reduce((s, p) => s + p.amount, 0);
  const balance = computeBalance(invoice.total, paidAmount);
  const newStatus = computeInvoiceStatus(invoice.total, paidAmount, invoice.dueDate, invoice.status);

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { paidAmount, balance, status: newStatus },
  });
}
