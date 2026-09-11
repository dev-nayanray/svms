import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentPaymentService } from "@/lib/services/student-payments";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/student/payments/[id]
 *
 * Returns the full detail view of one payment: amount, currency,
 * payment method, status, transactionReference (masked for PENDING/
 * CANCELLED), payment date, linked application + invoice.
 *
 * Ownership is verified server-side: the query is scoped by
 * `studentId` from the session. A foreign `id` returns null → 404
 * (NOT_FOUND, never 403 — the existence of another student's payment
 * is never confirmed).
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const { id } = await params;
    const payment = await studentPaymentService.getById(g.student.id, id);
    if (!payment) {
      return fail("NOT_FOUND", "Payment not found", 404);
    }
    return ok({ payment });
  } catch (err) {
    return handleApiError(err);
  }
}
