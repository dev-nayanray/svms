import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/api";
import type { AuthUser } from "@/lib/auth/guards";
import { auditLog } from "./audit";

export type InvoiceItemInput = { description: string; quantity: number; unitPrice: number };

/** Pure invoice math — server-side only; client-sent totals are never trusted. */
export function computeInvoiceTotals(items: InvoiceItemInput[], discount = 0) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const safeDiscount = Math.min(Math.max(discount, 0), subtotal);
  const total = subtotal - safeDiscount;
  return { subtotal, discount: safeDiscount, total };
}

export const invoiceService = {
  async nextInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.invoice.count();
    return `INV-${year}-${String(count + 1).padStart(5, "0")}`;
  },

  async create(
    input: {
      studentId: string;
      applicationId?: string;
      items: { description: string; quantity: number; unitPrice: number }[];
      discount?: number;
      issueDate?: Date;
      dueDate?: Date;
    },
    actor: AuthUser,
  ) {
    // Totals are always computed server-side — never trust the client.
    const { subtotal, discount, total } = computeInvoiceTotals(input.items, input.discount);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: await this.nextInvoiceNumber(),
        studentId: input.studentId,
        applicationId: input.applicationId,
        items: input.items,
        subtotal,
        discount,
        total,
        paidAmount: 0,
        dueAmount: total,
        status: "ISSUED",
        issueDate: input.issueDate ?? new Date(),
        dueDate: input.dueDate,
      },
    });

    await auditLog.record({
      userId: actor.id,
      action: "invoice.created",
      entity: "Invoice",
      entityId: invoice.id,
      newValue: { invoiceNumber: invoice.invoiceNumber, total },
    });
    return invoice;
  },

  /**
   * Update an invoice's editable fields (items, discount, issue/due
   * dates, status). Totals are recomputed server-side when items or
   * discount change. The paidAmount + dueAmount are recalculated against
   * the new total to keep them consistent.
   */
  async update(
    id: string,
    input: {
      items?: InvoiceItemInput[];
      discount?: number;
      issueDate?: Date | null;
      dueDate?: Date | null;
      status?: string;
    },
    actor: AuthUser,
  ) {
    const invoice = await prisma.invoice.findFirst({
      where: { id, deletedAt: null },
    });
    if (!invoice) throw new HttpError(404, "NOT_FOUND", "Invoice not found");

    const updateData: Record<string, unknown> = {};

    if (input.items) {
      const { subtotal, discount: safeDiscount, total } = computeInvoiceTotals(
        input.items,
        input.discount ?? invoice.discount,
      );
      updateData.items = input.items;
      updateData.subtotal = subtotal;
      updateData.discount = safeDiscount;
      updateData.total = total;
      // Recalculate paid/due against the new total
      updateData.paidAmount = Math.min(invoice.paidAmount, total);
      updateData.dueAmount = Math.max(total - (updateData.paidAmount as number), 0);
      // Recompute status based on the new paid/due
      if (updateData.dueAmount === 0 && (updateData.paidAmount as number) > 0) {
        updateData.status = "PAID";
      } else if ((updateData.paidAmount as number) > 0) {
        updateData.status = "PARTIAL";
      }
    } else if (input.discount !== undefined) {
      const { subtotal, discount: safeDiscount, total } = computeInvoiceTotals(
        invoice.items as InvoiceItemInput[],
        input.discount,
      );
      updateData.subtotal = subtotal;
      updateData.discount = safeDiscount;
      updateData.total = total;
      updateData.paidAmount = Math.min(invoice.paidAmount, total);
      updateData.dueAmount = Math.max(total - (updateData.paidAmount as number), 0);
    }

    if (input.issueDate !== undefined) updateData.issueDate = input.issueDate;
    if (input.dueDate !== undefined) updateData.dueDate = input.dueDate;
    if (input.status) updateData.status = input.status;

    const updated = await prisma.invoice.update({
      where: { id },
      data: updateData,
    });

    await auditLog.record({
      userId: actor.id,
      action: "invoice.updated",
      entity: "Invoice",
      entityId: id,
      oldValue: {
        subtotal: invoice.subtotal,
        discount: invoice.discount,
        total: invoice.total,
        status: invoice.status,
      },
      newValue: {
        subtotal: updateData.subtotal,
        discount: updateData.discount,
        total: updateData.total,
        status: updateData.status,
      },
    });
    return updated;
  },

  /**
   * Archive (soft-delete) an invoice. Financial records are never
   * hard-deleted — this retains the record for audit trails.
   */
  async archive(id: string, actor: AuthUser) {
    const invoice = await prisma.invoice.findFirst({ where: { id, deletedAt: null } });
    if (!invoice) throw new HttpError(404, "NOT_FOUND", "Invoice not found");

    const updated = await prisma.invoice.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: actor.id },
    });

    await auditLog.record({
      userId: actor.id,
      action: "invoice.archived",
      entity: "Invoice",
      entityId: id,
      oldValue: { invoiceNumber: invoice.invoiceNumber, total: invoice.total },
    });
    return updated;
  },

  /**
   * Record a payment against a student/invoice. Validates the payment
   * amount doesn't exceed the invoice's due amount. Updates the linked
   * invoice's paid/due/status accordingly.
   */
  async recordPayment(
    input: {
      studentId: string;
      applicationId?: string;
      invoiceId?: string;
      amount: number;
      currency?: string;
      paymentMethod: string;
      transactionReference?: string;
      paymentDate?: Date;
    },
    actor: AuthUser,
  ) {
    if (input.invoiceId) {
      const invoice = await prisma.invoice.findFirst({
        where: { id: input.invoiceId, deletedAt: null },
      });
      if (!invoice) throw new HttpError(404, "NOT_FOUND", "Invoice not found");
      if (invoice.status === "CANCELLED") {
        throw new HttpError(400, "BAD_REQUEST", "Cannot pay a cancelled invoice");
      }
      if (input.amount > invoice.dueAmount + 0.001) {
        throw new HttpError(
          400,
          "BAD_REQUEST",
          `Payment exceeds due amount (${invoice.dueAmount})`,
        );
      }
    }

    const payment = await prisma.payment.create({
      data: { ...input, status: "PAID", paymentDate: input.paymentDate ?? new Date(), createdById: actor.id },
    });

    if (input.invoiceId) {
      const invoice = await prisma.invoice.findUniqueOrThrow({
        where: { id: input.invoiceId },
      });
      const paidAmount = invoice.paidAmount + input.amount;
      const dueAmount = Math.max(invoice.total - paidAmount, 0);
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount,
          dueAmount,
          status: dueAmount === 0 ? "PAID" : "PARTIAL",
          payments: { connect: { id: payment.id } },
        },
      });
    }

    await auditLog.record({
      userId: actor.id,
      action: "payment.recorded",
      entity: "Payment",
      entityId: payment.id,
      newValue: { amount: input.amount, method: input.paymentMethod, invoiceId: input.invoiceId },
    });
    return payment;
  },

  /**
   * Update a payment's editable fields (amount, method, reference, date).
   * When the amount changes and the payment is linked to an invoice, the
   * invoice's paid/due/status are recalculated. Prevents invalid totals
   * by validating the new amount doesn't exceed the invoice's due amount
   * (adjusted for the old payment amount).
   */
  async updatePayment(
    id: string,
    input: {
      amount?: number;
      currency?: string;
      paymentMethod?: string;
      transactionReference?: string;
      paymentDate?: Date | null;
    },
    actor: AuthUser,
  ) {
    const payment = await prisma.payment.findFirst({ where: { id, deletedAt: null } });
    if (!payment) throw new HttpError(404, "NOT_FOUND", "Payment not found");
    if (payment.status === "REFUNDED") {
      throw new HttpError(409, "CONFLICT", "Cannot edit a refunded payment");
    }

    // If the amount is changing and the payment is linked to an invoice,
    // validate the new amount doesn't exceed the adjusted due amount.
    if (input.amount !== undefined && payment.invoiceId) {
      const invoice = await prisma.invoice.findFirst({
        where: { id: payment.invoiceId, deletedAt: null },
      });
      if (invoice) {
        const adjustedDue = invoice.dueAmount + payment.amount;
        if (input.amount > adjustedDue + 0.001) {
          throw new HttpError(
            400,
            "BAD_REQUEST",
            `Payment exceeds due amount (${adjustedDue})`,
          );
        }
      }
    }

    const updated = await prisma.payment.update({
      where: { id },
      data: input,
    });

    // If amount changed and linked to invoice, recalculate the invoice
    if (input.amount !== undefined && payment.invoiceId) {
      const invoice = await prisma.invoice.findUniqueOrThrow({
        where: { id: payment.invoiceId },
      });
      // Recalculate: sum all non-refunded payments for this invoice
      const allPayments = await prisma.payment.findMany({
        where: {
          invoiceId: payment.invoiceId,
          deletedAt: null,
          status: { in: ["PAID", "PARTIAL", "PENDING"] },
        },
      });
      const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);
      const dueAmount = Math.max(invoice.total - totalPaid, 0);
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: totalPaid,
          dueAmount,
          status: dueAmount === 0 ? "PAID" : totalPaid > 0 ? "PARTIAL" : invoice.status,
        },
      });
    }

    await auditLog.record({
      userId: actor.id,
      action: "payment.updated",
      entity: "Payment",
      entityId: id,
      oldValue: {
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        transactionReference: payment.transactionReference,
      },
      newValue: input,
    });
    return updated;
  },

  /**
   * Refund a payment. Sets the payment's status to REFUNDED and adjusts
   * the linked invoice's paid/due/status accordingly. Refunded payments
   * cannot be edited. The refund reason is audit-logged.
   */
  async refund(id: string, reason: string | undefined, actor: AuthUser) {
    const payment = await prisma.payment.findFirst({ where: { id, deletedAt: null } });
    if (!payment) throw new HttpError(404, "NOT_FOUND", "Payment not found");
    if (payment.status === "REFUNDED") {
      throw new HttpError(409, "CONFLICT", "Payment is already refunded");
    }
    if (payment.status === "CANCELLED") {
      throw new HttpError(409, "CONFLICT", "Cannot refund a cancelled payment");
    }

    const updated = await prisma.payment.update({
      where: { id },
      data: { status: "REFUNDED" },
    });

    // Adjust the linked invoice's paid/due/status
    if (payment.invoiceId) {
      const invoice = await prisma.invoice.findUniqueOrThrow({
        where: { id: payment.invoiceId },
      });
      const newPaidAmount = Math.max(invoice.paidAmount - payment.amount, 0);
      const newDueAmount = invoice.total - newPaidAmount;
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaidAmount,
          dueAmount: newDueAmount,
          status: newPaidAmount === 0 ? "ISSUED" : "PARTIAL",
        },
      });
    }

    await auditLog.record({
      userId: actor.id,
      action: "payment.refunded",
      entity: "Payment",
      entityId: id,
      oldValue: { status: payment.status, amount: payment.amount },
      newValue: { status: "REFUNDED", reason },
    });
    return updated;
  },

  /**
   * Archive (soft-delete) a payment. Financial records are never
   * hard-deleted — this retains the record for audit trails.
   */
  async archivePayment(id: string, actor: AuthUser) {
    const payment = await prisma.payment.findFirst({ where: { id, deletedAt: null } });
    if (!payment) throw new HttpError(404, "NOT_FOUND", "Payment not found");

    const updated = await prisma.payment.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: actor.id },
    });

    await auditLog.record({
      userId: actor.id,
      action: "payment.archived",
      entity: "Payment",
      entityId: id,
      oldValue: { amount: payment.amount, status: payment.status },
    });
    return updated;
  },
};
