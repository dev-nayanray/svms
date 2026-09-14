import { NextRequest } from "next/server";
import { ok, handleApiError } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentPaymentService } from "@/lib/services/student-payments";

export const dynamic = "force-dynamic";

/**
 * GET /api/student/payments
 *
 * Returns ALL payments for the caller, scoped by `studentId` from the
 * session. Each payment includes the linked application + invoice
 * summary. The `transactionReference` is shown for PAID/PARTIAL/
 * REFUNDED payments but masked (null) for PENDING/CANCELLED.
 *
 * Internal fields (`createdById`, `deletedAt`, `deletedBy`) are never
 * on the wire. Students CANNOT create, update, delete, or refund
 * payments — this route is GET-only. Payment management goes through
 * the admin `/api/payments` routes (ADMIN only, `finance.manage`).
 *
 * All financial totals are computed server-side — the client never
 * sends totals.
 */
export async function GET(_req: NextRequest) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const payments = await studentPaymentService.list(g.student.id);
    return ok({ payments });
  } catch (err) {
    return handleApiError(err);
  }
}
