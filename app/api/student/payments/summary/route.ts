import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentPaymentService } from "@/lib/services/student-payments";

export const dynamic = "force-dynamic";

/**
 * GET /api/student/payments/summary
 *
 * Returns the financial summary for the caller: totalAmount, paid,
 * outstanding, pending, currency, invoiceCount, paymentCount, and
 * the nextOpenInvoice (the invoice with the earliest due date that
 * still has an outstanding balance).
 *
 * ALL totals are computed server-side from the Invoice + Payment
 * tables. The client NEVER sends totals — they're always derived
 * from DB state. This is the single source of truth for "how much
 * does the student owe?".
 *
 * Calculations:
 *  - totalAmount: sum of non-DRAFT, non-CANCELLED invoice totals
 *  - paid: sum of non-CANCELLED invoice paidAmounts
 *  - outstanding: sum of non-DRAFT, non-CANCELLED invoice dueAmounts
 *  - pending: sum of PENDING payments (not yet confirmed)
 */
export async function GET(_req: NextRequest) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const summary = await studentPaymentService.getSummary(g.student.id);
    return ok({ summary });
  } catch (err) {
    return handleApiError(err);
  }
}
