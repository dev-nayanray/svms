import { NextRequest } from "next/server";
import { ok, handleApiError, fail } from "@/lib/api";
import { studentApiGuard } from "@/lib/student/guard";
import { studentInvoiceService } from "@/lib/services/student-invoices";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/student/invoices/[id]
 *
 * Returns the full invoice detail: items (line-item breakdown),
 * subtotal, discount, total, paidAmount, dueAmount, issueDate,
 * dueDate, student information, linked application, and payment
 * history. All financial values are server-side.
 *
 * Ownership is verified server-side: the query is scoped by
 * `studentId` from the session AND excludes DRAFT invoices. A foreign
 * `id` returns null → 404 (NOT_FOUND, never 403 — the existence of
 * another student's invoice is never confirmed).
 *
 * Payment `transactionReference` is masked for PENDING/CANCELLED
 * payments (same rule as Module 11).
 */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const g = await studentApiGuard();
    if (!g.ok) return g.error;

    const { id } = await params;
    const invoice = await studentInvoiceService.getById(g.student.id, id);
    if (!invoice) {
      return fail("NOT_FOUND", "Invoice not found", 404);
    }
    return ok({ invoice });
  } catch (err) {
    return handleApiError(err);
  }
}
