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
    actor: AuthUser
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
    actor: AuthUser
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
          `Payment exceeds due amount (${invoice.dueAmount})`
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
      newValue: { amount: input.amount, method: input.paymentMethod },
    });
    return payment;
  },
};
