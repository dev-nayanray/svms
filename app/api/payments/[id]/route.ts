import { NextRequest } from "next/server";
import { ok, handleApiError, notFound } from "@/lib/api";
import { guard } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { paymentUpdateSchema } from "@/lib/validations";
import { invoiceService } from "@/lib/services/finance";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Get a single payment with student + application + invoice joins.
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("finance.read");
    if (g.error) return g.error;
    const { id } = await params;

    const payment = await prisma.payment.findFirst({
      where: { id },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, studentId: true },
        },
        application: {
          select: { id: true, applicationNumber: true },
        },
        invoice: {
          select: { id: true, invoiceNumber: true, total: true, dueAmount: true },
        },
      },
    });
    if (!payment) throw notFound("Payment");
    return ok(payment);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Edit a payment's editable fields (amount, method, reference, date).
 * Delegates to `invoiceService.updatePayment` which recalculates the
 * linked invoice's paid/due/status when the amount changes. Refunded
 * payments cannot be edited.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("finance.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const body = paymentUpdateSchema.parse(await req.json());
    const updated = await invoiceService.updatePayment(id, body, g.user);
    return ok(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Archive (soft-delete) a payment. Financial records are never
 * hard-deleted — this retains the record for audit trails.
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await guard("finance.manage");
    if (g.error) return g.error;
    const { id } = await params;
    const archived = await invoiceService.archivePayment(id, g.user);
    return ok({ archived: true, deletedAt: archived.deletedAt });
  } catch (err) {
    return handleApiError(err);
  }
}
